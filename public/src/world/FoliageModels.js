import * as THREE from 'three';

// Each species is made from a handful of low-poly, GPU-instanced layers.
// Geometry is shared within each layer, so thousands of plants need only
// a small, predictable number of draw calls on mobile GPUs.
function layer(group, instances, geometry, material, pose, tint, shadows=true) {
  if (!instances.length) return null;
  const mesh=new THREE.InstancedMesh(geometry,material,instances.length);
  const dummy=new THREE.Object3D();
  const sample=new THREE.Color();
  for(let i=0;i<instances.length;i++){
    dummy.position.set(0,0,0);
    dummy.rotation.set(0,0,0);
    dummy.scale.set(1,1,1);
    pose(dummy,instances[i],i);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
    if(tint)mesh.setColorAt(i,tint(sample,instances[i],i));
  }
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.castShadow=shadows;
  mesh.receiveShadow=true;
  mesh.frustumCulled=false;
  group.add(mesh);
  return mesh;
}

function leaves() {
  return new THREE.MeshStandardMaterial({
    color:'#ffffff',roughness:.93,flatShading:true,side:THREE.DoubleSide
  });
}

function wood(color) {
  return new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});
}

function tint(species,light=0) {
  return (color,p)=>color.set(species.color).offsetHSL(
    (p.shade-.5)*.038,
    (p.shade-.5)*.09,
    (p.shade-.5)*.18+light
  );
}

function setPlantPose(dummy,p,dx,dy,dz,sx,sy,sz) {
  const c=Math.cos(p.rot),s=Math.sin(p.rot);
  dummy.position.set(
    p.x+(dx*c-dz*s)*p.scale,
    p.y+dy*p.scale,
    p.z+(dx*s+dz*c)*p.scale
  );
  dummy.rotation.y=p.rot;
  dummy.scale.set(sx*p.scale,sy*p.scale,sz*p.scale);
}

function trees(group,species,instances) {
  const birch=species.type==='birch';
  const pine=species.type==='conifer';
  const trunkHeight=pine?9:birch?11:9.5;
  const trunkRadius=pine?.69:birch?.43:.88;
  layer(group,instances,
    new THREE.CylinderGeometry(trunkRadius*.75,trunkRadius,trunkHeight,7),
    wood(birch?'#e7ded0':pine?'#776b57':'#826751'),
    (d,p)=>setPlantPose(d,p,0,trunkHeight*.5,0,.9,1,.9),null);

  if(birch){
    const bands=new THREE.MeshStandardMaterial({color:'#83766a',roughness:1});
    for(const h of [2.4,5.5,8.3]){
      layer(group,instances,new THREE.CylinderGeometry(.45,.45,.17,7),
        bands,(d,p)=>setPlantPose(d,p,0,h,0,.92,1,.92),null,false);
    }
  }

  if(pine){
    const layers=[
      {y:7.4,r:5.5,h:8.5,light:-.055},
      {y:10.6,r:4.65,h:7.9,light:.025},
      {y:13.5,r:3.65,h:7.1,light:-.015},
      {y:16.2,r:2.35,h:5.3,light:.065}
    ];
    for(const tier of layers){
      layer(group,instances,new THREE.ConeGeometry(tier.r,tier.h,9,2),
        leaves(),
        (d,p)=>setPlantPose(d,p,0,tier.y,0,1+(p.shape-.5)*.11,1,1+(p.shape-.5)*.11),
        tint(species,tier.light));
    }
    return;
  }

  // Visible forked limbs support an uneven, overlapping canopy.
  const branchGeom=new THREE.CylinderGeometry(.2,.43,6.5,6);
  for(const side of [-1,1]){
    layer(group,instances,branchGeom,wood(birch?'#ded4c9':'#876b54'),
      (d,p)=>{
        setPlantPose(d,p,side*2.15,8.25,.45,.9,1,.9);
        d.rotation.z=side*.62;
      },null,false);
  }
  const lobes=birch?[
    [0,13,0,4.1,.025],[-3.1,11.9,.8,3.05,-.035],
    [3.35,12.3,-1,3.15,.09],[.8,15.4,1,3.2,.06],
    [-.7,12.4,-3.0,2.8,-.075]
  ]:[
    [0,13.1,0,5.8,.0],[-4.1,11.2,1.0,4.5,-.05],
    [4.15,11.7,-.8,4.75,.045],[-1.3,15,2.3,4.45,.09],
    [1.65,13.8,-3.4,4.15,-.07],[.6,16.1,-.1,3.55,.065]
  ];
  const lobeGeometry=new THREE.IcosahedronGeometry(1,1);
  for(const [dx,dy,dz,r,shade] of lobes){
    layer(group,instances,lobeGeometry,leaves(),
      (d,p)=>setPlantPose(d,p,dx,dy+(p.shape-.5)*1.1,dz,r,r*(.79+p.shape*.12),r*.92),
      tint(species,shade));
  }
}

