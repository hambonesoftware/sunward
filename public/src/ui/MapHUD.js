// GTA-style navigation HUD: a rotating circular minimap with a compass ring,
// GPS route to a waypoint along mapped paths, and a full-screen pannable map.
import {MapData,STYLE} from './MapData.js';

const TAU=Math.PI*2;
const POINTS=['N','NE','E','SE','S','SW','W','NW'];
const ARRIVE_METRES=15;
const ROUTE_EVERY=1.5;

export class MapHUD{
  constructor({terrain,map,places,onTravel}){
    this.terrain=terrain;this.places=places;this.onTravel=onTravel;
    this.data=new MapData(terrain,map);
    this.player={x:0,z:0};this.heading=0;
    this.range=210;this.waypoint=null;this.route=null;this.routeTimer=0;this.labelTimer=0;
    this.isOpen=false;
    this.dpr=Math.min(devicePixelRatio||1,2);

    this.miniWrap=document.getElementById('minimap');
    this.mini=document.getElementById('minimap-canvas');
    this.miniCtx=this.mini.getContext('2d');
    this.bearingNode=document.getElementById('minimap-bearing');
    this.pill=document.getElementById('location-pill');
    this.toastNode=document.getElementById('toast');
    this.miniWrap.addEventListener('click',()=>this.show());
    this.miniWrap.addEventListener('keydown',e=>{if(e.code==='Enter'||e.code==='Space'){e.preventDefault();this.show();}});

    this.panel=document.getElementById('world-map');
    this.big=document.getElementById('world-map-canvas');
    this.bigCtx=this.big.getContext('2d');
    this.wpInfo=document.getElementById('waypoint-info');
    this.clearButton=document.getElementById('map-clear');
    this.mapButton=document.getElementById('map-button');
    this.view={x:0,z:0,zoom:.3};
    this.mapButton.addEventListener('click',()=>this.toggle());
    document.getElementById('map-close').addEventListener('click',()=>this.hide());
    document.getElementById('map-center').addEventListener('click',()=>{this.view.x=this.player.x;this.view.z=this.player.z;this.drawBig();});
    document.getElementById('map-zoom-in').addEventListener('click',()=>this.zoomAbout(1.6));
    document.getElementById('map-zoom-out').addEventListener('click',()=>this.zoomAbout(1/1.6));
    this.clearButton.addEventListener('click',()=>this.clearWaypoint());
    const list=document.getElementById('travel-list');
    for(const [id,place] of Object.entries(places)){
      const b=document.createElement('button');
      b.type='button';b.className='travel-button';b.dataset.place=id;b.textContent=place.label;
      b.addEventListener('click',()=>{this.hide();this.onTravel(id);});
      list.append(b);
    }
    this.bindMapPointer();
    addEventListener('keydown',e=>{
      if(e.target instanceof HTMLInputElement||e.target instanceof HTMLSelectElement)return;
      if(e.code==='KeyM'&&!e.repeat)this.toggle();
      else if(e.code==='Escape'&&this.isOpen)this.hide();
      else if(this.isOpen&&(e.key==='+'||e.key==='='))this.zoomAbout(1.4);
      else if(this.isOpen&&(e.key==='-'||e.key==='_'))this.zoomAbout(1/1.4);
    });
    addEventListener('resize',()=>{this.sizeCanvases();if(this.isOpen)this.drawBig();});
    this.sizeCanvases();
    this.updateWaypointInfo();
  }

  get open(){return this.isOpen;}

  sizeCanvases(){
    this.dpr=Math.min(devicePixelRatio||1,2);
    const m=this.mini.clientWidth||170;
    this.mini.width=Math.round(m*this.dpr);this.mini.height=Math.round(m*this.dpr);
    if(this.isOpen){
      this.big.width=Math.round(this.big.clientWidth*this.dpr);
      this.big.height=Math.round(this.big.clientHeight*this.dpr);
    }
  }

  // Called every frame by the explorer.
  update(dt,position,heading,jogging){
    this.player.x=position.x;this.player.z=position.z;this.heading=heading;
    const target=jogging?330:210;
    this.range+=(target-this.range)*Math.min(1,dt*2.5);
    if(this.waypoint){
      const d=Math.hypot(this.waypoint.x-this.player.x,this.waypoint.z-this.player.z);
      if(d<ARRIVE_METRES){this.clearWaypoint();this.toast('Arrived at waypoint');}
      else if((this.routeTimer-=dt)<=0){this.routeTimer=ROUTE_EVERY;this.computeRoute();}
    }
    if((this.labelTimer-=dt)<=0){this.labelTimer=.5;this.updateLabel();}
    if(!this.isOpen)this.drawMini();
  }

