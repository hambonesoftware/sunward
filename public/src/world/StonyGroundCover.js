import * as THREE from 'three';
import {makeGrassClump} from './RealisticPlants.js';
import {sampleDisk,seededRandom} from './StonyLOD.js';

// Nearby, short grass and low-opacity soil/litter patches disguise hard joins
// between the terrain color, trail edges, and individual tree trunks.
export class StonyGroundCover{
  constructor(group,terrain,biomes,assets,lod,trees){
    this.group=group;this.terrain=terrain;this.biomes=biomes;this.lod=lod;
    const rng=seededRandom(16756);
    this.grassPositions=[];
    for(const zone of biomes.zones){
      const target=Math.round(zone.grassClumps*(lod.maxGrass<5000?.75:1));
      let n=0;
      for(let attempt=0;attempt<target*12&&n<target;attempt++){
        const p=sampleDisk(zone.center,zone.radiusMeters,rng);
        if(!biomes.allow(p.x,p.z,'grass',rng))continue;
        this.grassPositions.push({x:p.x,z:p.z,y:terrain.heightAt(p.x,p.z),
          rot:rng()*Math.PI*2,scale:.23+rng()*.45});
        n++;
      }
    }
    this.grass=new THREE.InstancedMesh(
      makeGrassClump(),assets.grassMaterial,this.grassPositions.length||1
    );
    this.grass.count=0;this.grass.frustumCulled=false;group.add(this.grass);
    const patches=trees.filter((tree,i)=>i%3===0).map(tree=>({
      x:tree.x,z:tree.z,y:terrain.heightAt(tree.x,tree.z)+.032,
      scale:1.2+rng()*2.2,rot:rng()*Math.PI*2
    }));
    this.litterPositions=patches;
    const material=new THREE.MeshStandardMaterial({
      color:'#71674c',transparent:true,opacity:.27,
      depthWrite:false,side:THREE.DoubleSide,roughness:1
    });
    this.litter=new THREE.InstancedMesh(
      new THREE.CircleGeometry(1,10),material,patches.length||1
    );
    this.litter.count=0;this.litter.frustumCulled=false;group.add(this.litter);
    this.dummy=new THREE.Object3D();
    this.lastX=Infinity;this.lastZ=Infinity;
  }
  update(player){
    if(Math.hypot(player.x-this.lastX,player.z-this.lastZ)<this.lod.updateStride)return;
    this.lastX=player.x;this.lastZ=player.z;
    let visible=0;
    const radiusSq=this.lod.groundRadius*this.lod.groundRadius;
    for(const p of this.grassPositions){
      if((p.x-player.x)**2+(p.z-player.z)**2>radiusSq)continue;
      this.dummy.position.set(p.x,p.y,p.z);
      this.dummy.rotation.set(0,p.rot,0);
      this.dummy.scale.setScalar(p.scale);this.dummy.updateMatrix();
      this.grass.setMatrixAt(visible++,this.dummy.matrix);
      if(visible>=this.lod.maxGrass)break;
    }
    this.grass.count=visible;this.grass.instanceMatrix.needsUpdate=true;
    visible=0;
    for(const p of this.litterPositions){
      if((p.x-player.x)**2+(p.z-player.z)**2>radiusSq)continue;
      this.dummy.position.set(p.x,p.y,p.z);
      this.dummy.rotation.set(-Math.PI/2,p.rot,0);
      this.dummy.scale.setScalar(p.scale);this.dummy.updateMatrix();
      this.litter.setMatrixAt(visible++,this.dummy.matrix);
      if(visible>=this.lod.maxLitter)break;
    }
    this.litter.count=visible;
    this.litter.instanceMatrix.needsUpdate=true;
  }
}
