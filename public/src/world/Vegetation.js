import * as THREE from 'three';
import {HabitatMap} from './HabitatMap.js';
import {createPlantRenderer} from './KenneyPlants.js';

function seededRandom(seed) {
  return () => {
    let t=seed+=0x6D2B79F5;
    t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

const isTree=type=>['conifer','broadleaf','birch'].includes(type);

export class Vegetation {
  constructor(scene,terrain,profile,landcover,assets) {
    this.group=new THREE.Group();scene.add(this.group);
    this.terrain=terrain;this.profile=profile;
    this.habitat=landcover?new HabitatMap(landcover,terrain):null;
    this.assets=assets;
    this.renderers=[];
    this.random=seededRandom(43119);
    this.specimens=[];
    this.populate();this.addSpecimens();
    this.update(0,0,profile.start);
  }

  availableSpecies(x,z) {
    const above=this.terrain.rawElevation(x,z)-this.profile.waterElevationMeters;
    return this.profile.species.filter(s=>{
      if(s.minMetersAboveWater!==undefined && above<s.minMetersAboveWater)return false;
      if(s.maxMetersAboveWater!==undefined && above>s.maxMetersAboveWater)return false;
      if(above<2 && s.type!=='reed')return false;
      return true;
    });
  }

  chooseSpecies(x,z) {
    const list=this.availableSpecies(x,z);
    const above=this.terrain.rawElevation(x,z)-this.profile.waterElevationMeters;
    const weights=list.map(s=>s.weight*(this.habitat?.suitability(s,x,z,above)??1));
    const total=weights.reduce((sum,w)=>sum+w,0);
    if(!total)return null;
    let target=this.random()*total;
    for(let i=0;i<list.length;i++){
      target-=weights[i];if(target<=0)return list[i];
    }
    return list[list.length-1];
  }

  populate() {
    const bySpecies=new Map(this.profile.species.map(s=>[s.id,[]]));
    const {width,depth}=this.terrain;
    for(let i=0;i<4300;i++){
      const x=(this.random()-.5)*(width-65),z=(this.random()-.5)*(depth-65);
      const above=this.terrain.rawElevation(x,z)-this.profile.waterElevationMeters;
      if(above<.2||this.terrain.slopeAt(x,z)>.84)continue;
      if(this.habitat?.classAt(x,z)===11)continue;
      const town=this.profile.village;
      const dist=Math.hypot(x-town.x,z-town.z);
      if(dist<town.radius+34)continue;
      if(x>-560&&x<town.x&&Math.abs(z-(town.z-70))<19)continue;
      const species=this.chooseSpecies(x,z);if(!species)continue;
      if(isTree(species.type)&&this.random()<.27)continue;
      const y=this.terrain.heightAt(x,z);
      const scale=(isTree(species.type)?1.3:.75)+this.random()*(isTree(species.type)?1.3:1.2);
      bySpecies.get(species.id).push({x,y,z,scale,rot:this.random()*Math.PI*2,shade:this.random(),shape:this.random()});
    }
    for(const species of this.profile.species){
      const positions=bySpecies.get(species.id);
      if(positions.length)this.drawSpecies(species,positions);
    }
  }

  drawSpecies(species,instances) {
    this.renderers.push(createPlantRenderer(this.group,species,instances,this.assets));
  }

  addSpecimens() {
    const chosen=[
      {id:'white-pine',x:488,z:-75},
      {id:'sugar-maple',x:430,z:195},
      {id:'paper-birch',x:536,z:-310},
      {id:'dune-grass',x:-340,z:-170},
      {id:'goldenrod',x:40,z:266}
    ];
    for(const point of chosen) {
      const species=this.profile.species.find(s=>s.id===point.id);
      const y=this.terrain.heightAt(point.x,point.z);
      const marker=new THREE.Group();marker.position.set(point.x,y+7,point.z);
      const ring=new THREE.Mesh(new THREE.TorusGeometry(2.4,.32,7,20),new THREE.MeshStandardMaterial({color:'#f7d27b',emissive:'#dd9c45',emissiveIntensity:.65}));
      ring.rotation.x=Math.PI/2;marker.add(ring);
      const orb=new THREE.Mesh(new THREE.IcosahedronGeometry(.75,0),new THREE.MeshBasicMaterial({color:'#fff2be'}));
      orb.position.y=1.2;marker.add(orb);this.group.add(marker);
      this.specimens.push({...point,y,species,marker,discovered:false});
    }
  }

  update(dt,elapsed,playerPosition) {
    this.assets.setWindTime(elapsed);
    if(playerPosition){
      for(const renderer of this.renderers)
        renderer.update(playerPosition.x,playerPosition.z);
    }
    for(const p of this.specimens){
      if(p.discovered){p.marker.visible=false;continue;}
      p.marker.rotation.y+=dt*.7;
      p.marker.position.y=p.y+7+Math.sin(elapsed*1.7+p.x)*.6;
    }
  }
}
