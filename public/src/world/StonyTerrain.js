import * as THREE from 'three';

// Coordinates are meters in an east/right, south/down local tangent plane.
export const project=(lon,lat,bounds)=>{
  const cLat=(bounds.north+bounds.south)/2;
  return {
    x:(lon-(bounds.west+bounds.east)/2)*111320*Math.cos(cLat*Math.PI/180),
    z:((bounds.north+bounds.south)/2-lat)*111132
  };
};
export function insidePolygon(x,z,polygon){
  let hit=false;
  const p=polygon.points;
  for(let i=0,j=p.length-1;i<p.length;j=i++){
    const a=p[i],b=p[j];
    if((a.z>z)!==(b.z>z)&&x<(b.x-a.x)*(z-a.z)/(b.z-a.z)+a.x)hit=!hit;
  }
  return hit;
}
const lerp=THREE.MathUtils.lerp;
const clamp=THREE.MathUtils.clamp;
function makeGroundTexture(){
  const c=document.createElement('canvas');c.width=256;c.height=256;
  const ctx=c.getContext('2d');
  ctx.fillStyle='#eeede1';ctx.fillRect(0,0,256,256);
  // A subtle tiled microstructure, rather than uniformly painted grass.
  let seed=4319;const random=()=>{seed=(1664525*seed+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<3200;i++){
    const x=random()*256,y=random()*256,r=.4+random()*2.2;
    ctx.fillStyle=random()>.47?'rgba(64,79,43,.16)':'rgba(255,255,228,.27)';
    ctx.fillRect(x,y,r,r*1.6);
  }
  const texture=new THREE.CanvasTexture(c);
  texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
  texture.repeat.set(72,76);
  texture.colorSpace=THREE.SRGBColorSpace;
  texture.anisotropy=4;
  return texture;
}
function simplify(points,min=2.5){
  const result=[];let last=null;
  for(const p of points){
    if(!last||Math.hypot(p.x-last.x,p.z-last.z)>min){result.push(p);last=p;}
  }
  if(points.length>2&&result.at(-1)!==points.at(-1))result.push(points.at(-1));
  return result;
}
export class StonyTerrain {
  constructor(scene,dem,map){
    this.dem=dem;this.map=map;this.bounds=dem.bounds;
    this.width=(this.bounds.east-this.bounds.west)*111320*Math.cos((this.bounds.north+this.bounds.south)*Math.PI/360);
    this.depth=(this.bounds.north-this.bounds.south)*111132;
    this.datum=Math.floor(dem.minimum);
    this.water=[];
    for(const coordinates of map.water||[]){
      if(coordinates.length<4)continue;
      const pts=simplify(coordinates.map(([lon,lat])=>project(lon,lat,this.bounds)));
      if(pts.length<4)continue;
      const xs=pts.map(p=>p.x),zs=pts.map(p=>p.z);
      const polygon={points:pts,minX:Math.min(...xs),maxX:Math.max(...xs),minZ:Math.min(...zs),maxZ:Math.max(...zs)};
      // USGS raster edges approximate the level of the water at its shoreline.
      const candidates=pts.filter((_,i)=>i%Math.max(1,Math.floor(pts.length/22))===0)
        .map(p=>this.rawHeight(p.x,p.z)).sort((a,b)=>a-b);
      polygon.y=candidates[Math.floor(candidates.length*.32)]??0;
      if(!Number.isFinite(polygon.y))continue;
      this.water.push(polygon);
    }
    this.group=new THREE.Group();scene.add(this.group);
    this.makeTerrain();
    this.makeLakes();
  }
  rawElevation(x,z){
    const {width,height,samples}=this.dem;
    const fx=clamp((x/this.width+.5)*(width-1),0,width-1);
    const fz=clamp((z/this.depth+.5)*(height-1),0,height-1);
    const ax=Math.floor(fx),az=Math.floor(fz),bx=Math.min(width-1,ax+1),bz=Math.min(height-1,az+1);
    const tx=fx-ax,tz=fz-az;
    return lerp(lerp(samples[az][ax],samples[az][bx],tx),
      lerp(samples[bz][ax],samples[bz][bx],tx),tz);
  }
  rawHeight(x,z){return this.rawElevation(x,z)-this.datum;}
  waterAt(x,z){
    for(const p of this.water){
      if(x>=p.minX&&x<=p.maxX&&z>=p.minZ&&z<=p.maxZ&&insidePolygon(x,z,p))return p;
    }
    return null;
  }
  heightAt(x,z){
    const lake=this.waterAt(x,z);
    return lake?Math.min(lake.y-.65,this.rawHeight(x,z)):this.rawHeight(x,z);
  }
  surfaceAt(x,z){return this.waterAt(x,z)?.y??this.heightAt(x,z);}
  slopeAt(x,z){
    const d=6;
    return Math.hypot(this.heightAt(x+d,z)-this.heightAt(x-d,z),
      this.heightAt(x,z+d)-this.heightAt(x,z-d))/(2*d);
  }
  positionInBounds(x,z,margin=8){
    return Math.abs(x)<this.width/2-margin&&Math.abs(z)<this.depth/2-margin;
  }
  makeTerrain(){
    const segments=matchMedia('(pointer:coarse)').matches?128:192;
    const geometry=new THREE.PlaneGeometry(this.width,this.depth,segments,segments);
    geometry.rotateX(-Math.PI/2);
    const pos=geometry.getAttribute('position');
    const colors=new Float32Array(pos.count*3);
    const c=new THREE.Color();
    for(let i=0;i<pos.count;i++){
      const x=pos.getX(i),z=pos.getZ(i);
      const y=this.heightAt(x,z),s=this.slopeAt(x,z);
      pos.setY(i,y);
      if(this.waterAt(x,z))c.set('#7d9b8d');
      else if(s>.52)c.set('#8f9681');
      else if(y>40)c.set('#778d64');
      else c.set('#8eaa75');
      const organic=Math.sin(x*.016+z*.009)*.023+Math.cos(z*.022-x*.014)*.027;
      c.offsetHSL(0,0,organic);
      colors.set([c.r,c.g,c.b],i*3);
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    const mat=new THREE.MeshStandardMaterial({
      vertexColors:true,map:makeGroundTexture(),roughness:1,metalness:0
    });
    const mesh=new THREE.Mesh(geometry,mat);
    mesh.receiveShadow=true;
    this.group.add(mesh);
  }
  makeLakes(){
    const material=new THREE.MeshStandardMaterial({
      color:'#668f9b',metalness:.12,roughness:.29,transparent:true,opacity:.9,
      side:THREE.DoubleSide
    });
    for(const lake of this.water){
      if(lake.points.length>2500)continue;
      const pts=lake.points;
      const shape=new THREE.Shape();
      pts.forEach((p,i)=>i===0?shape.moveTo(p.x,-p.z):shape.lineTo(p.x,-p.z));
      shape.closePath();
      const geometry=new THREE.ShapeGeometry(shape);
      geometry.rotateX(-Math.PI/2);
      const mesh=new THREE.Mesh(geometry,material);
      mesh.position.y=lake.y+.035;
      mesh.receiveShadow=false;
      mesh.renderOrder=1;
      this.group.add(mesh);
    }
  }
}
