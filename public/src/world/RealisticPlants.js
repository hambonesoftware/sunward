import * as THREE from 'three';

// Foliage geometry and distance management are deliberately independent of
// terrain, quests and species selection. Species arrive as data-driven batches.
const white=new THREE.MeshStandardMaterial({color:'#ffffff',roughness:.97,side:THREE.DoubleSide});
const herbStem=new THREE.MeshStandardMaterial({color:'#71935b',roughness:.96});
const cattailHead=new THREE.MeshStandardMaterial({color:'#74583f',roughness:.99});
const goldenPetal=new THREE.MeshStandardMaterial({color:'#eec14e',roughness:.96});

function makeBatch(group,capacity,geometry,material,pose,{shadow=false,tint=null,receive=false}={}){
  const mesh=new THREE.InstancedMesh(geometry,material,capacity);
  mesh.count=0;
  mesh.castShadow=shadow;mesh.receiveShadow=receive;
  mesh.frustumCulled=false;
  group.add(mesh);
  const dummy=new THREE.Object3D();
  const color=new THREE.Color();
  return {
    mesh,
    update(items){
      mesh.count=items.length;
      items.forEach((item,index)=>{
        dummy.position.set(0,0,0);
        dummy.rotation.set(0,0,0);
        dummy.scale.set(1,1,1);
        pose(dummy,item,index);
        dummy.updateMatrix();
        mesh.setMatrixAt(index,dummy.matrix);
        if(tint)mesh.setColorAt(index,tint(color,item,index));
      });
      mesh.instanceMatrix.needsUpdate=true;
      if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
    }
  };
}

function place(dummy,p,x,y,z,sx,sy,sz,rotation=0){
  const sin=Math.sin(p.rot),cos=Math.cos(p.rot);
  dummy.position.set(
    p.x+(x*cos-z*sin)*p.scale,
    p.y+y*p.scale,
    p.z+(x*sin+z*cos)*p.scale
  );
  dummy.rotation.y=p.rot+rotation;
  dummy.scale.set(sx*p.scale,sy*p.scale,sz*p.scale);
}

function subtleTint(color,p){
  const v=.84+p.shade*.22;
  return color.setRGB(v,v,v);
}

export function makeGrassClump(){
  const positions=[],uvs=[],colors=[],indices=[];
  for(let blade=0;blade<9;blade++){
    const angle=blade*2.39996;
    const length=2.1+(blade%4)*.5;
    const width=.32+(blade%3)*.08;
    const lean=.7+(blade%4)*.18;
    const base=positions.length/3;
    for(let step=0;step<=4;step++){
      const t=step/4;
      const centerX=Math.cos(angle)*lean*t*t;
      const centerZ=Math.sin(angle)*lean*t*t;
      const halfWidth=width*(1-t)*.5;
      for(const side of [-1,1]){
        positions.push(centerX-Math.sin(angle)*halfWidth*side,length*t,centerZ+Math.cos(angle)*halfWidth*side);
        uvs.push(side===-1?0:1,t);
        const shade=.75+(blade%4)*.05;
        colors.push(shade*.86,shade,shade*.62);
      }
      if(step<4){
        const a=base+step*2;
        indices.push(a,a+1,a+2,a+1,a+3,a+2);
      }
    }
  }
  const geom=new THREE.BufferGeometry();
  geom.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geom.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));
  geom.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));
  geom.setIndex(indices);
  geom.computeVertexNormals();
  return geom;
}

