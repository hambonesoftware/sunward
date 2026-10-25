import * as THREE from 'three';

function seededRandom(seed) {
  return () => {
    let t=seed+=0x6D2B79F5;
    t=Math.imul(t^(t>>>15),t|1);t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  };
}

const isTree=type=>['conifer','broadleaf','birch'].includes(type);

export class Vegetation {
  constructor(scene,terrain,profile) {
    this.group=new THREE.Group();scene.add(this.group);
    this.terrain=terrain;this.profile=profile;
    this.random=seededRandom(43119);
    this.specimens=[];
    this.populate();this.addSpecimens();
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
    const total=list.reduce((sum,s)=>sum+s.weight,0);
    if(!total)return null;
    let target=this.random()*total;
    for(const species of list){target-=species.weight;if(target<=0)return species;}
    return list[list.length-1];
  }

  populate() {
    const bySpecies=new Map(this.profile.species.map(s=>[s.id,[]]));
    const {width,depth}=this.terrain;
    for(let i=0;i<2400;i++){
      const x=(this.random()-.5)*(width-65),z=(this.random()-.5)*(depth-65);
      const above=this.terrain.rawElevation(x,z)-this.profile.waterElevationMeters;
      if(above<.2||this.terrain.slopeAt(x,z)>.84)continue;
      const town=this.profile.village;
      const dist=Math.hypot(x-town.x,z-town.z);
      if(dist<town.radius+34)continue;
      if(x>-560&&x<town.x&&Math.abs(z-(town.z-70))<19)continue;
      const species=this.chooseSpecies(x,z);if(!species)continue;
      if(isTree(species.type)&&this.random()<.27)continue;
      const y=this.terrain.heightAt(x,z);
      const scale=(isTree(species.type)?1.3:.75)+this.random()*(isTree(species.type)?1.3:1.2);
      bySpecies.get(species.id).push({x,y,z,scale,rot:this.random()*Math.PI*2});
    }
    for(const species of this.profile.species){
      const positions=bySpecies.get(species.id);
      if(positions.length)this.drawSpecies(species,positions);
    }
  }

  drawSpecies(species,instances) {
    const color=new THREE.Color(species.color);
    const foliageMaterial=new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true,side:THREE.DoubleSide});
    const barkMaterial=new THREE.MeshStandardMaterial({color:species.type==='birch'?'#e5e0d1':'#806b54',roughness:1});
    const dummy=new THREE.Object3D();
    if(isTree(species.type)) {
      const trunk=new THREE.InstancedMesh(new THREE.CylinderGeometry(.56,.85,7,6),barkMaterial,instances.length);
      const crownGeometry=species.type==='conifer'
        ? new THREE.ConeGeometry(5.6,15,7)
        : new THREE.IcosahedronGeometry(species.type==='birch'?5.2:6.6,1);
      const crown=new THREE.InstancedMesh(crownGeometry,foliageMaterial,instances.length);
      instances.forEach((p,i)=>{
        dummy.position.set(p.x,p.y+3.4*p.scale,p.z);dummy.rotation.y=p.rot;
        dummy.scale.set(p.scale*.85,p.scale,p.scale*.85);dummy.updateMatrix();trunk.setMatrixAt(i,dummy.matrix);
        dummy.position.y=p.y+(species.type==='conifer'?12:10)*p.scale;
        dummy.scale.setScalar(p.scale);dummy.updateMatrix();crown.setMatrixAt(i,dummy.matrix);
      });
      trunk.castShadow=true;crown.castShadow=true;trunk.receiveShadow=true;crown.receiveShadow=true;
      this.group.add(trunk,crown);
      return;
    }
    const geometry=species.type==='reed'
      ? new THREE.CylinderGeometry(.25,.16,6,5)
      : species.type==='flower'
        ? new THREE.IcosahedronGeometry(.7,0)
        : new THREE.ConeGeometry(1.1,4.4,5);
    const foliage=new THREE.InstancedMesh(geometry,foliageMaterial,instances.length);
    instances.forEach((p,i)=>{
      dummy.position.set(p.x,p.y+(species.type==='flower'?2.1:species.type==='reed'?3:2)*p.scale,p.z);
      dummy.rotation.y=p.rot;dummy.scale.setScalar(p.scale);dummy.updateMatrix();
      foliage.setMatrixAt(i,dummy.matrix);
    });
    foliage.castShadow=true;this.group.add(foliage);
    if(species.type==='flower') {
      const stem=new THREE.InstancedMesh(new THREE.CylinderGeometry(.12,.12,2.4,4),new THREE.MeshStandardMaterial({color:'#6a9d57'}),instances.length);
      instances.forEach((p,i)=>{
        dummy.position.set(p.x,p.y+1.2*p.scale,p.z);dummy.scale.setScalar(p.scale);dummy.updateMatrix();stem.setMatrixAt(i,dummy.matrix);
      });this.group.add(stem);
    }
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

  update(dt,elapsed) {
    for(const p of this.specimens){
      if(p.discovered){p.marker.visible=false;continue;}
      p.marker.rotation.y+=dt*.7;
      p.marker.position.y=p.y+7+Math.sin(elapsed*1.7+p.x)*.6;
    }
  }
}