  updateLabel(){
    let label=this.data.nearestName(this.player.x,this.player.z,45);
    if(!label){
      let best=650;
      for(const place of Object.values(this.places)){
        if(!place.x&&place.x!==0)continue;
        const d=Math.hypot(place.x-this.player.x,place.z-this.player.z);
        if(d<best){best=d;label=place.label;}
      }
    }
    label=label||'Stony Creek Metropark';
    if(this.pill.textContent!==label)this.pill.textContent=label;
  }

  // ---------- Minimap ----------
  drawMini(){
    const ctx=this.miniCtx,S=this.mini.width,dpr=this.dpr,c=S/2;
    const ring=13*dpr,R=c-ring;
    const tex=this.data.texture,mpp=this.data.mpp;
    const h=this.heading;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.clearRect(0,0,S,S);
    ctx.beginPath();ctx.arc(c,c,c-dpr,0,TAU);ctx.fillStyle='rgba(12,30,23,.86)';ctx.fill();
    ctx.save();
    ctx.beginPath();ctx.arc(c,c,R,0,TAU);ctx.clip();
    ctx.fillStyle='#55734f';ctx.fillRect(0,0,S,S);
    const s=R/this.range*mpp;
    const [tx,ty]=this.data.toTex(this.player.x,this.player.z);
    ctx.translate(c,c);ctx.rotate(h);ctx.scale(s,s);ctx.translate(-tx,-ty);
    // Only sample the part of the texture around the player.
    const r=this.range*1.5/mpp;
    const sx=Math.max(0,Math.floor(tx-r)),sy=Math.max(0,Math.floor(ty-r));
    const sw=Math.min(tex.width,Math.ceil(tx+r))-sx,sh=Math.min(tex.height,Math.ceil(ty+r))-sy;
    if(sw>0&&sh>0)ctx.drawImage(tex,sx,sy,sw,sh,sx,sy,sw,sh);
    if(this.route)this.strokeRoute(ctx,p=>this.data.toTex(p.x,p.z),4.2*dpr/s);
    ctx.restore();

    // Waypoint blip, pinned to the edge when it is out of range.
    if(this.waypoint){
      let [x,y]=this.rotated(this.waypoint.x-this.player.x,this.waypoint.z-this.player.z,R/this.range);
      const len=Math.hypot(x,y),max=R-5*dpr;
      if(len>max){x*=max/len;y*=max/len;}
      blip(ctx,c+x,c+y,5.5*dpr,STYLE.waypoint);
    }
    // Inner ring shadow and the player arrow, always pointing up.
    ctx.beginPath();ctx.arc(c,c,R,0,TAU);ctx.strokeStyle='rgba(0,0,0,.45)';ctx.lineWidth=2*dpr;ctx.stroke();
    arrow(ctx,c,c,0,8*dpr);

    // Compass ring: ticks every 15°, letters every 45°, N in red.
    const mid=R+ring/2;
    for(let b=0;b<360;b+=15){
      const a=b*Math.PI/180+h,sa=Math.sin(a),ca=-Math.cos(a);
      if(b%45===0){
        const big=b%90===0;
        ctx.font=`${big?800:650} ${(big?10.5:7.5)*dpr}px system-ui,sans-serif`;
        ctx.textAlign='center';ctx.textBaseline='middle';
        ctx.fillStyle=b===0?'#ff5a4e':big?'#f4f6ee':'rgba(244,246,238,.7)';
        ctx.fillText(POINTS[b/45],c+sa*mid,c+ca*mid+.5*dpr);
      }else{
        ctx.beginPath();
        ctx.moveTo(c+sa*(R+3*dpr),c+ca*(R+3*dpr));ctx.lineTo(c+sa*(R+6.5*dpr),c+ca*(R+6.5*dpr));
        ctx.strokeStyle='rgba(244,246,238,.45)';ctx.lineWidth=1.2*dpr;ctx.stroke();
      }
    }
    // Heading notch at the top of the ring.
    ctx.beginPath();ctx.moveTo(c,ring*.15);ctx.lineTo(c-4*dpr,-1);ctx.lineTo(c+4*dpr,-1);ctx.closePath();
    ctx.fillStyle='#e6dfae';ctx.fill();

    const bearing=((-h*180/Math.PI)%360+360)%360;
    const text=`${POINTS[Math.round(bearing/45)%8]} ${String(Math.round(bearing)%360).padStart(3,'0')}°`;
    if(this.bearingNode.textContent!==text)this.bearingNode.textContent=text;
  }
  // World offset (east, south) to minimap pixels, player-up.
  rotated(dx,dz,k){
    const h=this.heading,ch=Math.cos(h),sh=Math.sin(h);
    return [(dx*ch-dz*sh)*k,(dx*sh+dz*ch)*k];
  }
  strokeRoute(ctx,pt,width){
    const pts=this.route.points;
    ctx.beginPath();
    pts.forEach((p,i)=>{const [x,y]=pt(p);i?ctx.lineTo(x,y):ctx.moveTo(x,y);});
    ctx.lineCap='round';ctx.lineJoin='round';
    ctx.strokeStyle='rgba(40,8,60,.55)';ctx.lineWidth=width*1.6;ctx.stroke();
    ctx.strokeStyle=STYLE.route;ctx.lineWidth=width;ctx.stroke();
  }

