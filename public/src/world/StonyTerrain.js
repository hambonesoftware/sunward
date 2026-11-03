import * as THREE from 'three';
import {bilinearElevation} from './StonyElevation.js';

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
    this.detailTiles=new Map();
    this.detailCell=null;
    this.detailSize=160;
    this.detailRadius=2;
    this.detailSegments=20;
    this.detailGroup=new THREE.Group();
    this.group.add(this.detailGroup);
    this.detailMaterial=this.groundMaterial.clone();
    this.detailMaterial.map=this.groundMaterial.map.clone();
    this.detailMaterial.map.repeat.set(3,3);
    this.detailMaterial.map.needsUpdate=true;
    this.detailMaterial.polygonOffset=true;
    this.detailMaterial.polygonOffsetFactor=-2;
    this.detailMaterial.polygonOffsetUnits=-2;
  }
  rawElevation(x,z){
    return bilinearElevation(this.dem,x,z,this.width,this.depth);
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
    const segments=matchMedia('(pointer:coarse)').matches?160:224;
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
    this.groundMaterial=mat;
    this.group.add(mesh);
  }
  // Moving 5x5 terrain detail tiles add 8 m surface geometry only where needed.
  // Distant ground remains a single inexpensive mesh. Every vertex samples
  // the same actual DEM as the player, trails and foliage placement.
  updateDetail(position){
    const cx=Math.floor(position.x/this.detailSize);
    const cz=Math.floor(position.z/this.detailSize);
    const key=cx+','+cz;
    if(key===this.detailCell)return;
    this.detailCell=key;
    const retain=new Set();
    for(let dx=-this.detailRadius;dx<=this.detailRadius;dx++)
      for(let dz=-this.detailRadius;dz<=this.detailRadius;dz++){
        const tx=cx+dx,tz=cz+dz,k=tx+','+tz;
        const x=(tx+.5)*this.detailSize,z=(tz+.5)*this.detailSize;
        if(!this.positionInBounds(x,z,0))continue;
        retain.add(k);
        if(this.detailTiles.has(k))continue;
        const geo=new THREE.PlaneGeometry(this.detailSize,this.detailSize,
          this.detailSegments,this.detailSegments);
        geo.rotateX(-Math.PI/2);
        const vertices=geo.getAttribute('position');
        const colors=new Float32Array(vertices.count*3);
        const color=new THREE.Color();
        for(let i=0;i<vertices.count;i++){
          const wx=x+vertices.getX(i),wz=z+vertices.getZ(i);
          const h=this.heightAt(wx,wz);
          vertices.setY(i,h+.06);
          const slope=this.slopeAt(wx,wz);
          if(this.waterAt(wx,wz))color.set('#7d9b8d');
          else if(slope>.52)color.set('#8f9681');
          else if(h>40)color.set('#778d64');
          else color.set('#8eaa75');
          colors.set([color.r,color.g,color.b],i*3);
        }
        geo.setAttribute('color',new THREE.BufferAttribute(colors,3));
        geo.computeVertexNormals();
        const tile=new THREE.Mesh(geo,this.detailMaterial);
        tile.position.set(x,0,z);
        tile.receiveShadow=true;
        this.detailTiles.set(k,tile);
        this.detailGroup.add(tile);
      }
    for(const [k,tile] of this.detailTiles)if(!retain.has(k)){
      this.detailGroup.remove(tile);
      tile.geometry.dispose();
      this.detailTiles.delete(k);
    }
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
