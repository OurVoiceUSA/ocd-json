/*
to run this script, do this one-time step:

* npm install

then:

* node node_modules/@babel/node/lib/_babel-node build-rtree.js

*/

import fs from 'fs';
import rbush from 'rbush';
import bbox from 'geojson-bbox';

// top level tree
var tree = rbush();

doYerThang();

async function doYerThang() {

  fs.readdirSync('./ocd-division/country/us/state/').forEach(state => {
    geojson2rtree('./ocd-division/country/us/state/'+state+'/shape.geojson', state, 'state', state);
  });

  fs.writeFileSync('./ocd-division/country/us/rtree.json', JSON.stringify(tree.toJSON()));
  console.log('Wrote rtree.json for us');

  fs.readdirSync('./ocd-division/country/us/state/').forEach(state => {
    // new rtree for this state
    tree = rbush();

    fs.readdirSync('./ocd-division/country/us/state/'+state).forEach(type => {
      // is not a directory if it has a file extention
      if (type.match(/\./)) return;

      fs.readdirSync('./ocd-division/country/us/state/'+state+'/'+type).forEach(dist => {
        geojson2rtree('./ocd-division/country/us/state/'+state+'/'+type+'/'+dist+'/shape.geojson', state, type, dist);
      });

    });

    fs.writeFileSync('./ocd-division/country/us/state/'+state+'/rtree.json', JSON.stringify(tree.toJSON()));
    console.log('Wrote rtree.json for '+state);

  });

  process.exit(0);
}

function geojson2rtree(file, state, type, name) {
  try {
    let geo;
    if (typeof file === 'object')
      geo = file;
    else
      geo = JSON.parse(fs.readFileSync(file))
    if (geo.geometry) geo = geo.geometry;
    let bb = bbox(geo);
    let obj = {minX: bb[0], minY: bb[1], maxX: bb[2], maxY: bb[3], state: state, type: type, name: name};
    if (type === 'state') obj.subtree = 'state/'+state+'/rtree.json';
    tree.insert(obj);
  } catch (e) {
    console.warn('Unable to process '+file);
    console.warn(e);
  }
}

