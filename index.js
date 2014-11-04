"use strict";

var http = require("http"),
    url = require("url"),
    backoff = require("backoff");
var request = require("request");
var version = require("./package.json").version;

http.globalAgent.maxSockets = 100;

var HttpSource = function(uri, callback) {
  this.source = url.format(uri);

  this.headers = {
    "User-Agent": "tilelive-http/" + version
  };
  if (process.env.TILELIVE_HTTP_HEADERS) {
    var envHeaders = JSON.parse(process.env.TILELIVE_HTTP_HEADERS);
    for (var key in envHeaders) {
      this.headers[key] = envHeaders[key];
    }
  }

  return callback(null, this);
};

HttpSource.prototype.getTile = function(z, x, y, callback) {
  var tileUrl = this.source
    .replace(/{z}/i, z)
    .replace(/{x}/i, x)
    .replace(/{y}/i, y);

  function get(callback) {
    return request.get({
      uri: tileUrl,
      encoding: null,
      headers: this.headers
    }, function(err, rsp, body) {
      if (err) {
        return callback(err);
      }

      switch (rsp.statusCode) {
      case 200:
        var rspHeaders = {
          "Content-Type": rsp.headers["content-type"]
        };

        return callback(null, body, rspHeaders);

      case 404:
        return callback(new Error('Tile does not exist'));

      default:
        return callback(new Error("Upstream error: " + rsp.statusCode));
      }
    });
  }

  var call = backoff.call(get, callback);
  call.setStrategy(new backoff.FibonacciStrategy({initialDelay:1000, maxDelay:60000}));
  call.failAfter(10);
  call.start();
};

HttpSource.prototype.getInfo = function(callback) {
  return callback(null, {
    format: url.parse(this.source).pathname.split(".").pop(),
    bounds: [-180, -85.0511, 180, 85.0511],
    minzoom: 0,
    maxzoom: Infinity
  });
};

HttpSource.prototype.close = function(callback) {
  callback = callback || function() {};

  return callback();
};

HttpSource.registerProtocols = function(tilelive) {
  tilelive.protocols["http:"] = HttpSource;
  tilelive.protocols["https:"] = HttpSource;
};

module.exports = HttpSource;
