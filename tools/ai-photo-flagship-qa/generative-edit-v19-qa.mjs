import fs from 'node:fs';
import {spawn} from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: generative-edit-v19-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const port=9539,log=fs.openSync(`${outDir}/chromedriver-generative-edit-v19.log`,'a'),driver=spawn(driverBinary,[`--port=${port}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',log,log]});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let sid='';const checks=[];
async function cmd(method,path,body){const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),raw=await r.text(),j=raw?JSON.parse(raw):{};if(!r.ok||j?.value?.error)throw new Error(`${method} ${path}: ${JSON.stringify(j.value||j)}`);return j.value}
async function ex(script,args=[]){return cmd('POST',`/session/${sid}/execute/sync`,{script,args})}
async function exa(script,args=[]){return cmd('POST',`/session/${sid}/execute/async`,{script,args})}
async function wait(script,label,timeout=16000){const st=Date.now();while(Date.now()-st<timeout){if(await ex(script))return;await delay(60)}throw new Error(`Timeout: ${label}`)}
function rec(name,pass,evidence=''){checks.push({name,pass:Boolean(pass),evidence:String(evidence)});if(!pass)console.error(`::error::${name}: ${evidence}`)}
async function expect(name,script){try{const v=await ex(script);rec(name,!!v,JSON.stringify(v));return!!v}catch(e){rec(name,false,e.message);return false}}
async function start(width=393,height=852){for(let i=0;i<60;i++){try{if((await cmd('GET','/status'))?.ready)break}catch{}await delay(100)}const made=await cmd('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage'],mobileEmulation:{deviceMetrics:{width,height,pixelRatio:1,mobile:true,touch:true}}}}}});sid=made.sessionId;await cmd('POST',`/session/${sid}/timeouts`,{pageLoad:20000,script:20000,implicit:0});await cmd('POST',`/session/${sid}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});await wait('return document.documentElement.dataset.qaReady||document.documentElement.dataset.qaError||"";','harness',20000);const err=await ex('return document.documentElement.dataset.qaError||"";');if(err)throw new Error(err)}
async function installMock(){return ex(`
  window.__nxgeCalls=[];
  const makeResult=()=>{const c=document.createElement('canvas');c.width=96;c.height=72;const x=c.getContext('2d');x.fillStyle='#1b2744';x.fillRect(0,0,96,72);x.fillStyle='#f3b43f';x.fillRect(25,18,46,38);return {src:c.toDataURL('image/png'),naturalWidth:96,naturalHeight:72,width:96,height:72}};
  globalThis.puter={auth:{isSignedIn:()=>true,getUser:async()=>({username:'qa-user'}),getMonthlyUsage:async()=>({allowanceInfo:{monthUsageAllowance:100,remaining:80}}),signIn:async()=>true},ai:{txt2img:async(prompt,opts)=>{window.__nxgeCalls.push({prompt,opts});return makeResult()}}};
  return true;
`)}
async function openAiEdit(){await ex('window.__qaRoot.__nxStudioNavigation.openWorkspace("ai-edit",{reason:"qa"});return true;');await wait('return document.querySelector("[data-v3-pane=ai-edit]")?.classList.contains("is-active")','AI Edit pane');}
async function loadSource(){return exa(`const done=arguments[arguments.length-1],c=document.createElement('canvas');c.width=320;c.height=240;const x=c.getContext('2d');x.fillStyle='#d7e4f3';x.fillRect(0,0,320,240);x.fillStyle='#c42f46';x.fillRect(116,56,88,132);x.fillStyle='#26334a';x.fillRect(20,170,280,45);c.toBlob(b=>{const dt=new DataTransfer();dt.items.add(new File([b],'ai-edit-source.png',{type:'image/png'}));const i=document.querySelector('[data-nxge-file]');i.files=dt.files;i.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>done(true),220)},'image/png');`)}
async function paintMask(){return ex(`const c=document.querySelector('[data-nxge-mask]'),r=c.getBoundingClientRect();if(!r.width||!r.height)return false;c.setPointerCapture=()=>{};const x=r.left+r.width*.5,y=r.top+r.height*.48;c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:73,pointerType:'touch',clientX:x,clientY:y,button:0,buttons:1}));c.dispatchEvent(new PointerEvent('pointermove',{bubbles:true,pointerId:73,pointerType:'touch',clientX:x+r.width*.06,clientY:y,button:0,buttons:1}));c.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:73,pointerType:'touch',clientX:x+r.width*.06,clientY:y,button:0,buttons:0}));return true;`)}
async function click(sel){return ex('const n=document.querySelector(arguments[0]);if(!n)return false;n.click();return true;',[sel])}

