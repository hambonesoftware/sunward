// Tunable instancing and culling budgets. All lengths in world meters.
export function foliageLOD(mobile) {
  return mobile ? {
    heroRadius:64, midRadius:195, farRadius:335,
    maxHeroes:32, maxMidPerModel:145,maxFarPerModel:230,
    groundRadius:80,maxGrass:4700,maxLitter:480,
    updateStride:8
  } : {
    heroRadius:88,midRadius:245,farRadius:465,
    maxHeroes:56,maxMidPerModel:275,maxFarPerModel:480,
    groundRadius:110,maxGrass:9500,maxLitter:900,
    updateStride:11
  };
}
export function seededRandom(seed) {
  let s=seed>>>0;
  return ()=>{
    s=(s+0x6D2B79F5)>>>0;
    let t=s;
    t=Math.imul(t^t>>>15,t|1);
    t^=t+Math.imul(t^t>>>7,t|61);
    return ((t^t>>>14)>>>0)/4294967296;
  };
}
export function sampleDisk(center,radius,rng){
  const r=radius*Math.sqrt(rng()),angle=2*Math.PI*rng();
  return {x:center.x+r*Math.cos(angle),z:center.z+r*Math.sin(angle)};
}
export function weightedChoice(weights,rng){
  const entries=Object.entries(weights).filter(([,weight])=>weight>0);
  const total=entries.reduce((sum,[,weight])=>sum+weight,0);
  if(!total)return null;
  let roll=rng()*total;
  for(const [id,weight] of entries){roll-=weight;if(roll<=0)return id;}
  return entries.at(-1)[0];
}
