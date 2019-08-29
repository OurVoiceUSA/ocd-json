/*
to run this script, do this one-time step:

* npm install

then:

* node node_modules/@babel/node/lib/_babel-node build-officials.js 

*/

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
  await processCSUSA();

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
    fs.writeFileSync(file, JSON.stringify(division, null, 2));
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
    fs.writeFileSync(file, JSON.stringify(pols, null, 2));
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
  fs.writeFileSync('./ocd-country-us.json', JSON.stringify(ocd, null, 2));
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
    "https://theunitedstates.io/congress-legislators/legislators-social-media.json",
    {compress: true}
  );
  json = await response.json();

  let sm = {};

  json.forEach(s => {
    sm[s.id.bioguide] = s.social;
  });

  response = await fetch(
    "https://theunitedstates.io/congress-legislators/executive.json",
    {compress: true}
  );
  json = await response.json();

  let prez = json.pop();
  let viceprez = json.pop();

  response = await fetch(
    "https://theunitedstates.io/congress-legislators/legislators-current.json",
    {compress: true}
  );
  json = await response.json();

  // push the executives onto this so they're caught in the loop
  json.push(prez);
  json.push(viceprez);

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
    let div = 'ocd-division/country:us';

    switch (term.type) {
      case 'rep':
        div = div+'/state:'+term.state.toLowerCase()+(term.district?'/cd:'+term.district:'');
        break;
      case 'sen':
        div = div+'/state:'+term.state.toLowerCase();
        break;
    }

    if (!ocd[div]) throw "Invlid div "+div;

    let id = sha1(div+":"+obj.name.last.toLowerCase().trim()+":"+obj.name.first.toLowerCase().trim());

    // execs don't have this prop -- SMH
    if (!obj.name.official_full) obj.name.official_full = obj.name.first+(obj.name.middle?' '+obj.name.middle:'')+' '+obj.name.last;

    polGen(id, div);
    polProp(id, 'name', obj.name.official_full);
    polProp(id, 'party', term.party);
    polProp(id, 'phones', term.phone);
    // this data set doesn't contain email address
    polProp(id, 'urls', term.url);
    if (obj.id.bioguide) polProp(id, 'photoUrl', 'https://theunitedstates.io/images/congress/450x550/'+obj.id.bioguide+'.jpg');
    polSource(id, 'theunitedstates.io');
    polProp(id, 'officekey', 'us'+term.type);
    if (term.district)
      polProp(id, 'districtkey', term.state+'-'+term.district);

    if (offices[obj.id.bioguide])
      offices[obj.id.bioguide].forEach(o => polAddress(id, o));

    if (sm[obj.id.bioguide]) {
      if (sm[obj.id.bioguide].twitter) polProp(id, 'channels', {type: "Twitter", id: sm[obj.id.bioguide].twitter});
      if (sm[obj.id.bioguide].facebook) polProp(id, 'channels', {type: "Facebook", id: sm[obj.id.bioguide].facebook});
      if (sm[obj.id.bioguide].youtube) polProp(id, 'channels', {type: "YouTube", id: sm[obj.id.bioguide].youtube});
      if (sm[obj.id.bioguide].instagram) polProp(id, 'channels', {type: "Instagram", id: sm[obj.id.bioguide].instagram});
    }
  });
}

async function processCSUSA() {
  let response, json;

  response = await fetch(
    "https://raw.githubusercontent.com/CivilServiceUSA/us-governors/master/us-governors/data/us-governors.json",
    {compress: true}
  );
  json = await response.json();

  json.forEach(obj => {
    let div = 'ocd-division/country:us/state:'+obj.state_code.toLowerCase();

    if (!ocd[div]) throw "Invlid div "+div;

    let id = sha1(div+":"+obj.last_name.toLowerCase().trim()+":"+obj.first_name.toLowerCase().trim());

    polGen(id, div);
    polProp(id, 'name', obj.name);
    polProp(id, 'party', ucfirst(obj.party));
    polProp(id, 'phones', obj.phone);
    // this data set doesn't contain email address
    polProp(id, 'urls', obj.website);
    polProp(id, 'photoUrl', obj.photo_url);
    if (obj.facebook_url) polProp(id, 'channels', {type: "Facebook", id: obj.facebook_url.split('/')[3]});
    if (obj.twitter_handle) polProp(id, 'channels', {type: "Twitter", id: obj.twitter_handle});
    polSource(id, 'civil.services');
    polProp(id, 'officekey', 'gov');
    // TODO: the address data here is a mess, need to figure it out
    // polAddress(id, {});
  });
}

function ucfirst(string) {
  return string.charAt(0).toUpperCase() + string.slice(1);
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
  // don't accept null or undefined values
  if (val === null || val === undefined) return;

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
    case 'usprez':
      return {
        name: "President",
        level: "federal",
      };
    case 'usviceprez':
      return {
        name: "Vice President",
        level: "federal",
      };
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

