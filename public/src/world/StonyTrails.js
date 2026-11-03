import * as THREE from 'three';
import {project} from './StonyTerrain.js';

// Measured centerlines are from OpenStreetMap. Visual path widths are inferred
// from highway class when no explicit width is present in source GIS data.
const TYPES={
  path:{width:2.1,color:'#a99a7c'},
  footway:{width:2.3,color:'#b8ad95'},
  cycleway:{width:3.2,color:'#999a8b'},
  track:{width:3.1,color:'#a89474'},
  pedestrian:{width:3.3,color:'#b3aa95'},
  service:{width:4.8,color:'#858786'},
  residential:{width:5.5,color:'#8a8d87'}
};
const SURFACES={
  asphalt:'#747c7b',concrete:'#a2a29b',
  gravel:'#aaa28d',dirt:'#8b775e',sand:'#c5b48b',
  wood:'#9c8566'
};
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
const MAX_STEP=4; // meters between successive ground samples
function surfaceKind(path){
  const s=(path.surface||'').toLowerCase();
  if(/asphalt/.test(s))return 'asphalt';
  if(/concrete|paving_stones|sett/.test(s))return 'concrete';
  if(/fine_gravel|gravel|pebblestone|compacted/.test(s))return 'gravel';
  if(/sand/.test(s))return 'sand';
  if(/wood|boardwalk/.test(s))return 'wood';
  if(/dirt|earth|ground|mud|soil|grass/.test(s))return 'dirt';
  return 'default-'+path.kind;
}
function widthFor(path){
  const style=TYPES[path.kind]||TYPES.path;
  const match=/^\s*(\d+(?:\.\d+)?)\s*(m|meters?)?\s*$/i.exec(path.width||'');
  return match?clamp(Number(match[1]),.7,9):style.width;
}
function resample(points){
  const result=[points[0]];
  for(let i=1;i<points.length;i++){
    const a=points[i-1],b=points[i];
    const distance=Math.hypot(b.x-a.x,b.z-a.z);
    if(distance<.05||distance>1000)continue;
    const count=Math.ceil(distance/MAX_STEP);
    for(let step=1;step<=count;step++){
      const t=step/count;
      result.push({x:a.x+(b.x-a.x)*t,z:a.z+(b.z-a.z)*t});
    }
  }
  return result;
}
export class StonyTrails{
  constructor(scene,terrain,map){
    this.terrain=terrain;
    this.group=new THREE.Group();scene.add(this.group);
    this.lines=[];
    this.cell=70;
    this.grid=new Map();
    const buckets=new Map();
    for(const path of map.paths||[]){
      if(path.foot==='no')continue;
      const points=path.coords.map(([lon,lat])=>project(lon,lat,terrain.bounds))
        .filter(p=>terrain.positionInBounds(p.x,p.z,0));
      if(points.length<2)continue;
      const style=TYPES[path.kind]||TYPES.path;
      const width=widthFor(path);
      this.lines.push({points,name:path.name,kind:path.kind,width,surface:path.surface});
      for(let i=1;i<points.length;i++)this.indexSegment(points[i-1],points[i]);
      const sampled=resample(points);
      if(sampled.length<2)continue;
      const kind=surfaceKind(path),color=SURFACES[kind]||style.color;
      if(!buckets.has(kind))buckets.set(kind,{positions:[],uvs:[],indices:[],color});
      const bucket=buckets.get(kind),base=bucket.positions.length/3;
      let progress=0;
      for(let i=0;i<sampled.length;i++){
        const point=sampled[i],previous=sampled[Math.max(0,i-1)],
          next=sampled[Math.min(sampled.length-1,i+1)];
        const dx=next.x-previous.x,dz=next.z-previous.z;
        const length=Math.hypot(dx,dz)||1;
        const nx=-dz/length,nz=dx/length;
        if(i>0)progress+=Math.hypot(point.x-previous.x,point.z-previous.z);
        // Left and right shoulders sample their *own* heights every 4 m.
        // Avoids the floating straight segments of the earlier ribbon mesh.
        for(const sign of [1,-1]){
          const x=point.x+sign*nx*width*.5,z=point.z+sign*nz*width*.5;
          bucket.positions.push(x,terrain.surfaceAt(x,z)+.14,z);
          bucket.uvs.push(progress/3,sign>0?0:1);
        }
        if(i>0){
          const a=base+(i-1)*2,b=a+2;
          bucket.indices.push(a,b,a+1,a+1,b,b+1);
        }
      }
    }
    for(const bucket of buckets.values()){
      if(!bucket.positions.length)continue;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(bucket.positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(bucket.uvs,2));
      geometry.setIndex(bucket.indices);
      geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
        color:bucket.color,roughness:1,metalness:0,side:THREE.DoubleSide,
        polygonOffset:true,polygonOffsetFactor:-2,polygonOffsetUnits:-2
      }));
      mesh.receiveShadow=true;
      this.group.add(mesh);
    }
  }
  indexSegment(a,b){
    const distance=Math.hypot(b.x-a.x,b.z-a.z);
    if(distance<.05||distance>1000)return;
    const cx1=Math.floor(Math.min(a.x,b.x)/this.cell)-1,
          cx2=Math.floor(Math.max(a.x,b.x)/this.cell)+1;
    const cz1=Math.floor(Math.min(a.z,b.z)/this.cell)-1,
          cz2=Math.floor(Math.max(a.z,b.z)/this.cell)+1;
    for(let x=cx1;x<=cx2;x++)for(let z=cz1;z<=cz2;z++){
      const key=x+','+z;
      if(!this.grid.has(key))this.grid.set(key,[]);
      this.grid.get(key).push([a,b]);
    }
  }
  nearPath(x,z,distance){
    const cell=this.grid.get(Math.floor(x/this.cell)+','+Math.floor(z/this.cell));
    if(!cell)return false;
    for(const [a,b] of cell){
      const dx=b.x-a.x,dz=b.z-a.z;
      const t=clamp(((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
      if(Math.hypot(x-(a.x+dx*t),z-(a.z+dz*t))<distance)return true;
    }
    return false;
  }
}
