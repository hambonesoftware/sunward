import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {resolve,join,extname,sep} from 'node:path';
import {fileURLToPath} from 'node:url';

const root=resolve(fileURLToPath(new URL('../public/',import.meta.url)));
const types={'.html':'text/html','.css':'text/css','.js':'text/javascript','.json':'application/json','.tif':'image/tiff','.txt':'text/plain'};

export function startServer(port=8080,host='127.0.0.1') {
  const server=createServer(async(req,res)=>{
    try {
      const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const target=resolve(join(root,pathname==='/'?'index.html':pathname.replace(/^\//,'')));
      if(target!==root&&!target.startsWith(root+sep))throw new Error('Path outside public folder');
      const info=await stat(target);
      if(!info.isFile())throw new Error('Not a file');
      const buffer=await readFile(target);
      res.writeHead(200,{'Content-Type':types[extname(target)]||'application/octet-stream','Cache-Control':'no-cache'});
      res.end(buffer);
    }catch{res.writeHead(404,{'Content-Type':'text/plain'});res.end('Not found');}
  });
  server.listen(port,host);
  return server;
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  const server=startServer(Number(process.env.PORT)||8080,'0.0.0.0');
  server.on('listening',()=>console.log(`Sunward is ready at http://localhost:${server.address().port}`));
}
