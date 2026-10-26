import * as THREE from 'three';
import {mergeGeometries} from '../../vendor/three-addons/utils/BufferGeometryUtils.js';

// A procedural, moderately realistic close-up placeholder: dozens of small,
// intersecting textured boughs rather than single blocky Kenney crowns.
// Asset slots are independent so approved GLB LODs can replace the placeholder.
export const TREE_LIBRARY={
  oak:{name:'oak / mixed hardwood',height:17,leaf:'oak',fallback:'tree_detailed'},
  maple:{name:'maple',height:16,leaf:'maple',fallback:'tree_detailed'},
  birch:{name:'birch-like hardwood',height:15,leaf:'birch',fallback:'tree_simple'},
  pine:{name:'pine',height:19,leaf:'pine',fallback:'tree_pineTallB_detailed'},
  hickory:{name:'hickory-like hardwood',height:17,leaf:'oak',fallback:'tree_detailed'}
};
const UNIT_Y=new THREE.Vector3(0,1,0);
function branchCylinder(start,end,radiusBottom,radiusTop){
  const direction=new THREE.Vector3().subVectors(end,start);
  const center=new THREE.Vector3().addVectors(start,end).multiplyScalar(.5);
  const geom=new THREE.CylinderGeometry(radiusTop,radiusBottom,direction.length(),7,1);
  const matrix=new THREE.Matrix4().compose(
    center,new THREE.Quaternion().setFromUnitVectors(UNIT_Y,direction.clone().normalize()),
    new THREE.Vector3(1,1,1)
  );
  geom.applyMatrix4(matrix);
  return geom;
}
function boughCard(center,w,h,angle,tilt){
  const geom=new THREE.PlaneGeometry(w,h,1,1);
  const q=new THREE.Quaternion().setFromEuler(new THREE.Euler(
    tilt,angle,(Math.sin(angle*3.7)*.35),'XYZ'
  ));
  geom.applyMatrix4(new THREE.Matrix4().compose(
    center,q,new THREE.Vector3(1,1,1)
  ));
  return geom;
}
const randomFromSeed=seed=>{
  let value=seed>>>0;
  return ()=>{
    value=(1664525*value+1013904223)>>>0;
    return value/4294967296;
  };
};
function buildCrown(kind){
  const rng=randomFromSeed(kind==='pine'?15398:kind==='birch'?4532:kind==='oak'?22215:81761);
  const pine=kind==='pine',birch=kind==='birch';
  const trunkTop=pine?14:birch?11:11.5;
  const wood=[branchCylinder(
    new THREE.Vector3(0,-.14,0),new THREE.Vector3(.12,trunkTop,.13),
    pine?.49:birch?.31:.55,.08
  )];
  const leaves=[];
  const branchCount=pine?19:15;
  for(let i=0;i<branchCount;i++){
    const t=i/branchCount;
    const angle=i*2.399963+(.5-rng())*.46;
    const altitude=pine?3+t*10.1:4.3+t*6.2;
    const radial=pine?(5-t*3.15)*(0.75+rng()*.3):
      (2.5+rng()*3.15)*(1-t*.36);
    const start=new THREE.Vector3(.02,altitude,0);
    const tip=new THREE.Vector3(
      Math.cos(angle)*radial,altitude+(pine?-.4:rng()*3.2-.3),Math.sin(angle)*radial
    );
    wood.push(branchCylinder(start,tip,pine?.095:.16,.025));
    // Branchlets and leaf-clusters are deliberately different sizes and angles.
    const sprays=pine?10:12;
    for(let n=0;n<sprays;n++){
      const progress=.44+rng()*.58;
      const bend=(rng()-.5)*(pine?1.5:2.3);
      const p=start.clone().lerp(tip,progress);
      p.x+=Math.cos(angle+Math.PI/2)*bend;
      p.z+=Math.sin(angle+Math.PI/2)*bend;
      p.y+=(rng()-.5)*(pine?.9:2.5);
      const w=pine?.75+rng()*.85:.68+rng()*.94;
      const h=pine?1.3+rng()*1.1:1.0+rng()*1.25;
      leaves.push(boughCard(p,w,h,angle+(.5-rng())*2.7,
        (rng()-.5)*1.25));
      // Two planes at differing orientations add depth from walking angles.
      if(n%3===0)leaves.push(boughCard(
        p.clone().add(new THREE.Vector3(.2,.13,-.15)),
        w*.75,h*.8,angle+Math.PI*.43,(rng()-.5)*.9
      ));
    }
  }
  // Young tips round out the very top; still avoid geometric lobe spheres.
  for(let i=0;i<13;i++){
    const angle=i*2.4, r=rng()*(pine?1.5:3.0);
    leaves.push(boughCard(
      new THREE.Vector3(Math.cos(angle)*r,10.5+rng()*3.3,Math.sin(angle)*r),
      .7+rng()*.65,1.2+rng()*.9,angle,(rng()-.5)*.7
    ));
  }
  const bark=mergeGeometries(wood,false);
  const foliage=mergeGeometries(leaves,false);
  for(const mesh of [...wood,...leaves])mesh.dispose();
  if(!bark||!foliage)throw new Error('Cannot construct close-range tree');
  bark.computeBoundingSphere();foliage.computeBoundingSphere();
  return {bark,foliage};
}
export class StonyTreeLibrary{
  constructor(group,assets,lod) {
    this.group=group;this.assets=assets;this.lod=lod;
    this.groups=new Map();
    const shared=assets.foliageMaterials||{};
    for(const [name,species] of Object.entries(TREE_LIBRARY)){
      const geometry=buildCrown(name);
      const bark=new THREE.MeshStandardMaterial({
        color:name==='birch'?'#d2d0c3':'#978471',
        map:name==='birch'?null:assets.textures?.bark||null,
        roughness:1,metalness:0
      });
      const leaf=shared[species.leaf]?.clone()||
        new THREE.MeshStandardMaterial({color:'#68915f',side:THREE.DoubleSide,roughness:1});
      leaf.side=THREE.DoubleSide;
      leaf.alphaTest=shared[species.leaf]?0.30:0;
      const capacity=lod.maxHeroes;
      const trunkMesh=new THREE.InstancedMesh(geometry.bark,bark,capacity);
      const crownMesh=new THREE.InstancedMesh(geometry.foliage,leaf,capacity);
      for(const mesh of [trunkMesh,crownMesh]){
        mesh.count=0;mesh.frustumCulled=false;mesh.castShadow=false;
        mesh.receiveShadow=false;group.add(mesh);
      }
      this.groups.set(name,{species,meshes:[trunkMesh,crownMesh]});
    }
    this.dummy=new THREE.Object3D();
  }
  update(trees,player) {
    for(const [name,group] of this.groups){
      const near=trees.filter(t=>t.species===name).map(tree=>({
        tree,d2:(tree.x-player.x)**2+(tree.z-player.z)**2
      })).filter(item=>item.d2<this.lod.heroRadius**2)
        .sort((a,b)=>a.d2-b.d2)
        .slice(0,this.lod.maxHeroes);
      let index=0;
      for(const {tree} of near) {
        this.dummy.position.set(tree.x,tree.y,tree.z);
        this.dummy.rotation.set(0,tree.rot,0);
        const scale=tree.scale*group.species.height/14;
        this.dummy.scale.setScalar(scale);
        this.dummy.updateMatrix();
        for(const mesh of group.meshes)mesh.setMatrixAt(index,this.dummy.matrix);
        index++;
      }
      for(const mesh of group.meshes){
        mesh.count=index;mesh.instanceMatrix.needsUpdate=true;
      }
    }
  }
}
