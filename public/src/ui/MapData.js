// Map art and trail routing shared by the minimap and the full-screen map.
// Everything is drawn from the same real data the 3D scene uses: USGS elevation
// (hillshade), OpenStreetMap water, habitat areas, paths and named landmarks.
import {project} from '../world/StonyTerrain.js';

export const STYLE={
  land:'#a9c08f',
  wood:'#7f9f6c',
  wetland:'#8fb3a0',
  meadow:'#c3cf98',
  water:'#5f9fbf',
  waterEdge:'#4b86a6',
  road:'#f4f1e6',
  roadEdge:'#7d7f78',
  trail:'#7a5b3a',
  cycleway:'#c99a4e',
  route:'#b04dff',
  player:'#ffffff',
  waypoint:'#ffcc33'
};
const HABITAT={wood:STYLE.wood,forest:STYLE.wood,wetland:STYLE.wetland,meadow:STYLE.meadow,grassland:STYLE.meadow};
const ROADS=new Set(['residential','service']);

export class MapData{
  constructor(terrain,map){
    this.terrain=terrain;
    this.width=terrain.width;this.depth=terrain.depth;
    const coarse=matchMedia('(pointer:coarse)').matches;
    this.mpp=coarse?4.5:3.5; // metres per texture pixel
    this.paths=[];
    for(const path of map.paths||[]){
      if(path.foot==='no')continue;
      const points=path.coords.map(([lon,lat])=>project(lon,lat,terrain.bounds));
      if(points.length<2)continue;
      const xs=points.map(p=>p.x),zs=points.map(p=>p.z);
      this.paths.push({points,coords:path.coords,kind:path.kind,name:path.name||'',
        x0:Math.min(...xs),x1:Math.max(...xs),z0:Math.min(...zs),z1:Math.max(...zs)});
    }
    this.habitats=(map.habitats||[]).map(h=>({kind:h.kind,points:h.coords.map(([lon,lat])=>project(lon,lat,terrain.bounds))}));
    this.landmarks=dedupeLandmarks((map.landmarks||[]).map(l=>({name:l.name,...project(l.lon,l.lat,terrain.bounds)})));
    this.texture=this.paint();
    this.buildGraph();
  }

  // World (x east, z south) to texture pixels, north up.
  toTex(x,z){return [(x+this.width/2)/this.mpp,(z+this.depth/2)/this.mpp];}
  fromTex(px,py){return {x:px*this.mpp-this.width/2,z:py*this.mpp-this.depth/2};}