try{
  await start();await installMock();await openAiEdit();
  await expect('Generative Edit installer and tab are active','return !!window.__qaRoot.__nxAiPhotoGenerativeEditV19&&!!document.querySelector("[data-v3-tab=ai-edit]")&&document.querySelector("[data-v3-pane=ai-edit]").classList.contains("is-active")');
  await expect('Unified navigation reports AI Edit','return window.__qaRoot.__nxStudioNavigation.getState().screen==="ai-edit"');
  await loadSource();await wait('return !document.querySelector("[data-nxge-source]").hidden&&document.querySelector("[data-nxge-source]").width===320','source loaded');
  await expect('Uploaded source renders on real canvas','const c=document.querySelector("[data-nxge-source]");return c.width===320&&c.height===240&&c.getContext("2d").getImageData(160,100,1,1).data[3]===255');
  await ex(`document.querySelector('[data-nxge-mode]').value='replace';document.querySelector('[data-nxge-prompt]').value='replace selected object with a matte black travel cup';return true;`);
  await click('[data-nxge-run]');await delay(120);
  await expect('Masked modes refuse generation without a painted selection','return window.__nxgeCalls.length===0&&document.querySelector("[data-nxge-status]").textContent.includes("Paint the region")');
  await paintMask();
  await expect('Brush selection changes mask pixels','const c=document.querySelector("[data-nxge-mask]"),d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;for(let i=3;i<d.length;i+=4)if(d[i]>0)return true;return false;');
  await click('[data-nxge-run]');await wait('return window.__nxgeCalls.length===1&&document.querySelectorAll("[data-nxge-card]").length===1','first generated candidate',10000);
  const first=await ex('return window.__nxgeCalls[0]');
  rec('Exactly one Puter generation call per Generate click',Array.isArray(first.opts?.input_images)&&first.opts.input_images.length===2&&first.opts.provider==='openai-image-generation',JSON.stringify({calls:1,provider:first.opts?.provider,inputs:first.opts?.input_images?.length}));
  rec('Economy edit uses gpt-image-1-mini',first.opts?.model==='gpt-image-1-mini',JSON.stringify(first.opts));
  rec('Selection guide is sent with source image',String(first.prompt).includes('WHITE pixels')&&String(first.prompt).includes('BLACK pixels'),String(first.prompt).slice(0,180));
  await expect('Generated candidate renders Keep and Discard controls','return document.querySelectorAll("[data-nxge-card]").length===1&&!!document.querySelector("[data-nxge-keep]")&&!!document.querySelector("[data-nxge-discard]")');
  await ex(`document.querySelector('[data-nxge-quality]').value='medium';return true;`);await click('[data-nxge-run]');await wait('return window.__nxgeCalls.length===2&&document.querySelectorAll("[data-nxge-card]").length===2','second candidate',10000);
  await expect('Balanced edit uses gpt-image-1','return window.__nxgeCalls[1].opts.model==="gpt-image-1"');
  await click('[data-nxge-run]');await wait('return window.__nxgeCalls.length===3&&document.querySelectorAll("[data-nxge-card]").length===3','third candidate',10000);await click('[data-nxge-run]');await wait('return window.__nxgeCalls.length===4','fourth generation',10000);
  await expect('Candidate history is capped to three results','return document.querySelectorAll("[data-nxge-card]").length===3');
  const beforeDiscard=await ex('return document.querySelectorAll("[data-nxge-card]").length');await click('[data-nxge-discard]');await expect('Discard removes a candidate',`return document.querySelectorAll('[data-nxge-card]').length===${beforeDiscard-1}`);
  await click('[data-nxge-keep]');await wait('return !document.querySelector(".nx-canva-v3").classList.contains("is-open")&&!document.querySelector("[data-photo-canvas]").hidden','candidate kept into Photo Editor',10000);
  await expect('Keep sends candidate to Photo Editor','return window.__qaRoot.__nxStudioNavigation.getState().screen==="photo-editor"&&!document.querySelector("[data-photo-canvas]").hidden');
  await openAiEdit();await ex('window.__qaRoot.__nxStudioNavigation.handleBack({reason:"qa-back"});return true;');await wait('return !document.querySelector(".nxlock-home").hidden','back to Studio Home');rec('Back from AI Edit returns Studio Home',true);
  for(const [w,h] of [[360,640],[360,740],[393,852],[415,858],[430,865]]){
    await cmd('POST',`/session/${sid}/window/rect`,{width:w,height:h,x:0,y:0}).catch(()=>null);await openAiEdit();await delay(80);const ok=await ex('return document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector(".nx-photo-editor").scrollWidth<=innerWidth+1');rec(`${w}x${h} AI Edit has no horizontal page overflow`,ok,`${w}x${h}`);await ex('window.__qaRoot.__nxStudioNavigation.showHome({reason:"viewport-qa"});return true;');
  }
}catch(e){rec('Generative Edit v19 execution completed',false,e?.stack||String(e))}
finally{if(sid)try{await cmd('DELETE',`/session/${sid}`)}catch{}driver.kill('SIGTERM');fs.closeSync(log)}
const failed=checks.filter(x=>!x.pass);fs.writeFileSync(`${outDir}/generative-edit-v19-report.json`,JSON.stringify({generatedAt:new Date().toISOString(),summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks},null,2));if(failed.length){console.error(`Generative Edit v19 QA FAIL — ${failed.length}/${checks.length}`);process.exit(1)}console.log(`Generative Edit v19 QA PASS — ${checks.length} checks passed.`);
