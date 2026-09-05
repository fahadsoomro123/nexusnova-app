import fs from 'node:fs';
import {spawn} from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: flagship-shell-v14-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const port=9531,log=fs.openSync(`${outDir}/chromedriver-shell-v14.log`,'a'),driver=spawn(driverBinary,[`--port=${port}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',log,log]});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let sessionId='';const checks=[];
async function cmd(method,path,body){const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),raw=await r.text(),j=raw?JSON.parse(raw):{};if(!r.ok||j?.value?.error)throw new Error(`${method} ${path}: ${JSON.stringify(j.value||j)}`);return j.value}
async function exec(script,args=[]){return cmd('POST',`/session/${sessionId}/execute/sync`,{script,args})}
async function execAsync(script,args=[]){return cmd('POST',`/session/${sessionId}/execute/async`,{script,args})}
async function wait(script,label,timeout=16000){const start=Date.now();while(Date.now()-start<timeout){if(await exec(script))return;await delay(60)}throw new Error(`Timed out: ${label}`)}
async function click(selector){return exec('const n=document.querySelector(arguments[0]);if(!n)return false;n.click();return true;',[selector])}
async function shot(name){const png=await cmd('GET',`/session/${sessionId}/screenshot`);fs.writeFileSync(`${outDir}/${name}.png`,Buffer.from(png,'base64'))}
function record(name,pass,evidence=''){checks.push({name,pass:Boolean(pass),evidence:String(evidence)});if(!pass)console.error(`::error::${name}: ${evidence}`)}
async function expect(name,script){try{const v=await exec(script);record(name,!!v,JSON.stringify(v));return!!v}catch(e){record(name,false,e.message);return false}}
async function start(){for(let i=0;i<60;i++){try{if((await cmd('GET','/status'))?.ready)break}catch{}await delay(100)}const made=await cmd('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--force-color-profile=srgb'],mobileEmulation:{deviceMetrics:{width:393,height:852,pixelRatio:1,mobile:true,touch:true}}}}}});sessionId=made.sessionId;await cmd('POST',`/session/${sessionId}/timeouts`,{pageLoad:20000,script:20000,implicit:0});await cmd('POST',`/session/${sessionId}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});await wait('return document.documentElement.dataset.qaReady||document.documentElement.dataset.qaError||"";','harness',20000);const err=await exec('return document.documentElement.dataset.qaError||"";');if(err)throw new Error(err)}
async function injectFixture(){return execAsync(`const done=arguments[arguments.length-1],input=document.querySelector('[data-nxqt-file]');if(!input){done(false);return}const c=document.createElement('canvas');c.width=640;c.height=480;const x=c.getContext('2d');const g=x.createLinearGradient(0,0,640,480);g.addColorStop(0,'#20293c');g.addColorStop(1,'#e9b774');x.fillStyle=g;x.fillRect(0,0,640,480);x.fillStyle='#e7d6c8';x.beginPath();x.arc(320,210,112,0,Math.PI*2);x.fill();x.fillStyle='#2c1e22';x.fillRect(245,300,150,135);c.toBlob(blob=>{const t=new DataTransfer();t.items.add(new File([blob],'flagship-phone-fixture.png',{type:'image/png'}));input.files=t.files;input.dispatchEvent(new Event('change',{bubbles:true}));done(true)},'image/png');`)}

