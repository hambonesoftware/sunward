import {mkdir,writeFile} from 'node:fs/promises';
import {dirname} from 'node:path';

// Ingest generated artwork from base64 stdin into a local PNG source asset.
// Run the asset optimization script afterwards to produce game-ready WebP.
const destination=process.argv[2];
if(!destination)throw new Error('Expected destination PNG path');
if(process.stdin.isTTY)process.stdin.setRawMode(true);
let received='';
for await(const chunk of process.stdin){
  received+=chunk.toString('utf8');
  if(received.includes('\nEND_IMAGE\n'))break;
}
const encoded=received.split('\nEND_IMAGE\n')[0].trim();
if(!/^[A-Za-z0-9+/=]+$/.test(encoded))throw new Error('Invalid base64 image');
await mkdir(dirname(destination),{recursive:true});
await writeFile(destination,Buffer.from(encoded,'base64'));
console.log('Wrote '+destination);
