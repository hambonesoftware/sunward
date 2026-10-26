import * as THREE from 'three';
import {GLTFLoader} from '../../vendor/three-addons/loaders/GLTFLoader.js';
import {HabitatMap} from './HabitatMap.js';

// The CC0 3D model library is a separate, optional visual layer. If an asset
// fails to load, the procedural Michigan landscape and gameplay continue.
const smoothRandom=seed=>()=>{
  let t=seed+=0x6D2B79F5;
  t=Math.imul(t^t>>>15,t|1);
  t^=t+Math.imul(t^t>>>7,t|61);
  return ((t^t>>>14)>>>0)/4294967296;
};

function entrySeed(id){
  let hash=2166136261;
  for(const character of id){
    hash=Math.imul(hash^character.charCodeAt(0),16777619);
  }
  return hash>>>0;
}

function habitatMatches(entry,klass,above,rand){
  const forest=klass===41||klass===42||klass===43;
  const open=klass===21||klass===22||klass===31;
  if(klass===11||klass===24)return false;
  if(entry.kind==='wetland')return above>=.35&&above<9&&rand()<.87;
  if(entry.kind==='tree')return above>5&&(forest||rand()<(klass===21?.65:.25));
  if(entry.kind==='shrub')return above>3&&(forest||rand()<.45);
  if(entry.kind==='understory')return above>3&&(forest||rand()<.42);
  if(entry.kind==='grass')return above>2&&(open||rand()<.65);
  if(entry.kind==='flower')return above>2&&(open||rand()<.32);
  if(entry.kind==='ground')return above>3&&(forest||rand()<.16);
  if(entry.kind==='fungus'||entry.kind==='deadwood')return above>5&&(forest||rand()<.17);
  return above>2;
}

function placeCandidates(entry,terrain,village,habitat,rand,mobile){
  const positions=[];
  const count=Math.ceil(entry.count*(mobile?.63:1));
  const center=village.profile.village;
  const terrainMargin=40;
  for(let tries=0;tries<count*55&&positions.length<count;tries++){
    const aroundVillage=rand()<.76;
    const x=aroundVillage?center.x+(rand()-.5)*840:(rand()-.5)*(terrain.width-terrainMargin);
    const z=aroundVillage?center.z+(rand()-.5)*840:(rand()-.5)*(terrain.depth-terrainMargin);
    if(!terrain.positionInBounds(x,z,12))continue;
    const above=terrain.rawElevation(x,z)-village.profile.waterElevationMeters;
    const klass=habitat?.classAt(x,z)??41;
    if(!habitatMatches(entry,klass,above,rand))continue;
    const slope=terrain.slopeAt(x,z);
    if(slope>(entry.kind==='rock'?.98:.72))continue;
    if(!village.canWalk(x,z,entry.kind==='tree'?8:3))continue;
    const dist=Math.hypot(x-center.x,z-center.z);
    if(entry.kind==='tree'&&dist<98)continue;
    if(dist<225&&((Math.abs(z-center.z)<13&&Math.abs(x-center.x)<200)||
      (Math.abs(x-center.x)<13&&Math.abs(z-center.z)<235)))continue;
    positions.push({x,y:terrain.heightAt(x,z),z,rot:rand()*6.28318,
      scale:.72+rand()*.63});
  }
  return positions;
}

function prepareMeshes(gltf){
  const parts=[];
  const box=new THREE.Box3();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(node=>{
    if(!node.isMesh||!node.geometry)return;
    const geometry=node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    geometry.computeBoundingBox();
    box.union(geometry.boundingBox);
    parts.push({geometry,material:node.material});
  });
  if(box.isEmpty())return {parts:[],height:1,offset:new THREE.Vector3()};
  return {
    parts,
    height:Math.max(.01,box.max.y-box.min.y),
    offset:new THREE.Vector3((box.min.x+box.max.x)/2,box.min.y,(box.min.z+box.max.z)/2)
  };
}

