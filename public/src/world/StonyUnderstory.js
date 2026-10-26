import * as THREE from 'three';
import {sampleDisk,seededRandom} from './StonyLOD.js';
import {createKenneyModelRenderer} from './KenneyPlants.js';

// Secondary vegetation is sparse near footpaths and dense at woodland edges.
// Kenney provides the inexpensive ground props until approved realistic GLBs land.
const CATEGORIES=[
  {id:'plant_bushDetailed',kind:'shrub',height:2.7,range:150,field:'shrubClumps'},
  {id:'plant_flatShort',kind:'shrub',height:1.4,range:90,field:'lowBrush'},
  {id:'flower_yellowC',kind:'flower',height:1.0,range:65,field:'wildflowers'},
  {id:'flower_purpleA',kind:'flower',height:.9,range:65,field:'wildflowers'},
  {id:'mushroom_tan',kind:'shrub',height:.36,range:48,field:'mushrooms'}
];
export class StonyUnderstory{
  constructor(group,terrain,biomes,assets,lod){
    this.group=group;
    this.renderers=[];
    this.terrain=terrain;
    this.biomes=biomes;
    for(let index=0;index<CATEGORIES.length;index++){
      const cat=CATEGORIES[index];
      if(!assets.models.has(cat.id))continue;
      const rng=seededRandom(6093+index*1277);
      const points=[];
      for(const zone of biomes.zones){
        const target=Math.round((zone[cat.field]||0)/(cat.id.startsWith('flower')?2:1));
        let made=0;
        for(let attempt=0;attempt<target*17&&made<target;attempt++){
          const p=sampleDisk(zone.center,zone.radiusMeters,rng);
          const biome=biomes.allow(p.x,p.z,cat.kind,rng);
          if(!biome)continue;
          if(cat.id==='mushroom_tan'&&!['forest','mixed'].includes(biome.baseline))continue;
          points.push({x:p.x,z:p.z,y:terrain.heightAt(p.x,p.z),
            rot:rng()*Math.PI*2,scale:.72+rng()*.55,shade:rng()});
          made++;
        }
      }
      const renderer=createKenneyModelRenderer(group,cat.id,points,assets,{
        height:cat.height,maxDistance:cat.range,
        maxVisible:cat.id.startsWith('flower')?135:lod.maxMidPerModel
      });
      if(renderer)this.renderers.push(renderer);
    }
  }
  update(player){
    for(const renderer of this.renderers)renderer.update(player.x,player.z);
  }
}