  // ---------- Waypoint and GPS ----------
  setWaypoint(p){
    const m=8;
    this.waypoint={x:clamp(p.x,-this.data.width/2+m,this.data.width/2-m),z:clamp(p.z,-this.data.depth/2+m,this.data.depth/2-m)};
    this.computeRoute();this.routeTimer=ROUTE_EVERY;
    this.updateWaypointInfo();
  }
  clearWaypoint(){
    this.waypoint=null;this.route=null;
    this.updateWaypointInfo();
    if(this.isOpen)this.drawBig();
  }
  computeRoute(){
    if(!this.waypoint)return;
    this.route=this.data.route(this.player,this.waypoint);
    this.updateWaypointInfo();
  }
  updateWaypointInfo(){
    const has=!!this.waypoint;
    this.clearButton.disabled=!has;
    if(!has){this.wpInfo.textContent='Tap the map to set a waypoint.';return;}
    const straight=Math.hypot(this.waypoint.x-this.player.x,this.waypoint.z-this.player.z);
    this.wpInfo.textContent=this.route
      ?`Waypoint: ${distance(this.route.length)} by trail (${distance(straight)} straight)`
      :`Waypoint: ${distance(straight)} away`;
  }
  toast(message){
    this.toastNode.textContent=message;this.toastNode.hidden=false;
    clearTimeout(this.toastTimer);
    this.toastTimer=setTimeout(()=>{this.toastNode.hidden=true;},3200);
  }

