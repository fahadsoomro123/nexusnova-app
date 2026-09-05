import fs from 'node:fs';
import { spawn } from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: enhance-v12-performance-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const driverPort=9528,driverLog=fs.openSync(`${outDir}/enhance-v12-chromedriver.log`,'a'),driver=spawn(driverBinary,[`--port=${driverPort}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',driverLog,driverLog]});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));let sessionId='';const checks=[];
async function command(method,path,body){const response=await fetch(`http://127.0.0.1:${driverPort}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),raw=await response.text(),parsed=raw?JSON.parse(raw):{};if(!response.ok||parsed?.value?.error)throw new Error(`${method} ${path}: ${JSON.stringify(parsed.value||parsed)}`);return parsed.value}
async function execute(script,args=[]){return command('POST',`/session/${sessionId}/execute/sync`,{script,args})}
async function executeAsync(script,args=[]){return command('POST',`/session/${sessionId}/execute/async`,{script,args})}
async function waitUntil(script,{timeout=16000,label='condition'}={}){const started=Date.now();while(Date.now()-started<timeout){if(await execute(script))return true;await delay(70)}throw new Error(`Timed out: ${label}`)}
function record(name,pass,evidence=''){checks.push({name,pass:Boolean(pass),evidence:String(evidence)});if(!pass)console.error(`::error::${name}: ${evidence}`)}
async function expect(name,script,evidence=''){try{const value=await execute(script);record(name,!!value,evidence||JSON.stringify(value));return value}catch(error){record(name,false,error.message);return false}}
async function waitDriver(){for(let i=0;i<60;i++){try{if((await command('GET','/status'))?.ready)return}catch{}await delay(100)}throw new Error('driver not ready')}
async function createSession(){const created=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-extensions'],mobileEmulation:{deviceMetrics:{width:393,height:852,pixelRatio:1,mobile:true,touch:true}}}}}});sessionId=created.sessionId;await command('POST',`/session/${sessionId}/timeouts`,{pageLoad:20000,script:25000,implicit:0});await command('POST',`/session/${sessionId}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});await waitUntil('return document.documentElement.dataset.qaReady||document.documentElement.dataset.qaError||"";',{timeout:20000,label:'harness'});const error=await execute('return document.documentElement.dataset.qaError||"";');if(error)throw new Error(error)}
async function injectLarge(){return executeAsync(`const done=arguments[arguments.length-1],input=document.querySelector('[data-nxqt-file]'),c=document.createElement('canvas');c.width=1600;c.height=1200;const x=c.getContext('2d'),g=x.createLinearGradient(0,0,1600,1200);g.addColorStop(0,'#282d3a');g.addColorStop(.55,'#7d8496');g.addColorStop(1,'#f4ede3');x.fillStyle=g;x.fillRect(0,0,c.width,c.height);x.fillStyle='#d06b55';x.fillRect(340,180,920,780);x.fillStyle='#1e2738';x.beginPath();x.arc(800,590,230,0,Math.PI*2);x.fill();x.fillStyle='#fff1d4';x.fillRect(690,500,220,150);c.toBlob(blob=>{const file=new File([blob],'enhance-v12-large.png',{type:'image/png'}),t=new DataTransfer();t.items.add(file);input.files=t.files;input.dispatchEvent(new Event('change',{bubbles:true}));done(true)},'image/png');`)}

try{
  await waitDriver();await createSession();
  await execute('window.__qaRoot.__nxStudioNavigation.showHome();document.querySelector("[data-nxlock-quick=enhance]").click();return true;');
  await waitUntil('const s=window.__qaRoot.__nxQuickTools?.getState?.();return s?.tool==="enhance"&&s.screen==="picker";',{label:'enhance picker'});
  await injectLarge();
  await waitUntil('return document.querySelector(".nxqt-result")?.dataset.flagshipEnhance==="v12-performance-safe"&&!!document.querySelector("[data-nxfs-enhance=shadows]");',{timeout:18000,label:'enhance v12 controls'});
  await expect('Enhance v12 owns result before legacy heavy handler','return document.querySelector(".nxqt-result")?.dataset.flagshipEnhance==="v12-performance-safe";');
  await expect('Enhance exposes pro tone controls','return ["strength","shadows","highlights","vibrance","detail","denoise"].every(k=>document.querySelector(`[data-nxfs-enhance="${k}"]`));');
  await expect('Enhance keeps full source dimensions','const c=[...document.querySelectorAll(".nxqt-canvas-wrap canvas")].find(x=>!x.hidden);return c?.width===1600&&c?.height===1200;');

  const dispatchMs=await execute(`const input=document.querySelector('[data-nxfs-enhance=detail]'),start=performance.now();for(let n=0;n<30;n++){input.value=String((n*3)%101);input.dispatchEvent(new Event('input',{bubbles:true}))}return performance.now()-start;`);
  record('Thirty slider input events return without blocking the phone UI',Number(dispatchMs)<120,`${Number(dispatchMs).toFixed(2)} ms`);
  await expect('Result actions disable while full-resolution commit is pending','return [...document.querySelectorAll("[data-nxqt-download],[data-nxqt-design],[data-nxqt-edit]")].every(b=>b.disabled);');
  await waitUntil('return /Full-resolution ready/.test(document.querySelector("[data-nxfs-enhance-status]")?.textContent||"");',{timeout:18000,label:'first full render'});
  await expect('Result actions re-enable after full-resolution render','return [...document.querySelectorAll("[data-nxqt-download],[data-nxqt-design],[data-nxqt-edit]")].every(b=>!b.disabled);');

  await execute(`const i=document.querySelector('[data-nxfs-enhance=strength]');i.value='0';i.dispatchEvent(new Event('input',{bubbles:true}));i.dispatchEvent(new Event('change',{bubbles:true}));return true;`);
  await waitUntil('return /Full-resolution ready/.test(document.querySelector("[data-nxfs-enhance-status]")?.textContent||"")&&!document.querySelector("[data-nxfs-enhance=strength]")?.matches(":active");',{timeout:18000,label:'strength zero render'});
  await expect('Strength zero is genuinely non-destructive','const cs=[...document.querySelectorAll(".nxqt-canvas-wrap canvas")],v=cs.find(c=>!c.hidden),o=cs.find(c=>c!==v);if(!v||!o)return false;const a=v.getContext("2d").getImageData(800,600,1,1).data,b=o.getContext("2d").getImageData(800,600,1,1).data;return Math.abs(a[0]-b[0])+Math.abs(a[1]-b[1])+Math.abs(a[2]-b[2])<=3;');

  const originalPixel=await execute('const cs=[...document.querySelectorAll(".nxqt-canvas-wrap canvas")],v=cs.find(c=>!c.hidden),o=cs.find(c=>c!==v),d=o.getContext("2d").getImageData(220,170,1,1).data;return [...d];');
  await execute(`document.querySelector('[data-nxfs-enhance-mode="lowlight"]').click();const s=document.querySelector('[data-nxfs-enhance=strength]');s.value='100';s.dispatchEvent(new Event('input',{bubbles:true}));s.dispatchEvent(new Event('change',{bubbles:true}));const sh=document.querySelector('[data-nxfs-enhance=shadows]');sh.value='90';sh.dispatchEvent(new Event('input',{bubbles:true}));sh.dispatchEvent(new Event('change',{bubbles:true}));return true;`);
  await waitUntil('return /Full-resolution ready/.test(document.querySelector("[data-nxfs-enhance-status]")?.textContent||"")&&!document.querySelector(".nxfs-enhance-v12")?.matches("[aria-busy=true]");',{timeout:18000,label:'lowlight full render'});
  const enhancedPixel=await execute('const c=[...document.querySelectorAll(".nxqt-canvas-wrap canvas")].find(x=>!x.hidden),d=c.getContext("2d").getImageData(220,170,1,1).data;return [...d];');
  record('Low Light enhancement changes actual rendered pixels',JSON.stringify(originalPixel)!==JSON.stringify(enhancedPixel),`${originalPixel} -> ${enhancedPixel}`);
  await expect('Auto white balance can be toggled','const b=document.querySelector("[data-nxfs-enhance-wb]");const before=b.getAttribute("aria-pressed");b.click();return before!==b.getAttribute("aria-pressed");');
  await expect('Enhance remains full-resolution after edits','const c=[...document.querySelectorAll(".nxqt-canvas-wrap canvas")].find(x=>!x.hidden);return c?.width===1600&&c?.height===1200;');
}catch(error){record('Uncaught Enhance v12 QA',false,error?.stack||error)}
finally{if(sessionId)try{await command('DELETE',`/session/${sessionId}`)}catch{}driver.kill('SIGTERM');fs.closeSync(driverLog)}

const failed=checks.filter(check=>!check.pass);fs.writeFileSync(`${outDir}/enhance-v12-performance-report.json`,JSON.stringify({generatedAt:new Date().toISOString(),summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks},null,2));
if(failed.length){console.error(`Enhance v12 performance QA FAIL — ${failed.length}/${checks.length}`);process.exit(1)}
console.log(`Enhance v12 performance QA PASS — ${checks.length} checks passed.`);
