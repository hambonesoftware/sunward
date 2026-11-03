import assert from 'node:assert/strict';
import {decodeElevation,bilinearElevation} from '../public/src/world/StonyElevation.js';
const metadata={
  width:3,height:3,bounds:{west:0,east:1,south:0,north:1},
  encoding:{type:'uint16-le',offset:200,scale:.01}
};
const input=new Uint8Array(18);
const view=new DataView(input.buffer);
for(let i=0;i<9;i++)view.setUint16(i*2,i*100,true);
const dem=decodeElevation(metadata,input.buffer);
assert.equal(dem.heights.length,9);
assert.equal(bilinearElevation(dem,-1,-1,2,2),200);
assert.equal(bilinearElevation(dem,1,1,2,2),208);
assert.equal(bilinearElevation(dem,0,0,2,2),204);
assert.equal(bilinearElevation(dem,0,-1,2,2),201);
assert.throws(()=>decodeElevation(metadata,new ArrayBuffer(3)),/Truncated/);
assert.throws(()=>decodeElevation({...metadata,encoding:{type:'float32',offset:0,scale:.01}},input.buffer),/Unsupported/);
console.log('Binary DEM decoding, interpolation and integrity tests passed');
