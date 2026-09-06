import fs from 'node:fs';
import {spawn} from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: product-studio-v21-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const port=9536,log=fs.openSync(`${outDir}/chromedriver-product-studio-v21.log`,'a'),driver=spawn(driverBinary,[`--port=${port}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',log,log]});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let sid='';const checks=[];
async function cmd(method,path,body){const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),raw=await r.text(),j=raw?JSON.parse(raw):{};if(!r.ok||j?.value?.error)throw new Error(`${method} ${path}: ${JSON.stringify(j.value||j)}`);return j.value}
async function ex(script,args=[]){return cmd('POST',`/session/${sid}/execute/sync`,{script,args})}
async function exa(script,args=[]){return cmd('POST',`/session/${sid}/execute/async`,{script,args})}
async function wait(script,label,timeout=18000){const st=Date.now();while(Date.now()-st<timeout){if(await ex(script))return;await delay(70)}throw new Error(`Timeout: ${label}`)}
function rec(name,pass,evidence=''){checks.push({name,pass:Boolean(pass),evidence:String(evidence)});if(!pass)console.error(`::error::${name}: ${evidence}`)}
async function expect(name,script){try{const v=await ex(script);rec(name,!!v,JSON.stringify(v));return!!v}catch(e){rec(name,false,e.message);return false}}
async function start(){for(let i=0;i<60;i++){try{if((await cmd('GET','/status'))?.ready)break}catch{}await delay(100)}const made=await cmd('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage'],mobileEmulation:{deviceMetrics:{width:393,height:852,pixelRatio:1,mobile:true,touch:true}}}}}});sid=made.sessionId;await cmd('POST',`/session/${sid}/timeouts`,{pageLoad:20000,script:25000,implicit:0});await cmd('POST',`/session/${sid}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});await wait('return document.documentElement.dataset.qaReady||document.documentElement.dataset.qaError||"";','harness',20000);const err=await ex('return document.documentElement.dataset.qaError||"";');if(err)throw new Error(err)}
async function injectProduct(){return exa(`const done=arguments[arguments.length-1],input=document.querySelector('[data-nxprod-file]');if(!input){done(false);return}const c=document.createElement('canvas');c.width=720;c.height=600;const x=c.getContext('2d');x.fillStyle='#f0f1f4';x.fillRect(0,0,c.width,c.height);x.fillStyle='#252932';x.beginPath();x.roundRect(220,115,280,390,52);x.fill();x.fillStyle='#d7a95d';x.fillRect(280,170,160,245);x.fillStyle='#faf7ef';x.fillRect(310,205,100,100);c.toBlob(blob=>{const t=new DataTransfer();t.items.add(new File([blob],'qa-product.png',{type:'image/png'}));input.files=t.files;input.dispatchEvent(new Event('change',{bubbles:true}));done(true)},'image/png');`)}