export class FoundModels {
  constructor(scene,terrain,village,landcover){
    this.scene=scene;this.terrain=terrain;this.village=village;
    this.habitat=landcover?new HabitatMap(landcover,terrain):null;
    this.group=new THREE.Group();scene.add(this.group);
    this.loader=new GLTFLoader();
    this.mobile=matchMedia('(pointer:coarse)').matches;
    this.draws=[];
    this.player={x:village.profile.start.x,z:village.profile.start.z};
    this.totalLoaded=0;this.failed=[];
    this.loading=this.load();
  }

  async load(){
    try{
      const manifestURL=new URL('../../data/model-library.json',import.meta.url);
      const response=await fetch(manifestURL);
      if(!response.ok)throw new Error(`Asset catalog ${response.status}`);
      const manifest=await response.json();
      const models=manifest.models.filter(entry=>entry.count>0);
      const queue=[...models];
      // Four independent workers fill in the scene incrementally, keeping the
      // village interactive while its optional scenery is fetched and parsed.
      const worker=async()=>{
        while(queue.length){
          const entry=queue.shift();
          try{
            const url=new URL(`../../assets/models/${entry.id}.glb`,import.meta.url);
            const gltf=await this.loader.loadAsync(url.href);
            const random=smoothRandom(entrySeed(entry.id));
            const positions=placeCandidates(entry,this.terrain,this.village,this.habitat,random,this.mobile);
            this.addModel(entry,gltf,positions);
            this.totalLoaded++;
          }catch(error){
            this.failed.push(entry.id);
            console.warn(`Could not load optional model ${entry.id}`,error);
          }
        }
      };
      await Promise.all(Array.from({length:4},()=>worker()));
      console.info(`Sunward 3D flora: ${this.totalLoaded}/${models.length} CC0 assets loaded`);
    }catch(error){
      console.warn('Optional model library unavailable; procedural plants remain.',error);
    }
  }

  addModel(entry,gltf,positions){
    if(!positions.length)return;
    const prepared=prepareMeshes(gltf);
    if(!prepared.parts.length)return;
    const scale=entry.height/prepared.height;
    const meshes=[];
    for(const {geometry,material} of prepared.parts){
      const mesh=new THREE.InstancedMesh(geometry,material,positions.length);
      mesh.count=0;
      mesh.frustumCulled=false;
      mesh.castShadow=false;mesh.receiveShadow=entry.kind==='rock';
      this.group.add(mesh);meshes.push(mesh);
    }
    const maxDistance=entry.kind==='tree'?375:
      entry.kind==='rock'||entry.kind==='deadwood'?215:150;
    const item={entry,positions,meshes,scale,offset:prepared.offset,maxDistance};
    this.draws.push(item);
    this.refresh(item);
  }

  refresh(item){
    const {positions,meshes,maxDistance,offset}=item;
    const maxDistanceSq=maxDistance*maxDistance;
    const dummy=new THREE.Object3D();
    let shown=0;
    for(const p of positions){
      const dx=p.x-this.player.x,dz=p.z-this.player.z;
      if(dx*dx+dz*dz>maxDistanceSq)continue;
      const multiplier=item.scale*p.scale;
      // Move the imported model's bottom/center to the surface, regardless of
      // source-mesh pivot conventions. Geometry retains baked child transforms.
      const sin=Math.sin(p.rot),cos=Math.cos(p.rot);
      dummy.position.set(
        p.x-(offset.x*cos-offset.z*sin)*multiplier,
        p.y-offset.y*multiplier,
        p.z-(offset.x*sin+offset.z*cos)*multiplier
      );
      dummy.rotation.set(0,p.rot,0);
      dummy.scale.setScalar(multiplier);
      dummy.updateMatrix();
      for(const mesh of meshes)mesh.setMatrixAt(shown,dummy.matrix);
      shown++;
    }
    for(const mesh of meshes){
      mesh.count=shown;
      mesh.instanceMatrix.needsUpdate=true;
    }
  }

  update(position){
    const dist=Math.hypot(position.x-this.player.x,position.z-this.player.z);
    if(dist<12)return;
    this.player={x:position.x,z:position.z};
    for(const item of this.draws)this.refresh(item);
  }
}
