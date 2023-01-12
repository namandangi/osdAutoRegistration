var request = require('request');
var fs = require('fs');
var dsaItems = require('./dsa-items');

// ----------
var groupName = 'SMM204_POST_F';

// Remove the existing items from this group so we don't end up with duplicates
dsaItems = dsaItems.filter(function(item) {
  return item.groupName !== groupName;
});

var url =
  'http://candygram.neurology.emory.edu:8080/api/v1/item?folderId=5c5a07c3e62914004dbbaeef&limit=50&sort=lowerName&sortdir=1';
var options = {
  url: url,
  json: true,
  method: 'GET'
};

request(options, function(err, response, body) {
  if (err) {
    console.log('error getting', url, err);
  } else {
    var items = body;
    var nextIndex = 0;

    items.forEach(function(item) {
      if (!item.largeImage) {
        return;
      }

      if (!item._id || !item.name) {
        console.log('Bad item', item);
        return;
      }

      if (!/^CBB_5295_F/.test(item.name)) {
        console.log('Expecting CBB_5295_F but found', item.name);
        return;
      }

      var stain = item.name.replace(/^CBB_5295_F_(.*?)\..*$/, '$1');
      if (stain === item.name) {
        console.log('Unable to find stain in', item.name);
        return;
      }

      var newItem = {
        groupName: groupName,
        index: nextIndex,
        itemId: item._id,
        name: item.name,
        specimenId: 'CBB_5295_F',
        stain: stain,
        baseURL: 'http://candygram.neurology.emory.edu:8080/api/v1'
      };

      dsaItems.push(newItem);
      nextIndex++;
    });

    var text = 'module.exports = ' + JSON.stringify(dsaItems, null, 2) + ';\n';
    fs.writeFileSync('util/dsa-items.js', text);
    console.log('done');
  }
});
