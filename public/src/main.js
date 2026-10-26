import * as THREE from 'three';
import {EventBus} from './engine/EventBus.js';
import {Input} from './engine/Input.js';
import {WorldClock} from './systems/WorldClock.js';
import {QuestJournal} from './systems/QuestJournal.js';
import {Interaction} from './systems/Interaction.js';
import {Terrain} from './world/Terrain.js';
import {Vegetation} from './world/Vegetation.js';
import {GroundCover} from './world/GroundCover.js';
import {FoundModels} from './world/FoundModels.js';
import {loadFoliageTextures} from './world/FoliageTextures.js';
import {Village} from './world/Village.js';
import {Water,Atmosphere} from './world/Atmosphere.js';
import {Player} from './actors/Player.js';
import {Residents} from './actors/Residents.js';
import {HUD} from './ui/HUD.js';

class Game {
  constructor(profile,dem,landcover,foliageAssets) {
    this.profile=profile;
    this.events=new EventBus();
    this.running=false;
    this.scene=new THREE.Scene();
    this.clock=new WorldClock(this.events);
    this.journal=new QuestJournal(this.events);
    this.canvas=document.getElementById('world');
    this.renderer=new THREE.WebGLRenderer({canvas:this.canvas,antialias:true,alpha:false,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.65));
    this.renderer.setSize(innerWidth,innerHeight);
    this.renderer.shadowMap.enabled=true;
    this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure=1.4;
    this.camera=new THREE.PerspectiveCamera(60,innerWidth/innerHeight,.5,2200);
    this.terrain=new Terrain(this.scene,dem,profile);
    this.water=new Water(this.scene,this.terrain);
    this.village=new Village(this.scene,this.terrain,profile,foliageAssets);
    this.vegetation=new Vegetation(this.scene,this.terrain,profile,landcover,foliageAssets);
    this.groundCover=new GroundCover(this.scene,this.terrain,this.village,profile,landcover,foliageAssets);
    this.foundModels=new FoundModels(this.scene,this.terrain,this.village,landcover);
    this.atmosphere=new Atmosphere(this.scene,this.terrain);
    this.player=new Player(this.scene,this.terrain,this.village,profile.start);
    this.residents=new Residents(this.scene,this.terrain,this.village,profile,this.clock);
    this.ui=new HUD(this.events,profile,this.terrain,this.journal);
    this.input=new Input(this.canvas,document.getElementById('joystick'),document.getElementById('action-button'),document.getElementById('jump-button'));
    this.interaction=new Interaction(this.player,this.residents,this.vegetation,this.journal,this.ui,this.events);
    this.journal.applySavedSpecimens(this.vegetation.specimens);
    this.heading=0;
    this.pitch=.22;
    this.elapsed=0;
    this.lastFrame=0;
    this.events.on('skip-time',()=>{this.clock.skip(2);this.ui.toast('Two peaceful hours drift by…');});
    this.events.on('game-started',()=>{this.running=true;this.ui.toast('Welcome! Find June at the bakery.');});
    this.events.on('dialog-closed',()=>this.input.consumeInteract());
    window.addEventListener('resize',()=>this.resize());
    this.camera.position.set(this.player.position.x+15,this.player.position.y+40,this.player.position.z+55);
    this.camera.lookAt(this.player.position.x,this.player.position.y+12,this.player.position.z);
    this.ui.ready();
    requestAnimationFrame(t=>this.frame(t));
  }

  resize() {
    this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth,innerHeight);
  }

  updateCamera(dt) {
    const look=this.input.consumeLook();
    if(this.running&&this.ui.dialog.hidden){
      this.heading-=look.x*.0044;
      this.pitch=THREE.MathUtils.clamp(this.pitch+look.y*.0035,-.15,.82);
    }
    const focus=this.player.position.clone().add(new THREE.Vector3(0,12,0));
    const distance=64;
    const horizontal=Math.cos(this.pitch)*distance;
    const target=new THREE.Vector3(
      focus.x+Math.sin(this.heading)*horizontal,
      focus.y+Math.sin(this.pitch)*distance+20,
      focus.z+Math.cos(this.heading)*horizontal
    );
    target.x=THREE.MathUtils.clamp(target.x,-this.terrain.width/2+10,this.terrain.width/2-10);
    target.z=THREE.MathUtils.clamp(target.z,-this.terrain.depth/2+10,this.terrain.depth/2-10);
    target.y=Math.max(target.y,this.terrain.heightAt(target.x,target.z)+17);
    this.camera.position.lerp(target,Math.min(dt*5.8,1));
    this.camera.lookAt(focus);
  }

  frame(timestamp) {
    const dt=Math.min((timestamp-this.lastFrame)/1000||0,.05);
    this.lastFrame=timestamp;
    this.elapsed+=dt;
    if(this.running) {
      this.clock.update(dt);
      this.player.update(dt,this.input,this.heading,this.ui.dialog.hidden);
      this.village.update(this.player.position);
      this.residents.update(dt,this.elapsed);
      this.vegetation.update(dt,this.elapsed,this.player.position);
      this.groundCover.update(this.player.position);
      this.foundModels.update(this.player.position);
      if(this.ui.dialog.hidden)this.interaction.update(this.input);
      this.ui.update(this.clock,this.player,this.residents);
    }
    this.atmosphere.update(dt,this.elapsed,this.clock.hours,this.player);
    this.water.update(this.elapsed);
    this.updateCamera(dt);
    this.renderer.render(this.scene,this.camera);
    requestAnimationFrame(t=>this.frame(t));
  }
}

async function begin() {
  try {
    const worldURL=new URL('../data/michigan-world.json',import.meta.url);
    const response=await fetch(worldURL);
    if(!response.ok)throw new Error(`World profile unavailable (${response.status})`);
    const profile=await response.json();
    const terrainURL=new URL('../'+profile.terrainFile.replace(/^\.\//,''),import.meta.url);
    const landcoverURL=new URL('../data/michigan-landcover.json',import.meta.url);
    const [terrainResponse,landcoverResponse,foliageAssets]=await Promise.all([
      fetch(terrainURL),fetch(landcoverURL).catch(()=>null),loadFoliageTextures()
    ]);
    if(!terrainResponse.ok)throw new Error(`Elevation map unavailable (${terrainResponse.status})`);
    const elevation=await terrainResponse.json();
    const landcover=landcoverResponse?.ok?await landcoverResponse.json():null;
    new Game(profile,elevation,landcover,foliageAssets);
  } catch(error) {
    console.error('Sunward could not start',error);
    const node=document.getElementById('error');node.hidden=false;
    node.textContent=`We could not load Bayberry Cove: ${error.message}. Run this game through an HTTP server (not file://) and refresh.`;
    const button=document.getElementById('start-button');button.textContent='Could not load game';
  }
}

begin();
