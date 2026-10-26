import * as THREE from 'three';
import {Input} from './engine/Input.js';
import {StonyTerrain,project} from './world/StonyTerrain.js';
import {StonyTrails} from './world/StonyTrails.js';
import {StonyFoliagePass2} from './world/StonyFoliagePass2.js';
import {loadKenneyNatureAssets} from './world/KenneyPlants.js';
import {loadFoliageTextures} from './world/FoliageTextures.js';

// Publicly documented or referenced approximate access points, not building footprints.
const PLACES={
  nature:{label:'Nature Center trails',lat:42.76078,lon:-83.0745},
  eastwood:{label:'Eastwood Beach',lat:42.722,lon:-83.078},
  baypoint:{label:'Baypoint Beach',lat:42.7284,lon:-83.09064},
  shelden:{label:'Shelden Trails',lat:42.73046,lon:-83.1072},
  trolley:{label:'Trolley Trails',lat:42.71823,lon:-83.079}
};
const clamp=THREE.MathUtils.clamp;

class Explorer{
  constructor(dem,map,assets,zones){
    this.canvas=document.getElementById('world');
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio||1,matchMedia('(pointer:coarse)').matches?1.4:1.8));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.16;
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.scene=new THREE.Scene();
    this.scene.background=new THREE.Color('#a5c8d3');
    this.scene.fog=new THREE.FogExp2('#b3c8bf',.001);
    this.scene.add(new THREE.HemisphereLight('#f5f8e9','#6e806a',2.1));
    this.sun=new THREE.DirectionalLight('#fff1d6',2.55);
    this.sun.castShadow=true;
    this.sun.shadow.mapSize.set(1024,1024);
    this.sun.shadow.camera.left=-100;
    this.sun.shadow.camera.right=100;
    this.sun.shadow.camera.top=100;
    this.sun.shadow.camera.bottom=-100;
    this.sun.shadow.camera.near=1;
    this.sun.shadow.camera.far=480;
    this.scene.add(this.sun,this.sun.target);
    this.terrain=new StonyTerrain(this.scene,dem,map);
    this.trails=new StonyTrails(this.scene,this.terrain,map);
    this.camera=new THREE.PerspectiveCamera(72,innerWidth/innerHeight,.08,1250);
    this.position=new THREE.Vector3();
    this.heading=0;this.pitch=0;this.running=false;this.jog=false;
    this.input=new Input(this.canvas,document.getElementById('joystick'),null,null);
    this.goTo('nature');
    this.plants=new StonyFoliagePass2(this.scene,this.terrain,this.trails,map,assets,zones,this.position);
    this.foliageAssets=assets;
    this.map=map;this.elapsed=0;this.last=0;
    this.startButton=document.getElementById('start-button');
    this.startButton.disabled=false;
    this.startButton.textContent='Enter Stony Creek';
    this.startButton.addEventListener('click',()=>{
      document.getElementById('start-screen').hidden=true;
      document.getElementById('start-screen').style.display='none';
      this.running=true;
    });
    const mapButton=document.getElementById('map-button'),
      panel=document.getElementById('map-panel');
    const toggle=visible=>{
      panel.hidden=!visible;
      mapButton.setAttribute('aria-expanded',String(visible));
      if(visible)this.drawMap();
    };
    mapButton.addEventListener('click',()=>toggle(panel.hidden));
    document.getElementById('map-close').addEventListener('click',()=>toggle(false));
    document.getElementById('destinations').addEventListener('change',event=>{
      this.goTo(event.target.value);
      this.plants.update(this.position);
      this.drawMap();
      toggle(false);
    });
    const pace=document.getElementById('pace-button');
    pace.addEventListener('click',()=>{
      this.jog=!this.jog;
      pace.textContent=this.jog?'Jog':'Walk';
      pace.setAttribute('aria-pressed',String(this.jog));
    });
    addEventListener('resize',()=>this.resize());
    requestAnimationFrame(t=>this.frame(t));
  }
  goTo(name){
    const destination=PLACES[name]||PLACES.nature;
    let p=project(destination.lon,destination.lat,this.terrain.bounds);
    p=this.nearestPath(p,200)||p;
    this.position.set(p.x,this.terrain.surfaceAt(p.x,p.z)+1.75,p.z);
    this.heading=0;this.pitch=-.02;
    this.camera?.position.copy(this.position);
    const label=document.getElementById('location-pill');
    label.textContent=destination.label;
  }
  nearestPath(p,limit){
    let best=null,dist=limit;
    for(const line of this.trails.lines){
      for(let i=1;i<line.points.length;i++){
        const a=line.points[i-1],b=line.points[i],dx=b.x-a.x,dz=b.z-a.z;
        const t=clamp(((p.x-a.x)*dx+(p.z-a.z)*dz)/(dx*dx+dz*dz||1),0,1);
        const x=a.x+t*dx,z=a.z+t*dz;
        const d=Math.hypot(x-p.x,z-p.z);
        if(d<dist){best={x,z};dist=d;}
      }
    }
    return best;
  }
  drawMap(){
    const canvas=document.getElementById('park-map');
    const ctx=canvas.getContext('2d');
    const w=canvas.width,h=canvas.height;
    ctx.clearRect(0,0,w,h);ctx.fillStyle='#b5c6a3';ctx.fillRect(0,0,w,h);
    const point=p=>[w*(p.x/this.terrain.width+.5),h*(p.z/this.terrain.depth+.5)];
    ctx.fillStyle='#789eae';
    for(const lake of this.terrain.water){
      ctx.beginPath();
      lake.points.forEach((p,i)=>{
        const [x,y]=point(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
      ctx.closePath();ctx.fill();
    }
    for(const line of this.trails.lines){
      ctx.beginPath();
      line.points.forEach((p,i)=>{
        const [x,y]=point(p);if(i===0)ctx.moveTo(x,y);else ctx.lineTo(x,y);
      });
      ctx.strokeStyle=line.kind==='cycleway'?'#b7a580':'#ede1c5';
      ctx.lineWidth=line.kind==='cycleway'?1.9:.75;
      ctx.stroke();
    }
    const [x,y]=point(this.position);
    ctx.beginPath();ctx.arc(x,y,5,0,Math.PI*2);ctx.fillStyle='#174e35';ctx.fill();
    ctx.beginPath();ctx.arc(x,y,7,0,Math.PI*2);ctx.strokeStyle='#f9f9f2';ctx.lineWidth=2;ctx.stroke();
    ctx.font='bold 12px system-ui';ctx.fillStyle='#254a35';ctx.fillText('N',w-21,18);
  }
  resize(){
    this.camera.aspect=innerWidth/innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth,innerHeight);
  }
  frame(timestamp){
    const dt=Math.min(.05,(timestamp-this.last)/1000||0);
    this.last=timestamp;this.elapsed+=dt;
    if(this.running){
      const look=this.input.consumeLook();
      this.heading-=look.x*.003;
      this.pitch=clamp(this.pitch-look.y*.0028,-1.45,1.45);
      const move=this.input.moveAxis();
      const walk=this.jog||this.input.sprinting()?3.9:1.85;
      const dx=(move.x*Math.cos(this.heading)+move.y*Math.sin(this.heading))*walk*dt;
      const dz=(move.x*Math.sin(this.heading)-move.y*Math.cos(this.heading))*walk*dt;
      const nx=this.position.x+dx,nz=this.position.z+dz;
      const oldGround=this.terrain.surfaceAt(this.position.x,this.position.z);
      if(this.terrain.positionInBounds(nx,nz,10)&&
          !this.terrain.waterAt(nx,nz)&&
          Math.abs(this.terrain.surfaceAt(nx,nz)-oldGround)<.8){
        this.position.x=nx;this.position.z=nz;
      }
      const eye=this.terrain.surfaceAt(this.position.x,this.position.z)+1.72;
      this.position.y=THREE.MathUtils.lerp(this.position.y,eye,Math.min(dt*9,1));
      this.camera.position.copy(this.position);
      this.camera.rotation.order='YXZ';
      this.camera.rotation.y=this.heading;
      this.camera.rotation.x=this.pitch;
      this.foliageAssets.setWindTime(this.elapsed);
      this.plants.update(this.position);
      this.sun.position.set(this.position.x-120,this.position.y+170,this.position.z-100);
      this.sun.target.position.copy(this.position);this.sun.target.position.y=this.position.y-2;
      this.sun.target.updateMatrixWorld();
    }
    this.renderer.render(this.scene,this.camera);
    requestAnimationFrame(t=>this.frame(t));
  }
}
async function start(){
  try{
    const [demResponse,mapResponse,zonesResponse,kenneyAssets,textureAssets]=await Promise.all([
      fetch(new URL('../data/stony-creek-dem.json',import.meta.url)),
      fetch(new URL('../data/stony-creek-map.json',import.meta.url)),
      fetch(new URL('../data/stony-foliage-zones.json',import.meta.url)),
      loadKenneyNatureAssets(),
      loadFoliageTextures()
    ]);
    if(!demResponse.ok||!mapResponse.ok||!zonesResponse.ok)
      throw Error('The actual Stony Creek terrain/trail data is missing from this deployment.');
    const [dem,map,zones]=await Promise.all([demResponse.json(),mapResponse.json(),zonesResponse.json()]);
    const assets={...kenneyAssets,...textureAssets,grassMaterial:kenneyAssets.grassMaterial};
    if(!dem.samples||!map.paths?.length)throw Error('Geographic data could not be verified.');
    new Explorer(dem,map,assets,zones);
    document.documentElement.dataset.stonyReady='true';
  }catch(error){
    console.error(error);
    const node=document.getElementById('error');
    node.hidden=false;node.textContent='Stony Creek could not initialize: '+error.message;
    document.getElementById('start-button').textContent='Park data unavailable';
  }
}
start();
