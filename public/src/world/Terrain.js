import * as THREE from 'three';

const smoothStep = x => { const v=THREE.MathUtils.clamp(x,0,1); return v*v*(3-2*v); };

export class Terrain {
  constructor(scene, metadata, profile) {
    this.metadata=metadata; this.profile=profile;
    const bounds=metadata.bounds;
    const lat=(bounds.south+bounds.north)*0.5*Math.PI/180;
    this.width=(bounds.east-bounds.west)*111320*Math.cos(lat);
    this.depth=(bounds.north-bounds.south)*111132;
    this.datum=Math.floor(metadata.minimum);
    this.waterY=(profile.waterElevationMeters-this.datum)*profile.verticalScale;
    this.townLevel=this.rawHeight(profile.village.x,profile.village.z);
    this.group=new THREE.Group(); scene.add(this.group);

    const geometry=new THREE.PlaneGeometry(this.width,this.depth,metadata.width-1,metadata.height-1);
    geometry.rotateX(-Math.PI/2);
    const position=geometry.getAttribute('position');
    const colors=new Float32Array(position.count*3);
    const color=new THREE.Color();
    for(let i=0;i<position.count;i++) {
      const x=position.getX(i),z=position.getZ(i);
      const y=this.heightAt(x,z); position.setY(i,y);
      const above=y-this.waterY;
      const slope=this.slopeAt(x,z);
      if(above<1.1) color.set('#d9ca8e');
      else if(above<4.5) color.set('#e0c992');
      else if(slope>0.7) color.set('#a6a18d');
      else if(above>38) color.set('#6f9665');
      else color.set('#84aa6a');
      const variation=Math.sin(x*0.032+z*0.021)*0.034 + Math.cos(z*0.043-x*0.015)*0.025;
      color.offsetHSL(0,0,variation);
      colors[i*3]=color.r;colors[i*3+1]=color.g;colors[i*3+2]=color.b;
    }
    geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));
    geometry.computeVertexNormals();
    this.mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:0.98,metalness:0,side:THREE.DoubleSide}));
    this.mesh.receiveShadow=true;this.group.add(this.mesh);
  }

  rawElevation(x,z) {
    const {width,height,samples}=this.metadata;
    const gx=THREE.MathUtils.clamp((x/this.width+0.5)*(width-1),0,width-1);
    const gz=THREE.MathUtils.clamp((z/this.depth+0.5)*(height-1),0,height-1);
    const x0=Math.floor(gx),z0=Math.floor(gz),x1=Math.min(x0+1,width-1),z1=Math.min(z0+1,height-1);
    const tx=gx-x0,tz=gz-z0;
    const north=samples[z0][x0]*(1-tx)+samples[z0][x1]*tx;
    const south=samples[z1][x0]*(1-tx)+samples[z1][x1]*tx;
    return north*(1-tz)+south*tz;
  }
  rawHeight(x,z) {return (this.rawElevation(x,z)-this.datum)*this.profile.verticalScale;}
  heightAt(x,z) {
    const h=this.rawHeight(x,z);
    const town=this.profile.village;
    const d=Math.hypot(x-town.x,z-town.z);
    const blend=1-smoothStep((d-70)/Math.max(town.radius-70,1));
    return THREE.MathUtils.lerp(h,this.townLevel,blend);
  }
  slopeAt(x,z) {
    const step=8;
    return Math.hypot(this.heightAtSimple(x+step,z)-this.heightAtSimple(x-step,z),this.heightAtSimple(x,z+step)-this.heightAtSimple(x,z-step))/(2*step);
  }
  heightAtSimple(x,z) { // avoid recursively calculating slope
    const h=this.rawHeight(x,z),town=this.profile.village;
    const d=Math.hypot(x-town.x,z-town.z);
    return THREE.MathUtils.lerp(h,this.townLevel,1-smoothStep((d-70)/Math.max(town.radius-70,1)));
  }
  positionInBounds(x,z,margin=10) {
    return Math.abs(x)<this.width/2-margin && Math.abs(z)<this.depth/2-margin;
  }
}
