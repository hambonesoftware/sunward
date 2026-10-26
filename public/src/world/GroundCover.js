import * as THREE from 'three';
import {makeGrassClump} from './RealisticPlants.js';
import {HabitatMap} from './HabitatMap.js';

function seeded(seed){
  return ()=>{
    let t=seed+=0x6D2B79F5;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return ((t^t>>>14)>>>0)/4294967296;
  };
}

// Dense clumps close to the player, without thousands of persistent Mesh nodes.
export class GroundCover {
  constructor(scene,terrain,village,profile,landcover,assets){
    this.terrain=terrain;
    this.village=village;
    this.profile=profile;
    this.habitat=landcover?new HabitatMap(landcover,terrain):null;
    this.positions=[];this.litter=[];
    this.random=seeded(55892);
    this.group=new THREE.Group();scene.add(this.group);
    this.buildPositions();

    const grassMaterial=assets.grassMaterial;
    grassMaterial.vertexColors=true;
    this.grass=new THREE.InstancedMesh(makeGrassClump(),grassMaterial,this.positions.length);
    this.grass.count=0;this.grass.castShadow=false;this.grass.receiveShadow=false;
    this.grass.frustumCulled=false;this.group.add(this.grass);

    this.litterMesh=new THREE.InstancedMesh(
      new THREE.PlaneGeometry(1.6,1.1),
      new THREE.MeshStandardMaterial({color:'#c8a76d',roughness:1,side:THREE.DoubleSide}),
      this.litter.length
    );
    this.litterMesh.count=0;this.litterMesh.receiveShadow=true;
    this.litterMesh.frustumCulled=false;this.group.add(this.litterMesh);
    this.lastX=Infinity;this.lastZ=Infinity;
    this.update(profile.start);
  }

  buildPositions(){
    const {width,depth}=this.terrain;
    const town=this.profile.village;
    const rand=this.random;
    for(let i=0;i<6400;i++){
      let x,z;
      if(rand()<.52){
        x=town.x+(rand()-.5)*680;
        z=town.z+(rand()-.5)*680;
      }else{
        x=(rand()-.5)*(width-35);
        z=(rand()-.5)*(depth-35);
      }
      if(!this.terrain.positionInBounds(x,z,10))continue;
      const above=this.terrain.rawElevation(x,z)-this.profile.waterElevationMeters;
      if(above<1.1||this.terrain.slopeAt(x,z)>.76)continue;
      const klass=this.habitat?.classAt(x,z)??41;
      if(klass===11||klass===24)continue;
      if(!this.village.canWalk(x,z,3))continue;

      // Maintain usable lanes to homes and the village square.
      const dx=x-town.x,dz=z-town.z;
      const nearTown=Math.hypot(dx,dz)<town.radius+25;
      if(nearTown){
        if((Math.abs(dz)<12&&Math.abs(dx)<190)||
          (Math.abs(dx)<12&&Math.abs(dz)<235))continue;
        if(rand()<.38)continue;
      }
      const forest=klass===41||klass===42||klass===43;
      if(!forest&&rand()<(klass===31?.62:.38))continue;
      const y=this.terrain.heightAt(x,z);
      const scale=(.45+rand()*.76)*(above<9?1.15:1);
      const instance={x,y,z,scale,rot:rand()*Math.PI*2,shade:rand()};
      this.positions.push(instance);
      if(forest&&rand()<.23){
        this.litter.push({...instance,scale:.5+rand()*.75});
      }
    }
  }

  update(player){
    if(Math.hypot(player.x-this.lastX,player.z-this.lastZ)<8)return;
    this.lastX=player.x;this.lastZ=player.z;
    const dummy=new THREE.Object3D();
    let n=0;
    for(const p of this.positions){
      if((p.x-player.x)**2+(p.z-player.z)**2>225**2)continue;
      dummy.position.set(p.x,p.y+.05,p.z);
      dummy.rotation.set(0,p.rot,0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      this.grass.setMatrixAt(n++,dummy.matrix);
    }
    this.grass.count=n;this.grass.instanceMatrix.needsUpdate=true;

    n=0;
    for(const p of this.litter){
      if((p.x-player.x)**2+(p.z-player.z)**2>160**2)continue;
      dummy.position.set(p.x,p.y+.1,p.z);
      dummy.rotation.set(-Math.PI/2,p.rot,0);
      dummy.scale.setScalar(p.scale);
      dummy.updateMatrix();
      this.litterMesh.setMatrixAt(n++,dummy.matrix);
    }
    this.litterMesh.count=n;
    this.litterMesh.instanceMatrix.needsUpdate=true;
  }
}
