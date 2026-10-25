import * as THREE from 'three';

const mat=(color,extra={})=>new THREE.MeshStandardMaterial({color,roughness:.84,...extra});

function box(parent,w,h,d,x,y,z,material,shadow=true) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material);
  mesh.position.set(x,y,z); mesh.castShadow=shadow;mesh.receiveShadow=true;parent.add(mesh);return mesh;
}
function sphere(parent,r,x,y,z,material) {
  const mesh=new THREE.Mesh(new THREE.SphereGeometry(r,10,7),material);
  mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
}
function cylinder(parent,r1,r2,h,x,y,z,material,segments=12) {
  const mesh=new THREE.Mesh(new THREE.CylinderGeometry(r1,r2,h,segments),material);
  mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
}


// Decorative village planting uses batches instead of one draw call per petal.
function plantBatch(group,geometry,material,items,place,palette=null) {
  const mesh=new THREE.InstancedMesh(geometry,material,items.length);
  const dummy=new THREE.Object3D();
  const color=new THREE.Color();
  items.forEach((item,i)=>{
    dummy.position.set(0,0,0);dummy.rotation.set(0,0,0);dummy.scale.set(1,1,1);
    place(dummy,item,i);
    dummy.updateMatrix();
    mesh.setMatrixAt(i,dummy.matrix);
    if(palette)mesh.setColorAt(i,color.set(palette(item,i)));
  });
  mesh.instanceMatrix.needsUpdate=true;
  if(mesh.instanceColor)mesh.instanceColor.needsUpdate=true;
  mesh.castShadow=false;mesh.receiveShadow=true;
  group.add(mesh);
  return mesh;
}

function labelSprite(text,scale=30) {
  const canvas=document.createElement('canvas');canvas.width=640;canvas.height=160;
  const ctx=canvas.getContext('2d');
  ctx.fillStyle='rgba(33,71,62,0.9)';ctx.beginPath();ctx.roundRect(8,12,624,136,24);ctx.fill();
  ctx.strokeStyle='#e8d49c';ctx.lineWidth=5;ctx.stroke();
  ctx.fillStyle='#fff4d8';ctx.font='bold 64px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(text,320,84,590);
  const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;
  const sprite=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false}));
  sprite.scale.set(scale,scale*.25,1);return sprite;
}

export class Village {
  constructor(scene,terrain,profile) {
    this.terrain=terrain;this.profile=profile;this.group=new THREE.Group();scene.add(this.group);
    this.blockers=[];this.decorations=[];
    const c=profile.village;
    this.places={
      home:{x:c.x+139,z:c.z+180},
      bakery:{x:c.x-55,z:c.z-48},
      market:{x:c.x,z:c.z-15},
      dock:{x:-535,z:c.z-100},
      garden:{x:c.x+145,z:c.z-45},
      ranger:{x:c.x+186,z:c.z-198},
      trail:{x:c.x+335,z:c.z-380},
      bookshop:{x:c.x+88,z:c.z-65},
      bench:{x:c.x-160,z:c.z+90},
      cottages:{x:c.x+116,z:c.z+185}
    };
    this.build();
  }

  elevation(x,z) {return this.terrain.heightAt(x,z);}

  walkHeight(x,z) {
    let height=this.elevation(x,z);
    const pierZ=this.profile.village.z-100;
    if(x>=-591&&x<=-482&&Math.abs(z-pierZ)<7.5){
      height=Math.max(height,this.terrain.waterY+3.85);
    } else {
      height=Math.max(height,this.terrain.waterY-1.4);
    }
    return height;
  }

