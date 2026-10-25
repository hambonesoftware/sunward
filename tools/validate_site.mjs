import assert from 'node:assert/strict';
import {readFile,stat,readdir} from 'node:fs/promises';
import {join,relative,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {startServer} from './serve.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const publicRoot=join(root,'public');
const data=JSON.parse(await readFile(join(publicRoot,'data/michigan-dem.json'),'utf8'));
const profile=JSON.parse(await readFile(join(publicRoot,'data/michigan-world.json'),'utf8'));

assert.equal(data.width,129);
assert.equal(data.height,129);
assert.equal(data.samples.length,data.height);
assert(data.samples.every(row=>row.length===data.width));
assert(data.minimum>=170&&data.maximum<=300&&data.maximum-data.minimum>35);
assert(data.source.includes('USGS'));
assert.equal(data.bounds.west,-86.256);
assert(profile.species.length>=7);
assert(profile.residents.length>=6);
for(const resident of profile.residents){
  assert(resident.schedule.length>=4,`Schedule missing for ${resident.name}`);
  assert(resident.schedule.every(s=>s.hour>=0&&s.hour<24),`Invalid hour for ${resident.name}`);
}

async function listModules(directory) {
  const result=[];
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const path=join(directory,entry.name);
    if(entry.isDirectory())result.push(...await listModules(path));
    else if(entry.name.endsWith('.js'))result.push(path);
  }
  return result;
}
const modules=await listModules(join(publicRoot,'src'));
assert(modules.length>=10);
for(const path of modules) {
  const source=await readFile(path,'utf8');
  for(const match of source.matchAll(/from\s+['"]([^'"]+)['"]/g)) {
    if(match[1]==='three')continue;
    assert(match[1].startsWith('.'),`Non-local dependency in ${relative(root,path)}: ${match[1]}`);
    const dependency=resolve(dirname(path),match[1]);
    const info=await stat(dependency);
    assert(info.isFile(),`Broken import in ${relative(root,path)}`);
  }
}
await stat(join(publicRoot,'vendor/three.module.js'));
await stat(join(publicRoot,'vendor/three.core.js'));
await stat(join(publicRoot,'vendor/THREE-LICENSE.txt'));

const server=startServer(0);
await new Promise(resolveReady=>server.once('listening',resolveReady));
try{
  for(const path of ['/','/styles.css','/src/main.js','/data/michigan-dem.json','/vendor/three.module.js','/vendor/three.core.js']){
    const response=await fetch(`http://127.0.0.1:${server.address().port}${path}`);
    assert.equal(response.status,200,`${path} failed HTTP check`);
  }
}finally{server.close();}

console.log(`Validated: ${modules.length} ES modules, real USGS ${data.width}×${data.height} DEM (${data.minimum}–${data.maximum}m), ${profile.species.length} regional species, ${profile.residents.length} scheduled residents, six HTTP asset routes.`);
