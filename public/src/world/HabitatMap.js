// Data-only adapter for the USGS Annual NLCD tile. The village is fictional,
// so real land cover influences plant frequency without dictating buildings.
const clamp=(value,min,max)=>Math.max(min,Math.min(max,value));

export class HabitatMap {
  constructor(data,terrain){
    this.data=data;
    this.terrain=terrain;
  }

  classAt(x,z){
    const gx=clamp(Math.round((x/this.terrain.width+.5)*(this.data.width-1)),0,this.data.width-1);
    const gz=clamp(Math.round((z/this.terrain.depth+.5)*(this.data.height-1)),0,this.data.height-1);
    return this.data.classes[gz][gx];
  }

  // These factors are artistic habitat rules layered over measured land cover.
  // Their exact probabilities are design choices, not ecological measurements.
  suitability(species,x,z,above){
    const klass=this.classAt(x,z);
    const tree=['conifer','broadleaf','birch'].includes(species.type);
    const wet=species.type==='reed';
    const dune=species.id==='dune-grass';

    if(klass===11)return 0;
    if(wet)return above<7?(klass===95?.95:.6):.03;
    if(dune)return above<19&&(klass===31||klass===21)?.95:.18;

    if(klass===31)return tree?.06:species.type==='flower'?.42:.25;
    if(klass===41||klass===43||klass===42){
      if(species.type==='shrub')return 1.35;
      if(tree)return species.type==='conifer'?(klass===41?.75:1.35):1.1;
      return .85;
    }
    if(klass===21)return tree?.65:.85;
    if(klass===22)return tree?.35:.55;
    if(klass===23)return tree?.12:.3;
    if(klass===24)return .04;
    if(klass===90||klass===95)return tree?.3:1.1;
    return 1;
  }
}