  building({x,z,w=25,d=22,h=22,color='#edb77e',roof='#bd6c52',name,awning=false}) {
    const ground=this.elevation(x,z);
    const g=new THREE.Group();g.position.set(x,ground,z);this.group.add(g);
    box(g,w+5,1.3,d+5,0,.5,0,mat('#d7c2a2'));
    box(g,w,h,d,0,h/2+1,0,mat(color));
    for(let side of [-1,1]) {
      const roofMesh=new THREE.Mesh(new THREE.BoxGeometry(w/Math.sqrt(2)+6,1.7,d+7),mat(roof));
      roofMesh.rotation.z=side*Math.PI/4;
      roofMesh.position.set(side*(w*.245),h+w*.18+1.5,0);
      roofMesh.castShadow=true;g.add(roofMesh);
    }
    box(g,7,12,.7,0,7.1,d/2+.5,mat('#6d5845'));
    sphere(g,.55,2.3,7.3,d/2+1,mat('#d0a447', {metalness:.65}));
    const glass=mat('#c5e9e9',{emissive:'#7ccbc8',emissiveIntensity:.1});
    for(const dx of [-w*.28,w*.28]) {
      box(g,6.2,7,.65,dx,h*.63,d/2+.7,mat('#fff2d8'));
      box(g,5.1,5.9,.8,dx,h*.63,d/2+1,glass);
      box(g,.55,6.2,.9,dx,h*.63,d/2+1.4,mat('#f5f0dc'));
      box(g,5.8,.55,.9,dx,h*.63,d/2+1.4,mat('#f5f0dc'));
      box(g,6.6,1.8,2.4,dx,h*.63-4.6,d/2+1.6,mat('#8d7455'));
      for(let i=0;i<4;i++)sphere(g,1.25,dx-2+i*1.3,h*.63-3.3,d/2+2.4,mat(i%2?'#8bb861':'#e6b35d'));
    }
    box(g,4,9,4,-w*.28,h+6,-d*.2,mat('#d4c5a6'));
    if(awning){
      const awn=box(g,w*.84,.6,9,0,12,d/2+5,mat('#f2dfb1'));
      awn.rotation.x=-.13;
      for(let i=-3;i<=3;i++)box(g,1.6,.2,9,i*(w*.11),12.5,d/2+5,mat(i%2===0?'#d77765':'#f4edcb'));
    }
    if(name) {const sign=labelSprite(name,w*.72);sign.position.set(0,18,d/2+2);g.add(sign);}
    this.blockers.push({x,z,r:Math.max(w,d)*.57});
    return g;
  }

