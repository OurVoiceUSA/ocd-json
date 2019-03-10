
import fetch from 'node-fetch';
import csvjson from 'csvjson';
import sha1 from 'sha1';
import fs from 'fs';

var pol = {};
var div = {};
var ocd = {};

processAll();

async function processAll() {

  await processOCDID();
  await processUSLC();

  // TODO: use other sources

  // write to division.json
  Object.keys(div).forEach(d => {
    let offices = [], office_names = [];;
    let scope;

    // NOTE: officialIndices is missing here because it's up to the caller to build that index

    div[d].forEach(id => {
      let o = officeFromKey(pol[id].officekey, null, pol[id].districtkey);
      if (office_names.indexOf(o.name) === -1) {
        offices.push(o);
        office_names.push(o.name);
      }
    });

    switch (true) {
      case /\/county:/.test(d): scope = 'countywide'; break;
      case /\/place:/.test(d): scope = 'citywide'; break;
      case /\/sldl:/.test(d): scope = 'stateLower'; break;
      case /\/sldu:/.test(d): scope = 'stateUpper'; break;
      case /\/cd:/.test(d): scope = 'congressional'; break;
      case /\/state:/.test(d): scope = 'statewide'; break;
      case /ocd-division\/country:us$/.test(d): scope = 'national'; break;
      default: scope = 'unknown'; break;
    }

    let division = {
      name: ocd[d],
      scope: scope,
      offices: offices,
    };

    let file = d.replace(/:/g, '/')+'/division.json';
    fs.writeFileSync(file, JSON.stringify(division));
  });

  // write to officials.json
  Object.keys(div).forEach(d => {
    let pols = [];
    div[d].forEach(id => {
      pol[id].office = officeFromKey(pol[id].officekey, null, pol[id].districtkey);
      // delete custom keys here
      delete pol[id].officekey;
      delete pol[id].districtkey;
      pols.push(pol[id])
    });
    let file = d.replace(/:/g, '/')+'/officials.json';
    fs.writeFileSync(file, JSON.stringify(pols));
  });

  process.exit(0);
}

async function processOCDID() {
  try {
    // if we already have this locally, no need to fetch
    ocd = JSON.parse(fs.readFileSync('./ocd-country-us.json'));
    return ocd;
  } catch(e) {}

  const response = await fetch(
    "https://raw.githubusercontent.com/opencivicdata/ocd-division-ids/master/identifiers/country-us.csv",
    {compress: true}
  );
  const csv = await response.text();
  const json = csvjson.toObject(csv, {});

  json.forEach(j => ocd[j.id] = j.name);
  fs.writeFileSync('./ocd-country-us.json', JSON.stringify(ocd));
}

async function processUSLC() {
  let response, json;

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

  json.forEach(obj => {
    let term = obj.terms[obj.terms.length-1];
    let div = 'ocd-division/country:us/state:'+term.state.toLowerCase()+((term.type == 'rep' && term.district)?'/cd:'+term.district:'');

    if (!ocd[div]) throw "Invlid div "+div;

    let id = sha1(div+":"+obj.name.last.toLowerCase().trim()+":"+obj.name.first.toLowerCase().trim());

    polGen(id, div);
    polProp(id, 'name', obj.name.official_full);
    polProp(id, 'party', term.party);
    polProp(id, 'phones', term.phone);
    // this data set doesn't contain email address
    polProp(id, 'urls', term.url);
    // no social media either
    polSource(id, 'theunitedstates.io');
    polProp(id, 'officekey', 'us'+term.type);
    if (term.district)
      polProp(id, 'districtkey', term.state+'-'+term.district);

    if (offices[obj.id.bioguide])
      offices[obj.id.bioguide].forEach(o => polAddress(id, o));
  });
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
   // below here is custom to us
   "officekey": "",
   "districtkey": "",
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

function officeFromKey(key, state, dist) {
  // TODO: "name" can sometimes be based on what state this is
  switch (key) {
    case 'ussen':
      return {
        name: "United States Senate",
        level: "federal",
      };
    case 'usrep':
      return {
        name: "United States House of Representatives"+(dist?" "+dist:""),
        level: "federal",
      };
    case 'gov':
      return {
        name: "Governor",
        level: "state",
      };
  }
}

