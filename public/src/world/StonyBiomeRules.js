import {project,insidePolygon} from './StonyTerrain.js';

// Habitat and zone values are authored art-direction rules, not field-survey data.
// OSM polygons override zone assumptions where they exist.
export class StonyBiomeRules {
  constructor(terrain,trails,map,configuration) {
    this.terrain=terrain;
    this.trails=trails;
    this.config=configuration;
    this.zones=configuration.zones.map(zone=>({
      ...zone,center:project(zone.center.lon,zone.center.lat,terrain.bounds)
    }));
    this.polygons=(map.habitats||[]).map(item=>{
      const points=item.coords.map(([lon,lat])=>project(lon,lat,terrain.bounds));
      return {kind:item.kind,points,
        minX:Math.min(...points.map(p=>p.x)),maxX:Math.max(...points.map(p=>p.x)),
        minZ:Math.min(...points.map(p=>p.z)),maxZ:Math.max(...points.map(p=>p.z))
      };
    }).filter(p=>p.points.length>3);
  }
  nearestZone(x,z) {
    let best=this.zones[0],bestMetric=Infinity;
    for(const zone of this.zones){
      const distance=Math.hypot(x-zone.center.x,z-zone.center.z);
      const metric=distance/(zone.radiusMeters||450);
      if(metric<bestMetric){bestMetric=metric;best=zone;}
    }
    return best;
  }
  baseBiome(x,z,zone) {
    for(const polygon of this.polygons){
      if(x<polygon.minX||x>polygon.maxX||z<polygon.minZ||z>polygon.maxZ)continue;
      if(!insidePolygon(x,z,polygon))continue;
      switch(polygon.kind){
        case 'wood':case 'forest':return 'forest';
        case 'grassland':case 'meadow':return 'meadow';
        case 'wetland':return 'wetland';
        default:break;
      }
    }
    return zone.defaultBiome||'mixed';
  }
  sample(x,z) {
    const zone=this.nearestZone(x,z);
    const trail=this.trails.nearPath(x,z,5);
    const water=!!this.terrain.waterAt(x,z);
    const slope=this.terrain.slopeAt(x,z);
    const baseline=this.baseBiome(x,z,zone);
    let biome=baseline;
    if(water)biome='water';
    else if(slope>.7)biome='steep';
    else if(trail)biome='trail-edge';
    // Zone's configured composition affects how we fill unmapped land cover.
    const defaults=this.config.biomes[baseline]||this.config.biomes.mixed;
    const values=this.config.biomes[biome]||defaults;
    return {
      zone,biome,baseline,slope,water,trail,
      treeDensity:values.treeDensity??defaults.treeDensity,
      shrubDensity:values.shrubDensity??defaults.shrubDensity,
      grassDensity:values.grassDensity??defaults.grassDensity,
      flowerDensity:values.flowerDensity??defaults.flowerDensity,
      treeWeights:zone.treeWeights,
      trailClearanceMeters:zone.trailClearanceMeters
    };
  }
  allow(x,z,kind,random) {
    if(!this.terrain.positionInBounds(x,z,15))return null;
    if(this.terrain.waterAt(x,z))return null;
    const sample=this.sample(x,z);
    if(sample.slope>(kind==='tree'?.66:.82))return null;
    const clearance=kind==='tree'
      ?sample.trailClearanceMeters.tree
      :kind==='shrub'?sample.trailClearanceMeters.shrub
      :sample.trailClearanceMeters.ground;
    if(this.trails.nearPath(x,z,clearance))return null;
    const multiplier=kind==='tree'?sample.treeDensity:
      kind==='shrub'?sample.shrubDensity:
      kind==='flower'?sample.flowerDensity:sample.grassDensity;
    if(random()>multiplier)return null;
    return sample;
  }
}