  route(points,width=5,color='#d8bb8c') {
    const positions=[],indices=[];
    for(let i=0;i<points.length-1;i++) {
      const a=points[i],b=points[i+1];
      const dist=Math.hypot(b.x-a.x,b.z-a.z),n=Math.max(3,Math.ceil(dist/5));
      for(let j=0;j<n;j++) {
        const t=j/n,x=a.x+(b.x-a.x)*t,z=a.z+(b.z-a.z)*t;
        const angle=Math.atan2(b.z-a.z,b.x-a.x),nx=-Math.sin(angle),nz=Math.cos(angle);
        const left={x:x+nx*width*.5,z:z+nz*width*.5};
        const right={x:x-nx*width*.5,z:z-nz*width*.5};
        positions.push(left.x,this.elevation(left.x,left.z)+.25,left.z,right.x,this.elevation(right.x,right.z)+.25,right.z);
      }
    }
    const last=points[points.length-1],prev=points[points.length-2];
    const angle=Math.atan2(last.z-prev.z,last.x-prev.x),nx=-Math.sin(angle),nz=Math.cos(angle);
    for(const side of [1,-1]) {
      const x=last.x+side*nx*width*.5,z=last.z+side*nz*width*.5;
      positions.push(x,this.elevation(x,z)+.25,z);
    }
    const count=positions.length/6;
    for(let i=0;i<count-1;i++){const p=i*2;indices.push(p,p+1,p+2,p+1,p+3,p+2);}
    const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));geometry.setIndex(indices);geometry.computeVertexNormals();
    const mesh=new THREE.Mesh(geometry,mat(color,{side:THREE.DoubleSide}));mesh.receiveShadow=true;this.group.add(mesh);
    return mesh;
  }

  flowerPatch(x,z,r=7) {
    const palette=['#f3d36d','#edaebb','#dfc5ef','#f5e5b1','#e89d63'];
    const flowers=[];
    for(let i=0;i<18;i++){
      const a=i*2.399963,rad=Math.sqrt((i+.4)/18)*r;
      const px=x+Math.cos(a)*rad,pz=z+Math.sin(a)*rad;
      flowers.push({
        x:px,y:this.elevation(px,pz),z:pz,
        h:2.1+(i%5)*.19,turn:a,
        color:palette[i%palette.length]
      });
    }
    plantBatch(this.group,new THREE.CylinderGeometry(.09,.14,2.1,5),
      mat('#65965b'),flowers,
      (d,p)=>{d.position.set(p.x,p.y+p.h*.48,p.z);d.scale.y=p.h/2.1;});
    const leafGeometry=new THREE.ConeGeometry(.54,1.65,5);
    for(const side of [-1,1]){
      plantBatch(this.group,leafGeometry,mat('#81a860'),flowers,
        (d,p)=>{
          d.position.set(p.x+side*.45,p.y+.85,p.z);
          d.rotation.z=side*.75+p.turn*.015;
          d.scale.set(.8,.95,.6);
        });
    }
    const petals=new THREE.SphereGeometry(.57,7,5);
    const petalMaterial=mat('#ffffff',{flatShading:true});
    for(let k=0;k<5;k++){
      const a=k*Math.PI*2/5;
      plantBatch(this.group,petals,petalMaterial,flowers,
        (d,p)=>{
          const angle=a+p.turn;
          d.position.set(
            p.x+Math.cos(angle)*.52,
            p.y+p.h+.12+Math.sin(a*2)*.08,
            p.z+Math.sin(angle)*.52
          );
          d.rotation.y=angle;
          d.scale.set(.8,.43,.64);
        },p=>p.color);
    }
    plantBatch(this.group,new THREE.SphereGeometry(.32,7,5),
      mat('#b87943'),flowers,
      (d,p)=>d.position.set(p.x,p.y+p.h+.15,p.z));
  }

  lantern(x,z) {
    const y=this.elevation(x,z);
    cylinder(this.group,.3,.4,10,x,y+5,z,mat('#3b625c'));
    cylinder(this.group,2,1,2.2,x,y+10.2,z,mat('#fff0b5',{emissive:'#f2d78f',emissiveIntensity:.5}));
    cylinder(this.group,2.5,2.5,.6,x,y+11.7,z,mat('#3b625c'));
  }

  shadeTree(x,z,scale=1) {
    const y=this.elevation(x,z);
    cylinder(this.group,.85*scale,1.3*scale,13*scale,
      x,y+6.5*scale,z,mat('#8d755a'),9);
    for(const side of [-1,1]){
      const branch=cylinder(this.group,.24*scale,.48*scale,7*scale,
        x+side*2.25*scale,y+11.5*scale,z+.25*scale,
        mat('#93785d'),7);
      branch.rotation.z=side*.63;
    }
    const canopy=[
      [0,17,0,6.2,'#76a666'],[-4.3,15.3,1,4.5,'#6d9a5c'],
      [4.2,15.8,-1.4,4.75,'#90b777'],
      [-1.6,19,2.2,4.05,'#98bf80'],
      [2.2,18.1,3.1,4.15,'#79a968'],
      [1.2,18,-4.1,4,'#638e57'],
      [-1,21,.2,3.35,'#9ac283']
    ];
    for(const [dx,dy,dz,r,color] of canopy){
      const mesh=new THREE.Mesh(
        new THREE.IcosahedronGeometry(r*scale,1),
        mat(color,{flatShading:true})
      );
      mesh.position.set(x+dx*scale,y+dy*scale,z+dz*scale);
      mesh.castShadow=true;mesh.receiveShadow=true;
      this.group.add(mesh);
    }
  }

  build() {
    const {x,z}=this.profile.village;
    this.route([{x:x-160,z:z},{x:x+200,z:z}],11,'#d2b18b');
    this.route([{x,z:z-225},{x,z:z+210}],9,'#dbc295');
    this.route([{x:x-140,z:z-10},{x:x-250,z:z-30},{x:x-400,z:z-65},{x:-535,z:z-100}],8,'#dcc89f');
    this.route([{x:x+150,z:z-70},{x:x+220,z:z-165},{x:x+350,z:z-350},{x:x+540,z:z-500}],6,'#b99b74');
    this.building({x:x-58,z:z-79,w:33,d:24,h:22,color:'#df9c7e',roof:'#a65343',name:'June’s Bakery',awning:true});
    this.building({x:x+92,z:z-92,w:28,d:23,h:23,color:'#e5c98c',roof:'#578b8d',name:'Book Nook',awning:true});
    this.building({x:x+165,z:z+104,w:30,d:26,h:22,color:'#b6d4be',roof:'#8f6856',name:'Bayberry House'});
    this.building({x:x+91,z:z+149,w:24,d:24,h:19,color:'#e8b2a5',roof:'#8c7460'});
    this.building({x:x+182,z:z-227,w:24,d:23,h:22,color:'#b5c8a0',roof:'#517e64',name:'Ranger Hut'});
    this.building({x:x-166,z:z+111,w:24,d:22,h:21,color:'#a9c5d5',roof:'#756b82'});
    this.building({x:x-130,z:z-159,w:22,d:19,h:19,color:'#e6cf9b',roof:'#9a795f'});
    // Town green, market umbrellas, cafe furniture, and flowerbeds.
    cylinder(this.group,17,17,1,x,this.elevation(x,z)+.7,z,mat('#d7c6a4'),20);
    cylinder(this.group,8,8,2,x,this.elevation(x,z)+2,z,mat('#b4d6d2'),20);
    cylinder(this.group,2,2,5,x,this.elevation(x,z)+5,z,mat('#eee4c9'));
    sphere(this.group,2.2,x,this.elevation(x,z)+8,z,mat('#f5e8b6'));
    for(const dx of [-35,38]) for(const dz of [-23,27])this.flowerPatch(x+dx,z+dz,8);
    for(const [tx,tz,s] of [[-118,-110,1.2],[126,14,1],[52,104,1.15],[-83,92,.9],[174,-128,1.25],[-200,-33,1.05]]){
      this.shadeTree(x+tx,z+tz,s);
    }
    for(const offset of [-74,62]){
      const px=x+offset,pz=z+37,py=this.elevation(px,pz);
      cylinder(this.group,13,13,.8,px,py+.45,pz,mat('#e8c596'));
      cylinder(this.group,.45,.5,13,px,py+7,pz,mat('#8c6d56'));
      const umbrella=new THREE.Mesh(new THREE.ConeGeometry(13,5,10),mat(offset<0?'#e1a063':'#83b7ab'));
      umbrella.position.set(px,py+15,pz);umbrella.castShadow=true;this.group.add(umbrella);
    }
    for(const lx of [-115,115])for(const lz of [-10,90])this.lantern(x+lx,z+lz);
    this.places.market={x:x+25,z:z+35};
    // Garden plots and raised beds.
    const gx=x+155,gz=z-43;
    for(let i=-1;i<=1;i++)for(let j=-1;j<=1;j++){
      const px=gx+i*10,pz=gz+j*12,py=this.elevation(px,pz);
      box(this.group,8,.9,9,px,py+.45,pz,mat('#816b50'));
      box(this.group,7,.3,8,px,py+1.05,pz,mat('#586e43'));
      this.flowerPatch(px,pz,3.5);
    }
    // A little dock reaches toward the lake and helps orient the landscape.
    const dockX=-580,dockZ=z-100;
    for(let i=0;i<7;i++){
      const px=dockX+i*15,y=Math.max(this.terrain.waterY+3.4,this.elevation(px,dockZ)+1);
      box(this.group,15,.9,14,px,y,dockZ,mat('#9d785a'));
      for(const dz of [-6,6])cylinder(this.group,.65,.75,8,px,y-3.5,dockZ+dz,mat('#765840'));
    }
    this.places.dock={x:dockX+78,z:dockZ};
    // Trail markers and a welcome sign.
    const sx=x,sz=z+202,sy=this.elevation(sx,sz);
    box(this.group,21,10,1,sx,sy+12,sz,mat('#4f785d'));
    const welcome=labelSprite('Welcome to Bayberry Cove',44);welcome.position.set(sx,sy+12,sz+1.3);this.group.add(welcome);
    for(const px of [-18,18])cylinder(this.group,.8,.8,13,sx+px,sy+6.5,sz,mat('#866a4f'));
  }

  canWalk(x,z,r=4) {
    for(const b of this.blockers) if(Math.hypot(x-b.x,z-b.z)<b.r+r) return false;
    return true;
  }
}