function addTree(group,species,positions,assets,handlers){
  const pine=species.type==='conifer';
  const birch=species.type==='birch';
  const leafName=pine?'pine':birch?'birch':species.id==='red-oak'?'oak':'maple';
  const leafMaterial=assets.foliageMaterials[leafName];
  const bark=new THREE.MeshStandardMaterial({
    color:birch?'#e3e0d5':pine?'#a6a09a':'#baa78d',
    map:birch?null:assets.textures.bark,roughness:.98
  });
  const twig=new THREE.MeshStandardMaterial({color:birch?'#aaa49a':'#776e59',roughness:1});
  const fullHeight=pine?11:birch?12:10;
  const radius=pine?.66:birch?.46:.9;

  function trunk(bucket){
    handlers.push({
      bucket,batch:makeBatch(group,positions.length,
        new THREE.CylinderGeometry(radius*.66,radius,fullHeight,9,2),bark,
        (d,p)=>place(d,p,0,fullHeight*.5,0,1,1,1),
        {shadow:bucket==='near',receive:true})
    });
  }
  trunk('near');trunk('mid');

  // Three-dimensional boughs remain visible through the foliage alpha gaps.
  const numBranches=pine?6:4;
  for(let n=0;n<numBranches;n++){
    const angle=n*Math.PI*2/numBranches;
    const height=pine?6.5+(n%3)*2.8:7.3+(n%2)*2;
    const branchLength=pine?6:7.5;
    handlers.push({
      bucket:'near',
      batch:makeBatch(group,positions.length,
        new THREE.CylinderGeometry(.11,.36,branchLength,5),twig,
        (d,p)=>{
          place(d,p,Math.cos(angle)*2.1,height,Math.sin(angle)*2.1,.9,1,.9,angle);
          d.rotation.z=-.65;
        })
    });
  }

  function cards(bucket,count,width,height){
    const geometry=new THREE.PlaneGeometry(width,height,1,2);
    // Each card is a cutout bough texture on a real 3D plane. Intersecting
    // orientations give a volumetric crown without millions of leaf meshes.
    for(let i=0;i<count;i++){
      const azimuth=i*2.399963;
      const layer=i%4;
      const y=pine?7.0+layer*2.75:9.2+layer*2.05;
      const offset=pine?1.8+layer*.65:2.3+(i%5)*.72;
      handlers.push({
        bucket,
        batch:makeBatch(group,positions.length,geometry,leafMaterial,
          (d,p)=>{
            const spin=azimuth+p.shape*.3;
            const x=Math.cos(spin)*offset;
            const z=Math.sin(spin)*offset;
            place(d,p,x,y+(p.shape-.5)*1.2,z,
              .76+(p.shape*.3),.8+(p.shade*.22),1,spin+.55);
            d.rotation.z=(p.shape-.5)*.21;
          },
          {tint:subtleTint,shadow:false})
      });
    }
  }
  cards('near',pine?13:birch?12:16,pine?8.7:birch?6.8:7.9,pine?8.2:birch?6.4:7.2);
  cards('mid',pine?6:birch?5:7,pine?10.5:birch?9.5:11,pine?12.4:birch?11:11.8);
  cards('far',2,pine?15:17,pine?23:19);
}

function addGrass(group,species,positions,assets,handlers){
  const material=assets.grassMaterial;
  material.vertexColors=true;
  const geometry=makeGrassClump();
  for(const bucket of ['near','mid']){
    handlers.push({
      bucket,batch:makeBatch(group,positions.length,geometry,material,
        (d,p)=>place(d,p,0,0,0,
          bucket==='near'?1:1.12,
          bucket==='near'?1:1.08,
          bucket==='near'?1:1.12),
        {tint:(c,p)=>c.set(species.color).offsetHSL(0,-.06,(p.shade-.5)*.21)})
    });
  }
}

function addShrubs(group,species,positions,assets,handlers){
  const geometry=new THREE.PlaneGeometry(3.8,3.7,1,2);
  const leafMaterial=assets.foliageMaterials.birch;
  for(let i=0;i<5;i++){
    const az=i*2.399963;
    handlers.push({
      bucket:'near',batch:makeBatch(group,positions.length,geometry,leafMaterial,
        (d,p)=>place(d,p,Math.cos(az)*.9,2.25+Math.sin(az)*.25,
          Math.sin(az)*.9,.7,1,.7,az),{tint:(c,p)=>c.set('#98b596').multiplyScalar(.83+p.shade*.17)})
    });
  }
  for(let i=0;i<2;i++){
    handlers.push({
      bucket:'mid',batch:makeBatch(group,positions.length,new THREE.PlaneGeometry(5,4.5),leafMaterial,
        (d,p)=>place(d,p,0,2.25,0,.9,1,.9,i*Math.PI*.5),
        {tint:(c,p)=>c.set('#8baa7c').multiplyScalar(.8+p.shade*.18)})
    });
  }
  const berryMaterial=new THREE.MeshStandardMaterial({color:'#526f9b',roughness:.63});
  for(let i=0;i<3;i++){
    handlers.push({
      bucket:'near',batch:makeBatch(group,positions.length,
        new THREE.SphereGeometry(.19,6,5),berryMaterial,
        (d,p)=>place(d,p,Math.sin(i*2.5)*1.1,2.4+i*.28,Math.cos(i*2.5)*.65,1,1,1))
    });
  }
}

