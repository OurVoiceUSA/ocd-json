## Open Civic Data

Prefixed with `ocd-division`, the Open Civic Data standard defines public office with predictable names and paths. This repository builds and publishes division geography files & representative info with the OCD standard and the google-civics JSON schema.

The path to each file is the ocd-id with the `:` changed to `/`, and has up to 4 files: `division.json`, `officials.json`, `rtree.json`, and `shape.geojson`

Upon build, the file most likely to change is the `officials.json` as various divisions rarely update what offices they have, and the shape of the division.

`division.json` is separated from `officials.json` to better track changes to the division spec itself, and only changes when its offices change, or we add a previously untracked office.

`rtree.json` is built from the collection of `shape.geojson` files under its directory structure, is only needed at the country & state levels, and only updates whenever a subordinate shapefile changes.

## Examples

| Legislative Division | ocd-id | file path prefix |
|---|---|---|
| State of Utah | `ocd-division/country:us/state:ut` | `/ocd-division/country/us/state/ut/` |
| Utah Congressional District 3 | `ocd-division/country:us/state:ut/cd:3` | `/ocd-division/country/us/state/ut/cd/3/` |
| Utah State House District 11 | `ocd-division/country:us/state:ut/sldl:11` | `ocd-division/country/us/state/ut/sldl/11/` |

## TODO

* Add scripts to populate `officials.json` files from 3rd party sources
* Scripts to update geojson shapefiles (initial import was from @unitedstates/districts)
* Add county & place district types for local offices
* Handle null rtree.json (territories & such)
* Test automation
* Better documentation
* Probably lots more things

