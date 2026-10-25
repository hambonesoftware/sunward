import * as THREE from 'three';

const material=color=>new THREE.MeshStandardMaterial({color,roughness:1,flatShading:true});

export class Atmosphere {
  constructor(scene,terrain) {
    this.scene=scene;this.terrain=terrain;
    scene.background=new THREE.Color('#a9d9ed');
    scene.fog=new THREE.FogExp2('#b8d9db',0.00053);
    this.ambient=new THREE.HemisphereLight('#e3f7ff','#9a9874',2.0);scene.add(this.ambient);
    this.sun=new THREE.DirectionalLight('#fff3d5',2.65);
    this.sun.castShadow=true;this.sun.shadow.mapSize.set(2048,2048);
    this.sun.shadow.camera.left=-500;this.sun.shadow.camera.right=500;
    this.sun.shadow.camera.top=500;this.sun.shadow.camera.bottom=-500;
    this.sun.shadow.camera.near=5;this.sun.shadow.camera.far=1300;
    this.sun.shadow.bias=-.00045;scene.add(this.sun);scene.add(this.sun.target);
    this.clouds=[];this.birds=[];
    this.makeClouds();this.makeBirds();
  }

  makeClouds() {
    const puffMaterial=new THREE.MeshBasicMaterial({color:'#fff9ec',transparent:true,opacity:.85,depthWrite:false});
    for(let i=0;i<12;i++){
      const group=new THREE.Group();group.position.set(-950+i*164,230+(i%4)*22,-700+(i%3)*210);
      for(let j=0;j<5;j++){
        const puff=new THREE.Mesh(new THREE.IcosahedronGeometry(28+(j%3)*6,1),puffMaterial);
        puff.position.set((j-2)*23,Math.sin(j*2)*8,(j%2)*7);puff.scale.y=.55;
        group.add(puff);
      }
      this.scene.add(group);this.clouds.push(group);
    }
  }

  makeBirds() {
    const feather=material('#f5f4e9');
    for(let i=0;i<9;i++) {
      const bird=new THREE.Group();
      for(const sign of [-1,1]){
        const wing=new THREE.Mesh(new THREE.BoxGeometry(4,.35,1.1),feather);
        wing.position.x=sign*2;wing.rotation.z=sign*.25;bird.add(wing);
      }
      bird.position.set(-480+i*19,80+i*3,-130+(i%3)*40);
      this.scene.add(bird);this.birds.push({mesh:bird,phase:i*.7});
    }
  }

  update(dt,elapsed,hours,player) {
    const day=Math.max(.08,Math.sin(Math.PI*(hours-5)/15));
    const morning=hours<12;
    const color=new THREE.Color(day>.3?'#fff3d7':'#e4b7a1');
    this.sun.color.lerp(color,dt*.4);
    this.sun.intensity=1.2+1.7*day;
    this.ambient.intensity=1.1+1.2*day;
    this.sun.position.set(player.position.x-290+Math.cos(hours/24*Math.PI*2)*310,180+day*380,player.position.z-100);
    this.sun.target.position.copy(player.position);this.sun.target.position.y=0;
    this.sun.target.updateMatrixWorld();
    const sky=new THREE.Color(hours>20||hours<5?'#687fa9':hours>18?'#efb69c':'#a9d9ed');
    this.scene.background.lerp(sky,Math.min(dt*.6,1));
    this.scene.fog.color.lerp(sky,Math.min(dt*.45,1));
    for(const [i,c] of this.clouds.entries())c.position.x+=dt*(.25+i*.01);
    for(const b of this.birds){
      b.mesh.position.x+=dt*4;
      if(b.mesh.position.x>500)b.mesh.position.x=-600;
      b.mesh.position.y+=Math.sin(elapsed*2+b.phase)*dt*.6;
      b.mesh.children[0].rotation.z=.3+Math.sin(elapsed*9+b.phase)*.4;
      b.mesh.children[1].rotation.z=-.3-Math.sin(elapsed*9+b.phase)*.4;
    }
  }
}

export class Water {
  constructor(scene,terrain) {
    this.terrain=terrain;
    this.material=new THREE.MeshPhysicalMaterial({color:'#6dbfca',roughness:.21,metalness:.08,transparent:true,opacity:.7,depthWrite:false,side:THREE.DoubleSide});
    this.mesh=new THREE.Mesh(new THREE.PlaneGeometry(terrain.width,terrain.depth),this.material);
    this.mesh.rotation.x=-Math.PI/2;
    this.mesh.position.y=terrain.waterY+.3;
    this.mesh.renderOrder=1;
    scene.add(this.mesh);
  }
  update(time) {this.material.opacity=.65+.04*Math.sin(time*.6);}
}
