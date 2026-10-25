import * as THREE from 'three';

const mat=color=>new THREE.MeshStandardMaterial({color,roughness:.9,flatShading:true});

function part(parent,geometry,color,x,y,z) {
  const obj=new THREE.Mesh(geometry,mat(color));obj.position.set(x,y,z);obj.castShadow=true;parent.add(obj);return obj;
}

export class Player {
  constructor(scene,terrain,village,start) {
    this.terrain=terrain;this.village=village;
    this.position=new THREE.Vector3(start.x,village.walkHeight(start.x,start.z),start.z);
    this.group=new THREE.Group();this.group.position.copy(this.position);scene.add(this.group);
    this.body=new THREE.Group();this.group.add(this.body);
    part(this.body,new THREE.CapsuleGeometry(2.55,5.2,4,8),'#548d8a',0,9.7,0);
    part(this.body,new THREE.SphereGeometry(2.4,12,9),'#eabda0',0,17,0);
    part(this.body,new THREE.SphereGeometry(2.5,10,6),'#4d493c',0,18.9,-.1);
    part(this.body,new THREE.CylinderGeometry(2.7,2.5,.9,11),'#e2a05b',0,19.7,.1);
    part(this.body,new THREE.BoxGeometry(4.8,6.6,2.6),'#bc8865',0,10,2.6);
    part(this.body,new THREE.BoxGeometry(2.8,2.8,1.2),'#dfbf83',0,11.5,4.2);
    this.leftArm=part(this.body,new THREE.CapsuleGeometry(.8,5.2,4,7),'#548d8a',-3.2,10.2,0);
    this.rightArm=part(this.body,new THREE.CapsuleGeometry(.8,5.2,4,7),'#548d8a',3.2,10.2,0);
    this.leftLeg=part(this.body,new THREE.CapsuleGeometry(1,4.8,4,7),'#6f8063',-1.35,3.6,0);
    this.rightLeg=part(this.body,new THREE.CapsuleGeometry(1,4.8,4,7),'#6f8063',1.35,3.6,0);
    this.verticalVelocity=0;this.airOffset=0;this.facing=start.facing||Math.PI;
    this.group.rotation.y=this.facing;
    this.walkPhase=0;
  }

  update(dt,input,cameraHeading,allowMovement=true) {
    const move=allowMovement?input.moveAxis():{x:0,y:0};
    const walking=Math.hypot(move.x,move.y)>.05;
    const speed=input.sprinting()?32:20;
    if(walking) {
      const dx=move.x*Math.cos(cameraHeading)+move.y*Math.sin(cameraHeading);
      const dz=move.x*Math.sin(cameraHeading)-move.y*Math.cos(cameraHeading);
      const nextX=this.position.x+dx*speed*dt,nextZ=this.position.z+dz*speed*dt;
      if(this.terrain.positionInBounds(nextX,this.position.z,18)&&this.village.canWalk(nextX,this.position.z))this.position.x=nextX;
      if(this.terrain.positionInBounds(this.position.x,nextZ,18)&&this.village.canWalk(this.position.x,nextZ))this.position.z=nextZ;
      this.facing=Math.atan2(-dx,-dz);
      const diff=Math.atan2(Math.sin(this.facing-this.group.rotation.y),Math.cos(this.facing-this.group.rotation.y));
      this.group.rotation.y+=diff*Math.min(1,dt*10);
      this.walkPhase+=dt*(input.sprinting()?13:9);
    }
    if(allowMovement&&input.consumeJump()&&this.airOffset<=.01){this.verticalVelocity=14.5;this.airOffset=.01;}
    this.airOffset+=this.verticalVelocity*dt;
    this.verticalVelocity-=32*dt;
    if(this.airOffset<0){this.airOffset=0;this.verticalVelocity=0;}
    const targetGround=this.village.walkHeight(this.position.x,this.position.z);
    this.position.y=THREE.MathUtils.lerp(this.position.y,targetGround,Math.min(1,dt*14));
    this.group.position.copy(this.position);this.group.position.y+=this.airOffset;
    const swing=walking?Math.sin(this.walkPhase)*.55:0;
    this.leftArm.rotation.x=THREE.MathUtils.lerp(this.leftArm.rotation.x,swing,dt*13);
    this.rightArm.rotation.x=THREE.MathUtils.lerp(this.rightArm.rotation.x,-swing,dt*13);
    this.leftLeg.rotation.x=THREE.MathUtils.lerp(this.leftLeg.rotation.x,-swing,dt*13);
    this.rightLeg.rotation.x=THREE.MathUtils.lerp(this.rightLeg.rotation.x,swing,dt*13);
    this.body.position.y=walking&&this.airOffset<.1?Math.abs(Math.sin(this.walkPhase*2))*.2:0;
  }
}