  paint(){
    const w=Math.ceil(this.width/this.mpp),h=Math.ceil(this.depth/this.mpp);
    const canvas=document.createElement('canvas');canvas.width=w;canvas.height=h;
    const ctx=canvas.getContext('2d');
    ctx.fillStyle=STYLE.land;ctx.fillRect(0,0,w,h);
    const poly=(points,fill,stroke,lw)=>{
      ctx.beginPath();
      points.forEach((p,i)=>{const [x,y]=this.toTex(p.x,p.z);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      ctx.closePath();
      if(fill){ctx.fillStyle=fill;ctx.fill();}
      if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke();}
    };
    for(const hab of this.habitats)if(HABITAT[hab.kind])poly(hab.points,HABITAT[hab.kind]);
    this.paintHillshade(ctx,w,h);
    for(const lake of this.terrain.water)poly(lake.points,STYLE.water,STYLE.waterEdge,1.4);
    this.strokePaths(ctx,p=>this.toTex(p.x,p.z),3.5/this.mpp);
    return canvas;
  }

  // Trails dashed brown, cycleways tan, roads white with grey casing.
  // pt maps a world point to canvas pixels; k scales line widths;
  // view (optional) is a world rectangle {x0,z0,x1,z1} used to skip off-screen paths.
  strokePaths(ctx,pt,k,view){
    const visible=view?this.paths.filter(p=>p.x1>=view.x0&&p.x0<=view.x1&&p.z1>=view.z0&&p.z0<=view.z1):this.paths;
    const line=(points,color,lw,dash)=>{
      ctx.beginPath();
      points.forEach((p,i)=>{const [x,y]=pt(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
      ctx.strokeStyle=color;ctx.lineWidth=lw;ctx.setLineDash(dash||[]);ctx.stroke();
    };
    ctx.save();
    ctx.lineCap='round';ctx.lineJoin='round';
    const trails=visible.filter(p=>!ROADS.has(p.kind)&&p.kind!=='cycleway');
    const bikes=visible.filter(p=>p.kind==='cycleway');
    const roads=visible.filter(p=>ROADS.has(p.kind));
    for(const p of trails)line(p.points,STYLE.trail,1.6*k,[4*k,3*k]);
    for(const p of roads)line(p.points,STYLE.roadEdge,(p.kind==='residential'?4.6:3.6)*k);
    for(const p of bikes)line(p.points,'#8a6a34',3.4*k);
    for(const p of roads)line(p.points,STYLE.road,(p.kind==='residential'?3:2.2)*k);
    for(const p of bikes)line(p.points,STYLE.cycleway,2*k);
    ctx.restore();
  }

  // Soft relief from the USGS grid, multiplied over the base colours.
  paintHillshade(ctx,w,h){
    const step=3,cols=Math.ceil(w/step),rows=Math.ceil(h/step);
    const cell=this.mpp*step;
    const H=new Float32Array((cols+2)*(rows+2));
    for(let r=0;r<rows+2;r++)for(let c=0;c<cols+2;c++){
      const {x,z}=this.fromTex((c-1)*step,(r-1)*step);
      H[r*(cols+2)+c]=this.terrain.rawHeight(clampTo(x,this.width/2),clampTo(z,this.depth/2));
    }
    const shade=document.createElement('canvas');shade.width=cols;shade.height=rows;
    const sctx=shade.getContext('2d'),img=sctx.createImageData(cols,rows);
    // Light from the north-west, the cartographic convention.
    const lx=-.6,lz=-.6,ly=.53;
    for(let r=0;r<rows;r++)for(let c=0;c<cols;c++){
      const i=(r+1)*(cols+2)+c+1;
      const dx=(H[i+1]-H[i-1])/(2*cell)*3.2,dz=(H[i+cols+2]-H[i-cols-2])/(2*cell)*3.2;
      const len=Math.hypot(dx,1,dz);
      const lit=Math.max(0,(-dx*lx+ly-dz*lz)/len);
      const v=Math.round(clamp255(150+lit*120));
      const o=(r*cols+c)*4;img.data[o]=v;img.data[o+1]=v;img.data[o+2]=v;img.data[o+3]=255;
    }
    sctx.putImageData(img,0,0);
    ctx.save();ctx.globalCompositeOperation='multiply';ctx.globalAlpha=.55;
    ctx.imageSmoothingEnabled=true;ctx.drawImage(shade,0,0,cols*step,rows*step);
    ctx.globalCompositeOperation='screen';ctx.globalAlpha=.12;ctx.drawImage(shade,0,0,cols*step,rows*step);
    ctx.restore();
  }

  // Path network for GPS routing: OSM ways share exact node coordinates at junctions.
  buildGraph(){
    const ids=new Map();this.nodes=[];const edges=[];
    const id=(c,p)=>{
      const key=c[0]+','+c[1];
      let n=ids.get(key);
      if(n===undefined){n=this.nodes.length;ids.set(key,n);this.nodes.push(p);edges.push([]);}
      return n;
    };
    for(const path of this.paths){
      let prev=id(path.coords[0],path.points[0]);
      for(let i=1;i<path.points.length;i++){
        const cur=id(path.coords[i],path.points[i]);
        const a=this.nodes[prev],b=this.nodes[cur],d=Math.hypot(a.x-b.x,a.z-b.z);
        if(cur!==prev){edges[prev].push(cur,d);edges[cur].push(prev,d);}
        prev=cur;
      }
    }
    this.edges=edges;
  }
  nearestNode(x,z){
    let best=-1,bd=Infinity;
    for(let i=0;i<this.nodes.length;i++){
      const n=this.nodes[i],d=(n.x-x)**2+(n.z-z)**2;
      if(d<bd&&this.edges[i].length){bd=d;best=i;}
    }
    return best;
  }
  // Dijkstra along mapped paths; returns world points from start to goal, or null.
  route(from,to){
    const s=this.nearestNode(from.x,from.z),g=this.nearestNode(to.x,to.z);
    if(s<0||g<0)return null;
    const n=this.nodes.length,dist=new Float64Array(n).fill(Infinity),prev=new Int32Array(n).fill(-1);
    const heap=new Heap();dist[s]=0;heap.push(0,s);
    while(heap.size){
      const [d,u]=heap.pop();
      if(u===g)break;
      if(d>dist[u])continue;
      const e=this.edges[u];
      for(let i=0;i<e.length;i+=2){
        const v=e[i],nd=d+e[i+1];
        if(nd<dist[v]){dist[v]=nd;prev[v]=u;heap.push(nd,v);}
      }
    }
    if(!Number.isFinite(dist[g]))return null;
    const out=[];
    for(let u=g;u!==-1;u=prev[u])out.push(this.nodes[u]);
    out.reverse();
    return {points:[{x:from.x,z:from.z},...out,{x:to.x,z:to.z}],length:dist[g]};
  }
  // Closest named path within range, for the location label.
  nearestName(x,z,range=60){
    let best='',bd=range*range;
    for(const p of this.paths){
      if(!p.name)continue;
      const pts=p.points;
      for(let i=1;i<pts.length;i++){
        const d=segDist2(x,z,pts[i-1],pts[i]);
        if(d<bd){bd=d;best=p.name;}
      }
    }
    return best;
  }
}

function segDist2(x,z,a,b){
  const dx=b.x-a.x,dz=b.z-a.z,l=dx*dx+dz*dz||1;
  const t=Math.max(0,Math.min(1,((x-a.x)*dx+(z-a.z)*dz)/l));
  return (a.x+t*dx-x)**2+(a.z+t*dz-z)**2;
}
function dedupeLandmarks(list){
  const out=[];
  for(const l of list){
    if(!l.name||l.name==='Beach')continue;
    if(out.some(o=>o.name===l.name&&Math.hypot(o.x-l.x,o.z-l.z)<500))continue;
    out.push(l);
  }
  return out;
}
const clampTo=(v,m)=>Math.max(-m,Math.min(m,v));
const clamp255=v=>Math.max(0,Math.min(255,v));

class Heap{
  constructor(){this.k=[];this.v=[];}
  get size(){return this.k.length;}
  push(k,v){
    const K=this.k,V=this.v;let i=K.length;K.push(k);V.push(v);
    while(i>0){const p=(i-1)>>1;if(K[p]<=k)break;K[i]=K[p];V[i]=V[p];i=p;}
    K[i]=k;V[i]=v;
  }
  pop(){
    const K=this.k,V=this.v,top=[K[0],V[0]],k=K.pop(),v=V.pop();
    if(K.length){
      let i=0;const n=K.length;
      for(;;){
        let c=2*i+1;if(c>=n)break;
        if(c+1<n&&K[c+1]<K[c])c++;
        if(K[c]>=k)break;
        K[i]=K[c];V[i]=V[c];i=c;
      }
      K[i]=k;V[i]=v;
    }
    return top;
  }
}
