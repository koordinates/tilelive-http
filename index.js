"use strict";

var http = require("http"),
    url = require("url");
var request = require("request");
var version = require("./package.json").version;

http.globalAgent.maxSockets = 100;

module.exports = function(tilelive, options) {
  var HttpSource = function(uri, callback) {
    this.source = url.format(uri);

    if (!(this.source.match(/{z}/) &&
        this.source.match(/{x}/) &&
        this.source.match(/{y}/))) {
      console.log("Coordinate placeholders missing; assuming %s is a TileJSON endpoint (tilejson+).", this.source);

      return tilelive.load("tilejson+" + this.source, callback);
    }

    return callback(null, this);
  };

  HttpSource.prototype.getTile = function(z, x, y, callback) {
    var tileUrl = this.source
      .replace(/{z}/i, z)
      .replace(/{x}/i, x)
      .replace(/{y}/i, y);

    var headers = {
      "User-Agent": "tilelive-http/" + version
    };

    return request.get({
      uri: tileUrl,
      encoding: null,
      headers: headers
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

  HttpSource.registerProtocols(tilelive);

  return HttpSource;
};
