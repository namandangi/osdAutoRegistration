var request = require('request');
var as = require('async');
var fs = require('fs');
var dsaItems = require('./dsa-items');

// ----------
function dsaTileSource(item, callback) {
  //this formats an item ID from a GIRDER based DSA instance into an OSD friendly
  //tilesource
  //need to get the tiles.sizeX from the thumbnail url

  var url = item.baseURL + '/item/' + item.itemId + '/tiles';
  console.log('loading', url);

  var options = {
    url: url,
    json: true,
    method: 'GET'
  };

  request(options, function(err, response, body) {
    if (err) {
      console.log('error getting', url, err);
    } else {
      var tiles = body;
      // console.log(tiles);

      item.tileSource = {
        width: tiles.sizeX,
        height: tiles.sizeY,
        tileWidth: tiles.tileWidth,
        tileHeight: tiles.tileHeight,
        minLevel: 0,
        maxLevel: tiles.levels - 1
      };

      callback();
    }
  });
}

// ----------
var config = {};
config.BASE_URL = 'http://dermannotator.org:8080/api/v1';
var output = [];

as.eachSeries(
  dsaItems,
  function(item, next) {
    item.baseURL = item.baseURL || config.BASE_URL;
    dsaTileSource(item, function() {
      output.push(item);
      next();
    });
  },
  function() {
    var text =
      '// this file is generated automatically by util/build-tilesources.js; do not edit directly\n\nApp.dsaItems = ' +
      JSON.stringify(output, null, 2) +
      ';\n';

    fs.writeFileSync('js/dsa-items.js', text);
    console.log('done');
  }
);
