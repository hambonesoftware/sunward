import assert from 'node:assert/strict';
import {existsSync} from 'node:fs';
import {startServer} from './serve.mjs';
const {chromium}=await import('playwright-core');

const candidates=[
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
  '/opt/google/chrome/chrome'
];
const executablePath=candidates.find(existsSync);
assert(executablePath,'Chrome/Chromium not installed on this runner');
const server=startServer(0);
await new Promise(resolve=>server.once('listening',resolve));
const port=server.address().port;
let browser;
try{
  browser=await chromium.launch({
    executablePath,
    headless:true,
    args:[
      '--no-sandbox',
      '--disable-gpu-sandbox',
      '--enable-webgl',
      '--enable-unsafe-swiftshader',
      '--use-gl=angle',
      '--use-angle=swiftshader'
    ]
  });
  const page=await browser.newPage({
    viewport:{width:1024,height:768},
    deviceScaleFactor:1
  });
  const problems=[];
  page.on('pageerror',error=>problems.push('Page error: '+error.message));
  await page.goto('http://127.0.0.1:'+port+'/',{waitUntil:'load'});
  await page.waitForFunction(()=>document.documentElement.dataset.stonyReady==='true',{timeout:45000});
  const count=await page.locator('#start-button').count();
  assert.equal(count,1);
  await page.click('#start-button');
  await page.waitForTimeout(1800);
  const status=await page.evaluate(()=>{
    const canvas=document.getElementById('world');
    const gl=canvas.getContext('webgl2')||canvas.getContext('webgl');
    return {
      ready:document.documentElement.dataset.stonyReady,
      startDisplay:getComputedStyle(document.getElementById('start-screen')).display,
      hasGL:!!gl,
      canvasWidth:canvas.width,
      canvasHeight:canvas.height,
      title:document.title
    };
  });
  assert.equal(status.ready,'true');
  assert.equal(status.startDisplay,'none');
  assert(status.hasGL,'WebGL did not initialize');
  assert(status.canvasWidth>100&&status.canvasHeight>100);
  assert.equal(problems.length,0,problems.join('\n'));
  await page.screenshot({path:'stony-creek-smoke.png'});
  console.log('3D browser smoke test passed:',status);
}finally{
  await browser?.close();
  await new Promise(resolve=>server.close(resolve));
}