  // ---------- Full-screen map ----------
  toggle(){this.isOpen?this.hide():this.show();}
  show(){
    if(this.isOpen)return;
    this.isOpen=true;this.panel.hidden=false;
    this.mapButton.setAttribute('aria-expanded','true');
    this.sizeCanvases();
    const fit=this.fitZoom();
    this.view={x:this.player.x,z:this.player.z,zoom:clamp(fit*3,fit,4)};
    this.updateWaypointInfo();
    this.drawBig();
  }
  hide(){
    if(!this.isOpen)return;
    this.isOpen=false;this.panel.hidden=true;
    this.mapButton.setAttribute('aria-expanded','false');
    this.pointers?.clear();
  }
  fitZoom(){
    const w=this.big.clientWidth||innerWidth,h=this.big.clientHeight||innerHeight;
    return Math.min(w/this.data.width,h/this.data.depth)*.94;
  }
  toScreen(x,z){
    const w=this.big.clientWidth,h=this.big.clientHeight,v=this.view;
    return [(x-v.x)*v.zoom+w/2,(z-v.z)*v.zoom+h/2];
  }
  toWorld(sx,sy){
    const w=this.big.clientWidth,h=this.big.clientHeight,v=this.view;
    return {x:(sx-w/2)/v.zoom+v.x,z:(sy-h/2)/v.zoom+v.z};
  }
  clampView(){
    const v=this.view,fit=this.fitZoom();
    v.zoom=clamp(v.zoom,fit,4);
    v.x=clamp(v.x,-this.data.width/2,this.data.width/2);
    v.z=clamp(v.z,-this.data.depth/2,this.data.depth/2);
  }
  zoomAbout(factor,sx,sy){
    const w=this.big.clientWidth,h=this.big.clientHeight;
    if(sx===undefined){sx=w/2;sy=h/2;}
    const before=this.toWorld(sx,sy);
    this.view.zoom*=factor;this.clampView();
    this.view.x=before.x-(sx-w/2)/this.view.zoom;
    this.view.z=before.z-(sy-h/2)/this.view.zoom;
    this.clampView();this.drawBig();
  }
  bindMapPointer(){
    const el=this.big;this.pointers=new Map();
    let gesture=null;
    const local=e=>{const r=el.getBoundingClientRect();return [e.clientX-r.left,e.clientY-r.top];};
    el.addEventListener('pointerdown',e=>{
      e.preventDefault();el.setPointerCapture(e.pointerId);
      this.pointers.set(e.pointerId,local(e));
      if(this.pointers.size===1)gesture={tap:true,t:performance.now(),moved:0};
      else if(gesture)gesture.tap=false;
    });
    el.addEventListener('pointermove',e=>{
      if(!this.pointers.has(e.pointerId))return;
      const prev=this.pointers.get(e.pointerId),cur=local(e);
      if(this.pointers.size===1){
        this.view.x-=(cur[0]-prev[0])/this.view.zoom;this.view.z-=(cur[1]-prev[1])/this.view.zoom;
        if(gesture){gesture.moved+=Math.hypot(cur[0]-prev[0],cur[1]-prev[1]);if(gesture.moved>8)gesture.tap=false;}
        this.pointers.set(e.pointerId,cur);this.clampView();this.drawBig();
      }else if(this.pointers.size===2){
        const other=[...this.pointers].find(([id])=>id!==e.pointerId)[1];
        const d0=Math.hypot(prev[0]-other[0],prev[1]-other[1]),d1=Math.hypot(cur[0]-other[0],cur[1]-other[1]);
        const m0=[(prev[0]+other[0])/2,(prev[1]+other[1])/2],m1=[(cur[0]+other[0])/2,(cur[1]+other[1])/2];
        this.pointers.set(e.pointerId,cur);
        this.view.x-=(m1[0]-m0[0])/this.view.zoom;this.view.z-=(m1[1]-m0[1])/this.view.zoom;
        if(d0>4)this.zoomAbout(d1/d0,m1[0],m1[1]);else this.drawBig();
      }
    });
    const end=e=>{
      if(!this.pointers.has(e.pointerId))return;
      const pos=this.pointers.get(e.pointerId);
      this.pointers.delete(e.pointerId);
      if(e.type==='pointerup'&&gesture?.tap&&this.pointers.size===0&&performance.now()-gesture.t<700)this.tapAt(pos[0],pos[1]);
      if(this.pointers.size===0)gesture=null;
    };
    el.addEventListener('pointerup',end);
    el.addEventListener('pointercancel',end);
    el.addEventListener('wheel',e=>{
      e.preventDefault();
      const [x,y]=local(e);
      this.zoomAbout(Math.exp(-e.deltaY*.0015),x,y);
    },{passive:false});
    el.addEventListener('contextmenu',e=>e.preventDefault());
  }
  tapAt(sx,sy){
    if(this.waypoint){
      const [wx,wy]=this.toScreen(this.waypoint.x,this.waypoint.z);
      if(Math.hypot(wx-sx,wy-sy)<24){this.clearWaypoint();return;}
    }
    this.setWaypoint(this.toWorld(sx,sy));
    this.drawBig();
  }
  drawBig(){
    if(!this.isOpen)return;
    const ctx=this.bigCtx,dpr=this.dpr,w=this.big.clientWidth,h=this.big.clientHeight;
    if(this.big.width!==Math.round(w*dpr)||this.big.height!==Math.round(h*dpr))this.sizeCanvases();
    const v=this.view,mpp=this.data.mpp,tex=this.data.texture;
    ctx.setTransform(dpr,0,0,dpr,0,0);
    ctx.fillStyle='#41593c';ctx.fillRect(0,0,w,h);
    ctx.save();
    ctx.translate(w/2-(this.data.width/2+v.x)*v.zoom,h/2-(this.data.depth/2+v.z)*v.zoom);
    ctx.scale(mpp*v.zoom,mpp*v.zoom);
    ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
    ctx.drawImage(tex,0,0);
    ctx.restore();
    const pt=p=>this.toScreen(p.x,p.z);
    // Sharp vector paths once the texture starts to blur.
    if(v.zoom*mpp>1.3){
      const a=this.toWorld(0,0),b=this.toWorld(w,h);
      this.data.strokePaths(ctx,pt,Math.min(2.4,v.zoom*1.6),{x0:a.x,z0:a.z,x1:b.x,z1:b.z});
    }
    // Park edge.
    const [x0,y0]=this.toScreen(-this.data.width/2,-this.data.depth/2),[x1,y1]=this.toScreen(this.data.width/2,this.data.depth/2);
    ctx.strokeStyle='rgba(20,40,31,.8)';ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.strokeRect(x0,y0,x1-x0,y1-y0);ctx.setLineDash([]);
    if(this.route)this.strokeRoute(ctx,pt,4.5);
    this.drawLabels(ctx,w,h);
    if(this.waypoint){const [x,y]=pt(this.waypoint);pin(ctx,x,y);}
    const [px,py]=pt(this.player);
    ctx.beginPath();ctx.arc(px,py,19,0,TAU);ctx.fillStyle='rgba(29,58,44,.35)';ctx.fill();
    ctx.lineWidth=2;ctx.strokeStyle='rgba(255,255,255,.85)';ctx.stroke();
    arrow(ctx,px,py,-this.heading,12);
    this.drawScaleBar(ctx,w,h);
  }
  drawLabels(ctx,w,h){
    const placed=[];
    const label=(text,x,y,size,weight,color)=>{
      ctx.font=`${weight} ${size}px system-ui,sans-serif`;
      const tw=ctx.measureText(text).width,box=[x-tw/2-3,y-size,x+tw/2+3,y+4];
      if(box[2]<0||box[0]>w||box[3]<0||box[1]>h)return;
      if(placed.some(b=>b[0]<box[2]&&b[2]>box[0]&&b[1]<box[3]&&b[3]>box[1]))return;
      placed.push(box);
      ctx.textAlign='center';ctx.textBaseline='alphabetic';
      ctx.lineJoin='round';ctx.strokeStyle='rgba(15,30,22,.85)';ctx.lineWidth=3.5;ctx.strokeText(text,x,y);
      ctx.fillStyle=color;ctx.fillText(text,x,y);
    };
    for(const place of Object.values(this.places)){
      if(place.x===undefined)continue;
      const [x,y]=this.toScreen(place.x,place.z);
      blip(ctx,x,y,4.5,'#9be0b4');
      label(place.label,x,y-9,13,750,'#ffffff');
    }
    if(this.view.zoom>this.fitZoom()*1.8){
      for(const l of this.data.landmarks){
        const [x,y]=this.toScreen(l.x,l.z);
        label(l.name,x,y-4,11,600,'#f3ecd2');
      }
    }
  }
  drawScaleBar(ctx,w,h){
    const feetPerPx=3.28084/this.view.zoom;
    const steps=[100,250,500,1000,2640,5280,10560];
    let ft=steps[0];for(const s of steps)if(s/feetPerPx<130)ft=s;
    const px=ft/feetPerPx,x=16,y=h-18;
    ctx.fillStyle='rgba(15,30,22,.75)';ctx.fillRect(x-6,y-20,px+12,28);
    ctx.strokeStyle='#fff';ctx.lineWidth=2;
    ctx.beginPath();ctx.moveTo(x,y-5);ctx.lineTo(x,y);ctx.lineTo(x+px,y);ctx.lineTo(x+px,y-5);ctx.stroke();
    ctx.fillStyle='#fff';ctx.font='600 11px system-ui,sans-serif';ctx.textAlign='left';ctx.textBaseline='alphabetic';
    ctx.fillText(ft>=2640?`${ft/5280} mi`:`${ft} ft`,x,y-8);
  }
}

