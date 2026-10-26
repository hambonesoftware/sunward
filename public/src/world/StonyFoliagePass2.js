import * as THREE from 'three';
import {StonyBiomeRules} from './StonyBiomeRules.js';
import {StonyTreeLibrary,TREE_LIBRARY} from './StonyTreeLibrary.js';
import {StonyGroundCover} from './StonyGroundCover.js';
import {StonyUnderstory} from './StonyUnderstory.js';
import {foliageLOD,sampleDisk,seededRandom,weightedChoice} from './StonyLOD.js';
import {createKenneyModelRenderer} from './KenneyPlants.js';

// Runtime integration point for foliage Pass 2.
// Static GIS data supplies terrain, trails and broad OSM land cover;
// locations of individual shrubs and trees are synthesized, never surveyed.
export class StonyFoliagePass2{
  constructor(scene,terrain,trails,map,assets,configuration,start){
    this.group=new THREE.Group();scene.add(this.group);
    this.lod=foliageLOD(matchMedia('(pointer:coarse)').matches);
    this.biomes=new StonyBiomeRules(terrain,trails,map,configuration);
    this.trees=this.generateTrees(terrain);
    this.heroes=new StonyTreeLibrary(this.group,assets,this.lod);
    this.distanceRenderers=[];
    for(const [speciesKey,species] of Object.entries(TREE_LIBRARY)){
      const positions=this.trees.filter(tree=>tree.species===speciesKey);
      // Retain Kenney only for background ranks. This is deliberately a
      // transitional LOD until compatible optimized photographic GLBs arrive.
      for(const tier of [
        {model:species.fallback,min:this.lod.heroRadius,max:this.lod.midRadius,
          cap:this.lod.maxMidPerModel,height:species.height},
        {model:speciesKey==='pine'?'tree_pineDefaultB':'tree_simple',
          min:this.lod.midRadius,max:this.lod.farRadius,
          cap:this.lod.maxFarPerModel,height:species.height}
      ]){
        if(!assets.models.has(tier.model))continue;
        const renderer=createKenneyModelRenderer(
          this.group,tier.model,positions,assets,{
            height:tier.height,minDistance:tier.min,maxDistance:tier.max,
            maxVisible:tier.cap
          }
        );
        if(renderer)this.distanceRenderers.push(renderer);
      }
    }
    this.understory=new StonyUnderstory(this.group,terrain,this.biomes,assets,this.lod);
    this.ground=new StonyGroundCover(this.group,terrain,this.biomes,assets,this.lod,this.trees);
    this.last={x:Infinity,z:Infinity};
    this.update(start);
  }
  generateTrees(terrain){
    const rng=seededRandom(480219);
    const taken=new Set(),trees=[];
    const cellSize=5.8;
    for(const zone of this.biomes.zones){
      const count=Math.round(zone.treeCandidates*(this.lod.maxHeroes<40?.75:1));
      let placed=0;
      for(let attempt=0;attempt<count*24&&placed<count;attempt++){
        const point=sampleDisk(zone.center,zone.radiusMeters,rng);
        const info=this.biomes.allow(point.x,point.z,'tree',rng);
        if(!info)continue;
        const cell=Math.floor(point.x/cellSize)+':'+Math.floor(point.z/cellSize);
        if(taken.has(cell))continue;
        // OSM forest/habitat class carries more weight than an artistic zone
        // default. Beaches/meadows remain noticeably more open.
        const weights={...zone.treeWeights};
        if(info.baseline==='meadow'||info.baseline==='grassland'){
          for(const key of Object.keys(weights))weights[key]*=.22;
        }
        if(info.baseline==='wetland'){
          weights.pine*=.3;weights.oak*=.4;weights.birch*=1.35;
        }
        const species=weightedChoice(weights,rng);
        if(!species||!TREE_LIBRARY[species])continue;
        taken.add(cell);
        trees.push({
          species,x:point.x,z:point.z,
          y:terrain.heightAt(point.x,point.z),
          rot:rng()*Math.PI*2,
          scale:.75+rng()*.55,
          shade:rng()
        });
        placed++;
      }
    }
    console.info('Stony foliage Pass 2:',trees.length,'generated trees across',
      this.biomes.zones.length,'exploration areas; botanical layout illustrative');
    return trees;
  }
  update(player){
    if(Math.hypot(player.x-this.last.x,player.z-this.last.z)<this.lod.updateStride)return;
    this.last={x:player.x,z:player.z};
    this.heroes.update(this.trees,player);
    for(const renderer of this.distanceRenderers)renderer.update(player.x,player.z);
    this.understory.update(player);
    this.ground.update(player);
  }
}
