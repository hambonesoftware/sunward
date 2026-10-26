import * as THREE from 'three';
import {HabitatMap} from './HabitatMap.js';
import {createKenneyModelRenderer} from './KenneyPlants.js';

function seeded(seed) {
  return ()=>{
    let t=seed+=0x6D2B79F5;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
const PROPS=[
  {id:'rock_smallF',count:220,height:2.1,range:230},
  {id:'mushroom_tan',count:125,height:1.0,range:105,forestOnly:true},
  {id:'flower_purpleA',count:160,height:2.4,range:185},
  {id:'plant_bushDetailed',count:105,height:3.2,range:260}
];
export class KenneyDecor {
  constructor(scene,terrain,village,landcover,assets) {
    this.terrain=terrain;
    this.village=village;
    this.habitat=landcover?new HabitatMap(landcover,terrain):null;
    this.group=new THREE.Group();scene.add(this.group);
    this.renderers=[];
    const town=village.profile.village;
    const coarse=matchMedia('(pointer:coarse)').matches;
    for(let index=0;index<PROPS.length;index++){
      const entry=PROPS[index];
      const random=seeded(15217+index*6637);
      const positions=[];
      const count=Math.round(entry.count*(coarse?.7:1));
      for(let attempt=0;attempt<count*80&&positions.length<count;attempt++){
        const x=(random()-.5)*(terrain.width-55);
        const z=(random()-.5)*(terrain.depth-55);
        const klass=this.habitat?.classAt(x,z)??41;
        const forest=klass===41||klass===42||klass===43;
        const above=terrain.rawElevation(x,z)-village.profile.waterElevationMeters;
        if(klass===11||klass===24||above<3||terrain.slopeAt(x,z)>.68)continue;
        if(entry.forestOnly&&!forest)continue;
        if(Math.hypot(x-town.x,z-town.z)<town.radius+24)continue;
        if(!village.canWalk(x,z,4))continue;
        if(!terrain.positionInBounds(x,z,10))continue;
        positions.push({x,z,y:terrain.heightAt(x,z),rot:random()*Math.PI*2,
          scale:.6+random()*.85,shade:random()});
      }
      const renderer=createKenneyModelRenderer(this.group,entry.id,positions,assets,{
        height:entry.height,maxDistance:entry.range
      });
      if(renderer)this.renderers.push(renderer);
    }
    this.update(village.profile.start);
  }
  update(position) {
    for(const renderer of this.renderers)renderer.update(position.x,position.z);
  }
}
