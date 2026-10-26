import * as THREE from 'three';
import {GLTFLoader} from '../../vendor/three-addons/loaders/GLTFLoader.js';
import {renderVegetationSpecies} from './FoliageModels.js';

// Kenney Nature Kit, CC0: https://kenney.nl/assets/nature-kit.
// Models are bundled as independent GLBs so regions can reuse this loader.
// Materials are reauthored together to avoid an unlit, over-bright foreground.
export const KENNEY_MODEL_IDS = Object.freeze([
  'tree_detailed', 'tree_simple', 'tree_pineTallB_detailed',
  'tree_pineTallC_detailed', 'tree_pineDefaultB',
  'tree_pineSmallC', 'tree_pineRoundB', 'plant_bushDetailed',
  'plant_flatShort', 'flower_yellowC', 'flower_purpleA',
  'rock_smallF', 'mushroom_tan'
]);

const PALETTE = Object.freeze({
  oak: '#6b9360', maple: '#83a976', birch: '#a0b58a',
  pine: '#557a61', bark: '#806b55', birchBark: '#d9d0b7',
  sand: '#c8b28b', rock: '#a3a798', ground: '#879f6c'
});
const speciesModels = Object.freeze({
  'white-pine': ['tree_pineTallB_detailed','tree_pineTallC_detailed','tree_pineDefaultB','tree_pineSmallC','tree_pineRoundB'],
  'sugar-maple': ['tree_detailed','tree_simple'],
  'paper-birch': ['tree_simple','tree_detailed'],
  'red-oak': ['tree_detailed','tree_simple'],
  'lowbush-blueberry': ['plant_bushDetailed'],
  'dune-grass': ['plant_flatShort'],
  'goldenrod': ['flower_yellowC']
});

function isTree(species) {
  return ['conifer','broadleaf','birch'].includes(species.type);
}

function speciesHeight(species) {
  if(species.type==='conifer')return 14;
  if(species.type==='broadleaf')return 12;
  if(species.type==='birch')return 12.5;
  if(species.type==='shrub')return 3.1;
  if(species.type==='flower')return 4.5;
  return 2.6;
}

function meshColor(materialName, species, modelID) {
  const name=(materialName||'').toLowerCase();
  if(name.includes('wood')||name.includes('bark'))
    return species?.type==='birch' ? PALETTE.birchBark : PALETTE.bark;
  if(name.includes('purple'))return '#9a77bb';
  if(name.includes('yellow'))return '#edc45c';
  if(name.includes('white'))return '#f1e9d7';
  if(name.includes('tan')||name.includes('dirt'))return PALETTE.sand;
  if(modelID.startsWith('rock'))return PALETTE.rock;
  if(modelID.startsWith('mushroom'))return '#c6aa88';
  if(name.includes('grass')||name.includes('leaf')||name.includes('green')){
    if(species?.id==='white-pine')return PALETTE.pine;
    if(species?.id==='sugar-maple')return PALETTE.maple;
    if(species?.id==='paper-birch')return PALETTE.birch;
    if(species?.id==='red-oak')return PALETTE.oak;
    return species?.color||PALETTE.ground;
  }
  if(modelID.startsWith('tree'))return species?.color||PALETTE.oak;
  return species?.color||PALETTE.ground;
}

function materialFor(source,species,id) {
  return new THREE.MeshStandardMaterial({
    name:source.name||id,
    color:meshColor(source.name,species,id),
    roughness:.95,
    metalness:0,
    flatShading:true,
    side:THREE.DoubleSide
  });
}

function prepareModel(gltf) {
  const parts=[];
  const box=new THREE.Box3();
  gltf.scene.updateMatrixWorld(true);
  gltf.scene.traverse(node=>{
    if(!node.isMesh||!node.geometry)return;
    const geometry=node.geometry.clone();
    geometry.applyMatrix4(node.matrixWorld);
    geometry.computeBoundingBox();
    if(!geometry.getAttribute('normal'))geometry.computeVertexNormals();
    box.union(geometry.boundingBox);
    parts.push({geometry,material:node.material});
  });
  if(box.isEmpty()||!parts.length)return null;
  return {
    parts,
    height:Math.max(.01,box.max.y-box.min.y),
    offset:new THREE.Vector3(
      (box.min.x+box.max.x)/2,
      box.min.y,
      (box.min.z+box.max.z)/2
    )
  };
}

