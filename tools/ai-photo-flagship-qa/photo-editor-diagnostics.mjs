import fs from 'node:fs';
import { spawn } from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: photo-editor-diagnostics.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const driverPort=9521,log=fs.openSync(`${outDir}/chromedriver-photo-diagnostics.log`,'a'),driver=spawn(driverBinary,[`--port=${driverPort}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',log,log]});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let sessionId='';
async function command(method,path,body){const res=await fetch(`http://127.0.0.1:${driverPort}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),raw=await res.text();const parsed=raw?JSON.parse(raw):{};if(!res.ok||parsed?.value?.error)throw new Error(`${method} ${path}: ${JSON.stringify(parsed.value||parsed)}`);return parsed.value}
async function execute(script,args=[]){return command('POST',`/session/${sessionId}/execute/sync`,{script,args})}
async function executeAsync(script,args=[]){return command('POST',`/session/${sessionId}/execute/async`,{script,args})}
async function waitUntil(script,label,timeout=12000){const started=Date.now();while(Date.now()-started<timeout){if(await execute(script))return;await delay(60)}throw new Error(`Timed out: ${label}`)}
async function click(selector){return execute('const n=document.querySelector(arguments[0]);if(!n)return false;n.click();return true;',[selector])}
async function start(){for(let i=0;i<60;i++){try{if((await command('GET','/status'))?.ready)break}catch{}await delay(100)}const made=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome',pageLoadStrategy:'normal','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-default-apps','--disable-extensions','--force-color-profile=srgb','--hide-scrollbars'],mobileEmulation:{deviceMetrics:{width:393,height:852,pixelRatio:1,mobile:true,touch:true}}}}}});sessionId=made.sessionId;await command('POST',`/session/${sessionId}/timeouts`,{pageLoad:20000,script:20000,implicit:0});await command('POST',`/session/${sessionId}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});await waitUntil('return document.documentElement.dataset.qaReady||document.documentElement.dataset.qaError||"";','harness',20000);const err=await execute('return document.documentElement.dataset.qaError||"";');if(err)throw new Error(err)}
async function stop(){if(sessionId)try{await command('DELETE',`/session/${sessionId}`)}catch{}driver.kill('SIGTERM')}
async function loadFixture(){return executeAsync(`const done=arguments[arguments.length-1],i=document.querySelector('[data-photo-file]'),c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d'),img=x.createImageData(c.width,c.height);for(let y=0;y<c.height;y++)for(let xx=0;xx<c.width;xx++){const p=(y*c.width+xx)*4;const n=((xx*73+y*151+(xx*y*17))%97)-48;const base=90+Math.round(xx/c.width*95)+Math.round(y/c.height*35);img.data[p]=Math.max(0,Math.min(255,base+n));img.data[p+1]=Math.max(0,Math.min(255,base-n));img.data[p+2]=Math.max(0,Math.min(255,125+n));img.data[p+3]=255}x.putImageData(img,0,0);c.toBlob(b=>{const dt=new DataTransfer();dt.items.add(new File([b],'diagnostic-noise.png',{type:'image/png'}));i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>done(true),180)},'image/png');`)}
async function setRange(selector,value){return execute(`const i=document.querySelector(arguments[0]);if(!i)return false;i.focus();i.value=String(arguments[1]);i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));i.blur();return true;`,[selector,value])}
async function canvasSnapshot(){return execute(`const c=document.querySelector('[data-photo-canvas]'),x=c.getContext('2d',{willReadFrequently:true}),d=x.getImageData(0,0,c.width,c.height).data;let hash=2166136261,sum=0;for(let i=0;i<d.length;i+=4){hash^=d[i];hash=Math.imul(hash,16777619);hash^=d[i+1];hash=Math.imul(hash,16777619);hash^=d[i+2];hash=Math.imul(hash,16777619);sum+=d[i]+d[i+1]+d[i+2]}return{w:c.width,h:c.height,hash:hash>>>0,sum,transform:c.style.transform,zoomValue:document.querySelector('[data-photo-zoom]').value,zoomOutput:document.querySelector('[data-photo-zoom-output]').textContent,zoomLabel:document.querySelector('[data-photo-zoomlabel]').textContent};`)}

const report={};
try{
  await start();await loadFixture();await waitUntil('return !document.querySelector("[data-photo-canvas]").hidden;','photo load');await delay(220);
  report.initial=await canvasSnapshot();
  await click('[data-photo-panel-open="edit"]');await setRange('[data-photo-zoom]',175);await delay(100);report.zoom175=await canvasSnapshot();
  await click('[data-photo-subtab="history"]');await click('[data-view-fit]');await delay(80);report.afterFit=await canvasSnapshot();
  await click('[data-photo-subtab="detail"]');
  await setRange('[data-photo-range="noiseReduction"]',65);await delay(180);report.noise65=await canvasSnapshot();
  await setRange('[data-photo-range="noiseReduction"]',100);await delay(240);report.noise100=await canvasSnapshot();
  report.noise65Changed=report.noise65.hash!==report.afterFit.hash||report.noise65.sum!==report.afterFit.sum;
  report.noise100Changed=report.noise100.hash!==report.afterFit.hash||report.noise100.sum!==report.afterFit.sum;
  report.zoom175StateOk=report.zoom175.zoomValue==='175'&&report.zoom175.zoomOutput==='175%'&&report.zoom175.zoomLabel==='175%';
  report.fitStateOk=report.afterFit.zoomValue==='100'&&report.afterFit.zoomOutput==='100%'&&report.afterFit.zoomLabel==='100%';
  fs.writeFileSync(`${outDir}/photo-editor-diagnostics.json`,JSON.stringify(report,null,2));
  fs.writeFileSync(`${outDir}/photo-editor-diagnostics.md`,`# Photo Editor diagnostics\n\n- Zoom 175 state: ${report.zoom175StateOk?'OK':'MISMATCH'}\n- Fit 100 state: ${report.fitStateOk?'OK':'MISMATCH'}\n- Noise 65 pixel change: ${report.noise65Changed?'YES':'NO'}\n- Noise 100 pixel change: ${report.noise100Changed?'YES':'NO'}\n\n\`\`\`json\n${JSON.stringify(report,null,2)}\n\`\`\`\n`);
  console.log(JSON.stringify(report,null,2));
}catch(error){report.error=String(error?.stack||error);fs.writeFileSync(`${outDir}/photo-editor-diagnostics.json`,JSON.stringify(report,null,2));console.error(error?.stack||error);process.exitCode=1}finally{await stop()}
