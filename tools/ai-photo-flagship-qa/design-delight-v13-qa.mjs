import fs from 'node:fs';
import { spawn } from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: design-delight-v13-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const port=9526,log=fs.openSync(`${outDir}/chromedriver-design-v13.log`,'a'),driver=spawn(driverBinary,[`--port=${port}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',log,log]});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let sessionId='';const checks=[];
async function cmd(method,path,body){const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),raw=await r.text(),j=raw?JSON.parse(raw):{};if(!r.ok||j?.value?.error)throw new Error(`${method} ${path}: ${JSON.stringify(j.value||j)}`);return j.value}
async function exec(script,args=[]){return cmd('POST',`/session/${sessionId}/execute/sync`,{script,args})}
async function wait(script,label,timeout=12000){const start=Date.now();while(Date.now()-start<timeout){if(await exec(script))return;await delay(60)}throw new Error(`Timed out: ${label}`)}
async function click(selector){return exec('const n=document.querySelector(arguments[0]);if(!n)return false;n.click();return true;',[selector])}
function record(name,pass,evidence=''){checks.push({name,pass:Boolean(pass),evidence:String(evidence)});if(!pass)console.error(`::error::${name}: ${evidence}`)}
async function expect(name,script){try{const v=await exec(script);record(name,!!v,JSON.stringify(v));return!!v}catch(e){record(name,false,e.message);return false}}
async function start(){for(let i=0;i<60;i++){try{if((await cmd('GET','/status'))?.ready)break}catch{}await delay(100)}const made=await cmd('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage'],mobileEmulation:{deviceMetrics:{width:393,height:852,pixelRatio:1,mobile:true,touch:true}}}}}});sessionId=made.sessionId;await cmd('POST',`/session/${sessionId}/timeouts`,{pageLoad:20000,script:20000,implicit:0});await cmd('POST',`/session/${sessionId}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});await wait('return document.documentElement.dataset.qaReady||document.documentElement.dataset.qaError||"";','harness',20000);const err=await exec('return document.documentElement.dataset.qaError||"";');if(err)throw new Error(err)}

try{
  await start();
  await expect('Design delight layer installed','return !!window.__qaRoot.__nxDesignDelightV13&&document.querySelector(".nx-canva-v3")?.classList.contains("nxv13-premium");');
  await exec('window.__qaRoot.__nxCanvaWorkspaceV3.openTemplate("nx-approved-featured-photo-portrait");return true;');await wait('return document.querySelector("[data-v3-detail]")?.classList.contains("is-open");','detail');await click('[data-v3-use]');await wait('return window.__qaRoot.__nxCanvaWorkspaceV3.getState().tab==="design";','design');
  await expect('Premium selection status is visible','const n=document.querySelector(".nxv13-status");return !!n&&!n.hidden&&n.textContent.length>0;');
  await click('[data-v3-add-shape]');await wait('const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign();return d?.selection?.length===1;','shape');
  await click('[data-nxv13-align]');await expect('Precision align popover opens','return document.querySelector("[data-nxv13-pop]")?.classList.contains("is-open");');
  await click('[data-nxv13-pos="left"]');await delay(80);await expect('Align Left mutates selected layer through real drag path','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),e=d.elements.find(x=>d.selection.includes(x.id));return !!e&&Math.abs(e.x)<.006;');
  await click('[data-nxv13-align]');await click('[data-nxv13-pos="right"]');await delay(80);await expect('Align Right mutates selected layer through real drag path','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),e=d.elements.find(x=>d.selection.includes(x.id));return !!e&&Math.abs(e.x-(1-e.w))<.006;');
  const before=await exec('const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),e=d.elements.find(x=>d.selection.includes(x.id));return e.x;');await click('[data-nxv13-align]');await click('[data-nxv13-nudge="left"]');await delay(80);const after=await exec('const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),e=d.elements.find(x=>d.selection.includes(x.id));return e.x;');record('Nudge changes position by about one percent',before-after>.006&&before-after<.016,`${before} -> ${after}`);
  await click('[data-nxv13-grid]');await expect('Grid toggle is editor-only and active','const w=document.querySelector(".nx-canva-v3"),b=document.querySelector("[data-nxv13-grid]");return w.classList.contains("nxv13-grid")&&b.getAttribute("aria-pressed")==="true"&&!document.querySelector("[data-v3-export]").disabled;');
  await click('[data-nxv13-focus]');await expect('Focus mode expands canvas without removing tools','const w=document.querySelector(".nx-canva-v3"),b=document.querySelector("[data-nxv13-focus]");return w.classList.contains("nxv13-focus")&&b.getAttribute("aria-pressed")==="true"&&!!document.querySelector("[data-v3-add-text]");');
  await expect('Design workspace has no horizontal document overflow','return document.documentElement.scrollWidth<=innerWidth+1;');
}catch(e){record('Uncaught Design delight QA',false,e?.stack||e)}
finally{if(sessionId)try{await cmd('DELETE',`/session/${sessionId}`)}catch{}driver.kill('SIGTERM');fs.closeSync(log)}
const failed=checks.filter(x=>!x.pass);fs.writeFileSync(`${outDir}/design-delight-v13-report.json`,JSON.stringify({generatedAt:new Date().toISOString(),summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks},null,2));if(failed.length){console.error(`Design delight v13 QA FAIL — ${failed.length}/${checks.length}`);process.exit(1)}console.log(`Design delight v13 QA PASS — ${checks.length} checks passed.`);