export async function loadKenneyNatureAssets() {
  const loader=new GLTFLoader();
  const models=new Map();
  const missing=[];
  // Four parallel requests keep initial loading responsive on phones.
  const queue=[...KENNEY_MODEL_IDS];
  async function worker() {
    while(queue.length) {
      const id=queue.shift();
      try {
        const url=new URL(`../../assets/kenney/${id}.glb`,import.meta.url);
        const gltf=await loader.loadAsync(url.href);
        const result=prepareModel(gltf);
        if(!result)throw new Error('No mesh geometry');
        models.set(id,result);
      }catch(error) {
        missing.push(id);
        console.warn('Kenney model unavailable:',id,error);
      }
    }
  }
  await Promise.all(Array.from({length:4},worker));
  console.info(`Kenney Nature Kit: ${models.size}/${KENNEY_MODEL_IDS.length} GLBs available`);
  return {
    models,missing,
    grassMaterial:new THREE.MeshStandardMaterial({
      color:'#a6b583',vertexColors:true,
      flatShading:true,side:THREE.DoubleSide,roughness:1
    }),
    setWindTime() {}
  };
}

// A single model renderer batches each sub-mesh with InstancedMesh and does
// player-relative distance culling; nothing is allocated every animation frame.
export function createKenneyModelRenderer(group,modelID,positions,assets,{
  species=null,height=4,maxDistance=220,minDistance=0,maxVisible=Infinity
}={}) {
  const model=assets.models.get(modelID);
  if(!model||!positions.length)return null;
  const capacity=Math.max(1,Math.min(positions.length,maxVisible));
  const meshes=model.parts.map(({geometry,material})=>{
    const mesh=new THREE.InstancedMesh(
      geometry,materialFor(material,species,modelID),capacity
    );
    mesh.count=0;
    mesh.frustumCulled=false;
    mesh.castShadow=false;
    mesh.receiveShadow=false;
    group.add(mesh);
    return mesh;
  });
  const dummy=new THREE.Object3D();
  const tint=new THREE.Color();
  let lastX=Infinity,lastZ=Infinity;
  const radiusSq=maxDistance*maxDistance,minSq=minDistance*minDistance;
  return {
    update(cameraX,cameraZ,force=false) {
      if(!force&&Math.hypot(cameraX-lastX,cameraZ-lastZ)<10)return;
      lastX=cameraX;lastZ=cameraZ;
      let visible=0;
      // Nearest-first selection guarantees that the bounded GPU buffer always
      // contains relevant trees rather than the earliest random coordinates.
      const candidates=[];
      for(const p of positions){
        const dx=p.x-cameraX,dz=p.z-cameraZ;
        const d2=dx*dx+dz*dz;
        if(d2>=minSq&&d2<=radiusSq)candidates.push({p,d2});
      }
      candidates.sort((a,b)=>a.d2-b.d2);
      for(const {p} of candidates.slice(0,capacity)) {
        const factor=(height/model.height)*(p.scale??1);
        const rot=p.rot||0;
        const cos=Math.cos(rot),sin=Math.sin(rot);
        dummy.position.set(
          p.x-(model.offset.x*cos-model.offset.z*sin)*factor,
          p.y-model.offset.y*factor,
          p.z-(model.offset.x*sin+model.offset.z*cos)*factor
        );
        dummy.rotation.set(0,rot,0);
        dummy.scale.setScalar(factor);
        dummy.updateMatrix();
        tint.setRGB(.89+(p.shade??.5)*.17,.89+(p.shade??.5)*.17,.89+(p.shade??.5)*.17);
        for(const mesh of meshes) {
          mesh.setMatrixAt(visible,dummy.matrix);
          mesh.setColorAt(visible,tint);
        }
        visible++;
      }
      for(const mesh of meshes) {
        mesh.count=visible;
        mesh.instanceMatrix.needsUpdate=true;
        if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
      }
    },
    dispose() {
      for(const mesh of meshes){
        mesh.parent?.remove(mesh);
        mesh.material.dispose();
      }
    }
  };
}

export function createPlantRenderer(group,species,positions,assets) {
  if(!positions.length)return {update(){},dispose(){}};
  const available=(speciesModels[species.id]||[])
    .filter(id=>assets.models.has(id));
  if(!available.length) {
    // Reuse the original fully volumetric low-poly species shapes only when
    // a Kenney model isn't provided (e.g., the distinctive cattail heads).
    renderVegetationSpecies(group,species,positions);
    return {update(){},dispose(){}};
  }
  const batches=available.map(()=>[]);
  positions.forEach((item,i)=>batches[i%available.length].push(item));
  const renderers=available.map((id,i)=>createKenneyModelRenderer(
    group,id,batches[i],assets,{
      species,height:speciesHeight(species),
      maxDistance:isTree(species)?740:species.type==='shrub'?360:240
    }
  )).filter(Boolean);
  return {
    update(x,z,force=false){for(const renderer of renderers)renderer.update(x,z,force);},
    dispose(){for(const renderer of renderers)renderer.dispose();}
  };
}