try{
  await start();
  await expect('Product Studio v21 is installed and reusable API is exposed','return !!window.__qaRoot?.__nxProductStudioV21&&!!document.querySelector("[data-nxps-product-studio]")&&!!document.getElementById("nx-ai-photo-product-studio-v21");');
  await ex('document.querySelector("[data-nxps-product-studio]").click();return true;');
  await wait('return !document.querySelector(".nxprod")?.hidden&&!!document.querySelector("[data-nxprod-choose]");','product picker');
  await expect('Product Studio picker fits phone viewport without horizontal overflow','return document.documentElement.scrollWidth<=innerWidth+1&&document.querySelector(".nxprod")?.getBoundingClientRect().width<=innerWidth+1;');
  await expect('Current-photo route matches actual editor canvas availability','const b=document.querySelector("[data-nxprod-current]"),c=document.querySelector("[data-photo-canvas]");return !!b&&b.disabled===!Boolean(c?.width);');

  await ex(`window.__nxProductQaObserver=new MutationObserver(()=>{const r=document.querySelector('.nxqt-result');if(r&&!r.dataset.nxMlRemoveBg){r.dataset.nxMlRemoveBg='fallback';const d=r.querySelector('[data-nxqt-result-detail]');if(d)d.textContent='QA protected local cutout';}});window.__nxProductQaObserver.observe(window.__qaRoot,{childList:true,subtree:true});return true;`);
  await injectProduct();
  await wait('return !!document.querySelector("[data-nxprod-preset]")&&window.__qaRoot.__nxProductStudioV21.getState().hasCutout;','product controls',22000);
  await expect('Product Studio exposes marketplace canvas presets','return ["shop","square","portrait","story","marketplace"].every(k=>document.querySelector(`[data-nxprod-preset="${k}"]`));');
  await expect('Background choices include white, transparent, solid and capability-gated AI scene','return ["white","transparent","solid","ai"].every(k=>document.querySelector(`[data-nxprod-bg="${k}"]`));');
  await expect('Placement shadow relight and recolor controls are live','return ["x","y","scale","shadow","shadowBlur","shadowY","relight","saturation","hue"].every(k=>document.querySelector(`[data-nxprod-range="${k}"]`));');
  await expect('AI Background control is explicit Puter generation, not a fake local filter','return !!document.querySelector("[data-nxprod-prompt]")&&/Puter/i.test(document.querySelector("[data-nxprod-ai]")?.textContent||"");');
  await expect('Export and Photo Editor handoff buttons are present','return !!document.querySelector("[data-nxprod-png]")&&!!document.querySelector("[data-nxprod-jpg]")&&!!document.querySelector("[data-nxprod-edit]");');

  await expect('Shop preset renders genuine 2000 × 2000 full-resolution output','const c=window.__qaRoot.__nxProductStudioV21.renderFull();return c.width===2000&&c.height===2000;');
  await expect('Default white background is actually rendered white','const c=window.__qaRoot.__nxProductStudioV21.renderFull(),d=c.getContext("2d").getImageData(2,2,1,1).data;return d[0]>245&&d[1]>245&&d[2]>245&&d[3]===255;');
  await ex('document.querySelector("[data-nxprod-bg=transparent]").click();return true;');
  await expect('Transparent background produces real transparent export pixels','const c=window.__qaRoot.__nxProductStudioV21.renderFull(),d=c.getContext("2d").getImageData(2,2,1,1).data;return d[3]===0;');
  await ex(`const i=document.querySelector('[data-nxprod-color]');i.value='#2a5cff';i.dispatchEvent(new Event('input',{bubbles:true}));return true;`);
  await expect('Solid background color changes actual export pixels','const c=window.__qaRoot.__nxProductStudioV21.renderFull(),d=c.getContext("2d").getImageData(2,2,1,1).data;return d[2]>220&&d[0]<80&&d[1]>50;');
  await ex('document.querySelector("[data-nxprod-preset=story]").click();return true;');
  await expect('Story preset renders exact 1080 × 1920 output','const c=window.__qaRoot.__nxProductStudioV21.renderFull();return c.width===1080&&c.height===1920;');

  const perf=await ex(`const i=document.querySelector('[data-nxprod-range="x"]'),start=performance.now();for(let n=0;n<50;n++){i.value=String(n*2);i.dispatchEvent(new Event('input',{bubbles:true}))}return performance.now()-start;`);rec('Fifty placement inputs return without blocking the phone UI',Number(perf)<120,`${Number(perf).toFixed(2)} ms`);
  await expect('Placement input updates reusable Product Studio state','return window.__qaRoot.__nxProductStudioV21.getState().x===98;');
  await ex(`const s=document.querySelector('[data-nxprod-range="scale"]');s.value='130';s.dispatchEvent(new Event('input',{bubbles:true}));const r=document.querySelector('[data-nxprod-range="relight"]');r.value='125';r.dispatchEvent(new Event('input',{bubbles:true}));const h=document.querySelector('[data-nxprod-range="hue"]');h.value='30';h.dispatchEvent(new Event('input',{bubbles:true}));return true;`);
  await expect('Scale relight and hue values persist in reusable layout state','const s=window.__qaRoot.__nxProductStudioV21.getState();return s.scale===130&&s.relight===125&&s.hue===30;');
  await expect('Product preview remains physically visible on phone','const c=document.querySelector(".nxprod-canvas"),r=c?.getBoundingClientRect();return r&&r.width>120&&r.height>120&&r.bottom<=innerHeight+600;');
  await expect('Product Studio source contract keeps AI generation limited to separate background','return fetch("/fresh-rebuild/src/features/apps/ai-photo-product-studio-v21.js").then(r=>r.text()).then(t=>t.includes("generateAiImage")&&t.includes("Empty premium commercial product photography background only")&&t.includes("No product, no object, no logo, no text")&&t.includes("product cutout remains unchanged"));');
}catch(e){rec('Uncaught Product Studio v21 QA',false,e?.stack||e)}
finally{try{await ex('window.__nxProductQaObserver?.disconnect();return true;')}catch{}if(sid)try{await cmd('DELETE',`/session/${sid}`)}catch{}driver.kill('SIGTERM');fs.closeSync(log)}
const failed=checks.filter(x=>!x.pass);fs.writeFileSync(`${outDir}/product-studio-v21-report.json`,JSON.stringify({generatedAt:new Date().toISOString(),summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks},null,2));if(failed.length){console.error(`Product Studio v21 QA FAIL — ${failed.length}/${checks.length}`);process.exit(1)}console.log(`Product Studio v21 QA PASS — ${checks.length} checks passed.`);
