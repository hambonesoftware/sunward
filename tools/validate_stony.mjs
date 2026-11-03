import assert from 'node:assert/strict';
import {readFile,stat} from 'node:fs/promises';
import {decodeElevation,bilinearElevation} from '../public/src/world/StonyElevation.js';
const root=new URL('../public/',import.meta.url);
const read=async path=>JSON.parse(await readFile(new URL(path,root),'utf8'));
const dem=await read('data/stony-creek-dem.json');
const osm=await read('data/stony-creek-map.json');
assert.equal(dem.width,1025);
assert.equal(dem.height,1025);
assert.equal(dem.encoding.type,'uint16-le');
const raster=await readFile(new URL('data/'+dem.encoding.file,root));
const elevation=decodeElevation(dem,raster.buffer.slice(raster.byteOffset,raster.byteOffset+raster.byteLength));
assert.equal(elevation.heights.length,1025*1025);
assert(elevation.heights.some(v=>v>100));
const widthMeters=(dem.bounds.east-dem.bounds.west)*111320*Math.cos((dem.bounds.north+dem.bounds.south)*Math.PI/360);
const depthMeters=(dem.bounds.north-dem.bounds.south)*111132;
for(const [x,z] of [[0,0],[-widthMeters/3,depthMeters/3],[widthMeters/3,-depthMeters/3]]){
  const sample=bilinearElevation(elevation,x,z,widthMeters,depthMeters);
  assert(Number.isFinite(sample)&&sample>=dem.minimum-.05&&sample<=dem.maximum+.05);
}
assert(dem.gridSpacingMeters.eastWest<10);
assert(dem.gridSpacingMeters.northSouth<10);
assert(/resolution/i.test(dem.resolutionNote));
assert(Math.abs(dem.bounds.west+83.125)<.001);
assert(Math.abs(dem.bounds.north-42.787)<.001);
assert(/USGS|Mapzen/i.test(dem.source),'Must use a real-elevation source');
assert(dem.maximum-dem.minimum>10,'DEM must have real relief');
assert(osm.paths.length>10,'Expected real walking/cycling paths');
assert(osm.paths.every(path=>path.coords.length>=2));
assert(osm.paths.every(path=>typeof path.surface==='string'));
const terrainSource=await readFile(new URL('src/world/StonyTerrain.js',root),'utf8');
const trailsSource=await readFile(new URL('src/world/StonyTrails.js',root),'utf8');
assert(terrainSource.includes('updateDetail(position)'),'Missing moving detailed terrain tiles');
assert(trailsSource.includes('MAX_STEP=4'),'Missing 4 m trail subdivision');
assert(trailsSource.includes('terrain.surfaceAt(x,z)'),'Trails must drape over terrain');
assert(osm.source.includes('OpenStreetMap'));
for(const path of ['src/world/StonyTerrain.js','src/world/StonyPlants.js','src/world/StonyTrails.js','src/main.js']){
  assert((await stat(new URL(path,root))).size>500);
}

const zones=await read('data/stony-foliage-zones.json');
const catalog=await read('data/stony-foliage-assets.json');
assert.equal(zones.version,2);
assert.equal(zones.zones.length,5);
assert.equal(zones.biomes.forest.treeDensity,1);
const ids=new Set();
for(const zone of zones.zones){
  assert(!ids.has(zone.id),'Duplicate zone '+zone.id);
  ids.add(zone.id);
  assert(zone.radiusMeters>=350);
  assert(zone.treeCandidates>0&&zone.grassClumps>0);
  assert(zone.trailClearanceMeters.tree>=5);
  assert(Math.abs(Object.values(zone.treeWeights).reduce((sum,value)=>sum+value,0)-100)<.001);
}
assert.equal(catalog.version,2);
assert(catalog.live.length>=18);
for(const asset of catalog.live){
  const info=await stat(new URL('assets/'+asset.file.replace(/^assets\//,''),root));
  assert(info.isFile(),'Missing active foliage asset: '+asset.file);
}
for(const component of ['StonyFoliagePass2','StonyTreeLibrary','StonyBiomeRules',
  'StonyGroundCover','StonyUnderstory','StonyLOD']){
  const info=await stat(new URL('src/world/'+component+'.js',root));
  assert(info.size>500,'Missing Pass 2 module '+component);
}
const main=await readFile(new URL('src/main.js',root),'utf8');
const html=await readFile(new URL('index.html',root),'utf8');
assert(!/QuestJournal|new Village|new Residents|Meet June|quest-title|journal-footer/.test(main+html));
assert(main.includes('new StonyTerrain'));
assert(main.includes('new StonyFoliagePass2'),'Pass 2 not wired into active explorer');
assert(!main.includes('new StonyPlants('),'Old low-poly tree system still active');
assert(html.includes('Stony Creek'));
assert(!html.includes('goals window'));
console.log('Foliage Pass 2 verified:',zones.zones.length,'zones,',catalog.live.length,'live assets');
console.log('Stony Creek verified:',dem.width+'x'+dem.height+' raster,',dem.source,
  dem.minimum.toFixed(1)+'–'+dem.maximum.toFixed(1)+'m;',
  osm.paths.length+' mapped ways, '+osm.water.length+' water polygons, '+
  osm.habitats.length+' habitat areas.');
