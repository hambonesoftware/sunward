import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
const root=new URL('../public/',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const dem=await read('data/stony-creek-dem.json');
const osm=await read('data/stony-creek-map.json');
assert.equal(dem.width,257);
assert.equal(dem.height,257);
assert(dem.samples.length===257);
assert(dem.samples.every(row=>row.length===257&&row.every(Number.isFinite)));
assert(Math.abs(dem.bounds.west+83.125)<.001);
assert(Math.abs(dem.bounds.north-42.787)<.001);
assert(/USGS|Mapzen/i.test(dem.source),'Must use a real-elevation source');
assert(dem.maximum-dem.minimum>10,'DEM must have real relief');
assert(osm.paths.length>10,'Expected real walking/cycling paths');
assert(osm.paths.every(path=>path.coords.length>=2));
assert(osm.source.includes('OpenStreetMap'));
for(const path of ['src/world/StonyTerrain.js','src/world/StonyPlants.js','src/world/StonyTrails.js','src/main.js']){
  assert((await stat(new URL(path,root))).size>500);
}
const main=await readFile(new URL('src/main.js',root),'utf8');
const html=await readFile(new URL('index.html',root),'utf8');
assert(!/QuestJournal|new Village|new Residents|Meet June|quest-title|journal-footer/.test(main+html));
assert(main.includes('new StonyTerrain'));
assert(html.includes('Stony Creek'));
assert(!html.includes('goals window'));
console.log('Stony Creek verified:',dem.source,
  dem.minimum.toFixed(1)+'–'+dem.maximum.toFixed(1)+'m;',
  osm.paths.length+' mapped ways, '+osm.water.length+' water polygons, '+
  osm.habitats.length+' habitat areas.');
