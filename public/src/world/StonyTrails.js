import * as THREE from 'three';
import {project} from './StonyTerrain.js';
const TYPES={
  path:{width:2.1,color:'#a99a7c'},
  footway:{width:2.3,color:'#b8ad95'},
  cycleway:{width:3.2,color:'#999a8b'},
  track:{width:3.1,color:'#a89474'},
  pedestrian:{width:3.3,color:'#b3aa95'},
  service:{width:4.8,color:'#858786'},
  residential:{width:5.5,color:'#8a8d87'}
};
function seeded(i){
  return Math.sin(i*143.31+4.2)*.5+.5;
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
      this.lines.push({points,name:path.name,kind:path.kind,width:style.width});
      const key=path.kind;
      if(!buckets.has(key))buckets.set(key,[]);
      for(let i=0;i<points.length-1;i++){
        const a=points[i],b=points[i+1];
        const length=Math.hypot(b.x-a.x,b.z-a.z);
        if(length<.4||length>500)continue;
        const nX=-(b.z-a.z)/length,nZ=(b.x-a.x)/length;
        const width=style.width;
        const yA=terrain.surfaceAt(a.x,a.z)+.09,yB=terrain.surfaceAt(b.x,b.z)+.09;
        const v=[
          [a.x+nX*width/2,yA,a.z+nZ*width/2],
          [a.x-nX*width/2,yA,a.z-nZ*width/2],
          [b.x+nX*width/2,yB,b.z+nZ*width/2],
          [b.x-nX*width/2,yB,b.z-nZ*width/2]
        ];
        buckets.get(key).push(v);
        this.indexSegment(a,b);
      }
    }
    for(const [kind,quads] of buckets){
      const positions=[],uvs=[],indices=[];
      for(const quad of quads){
        const start=positions.length/3;
        for(const p of quad)positions.push(...p);
        uvs.push(0,0,1,0,0,1,1,1);
        indices.push(start,start+2,start+1,start+1,start+2,start+3);
      }
      if(!quads.length)continue;
      const geometry=new THREE.BufferGeometry();
      geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
      geometry.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
      geometry.setIndex(indices);geometry.computeVertexNormals();
      const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({
        color:TYPES[kind]?.color||'#ad9f81',roughness:1,metalness:0,
        side:THREE.DoubleSide,polygonOffset:true,polygonOffsetFactor:-1
      }));
      mesh.receiveShadow=true;this.group.add(mesh);
    }
  }
  indexSegment(a,b){
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
      const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/(dx*dx+dz*dz||1)));
      if(Math.hypot(x-(a.x+dx*t),z-(a.z+dz*t))<distance)return true;
    }
    return false;
  }
}
