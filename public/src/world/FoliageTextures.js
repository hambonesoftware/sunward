import * as THREE from 'three';

const names=['maple','pine','oak','birch','bark'];

function configureTexture(texture,renderer,name){
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=Math.min(4,renderer?.capabilities?.getMaxAnisotropy?.()??4);
  if(name==='bark'){
    texture.wrapS=THREE.RepeatWrapping;
    texture.wrapT=THREE.RepeatWrapping;
    texture.repeat.set(1,2.4);
  }
  texture.needsUpdate=true;
  return texture;
}

function fallbackTexture(){
  const canvas=document.createElement('canvas');
  canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='#679a57';
  for(let i=0;i<9;i++){
    const x=36+(i%3)*29,y=25+Math.floor(i/3)*28;
    ctx.beginPath();ctx.ellipse(x,y,18,12,i*.7,0,Math.PI*2);ctx.fill();
  }
  return new THREE.CanvasTexture(canvas);
}

// A material factory keeps visual effects independent of plant placement.
function windMaterial(map,windUniform,amount){
  const material=new THREE.MeshStandardMaterial({
    map,color:'#ffffff',roughness:.92,metalness:0,
    alphaTest:map?.image?.width?0.36:0.05,
    side:THREE.DoubleSide,depthWrite:true
  });
  material.onBeforeCompile=shader=>{
    const tip=map?'uv.y':'clamp(position.y/4.0,0.0,1.0)';
    shader.uniforms.sunwardWind=windUniform;
    shader.vertexShader=shader.vertexShader.replace(
      '#include <common>',
      '#include <common>\nuniform float sunwardWind;'
    );
    shader.vertexShader=shader.vertexShader.replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\n#ifdef USE_INSTANCING\nfloat swPhase=instanceMatrix[3].x*.071+instanceMatrix[3].z*.053;\nfloat swHeight='+tip+';\nfloat swTip=max(swHeight-.22,0.0);\ntransformed.x+=sin(sunwardWind*1.45+swPhase+swHeight*2.4)*swTip*'+amount.toFixed(3)+';\n#endif'
    );
  };
  material.customProgramCacheKey=()=>`sunward-wind-${amount}`;
  return material;
}

export async function loadFoliageTextures(renderer){
  const loader=new THREE.TextureLoader();
  const results=await Promise.allSettled(names.map(name=>loader.loadAsync(
    new URL('../../assets/foliage/'+name+'.webp',import.meta.url).href
  )));
  const textures={};
  for(let i=0;i<names.length;i++){
    const result=results[i];
    if(result.status==='fulfilled')textures[names[i]]=configureTexture(result.value,renderer,names[i]);
    else{
      console.warn('Using fallback foliage texture for',names[i],result.reason);
      textures[names[i]]=configureTexture(fallbackTexture(),renderer,names[i]);
    }
  }
  const windUniform={value:0};
  const foliageMaterials={};
  for(const name of ['maple','pine','oak','birch']){
    foliageMaterials[name]=windMaterial(textures[name],windUniform,.16);
  }
  return {
    textures,foliageMaterials,windUniform,
    grassMaterial:windMaterial(null,windUniform,.31),
    setWindTime(time){windUniform.value=time;}
  };
}
