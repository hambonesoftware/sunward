// Elevation is downloaded and preprocessed once during Pages deployment.
// At runtime every height lookup uses the same measured raster.
export function decodeElevation(metadata,buffer){
  if(metadata?.encoding?.type!=='uint16-le')throw Error('Unsupported Stony Creek elevation encoding');
  const {width,height,encoding}=metadata;
  if(!Number.isInteger(width)||!Number.isInteger(height)||width<2||height<2)
    throw Error('Invalid elevation dimensions');
  if(buffer.byteLength!==width*height*2)
    throw Error('Truncated elevation raster: expected '+width*height*2+' bytes');
  if(!Number.isFinite(encoding.offset)||encoding.scale!==0.01)
    throw Error('Invalid elevation scale or origin');
  const heights=new Uint16Array(width*height);
  const view=new DataView(buffer);
  for(let i=0;i<heights.length;i++)heights[i]=view.getUint16(i*2,true);
  return {...metadata,heights,offset:encoding.offset,scale:encoding.scale};
}
export async function loadStonyElevation(url){
  const response=await fetch(url);
  if(!response.ok)throw Error('Stony Creek elevation metadata is unavailable');
  const metadata=await response.json();
  if(typeof metadata.encoding?.file!=='string'||!/^[\w.-]+\.bin$/.test(metadata.encoding.file))
    throw Error('Missing elevation raster path');
  const binaryResponse=await fetch(new URL(metadata.encoding.file,url));
  if(!binaryResponse.ok)throw Error('The Stony Creek elevation raster is unavailable');
  return decodeElevation(metadata,await binaryResponse.arrayBuffer());
}
export function bilinearElevation(dem,x,z,widthMeters,depthMeters){
  const fx=Math.max(0,Math.min(dem.width-1,(x/widthMeters+.5)*(dem.width-1)));
  const fz=Math.max(0,Math.min(dem.height-1,(z/depthMeters+.5)*(dem.height-1)));
  const ax=Math.floor(fx),az=Math.floor(fz);
  const bx=Math.min(dem.width-1,ax+1),bz=Math.min(dem.height-1,az+1);
  const tx=fx-ax,tz=fz-az,w=dem.width,h=dem.heights;
  const v00=h[az*w+ax],v10=h[az*w+bx],v01=h[bz*w+ax],v11=h[bz*w+bx];
  return dem.offset+dem.scale*((v00*(1-tx)+v10*tx)*(1-tz)+(v01*(1-tx)+v11*tx)*tz);
}