function arrow(ctx,x,y,angle,size){
  ctx.save();ctx.translate(x,y);ctx.rotate(angle);
  ctx.beginPath();ctx.moveTo(0,-size*1.15);ctx.lineTo(size*.8,size*.85);ctx.lineTo(0,size*.4);ctx.lineTo(-size*.8,size*.85);ctx.closePath();
  ctx.fillStyle=STYLE.player;ctx.strokeStyle='#1d3a2c';ctx.lineWidth=Math.max(1.5,size*.22);ctx.lineJoin='round';
  ctx.stroke();ctx.fill();
  ctx.restore();
}
function blip(ctx,x,y,r,color){
  ctx.beginPath();ctx.arc(x,y,r,0,TAU);ctx.fillStyle=color;ctx.fill();
  ctx.lineWidth=Math.max(1.5,r*.35);ctx.strokeStyle='#1d2a22';ctx.stroke();
}
function pin(ctx,x,y){
  ctx.beginPath();ctx.moveTo(x,y);ctx.bezierCurveTo(x-11,y-14,x-9,y-27,x,y-27);ctx.bezierCurveTo(x+9,y-27,x+11,y-14,x,y);
  ctx.fillStyle=STYLE.waypoint;ctx.strokeStyle='#3b2d06';ctx.lineWidth=2;ctx.fill();ctx.stroke();
  ctx.beginPath();ctx.arc(x,y-19,3.5,0,TAU);ctx.fillStyle='#3b2d06';ctx.fill();
}
function distance(metres){
  const feet=metres*3.28084;
  return feet<1000?`${Math.round(feet/10)*10} ft`:`${(feet/5280).toFixed(feet<5280*10?1:0)} mi`;
}
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
