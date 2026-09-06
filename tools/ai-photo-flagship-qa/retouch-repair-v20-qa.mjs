import fs from 'node:fs';
import { spawn } from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: retouch-repair-v20-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const driverPort=9532,log=fs.openSync(`${outDir}/chromedriver-retouch-v20.log`,'a'),driver=spawn(driverBinary,[`--port=${driverPort}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',log,log]});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));let sessionId='';
async function command(method,path,body){const response=await fetch(`http://127.0.0.1:${driverPort}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),raw=await response.text();let parsed={};try{parsed=raw?JSON.parse(raw):{}}catch{throw new Error(`${method} ${path} invalid JSON`)}if(!response.ok||parsed?.value?.error)throw new Error(`${method} ${path}: ${JSON.stringify(parsed.value||parsed)}`);return parsed.value}
async function execute(script,args=[]){return command('POST',`/session/${sessionId}/execute/sync`,{script,args})}
async function executeAsync(script,args=[]){return command('POST',`/session/${sessionId}/execute/async`,{script,args})}
async function waitUntil(script,label,timeout=12000){const start=Date.now();while(Date.now()-start<timeout){if(await execute(script))return true;await delay(60)}throw new Error(`Timed out: ${label}`)}
async function click(selector){return execute('const n=document.querySelector(arguments[0]);if(!n)return false;n.click();return true;',[selector])}
async function start(){for(let i=0;i<60;i++){try{if((await command('GET','/status'))?.ready)break}catch{}await delay(100)}const made=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome',pageLoadStrategy:'normal','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-default-apps','--disable-extensions','--force-color-profile=srgb','--hide-scrollbars'],mobileEmulation:{deviceMetrics:{width:393,height:852,pixelRatio:1,mobile:true,touch:true}}}}}});sessionId=made.sessionId;await command('POST',`/session/${sessionId}/timeouts`,{pageLoad:20000,script:20000,implicit:0});await command('POST',`/session/${sessionId}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});await waitUntil('return document.documentElement.dataset.qaReady||document.documentElement.dataset.qaError||"";','harness',20000);const error=await execute('return document.documentElement.dataset.qaError||"";');if(error)throw new Error(error)}
async function stop(){if(sessionId)try{await command('DELETE',`/session/${sessionId}`)}catch{}driver.kill('SIGTERM')}

const checks=[];
function record(control,pass,evidence=''){checks.push({area:'Retouch Repair v20',control,pass:Boolean(pass),evidence:String(evidence??'')});if(!pass)console.error(`::error::Retouch Repair v20 — ${control}: ${evidence}`)}
async function expect(control,script){let value=false,evidence='';try{value=await execute(script)}catch(error){evidence=error.message}record(control,Boolean(value),evidence||String(value));return value}
async function digest(){return execute('const c=document.querySelector("[data-photo-canvas]");return c&&!c.hidden?c.toDataURL("image/png"):"";')}
async function openEdit(){await click('[data-photo-panel-open="edit"]');await waitUntil('return document.querySelector("[data-photo-sheet-panel=edit]")?.classList.contains("is-active");','edit panel')}
async function sub(name){await click(`[data-photo-subtab="${name}"]`);await waitUntil(`return document.querySelector('[data-photo-sub="${name}"]')?.classList.contains('is-active');`,`subtab ${name}`)}
async function gesture(x1,y1,x2=x1,y2=y1,tap=false){return execute(`const w=document.querySelector('[data-photo-work]'),c=document.querySelector('[data-photo-canvas]'),r=c.getBoundingClientRect(),old=w.setPointerCapture;w.setPointerCapture=()=>{};const fire=(type,x,y)=>w.dispatchEvent(new PointerEvent(type,{bubbles:true,cancelable:true,pointerId:208,pointerType:'touch',clientX:r.left+x*r.width,clientY:r.top+y*r.height,button:0,buttons:type==='pointerup'?0:1}));fire('pointerdown',arguments[0],arguments[1]);if(!arguments[4]){for(let i=1;i<=5;i++){const t=i/5;fire('pointermove',arguments[0]+(arguments[2]-arguments[0])*t,arguments[1]+(arguments[3]-arguments[1])*t)}}fire('pointerup',arguments[4]?arguments[0]:arguments[2],arguments[4]?arguments[1]:arguments[3]);w.setPointerCapture=old;return true;`,[x1,y1,x2,y2,tap])}
async function loadFixture(){return executeAsync(`const done=arguments[arguments.length-1],input=document.querySelector('[data-photo-file]'),c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,320,240);g.addColorStop(0,'#3157a8');g.addColorStop(.5,'#d8a06c');g.addColorStop(1,'#3b8b62');x.fillStyle=g;x.fillRect(0,0,320,240);for(let yy=0;yy<240;yy+=6)for(let xx=0;xx<320;xx+=6){const n=((xx*17+yy*29)%41)-20;x.fillStyle='rgba('+(120+n)+','+(105-n)+','+(145+n)+',.22)';x.fillRect(xx,yy,4,4)}x.fillStyle='#e3152b';x.beginPath();x.arc(76,84,20,0,Math.PI*2);x.fill();x.fillStyle='#33161b';x.beginPath();x.arc(76,84,7,0,Math.PI*2);x.fill();x.fillStyle='#f2ece5';x.fillRect(128,142,70,28);x.fillStyle='#d6c6b7';for(let i=0;i<6;i++)x.fillRect(134+i*10,144,2,24);x.fillStyle='#101b2b';x.beginPath();x.arc(242,72,19,0,Math.PI*2);x.fill();x.fillStyle='#4ea7d8';x.beginPath();x.arc(242,72,9,0,Math.PI*2);x.fill();x.fillStyle='#fff';x.fillRect(222,176,70,36);c.toBlob(blob=>{if(!blob){done(false);return}const dt=new DataTransfer();dt.items.add(new File([blob],'retouch-v20.png',{type:'image/png'}));input.files=dt.files;input.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>done(true),220)},'image/png');`)}

try{
  await start();await loadFixture();await waitUntil('return !document.querySelector("[data-photo-canvas]")?.hidden&&document.querySelector("[data-photo-export]")?.disabled===false;','photo load');await delay(160);await openEdit();
  await expect('Retouch repair v20 module decorates editor','return document.querySelector(".nx-photo-editor")?.dataset.nxRetouchRepair==="v20";');
  await expect('Full source dimensions are preserved','const c=document.querySelector("[data-photo-canvas]");return c.width===320&&c.height===240;');

  await sub('repair');
  await expect('Repair exposes Healing, Clone, Blemish and Distraction controls','return !!document.querySelector("[data-local-tool=heal]")&&!!document.querySelector("[data-local-tool=clone]")&&!!document.querySelector("[data-nxrt-preset=blemish]")&&!!document.querySelector("[data-nxrt-preset=distraction]");');
  await click('[data-nxrt-preset="blemish"]');
  await expect('Blemish Cleanup selects source-aware small healing preset','const b=document.querySelector("[data-nxrt-preset=blemish]"),s=document.querySelector("[data-local-size]"),p=document.querySelector("[data-local-strength]"),t=document.querySelector("[data-local-status]");return b.classList.contains("is-active")&&s.value==="7"&&p.value==="62"&&/source-aware|Healing/i.test(t.textContent);');
  const blemishBefore=await digest();await gesture(.38,.36,.43,.39);await delay(160);const blemishAfter=await digest();record('Blemish Cleanup changes real pixels',blemishAfter!==blemishBefore,'digest changed');
  await click('[data-nxrt-repair-undo]');await delay(150);record('Repair quick Undo restores previous pixels',(await digest())===blemishBefore,'digest restored');await click('[data-nxrt-repair-redo]');await delay(150);record('Repair quick Redo restores repaired pixels',(await digest())===blemishAfter,'digest restored');

  await click('[data-nxrt-preset="distraction"]');
  await expect('Distraction Repair selects larger healing preset','return document.querySelector("[data-nxrt-preset=distraction]").classList.contains("is-active")&&document.querySelector("[data-local-size]").value==="22"&&document.querySelector("[data-local-strength]").value==="78";');
  const distractionBefore=await digest();await gesture(.68,.72,.78,.77);await delay(160);record('Distraction Repair changes real pixels',(await digest())!==distractionBefore,'digest changed');

  await click('[data-local-tool="clone"]');await gesture(.18,.20,.18,.20,true);await expect('Clone captures explicit source anchor','return /source set/i.test(document.querySelector("[data-local-status]").textContent);');const cloneBefore=await digest();await gesture(.73,.28,.79,.32);await delay(160);record('Clone paints source-aware destination pixels',(await digest())!==cloneBefore,'digest changed');

  await sub('retouch');
  await expect('Retouch owns mobile brush size and strength controls','return !!document.querySelector("[data-nxrt-size]")&&!!document.querySelector("[data-nxrt-strength]")&&!!document.querySelector("[data-nxrt-undo]")&&!!document.querySelector("[data-nxrt-redo]");');
  await execute(`const s=document.querySelector('[data-nxrt-size]'),p=document.querySelector('[data-nxrt-strength]');s.value='17';s.dispatchEvent(new Event('input',{bubbles:true}));p.value='44';p.dispatchEvent(new Event('input',{bubbles:true}));return true;`);
  await expect('Retouch mirror controls update real brush state','return document.querySelector("[data-local-size]").value==="17"&&document.querySelector("[data-local-strength]").value==="44";');

  const retouchCases=[
    ['Skin Smooth','smooth',.48,.48,.60,.52],
    ['Teeth Whiten','whiten',.42,.63,.58,.64],
    ['Eye Brighten','brighten',.73,.30,.79,.31],
    ['Red Eye','redeye',.20,.35,.28,.35],
    ['Local Detail','sharpen',.28,.22,.38,.26]
  ];
  for(const [label,tool,x1,y1,x2,y2] of retouchCases){await click(`[data-local-tool="${tool}"]`);const before=await digest();await gesture(x1,y1,x2,y2);await delay(150);record(`${label} changes real local pixels`,(await digest())!==before,tool)}

  const undoBefore=await digest();await click('[data-local-tool="brighten"]');await gesture(.56,.42,.62,.44);await delay(150);const undoAfter=await digest();record('Retouch test stroke changes pixels',undoAfter!==undoBefore,'digest changed');await click('[data-nxrt-undo]');await delay(150);record('Retouch quick Undo restores prior state',(await digest())===undoBefore,'digest restored');await click('[data-nxrt-redo]');await delay(150);record('Retouch quick Redo restores stroke',(await digest())===undoAfter,'digest restored');

  const dispatchMs=await execute(`const i=document.querySelector('[data-nxrt-strength]'),start=performance.now();for(let n=0;n<30;n++){i.value=String(20+n);i.dispatchEvent(new Event('input',{bubbles:true}))}return performance.now()-start;`);record('Retouch brush controls stay responsive during 30 input events',dispatchMs<80,`${Number(dispatchMs).toFixed(2)} ms`);
  await expect('Retouch status is readable on mobile','const n=document.querySelector("[data-nxrt-status]"),s=getComputedStyle(n);return n.textContent.trim().length>20&&s.display!=="none"&&s.visibility!=="hidden"&&parseFloat(s.fontSize)>0;');
  await expect('Retouch keeps full-resolution canvas after all strokes','const c=document.querySelector("[data-photo-canvas]");return c.width===320&&c.height===240;');
}catch(error){record('Suite completed without harness exception',false,error.stack||error.message)}finally{await stop()}

const passed=checks.filter(check=>check.pass).length,failed=checks.length-passed,report={suite:'retouch-repair-v20',passed,failed,total:checks.length,checks};fs.writeFileSync(`${outDir}/retouch-repair-v20-report.json`,JSON.stringify(report,null,2));console.log(`Retouch Repair v20 QA: ${passed}/${checks.length} passed`);if(failed)process.exitCode=1;
