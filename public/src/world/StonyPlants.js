import * as THREE from 'three';
import {project,insidePolygon} from './StonyTerrain.js';
import {createKenneyModelRenderer} from './KenneyPlants.js';
import {makeGrassClump} from './RealisticPlants.js';

const FOCAL_POINTS=[
  [42.76078,-83.0745],[42.722,-83.078],[42.7284,-83.09064],
  [42.73046,-83.1072],[42.71823,-83.079]
];
const SPECIES=[
  {id:'tree_detailed',count:3600,height:16,range:330},
  {id:'tree_simple',count:2000,height:13,range:320},
  {id:'tree_pineTallB_detailed',count:2600,height:19,range:410},
  {id:'tree_pineTallC_detailed',count:1400,height:17,range:390},
  {id:'tree_pineDefaultB',count:1360,height:12,range:330},
  {id:'tree_pineRoundB',count:760,height:11,range:270},
  {id:'plant_bushDetailed',count:3800,height:2.4,range:130},
  {id:'plant_flatShort',count:2800,height:1.6,range:120},
  {id:'flower_yellowC',count:800,height:1.2,range:80},
  {id:'flower_purpleA',count:660,height:1.1,range:80},
  {id:'rock_smallF',count:760,height:1.6,range:170},
  {id:'mushroom_tan',count:580,height:.35,range:75}
];
function randomSource(seed){
  return ()=>{
    let t=seed+=0x6D2B79F5;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
export class StonyPlants {
  constructor(scene,terrain,trails,map,assets,start){
    this.terrain=terrain;this.trails=trails;this.assets=assets;
    this.group=new THREE.Group();scene.add(this.group);
    this.renderers=[];
    this.polygons=(map.habitats||[]).map(h=>{
      const points=h.coords.map(([lon,lat])=>project(lon,lat,terrain.bounds));
      return {kind:h.kind,points,
        minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
        minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))};
    }).filter(p=>p.points.length>=4);
    const coarse=matchMedia('(pointer:coarse)').matches;
    SPECIES.forEach((spec,index)=>{
      if(!assets.models.has(spec.id))return;
      const rand=randomSource(87343+index*983);
      const positions=[];
      const count=Math.round(spec.count*(coarse?.63:1));
      for(let attempts=0;attempts<count*12&&positions.length<count;attempts++){
        let x,z;
        if(rand()<.79){
          const [lat,lon]=FOCAL_POINTS[Math.floor(rand()*FOCAL_POINTS.length)];
          const p=project(lon,lat,terrain.bounds);
          x=p.x+(rand()-.5)*1050;
          z=p.z+(rand()-.5)*1050;
        }else{
          x=(rand()-.5)*(terrain.width-25);
          z=(rand()-.5)*(terrain.depth-25);
        }
        if(!terrain.positionInBounds(x,z,12))continue;
        const isTree=spec.id.startsWith('tree_');
        if(terrain.waterAt(x,z)||terrain.slopeAt(x,z)>.75)continue;
        if(trails.nearPath(x,z,isTree?4.7:spec.id.startsWith('plant')?2.2:1.4))continue;
        const habitat=this.habitat(x,z);
        const forest=habitat==='wood'||habitat==='forest';
        const wetland=habitat==='wetland';
        const meadow=habitat==='meadow'||habitat==='grassland';
        if(wetland&&isTree&&rand()<.82)continue;
        if(meadow&&isTree&&rand()<.84)continue;
        if(forest&&spec.id.startsWith('flower')&&rand()<.72)continue;
        if(isTree&&rand()<.08)continue;
        const scale=(.76+rand()*.47);
        positions.push({x,z,y:terrain.heightAt(x,z),rot:rand()*6.283,
          scale,shade:rand()});
      }
      const renderer=createKenneyModelRenderer(this.group,spec.id,positions,assets,
        {height:spec.height,maxDistance:spec.range});
      if(renderer)this.renderers.push(renderer);
    });
    this.makeGrass();
    this.update(start);
  }
  habitat(x,z){
    for(const p of this.polygons){
      if(x>p.minX&&x<p.maxX&&z>p.minZ&&z<p.maxZ&&insidePolygon(x,z,p))return p.kind;
    }
    return 'mixed';
  }
  makeGrass(){
    const rand=randomSource(1249);
    this.grassPositions=[];
    const count=matchMedia('(pointer:coarse)').matches?36000:55000;
    for(let i=0;i<count;i++){
      let x,z;
      if(rand()<.86){
        const [lat,lon]=FOCAL_POINTS[Math.floor(rand()*FOCAL_POINTS.length)];
        const p=project(lon,lat,this.terrain.bounds);
        x=p.x+(rand()-.5)*1050;
        z=p.z+(rand()-.5)*1050;
      }else{
        x=(rand()-.5)*(this.terrain.width-20);
        z=(rand()-.5)*(this.terrain.depth-20);
      }
      if(!this.terrain.positionInBounds(x,z,10))continue;
      if(this.terrain.waterAt(x,z)||this.trails.nearPath(x,z,2.2))continue;
      if(this.terrain.slopeAt(x,z)>.5)continue;
      this.grassPositions.push({x,z,y:this.terrain.heightAt(x,z),
        rot:rand()*6.283,scale:.28+rand()*.35});
    }
    const material=this.assets.grassMaterial;
    this.grass=new THREE.InstancedMesh(makeGrassClump(),material,this.grassPositions.length);
    this.grass.count=0;this.grass.frustumCulled=false;
    this.group.add(this.grass);
    this.lastGrass={x:Infinity,z:Infinity};
  }
  update(player){
    for(const renderer of this.renderers)renderer.update(player.x,player.z);
    if(Math.hypot(player.x-this.lastGrass.x,player.z-this.lastGrass.z)<7)return;
    this.lastGrass={x:player.x,z:player.z};
    const dummy=new THREE.Object3D();let n=0;
    for(const p of this.grassPositions){
      if((p.x-player.x)**2+(p.z-player.z)**2>135**2)continue;
      dummy.position.set(p.x,p.y,p.z);
      dummy.rotation.set(0,p.rot,0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      this.grass.setMatrixAt(n++,dummy.matrix);
    }
    this.grass.count=n;
    this.grass.instanceMatrix.needsUpdate=true;
  }
}