function grasses(group,species,instances) {
  const material=leaves();
  for(let blade=0;blade<5;blade++){
    const spread=(blade-2)*.43;
    const height=3.3+(blade%3)*.65;
    layer(group,instances,new THREE.ConeGeometry(.33,height,4),material,
      (d,p)=>{
        setPlantPose(d,p,Math.sin(blade*2.4)*.6,height*.5,Math.cos(blade*2.4)*.6,.7,1,.7);
        d.rotation.z=(blade-2)*.15;
        d.rotation.x=Math.sin(blade*1.5)*.13;
      },tint(species,(blade-2)*.025),false);
  }
}

function reeds(group,species,instances) {
  const stalk=wood('#739a65'),seed=wood('#795b3c');
  const leaf=leaves();
  for(let stem=0;stem<3;stem++){
    const dx=(stem-1)*.8;
    const h=5.6+(stem%2)*1.15;
    layer(group,instances,new THREE.CylinderGeometry(.11,.18,h,5),stalk,
      (d,p)=>setPlantPose(d,p,dx,h*.5,Math.sin(stem*2)*.6,.82,1,.82),null,false);
    layer(group,instances,new THREE.CylinderGeometry(.29,.33,1.9,7),seed,
      (d,p)=>setPlantPose(d,p,dx,h-1.15,Math.sin(stem*2)*.6,.88,1,.88),null,false);
    layer(group,instances,new THREE.ConeGeometry(.44,4.9,4),leaf,
      (d,p)=>{
        setPlantPose(d,p,dx+.38,2.5,0,.8,1,.8);
        d.rotation.z=.26;
      },tint(species,-.03),false);
  }
}

function flowers(group,species,instances) {
  const stem=wood('#648b4e'),leaf=leaves();
  layer(group,instances,new THREE.CylinderGeometry(.12,.17,4.1,5),stem,
    (d,p)=>setPlantPose(d,p,0,2.05,0,1,1,1),null,false);
  for(const direction of [-1,1]){
    layer(group,instances,new THREE.ConeGeometry(.45,2.2,5),leaf,
      (d,p)=>{
        setPlantPose(d,p,direction*.55,1.55,0,.8,1,.8);
        d.rotation.z=direction*.67;
      },(c,p)=>c.set('#719b54').offsetHSL(0,0,(p.shade-.5)*.13),false);
  }
  // Goldenrod-like clustered sprays rather than one floating sphere.
  const tips=[
    [0,4.3,0,.62],[-.6,3.8,0,.43],[.62,3.95,0,.42],
    [-.26,4.95,.12,.4],[.3,4.72,-.35,.36],[.13,3.65,.6,.35]
  ];
  const bloomGeometry=new THREE.IcosahedronGeometry(1,0);
  for(const [x,y,z,r] of tips){
    layer(group,instances,bloomGeometry,leaf,
      (d,p)=>setPlantPose(d,p,x,y,z,r,r*.78,r),
      tint(species,(y-4)*.06),false);
  }
}

function shrubs(group,species,instances) {
  const centers=[
    [-1.0,1.7,0,2], [1.1,1.75,.25,1.9],
    [0,2.6,.8,2.0], [.2,1.65,-1.15,1.7]
  ];
  const geometry=new THREE.IcosahedronGeometry(1,0);
  for(const [x,y,z,r] of centers){
    layer(group,instances,geometry,leaves(),
      (d,p)=>setPlantPose(d,p,x,y,z,r,r*.78,r),
      tint(species,(y-2)*.065),false);
  }
  const berry=wood('#566e91');
  for(const [x,y,z] of [[-.65,3,.7],[.8,2.8,1.25]]){
    layer(group,instances,new THREE.SphereGeometry(.18,5,4),berry,
      (d,p)=>setPlantPose(d,p,x,y,z,1,1,1),null,false);
  }
}

export function renderVegetationSpecies(group,species,instances) {
  if(species.type==='conifer'||species.type==='broadleaf'||species.type==='birch'){
    trees(group,species,instances);
  } else if(species.type==='grass') {
    grasses(group,species,instances);
  } else if(species.type==='reed') {
    reeds(group,species,instances);
  } else if(species.type==='flower') {
    flowers(group,species,instances);
  } else if(species.type==='shrub') {
    shrubs(group,species,instances);
  }
}
