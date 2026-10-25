import * as THREE from 'three';

const mat=(color)=>new THREE.MeshStandardMaterial({color,roughness:.92,flatShading:true});

function bodyPart(parent,geometry,color,x,y,z) {
  const mesh=new THREE.Mesh(geometry,mat(color));mesh.position.set(x,y,z);mesh.castShadow=true;parent.add(mesh);return mesh;
}

function residentMesh(profile,index) {
  const group=new THREE.Group();
  const shirt=profile.color;
  bodyPart(group,new THREE.CapsuleGeometry(2.3,4.5,3,7),shirt,0,8.6,0);
  bodyPart(group,new THREE.SphereGeometry(2.1,10,7),index%3===0?'#d9a183':index%3===1?'#bc8564':'#efc9a6',0,16,0);
  bodyPart(group,new THREE.SphereGeometry(2.2,8,5),index%2?'#58453b':'#75634b',0,18,.2).scale.y=.65;
  const leftLeg=bodyPart(group,new THREE.CapsuleGeometry(.9,3.9,3,6),'#6a7c71',-1.2,3.2,0);
  const rightLeg=bodyPart(group,new THREE.CapsuleGeometry(.9,3.9,3,6),'#6a7c71',1.2,3.2,0);
  const leftArm=bodyPart(group,new THREE.CapsuleGeometry(.65,4.4,3,6),shirt,-2.8,9,0);
  const rightArm=bodyPart(group,new THREE.CapsuleGeometry(.65,4.4,3,6),shirt,2.8,9,0);
  if(profile.job==='Fisherman')bodyPart(group,new THREE.CylinderGeometry(3,3,.75,12),'#c8ae79',0,18.8,0);
  if(profile.job==='Park ranger')bodyPart(group,new THREE.CylinderGeometry(2.3,2.4,.9,8),'#4d7a58',0,18.8,0);
  return {group,leftLeg,rightLeg,leftArm,rightArm};
}

export class Residents {
  constructor(scene,terrain,village,profile,clock) {
    this.people=profile.residents.map((definition,index)=>{
      const objects=residentMesh(definition,index);
      scene.add(objects.group);
      const entry=this.scheduleEntry(definition,clock.hours);
      const place=village.places[entry.place]||village.places.home;
      const x=place.x+((index%3)-1)*8,z=place.z+((index%2)*2-1)*7;
      objects.group.position.set(x,village.walkHeight(x,z),z);
      return {...definition,...objects,index,target:{x,z},moving:false,walkPhase:0};
    });
    this.terrain=terrain;this.village=village;this.clock=clock;
  }

  scheduleEntry(person,hour) {
    let active=person.schedule[0];
    for(const entry of person.schedule)if(hour>=entry.hour)active=entry;
    return active;
  }

  update(dt,elapsed) {
    for(const person of this.people) {
      const schedule=this.scheduleEntry(person,this.clock.hours);
      const place=this.village.places[schedule.place]||this.village.places.home;
      const variation=Math.sin(person.index*17.2)*7;
      const targetX=place.x+variation,targetZ=place.z+Math.cos(person.index*21)*6;
      const dx=targetX-person.group.position.x,dz=targetZ-person.group.position.z;
      const distance=Math.hypot(dx,dz);
      person.moving=distance>3;
      if(person.moving) {
        const speed=Math.min(distance,dt*(person.job==='Park ranger'?11:8));
        const x=person.group.position.x+dx/distance*speed;
        const z=person.group.position.z+dz/distance*speed;
        person.group.position.set(x,this.village.walkHeight(x,z),z);
        const angle=Math.atan2(-dx,-dz);
        person.group.rotation.y+=Math.atan2(Math.sin(angle-person.group.rotation.y),Math.cos(angle-person.group.rotation.y))*Math.min(1,dt*6);
        person.walkPhase+=dt*8;
      } else {
        person.group.rotation.y+=Math.sin(elapsed*.25+person.index)*dt*.003;
      }
      const sway=person.moving?Math.sin(person.walkPhase)*.42:0;
      person.leftLeg.rotation.x=THREE.MathUtils.lerp(person.leftLeg.rotation.x,sway,dt*10);
      person.rightLeg.rotation.x=THREE.MathUtils.lerp(person.rightLeg.rotation.x,-sway,dt*10);
      person.leftArm.rotation.x=THREE.MathUtils.lerp(person.leftArm.rotation.x,-sway,dt*10);
      person.rightArm.rotation.x=THREE.MathUtils.lerp(person.rightArm.rotation.x,sway,dt*10);
    }
  }

  nearby(x,z,radius=25) {
    let closest=null,best=radius;
    for(const person of this.people){
      const d=Math.hypot(person.group.position.x-x,person.group.position.z-z);
      if(d<best){best=d;closest=person;}
    }
    return closest;
  }
}