function addCattails(group,species,positions,assets,handlers){
  for(let i=0;i<3;i++){
    const x=(i-1)*.75,z=Math.sin(i*2)*.4,h=5.8+(i%2)*1.15;
    handlers.push({
      bucket:'near',batch:makeBatch(group,positions.length,
        new THREE.CylinderGeometry(.1,.17,h,5),herbStem,
        (d,p)=>place(d,p,x,h*.5,z,1,1,1))
    });
    handlers.push({
      bucket:'near',batch:makeBatch(group,positions.length,
        new THREE.CylinderGeometry(.29,.32,1.9,7),cattailHead,
        (d,p)=>place(d,p,x,h-1.05,z,1,1,1))
    });
  }
}

function addGoldenrod(group,species,positions,assets,handlers){
  handlers.push({
    bucket:'near',batch:makeBatch(group,positions.length,
      new THREE.CylinderGeometry(.09,.15,4.5,5),herbStem,
      (d,p)=>place(d,p,0,2.25,0,1,1,1))
  });
  for(let i=0;i<8;i++){
    const angle=i*2.399963,y=3.35+(i%4)*.43;
    handlers.push({
      bucket:'near',batch:makeBatch(group,positions.length,
        new THREE.IcosahedronGeometry(.49,0),goldenPetal,
        (d,p)=>place(d,p,Math.cos(angle)*.65,y,Math.sin(angle)*.6,.8,.7,.8),
        {tint:(c,p)=>c.set('#ffffff').multiplyScalar(.75+p.shade*.24)})
    });
  }
  handlers.push({
    bucket:'mid',batch:makeBatch(group,positions.length,
      new THREE.ConeGeometry(.95,4.2,6),goldenPetal,
      (d,p)=>place(d,p,0,2.1,0,1,1,1))
  });
}

export function createPlantRenderer(group,species,positions,assets){
  const handlers=[];
  if(['conifer','broadleaf','birch'].includes(species.type))
    addTree(group,species,positions,assets,handlers);
  else if(species.type==='grass')
    addGrass(group,species,positions,assets,handlers);
  else if(species.type==='shrub')
    addShrubs(group,species,positions,assets,handlers);
  else if(species.type==='reed')
    addCattails(group,species,positions,assets,handlers);
  else if(species.type==='flower')
    addGoldenrod(group,species,positions,assets,handlers);

  let lastX=Infinity,lastZ=Infinity;
  const tree=['conifer','broadleaf','birch'].includes(species.type);
  return {
    update(cameraX,cameraZ,force=false){
      if(!force&&Math.hypot(cameraX-lastX,cameraZ-lastZ)<9)return;
      lastX=cameraX;lastZ=cameraZ;
      const buckets={near:[],mid:[],far:[]};
      const nearLimit=tree?255:165;
      const midLimit=tree?640:355;
      const farLimit=tree?1190:0;
      for(const p of positions){
        const distance=Math.hypot(p.x-cameraX,p.z-cameraZ);
        if(distance<nearLimit)buckets.near.push(p);
        else if(distance<midLimit)buckets.mid.push(p);
        else if(farLimit&&distance<farLimit)buckets.far.push(p);
      }
      for(const h of handlers)h.batch.update(buckets[h.bucket]);
    },
    dispose(){
      for(const h of handlers){
        h.batch.mesh.geometry.dispose();
        h.batch.mesh.dispose();
        h.batch.mesh.parent?.remove(h.batch.mesh);
      }
    }
  };
}
