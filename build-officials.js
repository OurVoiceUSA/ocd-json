
import fetch from 'node-fetch';
import sha1 from 'sha1';
import fs from 'fs';

var pol = {};
var div = {};

processAll();

async function processAll() {

  await processUSLC();

  // TODO: use other sources

  // TODO: write to divisions.json

  // write to officials.json
  Object.keys(div).forEach(d => {
    let pols = [];
    div[d].forEach(id => pols.push(pol[id]));
    let file = d.replace(/:/g, '/')+'/officials.json';
    fs.writeFileSync(file, JSON.stringify(pols));
  });

  process.exit(0);
}

async function processUSLC() {
  let response, json;

  try {

    response = await fetch(
      "https://theunitedstates.io/congress-legislators/legislators-district-offices.json",
      {compress: true}
    );
    json = await response.json();

    let offices = {};

    json.forEach(o => {
      offices[o.id.bioguide] = o.offices;
    });

    response = await fetch(
      "https://theunitedstates.io/congress-legislators/legislators-current.json",
      {compress: true}
    );
    json = await response.json();

/*
  input format:

  {
    "id": {
      "bioguide": "",
      "thomas": "",
      "lis": "",
      "govtrack": <>,
      "opensecrets": "",
      "votesmart": <>,
      "fec": [""],
      "cspan": <>,
      "wikipedia": "",
      "house_history": <>,
      "ballotpedia": "",
      "maplight": <>,
      "icpsr": <>,
      "wikidata": "",
      "google_entity_id": ""
    },
    "name": {
      "first": "",
      "last": "",
      "official_full": ""
    },
    "bio": {
      "birthday": "",
      "gender": ""
    },
    "terms": [
      {
        "type": "",
        "start": "",
        "end": "",
        "state": "",
        "district": <>,
        "party": "",
        "url": "",
        "address": "",
        "phone": "",
        "fax": "",
        "contact_form": "",
        "office": "",
        "state_rank": "",
        "rss_url": "'
      },
    ]
  },
*/

    for (let i in json) {
      let obj = json[i];
      try {
        let term = obj.terms[obj.terms.length-1];
        let div = 'ocd-division/country:us/state:'+term.state.toLowerCase()+((term.type == 'rep' && term.district)?'/cd:'+term.district:'');

        // TODO: validate div

        let id = sha1(div+":"+obj.name.last.toLowerCase().trim()+":"+obj.name.first.toLowerCase().trim());

        polGen(id, div);
        polProp(id, 'name', obj.name.official_full);
        polProp(id, 'party', term.party);
        polProp(id, 'phones', term.phone);
        // this data set doesn't contain email address
        polProp(id, 'urls', term.url);
        // no social media either
        polSource(id, 'theunitedstates.io');

        if (offices[obj.id.bioguide])
          offices[obj.id.bioguide].forEach(o => polAddress(id, o));

        } catch (e) {
          console.log("Unable to parse uslc record: %j", obj);
          console.log(e);
        }

      }
  } catch (e) {
    console.log(e);
  }

}

function polGen(id, did) {
  if (pol[id]) return;
  if (!div[did]) div[did] = [];

  div[did].push(id);

  pol[id] = {
   "name": "",
   "address": [],
   "party": "",
   "phones": [],
   "emails": [],
   "urls": [],
   "photoUrl": "",
   "channels": [],
   "sources": [],
  };
}

function polSource(id, input) {
  pol[id].sources.push(input);
}

function polProp(id, key, val) {
  // based on prop key, assort the input
  switch (key) {
    case 'party':
      if (val === 'Democrat') val = 'Democratic';
      break;
    default: break;
  }

  // TODO: push if not in / set if not set
  if (typeof pol[id][key] === "string") pol[id][key] = val;
  else pol[id][key].push(val);
}

function polAddress(id, input) {
  pol[id].address.push({
    line1: input.address,
    line2: input.suite,
    line3: input.building,
    city: input.city,
    state: input.state,
    zip: input.zip,
    phone: input.phone,
    longitude: input.longitude,
    latitude: input.latitude,
  });
}