try{
  await start();
  await expect('Flagship v14 shell is actually installed','return window.__qaRoot?.dataset.aiPhotoFlagship==="flagship-repair-v14"&&window.__qaRoot?.classList.contains("nx-photo-v14")&&!!document.getElementById("nx-ai-photo-flagship-shell-v14");');

  await click('[data-nxlock-quick="upscale"]');await wait('return window.__qaRoot.__nxQuickTools?.getState?.()?.screen==="picker";','upscale picker');await injectFixture();await wait('return window.__qaRoot.__nxQuickTools?.getState?.()?.screen==="result";','upscale result');await click('[data-nxqt-edit]');await wait('const c=document.querySelector("[data-photo-canvas]");return c&&!c.hidden;','photo editor loaded');

  await expect('Photo Editor chrome is visibly dark, not white-on-white','const f=document.querySelector(".nx-photo-frame"),t=document.querySelector(".nx-photo-top"),b=document.querySelector(".nx-photo-tools");if(!f||!t||!b)return false;const fc=getComputedStyle(f),tc=getComputedStyle(t),bc=getComputedStyle(b);return fc.color.includes("247")&&tc.backgroundImage.includes("linear-gradient")&&bc.backgroundImage.includes("linear-gradient");');
  await expect('Bottom editor option labels are visible','const nodes=[...document.querySelectorAll(".nx-photo-tool span")];const rgb=s=>(s.match(/\d+(?:\.\d+)?/g)||[]).slice(0,3).map(Number);return nodes.length===5&&nodes.every(n=>{const s=getComputedStyle(n),r=n.getBoundingClientRect(),c=rgb(s.color);return r.width>0&&r.height>0&&s.visibility!=="hidden"&&s.display!=="none"&&Number(s.opacity||1)>.6&&c.length===3&&c.reduce((a,v)=>a+v,0)>430});');
  await click('[data-photo-panel-open="adjust"]');await wait('return document.querySelector(".nx-photo-sheet")?.classList.contains("is-open")&&document.querySelector("[data-photo-sheet-panel=adjust]")?.classList.contains("is-active");','adjust sheet');
  await expect('Adjust options are physically displayed','const p=document.querySelector("[data-photo-sheet-panel=adjust]");const fields=[...p.querySelectorAll("[data-photo-sub=light].is-active .nx-photo-field")];return fields.length===7&&fields.every(n=>{const r=n.getBoundingClientRect();return r.width>100&&r.height>20});');
  await expect('Adjust text is bright on the dark control sheet','const p=document.querySelector("[data-photo-sheet-panel=adjust]"),label=p?.querySelector(".nx-photo-field span"),sheet=document.querySelector(".nx-photo-sheet");if(!label||!sheet)return false;const nums=(getComputedStyle(label).color.match(/\d+(?:\.\d+)?/g)||[]).slice(0,3).map(Number);return nums.length===3&&nums.reduce((a,v)=>a+v,0)>500&&getComputedStyle(sheet).backgroundImage.includes("linear-gradient");');
  await shot('phone-photo-editor-v14-adjust-393x852');

  const perf=await exec(`const i=document.querySelector('[data-photo-range="exposure"]');if(!i)return null;const start=performance.now();for(let n=0;n<60;n++){i.value=String(-1.5+(n%60)*.05);i.dispatchEvent(new Event('input',{bubbles:true}))}return {ms:performance.now()-start,value:i.value};`);
  record('Rapid slider input returns without main-thread lock',perf&&perf.ms<120,JSON.stringify(perf));
  await delay(650);
  await expect('Editor remains responsive after slider burst','const s=document.querySelector(".nx-photo-sheet"),i=document.querySelector("[data-photo-range=exposure]");return s?.classList.contains("is-open")&&!!i&&!document.querySelector(".nx-photo-toast.is-on")?.textContent?.includes("error");');

  await expect('Photo Editor has no horizontal document overflow','return document.documentElement.scrollWidth<=innerWidth+1;');
  await exec('return window.__qaRoot.__nxStudioNavigation.showHome();');await wait('return !document.querySelector(".nxlock-home")?.hidden;','home');
  await click('[data-nxlock-quick="enhance"]');await wait('return window.__qaRoot.__nxQuickTools?.getState?.()?.screen==="picker";','enhance picker');await injectFixture();await wait('return window.__qaRoot.__nxQuickTools?.getState?.()?.screen==="result";','enhance result');
  await expect('Enhance Pro controls are visible and compact','const p=document.querySelector(".nxfs-enhance-v12"),c=document.querySelector(".nxqt-canvas-wrap");if(!p||!c)return false;const pr=p.getBoundingClientRect(),cr=c.getBoundingClientRect();return pr.width>300&&pr.height>120&&cr.height<=innerHeight*.52;');
  await shot('phone-enhance-v14-393x852');
}catch(e){record('Uncaught flagship shell v14 QA',false,e?.stack||e)}
finally{if(sessionId)try{await cmd('DELETE',`/session/${sessionId}`)}catch{}driver.kill('SIGTERM');fs.closeSync(log)}
const failed=checks.filter(x=>!x.pass);fs.writeFileSync(`${outDir}/flagship-shell-v14-report.json`,JSON.stringify({generatedAt:new Date().toISOString(),summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks},null,2));if(failed.length){console.error(`Flagship shell v14 QA FAIL — ${failed.length}/${checks.length}`);process.exit(1)}console.log(`Flagship shell v14 QA PASS — ${checks.length} checks passed.`);
