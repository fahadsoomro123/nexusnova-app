import fs from 'node:fs';
import { spawn } from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: behavior-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const driverPort=9516,driverLog=fs.openSync(`${outDir}/chromedriver.log`,'a'),driver=spawn(driverBinary,[`--port=${driverPort}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',driverLog,driverLog]});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let sessionId='';

async function command(method,path,body){
  const response=await fetch(`http://127.0.0.1:${driverPort}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),raw=await response.text();let parsed={};
  try{parsed=raw?JSON.parse(raw):{}}catch{throw new Error(`${method} ${path} returned invalid JSON: ${raw.slice(0,300)}`)}
  if(!response.ok||parsed?.value?.error)throw new Error(`${method} ${path} failed: ${JSON.stringify(parsed.value||parsed)}`);return parsed.value;
}
async function waitForDriver(){for(let attempt=0;attempt<60;attempt++){try{if((await command('GET','/status'))?.ready)return}catch{}await delay(100)}throw new Error('ChromeDriver did not become ready')}
async function execute(script,args=[]){return command('POST',`/session/${sessionId}/execute/sync`,{script,args})}
async function executeAsync(script,args=[]){return command('POST',`/session/${sessionId}/execute/async`,{script,args})}
async function waitUntil(script,{timeout=10000,label='condition'}={}){const started=Date.now();while(Date.now()-started<timeout){const value=await execute(script);if(value)return value;await delay(60)}throw new Error(`Timed out waiting for ${label}`)}
async function click(selector){return execute('const node=document.querySelector(arguments[0]);if(!node)return false;node.click();return true;',[selector])}
async function screenshot(name){const png=await command('GET',`/session/${sessionId}/screenshot`);fs.writeFileSync(`${outDir}/${name}.png`,Buffer.from(png,'base64'))}
async function createSession(width=393,height=852){const created=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome',pageLoadStrategy:'normal','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-default-apps','--disable-extensions','--force-color-profile=srgb','--hide-scrollbars'],mobileEmulation:{deviceMetrics:{width,height,pixelRatio:1,mobile:true,touch:true}}}}}});sessionId=created.sessionId;await command('POST',`/session/${sessionId}/timeouts`,{pageLoad:20000,script:20000,implicit:0});await command('POST',`/session/${sessionId}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});await waitUntil('return document.documentElement.dataset.qaReady || document.documentElement.dataset.qaError || "";',{timeout:20000,label:'behavior harness'});const error=await execute('return document.documentElement.dataset.qaError || "";');if(error)throw new Error(`Harness failed: ${error}`)}
async function quit(){if(!sessionId)return;try{await command('DELETE',`/session/${sessionId}`)}catch{}sessionId=''}

const checks=[];
function record(area,control,pass,evidence){checks.push({area,control,pass:Boolean(pass),evidence:String(evidence??'')});if(!pass)console.error(`::error::${area} — ${control}: ${evidence}`)}
async function expect(area,control,script,evidence=''){let value=false;try{value=await execute(script)}catch(error){evidence=error.message}record(area,control,Boolean(value),evidence||JSON.stringify(value));return value}
async function quickState(screen){return waitUntil(`const s=window.__qaRoot?.__nxQuickTools?.getState?.();return s?.open&&s.screen===${JSON.stringify(screen)}?s:null;`,{timeout:16000,label:`Quick Tools ${screen}`})}
async function injectFixture(count=1,{invalid=false}={}){
  return executeAsync(`
    const count=arguments[0],invalid=arguments[1],done=arguments[arguments.length-1],input=document.querySelector('[data-nxqt-file]');
    if(!input){done({ok:false,error:'input missing'});return}
    if(invalid){const transfer=new DataTransfer();transfer.items.add(new File(['not an image'],'invalid.txt',{type:'text/plain'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));done({ok:true});return}
    const colors=['#d94a65','#28a8d4','#f4a62a','#58c57a','#8356d8','#ee7070'];
    Promise.all(Array.from({length:count},(_,index)=>new Promise(resolve=>{const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const context=canvas.getContext('2d');context.fillStyle='#ececf2';context.fillRect(0,0,160,120);context.fillStyle=colors[index%colors.length];context.fillRect(43,24,74,72);context.fillStyle='#18203a';context.beginPath();context.arc(80,60,18,0,Math.PI*2);context.fill();canvas.toBlob(blob=>resolve(new File([blob],'fixture-'+index+'.png',{type:'image/png'})),'image/png')}))).then(files=>{const transfer=new DataTransfer();files.forEach(file=>transfer.items.add(file));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));done({ok:true,count:files.length})}).catch(error=>done({ok:false,error:String(error)}));
  `,[count,invalid]);
}
async function injectEdgeTouchFixture(){
  return executeAsync(`
    const done=arguments[arguments.length-1],input=document.querySelector('[data-nxqt-file]');
    if(!input){done({ok:false,error:'input missing'});return}
    const canvas=document.createElement('canvas');canvas.width=160;canvas.height=120;const context=canvas.getContext('2d');
    context.fillStyle='#ececf2';context.fillRect(0,0,160,120);
    context.fillStyle='#d94a65';context.fillRect(0,0,60,100);
    context.fillStyle='#18203a';context.beginPath();context.arc(30,50,18,0,Math.PI*2);context.fill();
    canvas.toBlob(blob=>{const transfer=new DataTransfer();transfer.items.add(new File([blob],'edge-touch-subject.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));done({ok:true})},'image/png');
  `);
}
async function goHome(){await execute('return window.__qaRoot.__nxStudioNavigation.showHome();');await waitUntil('return !document.querySelector(".nxlock-home")?.hidden;',{label:'Studio Home'})}

try{
  await waitForDriver();await createSession();
  await expect('Home','Locked home visible','return !document.querySelector(".nxlock-home")?.hidden;');
  await expect('Home','Six dedicated Quick Tool launchers','return document.querySelectorAll("[data-nxlock-quick]").length===6;');
  await expect('Home','Approved Featured templates map to opened designs','return JSON.stringify([...document.querySelectorAll(".nxlock-feature")].slice(0,4).map(node=>node.dataset.templateId))===JSON.stringify(["nx-approved-featured-photo-portrait","nx-approved-featured-social-media","nx-approved-featured-poster-design","nx-approved-featured-instagram-post"]);');
  await screenshot('home-before-functional-qa');

  await click('[data-nxlock="ai-tools"]');await quickState('hub');
  await expect('Quick Tools','AI Tools opens meaningful hub','return document.querySelectorAll("[data-nxqt-tool]").length===6&&/One tap/.test(document.querySelector(".nxqt-intro strong")?.textContent||"");');await execute('return window.__qaRoot.__nxStudioNavigation.handleBack();');await expect('Navigation','Quick Tools hub Back to Home','return !document.querySelector(".nxlock-home")?.hidden;');

  await click('.nxlock-feature');await waitUntil('return document.querySelector("[data-v3-detail]")?.classList.contains("is-open");',{label:'approved Featured detail'});
  await expect('Templates','Featured preview opens matching template','return document.querySelector("[data-v3-detail-name]")?.textContent==="Photo Portrait";');
  await click('[data-v3-favorite]');await expect('Templates','Add favorite persists selected state','return document.querySelector("[data-v3-favorite]").getAttribute("aria-pressed")==="true"&&window.__qaRoot.__nxCanvaWorkspaceV3.getFavorites().includes("nx-approved-featured-photo-portrait");');
  await execute('return window.__qaRoot.__nxStudioNavigation.handleBack();');await goHome();await click('[data-nxlock="favorites"]');await waitUntil('return window.__qaRoot.__nxCanvaWorkspaceV3.getState().favoritesOnly;',{label:'Favorites library'});
  await expect('Templates','Favorites opens only saved templates','return document.querySelectorAll(".nxv3-card[data-template-id]").length===1&&document.querySelector(".nxv3-card")?.dataset.templateId==="nx-approved-featured-photo-portrait";');
  await click('.nxv3-card');await click('[data-v3-use]');await waitUntil('return document.querySelector("[data-v3-tab=design]")?.classList.contains("is-active");',{label:'favorite template in Design'});
  await expect('Templates','Approved preview matches actual editable design','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign();return d?.templateId==="nx-approved-featured-photo-portrait"&&d.elements?.[0]?.sourceCrop?.x===0&&d.elements?.[0]?.sourceCrop?.w===0.25;');await goHome();

  await click('[data-nxlock-quick="remove-bg"]');await quickState('picker');await injectFixture();await quickState('result');
  await expect('Quick Tools','Remove BG busy state observed','return window.__qaTransitions.some(value=>value==="quick:remove-bg:busy");');
  await expect('Quick Tools','Remove BG produced real transparency','const c=document.querySelector(".nxqt-canvas-wrap canvas:not([hidden])");if(!c)return false;const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data;let transparent=0;for(let i=3;i<d.length;i+=4)if(d[i]===0)transparent++;return transparent>d.length/16&&d[((60*c.width+80)*4)+3]===255;');
  await expect('Quick Tools','Remove BG success state','return /background removed/i.test(document.querySelector(".nxqt-result-head")?.textContent||"")&&!!document.querySelector(".nxqt-success");');
  await click('[data-nxqt-download]');await expect('Quick Tools','Result Download action','return window.__qaDownloads.some(row=>/remove-bg/.test(row.download));');
  await click('[data-nxqt-back]');await quickState('picker');await click('[data-nxqt-home]');await expect('Navigation','Quick result Back then Home','return !document.querySelector(".nxlock-home")?.hidden&&!window.__qaRoot.__nxQuickTools.getState().open;');

  await click('[data-nxlock-quick="remove-bg"]');await quickState('picker');await injectEdgeTouchFixture();await quickState('result');
  await expect('Quick Tools','Remove BG preserves edge-touching subject','const c=document.querySelector(".nxqt-canvas-wrap canvas:not([hidden])");if(!c)return false;const d=c.getContext("2d").getImageData(0,0,c.width,c.height).data,subject=d[((50*c.width+30)*4)+3],background=d[((110*c.width+130)*4)+3];return subject>220&&background<32;');
  await click('[data-nxqt-home]');await expect('Navigation','Edge-touch Remove BG returns Home','return !document.querySelector(".nxlock-home")?.hidden&&!window.__qaRoot.__nxQuickTools.getState().open;');

  await click('[data-nxlock-quick="enhance"]');await injectFixture();await quickState('result');
  await expect('Quick Tools','Enhance changed pixels','const c=document.querySelector(".nxqt-canvas-wrap canvas:not([hidden])");const p=c?.getContext("2d").getImageData(5,5,1,1).data;return !!p&&(p[0]!==236||p[1]!==236||p[2]!==242);');
  await click('[data-nxqt-design]');await waitUntil('return document.querySelector("[data-v3-tab=design]")?.classList.contains("is-active");',{label:'enhanced result in Design'});
  await expect('Quick Tools','Use in Design opened saved result','return !!window.__qaRoot.__nxCanvaWorkspaceV3.getState().designId;');await goHome();
  await expect('Recent Creations','Real saved card replaces example','return !!document.querySelector(".nxlock-recent-item[data-nx-project-id]:not(.is-example)");');

  await click('[data-nxlock-quick="upscale"]');await injectFixture();await quickState('result');
  await expect('Quick Tools','Upscale produced 2x dimensions','const c=document.querySelector(".nxqt-canvas-wrap canvas:not([hidden])");return c?.width===320&&c?.height===240;');
  await click('[data-nxqt-edit]');await waitUntil('return document.querySelector("[data-photo-canvas]")&&!document.querySelector("[data-photo-canvas]").hidden;',{timeout:16000,label:'upscaled result in Photo Editor'});
  await expect('Quick Tools','Edit Photo opened processed result','return !window.__qaRoot.__nxCanvaWorkspaceV3.getState().open&&document.querySelector(".nxlock-home").hidden;');await goHome();

  await click('[data-nxlock-quick="filters"]');await injectFixture();await quickState('filters');
  await expect('Quick Tools','Eight meaningful filter choices','return document.querySelectorAll("[data-nxqt-filter]").length===8;');await click('[data-nxqt-filter="cinematic"]');
  await expect('Quick Tools','AI Filters single selected state','return document.querySelectorAll("[data-nxqt-filter][aria-pressed=true]").length===1&&document.querySelector("[data-nxqt-filter=cinematic]").getAttribute("aria-pressed")==="true";');await click('[data-nxqt-filter-use]');await quickState('result');await expect('Quick Tools','AI Filters result visible','return /cinematic filter applied/i.test(document.querySelector(".nxqt-result-head")?.textContent||"");');await goHome();

  await click('[data-nxlock-quick="collage"]');await injectFixture(3);await quickState('collage');await click('[data-layout="hero"]');await click('[data-nxqt-collage-use]');await quickState('result');
  await expect('Quick Tools','Collage real 3-photo render','const c=document.querySelector(".nxqt-canvas-wrap canvas:not([hidden])");return c?.width===1200&&c?.height===1200&&/3 photos/.test(document.querySelector(".nxqt-result-head")?.textContent||"");');await goHome();

  await click('[data-nxlock-quick="text-art"]');await quickState('text');await execute('const t=document.querySelector("[data-nxqt-text]");t.value="NEXUS\\nNOVA";t.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("[data-text-style=neon]").click();return true;');
  await expect('Quick Tools','Text Art live controls','return document.querySelector("[data-text-style=neon]").classList.contains("is-active")&&document.querySelector("[data-nxqt-text-preview] canvas")?.width===1080;');await click('[data-nxqt-text-use]');await quickState('result');await expect('Quick Tools','Text Art result state','return /text art ready/i.test(document.querySelector(".nxqt-result-head")?.textContent||"");');await goHome();

  await click('[data-nxlock-quick="remove-bg"]');await injectFixture(1,{invalid:true});await quickState('error');await expect('Quick Tools','Invalid-file error is explicit','return /JPG, PNG or WebP/i.test(document.querySelector("[data-nxqt-error-copy]")?.textContent||"");');await goHome();
  await click('[data-nxlock-quick="collage"]');await injectFixture(1);await quickState('error');await expect('Quick Tools','Collage minimum error is explicit','return /at least two/i.test(document.querySelector("[data-nxqt-error-copy]")?.textContent||"");');await goHome();

  await click('[data-nxlock="templates"]');await waitUntil('return document.querySelector("[data-v3-tab=templates]")?.classList.contains("is-active");',{label:'Templates'});
  await expect('Templates','Initial semantic cards render','return document.querySelectorAll(".nxv3-card[data-template-id]").length===30;');await click('[data-v3-more]');await expect('Templates','Load More adds cards','return document.querySelectorAll(".nxv3-card[data-template-id]").length===60;');
  await execute('const input=document.querySelector("[data-v3-search]");input.value="coffee";input.dispatchEvent(new Event("input",{bubbles:true}));return true;');await expect('Templates','Search filters rendered cards','return [...document.querySelectorAll(".nxv3-card-copy strong")].every(node=>/coffee|cafe/i.test(node.textContent))&&document.querySelectorAll(".nxv3-card").length>0;');
  await execute('const input=document.querySelector("[data-v3-search]");input.value="";input.dispatchEvent(new Event("input",{bubbles:true}));const select=document.querySelector("[data-v3-category]");select.value="logos";select.dispatchEvent(new Event("change",{bubbles:true}));return true;');await expect('Templates','Category filter works','return document.querySelectorAll(".nxv3-card").length===30&&[...document.querySelectorAll(".nxv3-card")].every(card=>card.dataset.templateId.includes("-logos-"));');
  await click('.nxv3-card');await expect('Templates','Template detail opens','return document.querySelector("[data-v3-detail]").classList.contains("is-open")&&!!document.querySelector("[data-v3-detail-name]").textContent;');await execute('return window.__qaRoot.__nxStudioNavigation.handleBack();');await expect('Navigation','Template detail Back','return !document.querySelector("[data-v3-detail]").classList.contains("is-open")&&document.querySelector("[data-v3-tab=templates]").classList.contains("is-active");');await execute('return window.__qaRoot.__nxStudioNavigation.handleBack();');await expect('Navigation','Template library Back to Home','return !document.querySelector(".nxlock-home").hidden;');

  await click('[data-nxlock="projects"]');await waitUntil('return document.querySelector("[data-v3-tab=projects]")?.classList.contains("is-active");',{label:'Projects'});await execute('return window.__qaRoot.__nxStudioNavigation.handleBack();');await expect('Navigation','Projects Back to Studio Home','return !document.querySelector(".nxlock-home").hidden;');
  await click('[data-nxlock="edit"]');await expect('Navigation','Photo Editor opens under Studio ownership','return document.querySelector(".nxlock-home").hidden&&!window.__qaRoot.__nxCanvaWorkspaceV3.getState().open;');await execute('return window.__qaRoot.__nxStudioNavigation.handleBack();');await expect('Navigation','Photo Editor Back to Studio Home','return !document.querySelector(".nxlock-home").hidden;');

  await click('[data-nxlock="ai"]');await waitUntil('return document.querySelector(".nxlock-generator")&&document.querySelector("[data-puter-generate]")&&!document.querySelector("[data-puter-generate]").disabled;',{timeout:16000,label:'Generator'});
  const stylePairs=[['threeD','3D'],['photo','Realistic'],['illustration','Anime'],['cinematic','Cinematic'],['digitalArt','Digital Art'],['portrait','Portrait'],['product','Product'],['logo','Logo']];
  for(const [value,label] of stylePairs){await click(`[data-style="${value}"]`);await expect('Generator',`${label} selected state`,`return document.querySelector('[data-puter-style]').value===${JSON.stringify(value)}&&document.querySelectorAll('.nxlock-style.is-active').length===1&&document.querySelector('[data-style=${value}]').getAttribute('aria-pressed')==='true';`)}
  for(const value of ['square','portrait','story','wide']){await click(`[data-r="${value}"]`);await expect('Generator',`${value} ratio selected`,`return document.querySelector('[data-puter-aspect]').value===${JSON.stringify(value)}&&document.querySelectorAll('.nxlock-ratio.is-active').length===1&&document.querySelector('[data-r=${value}]').getAttribute('aria-pressed')==='true';`)}
  await click('[data-r="custom"]');await expect('Generator','Custom ratio truthfully unsupported','return /not supported/i.test(document.querySelector("[data-puter-error]")?.textContent||"")&&document.querySelector("[data-r=custom]").getAttribute("aria-disabled")==="true";');
  await execute('const p=document.querySelector("[data-puter-prompt]");p.value="Premium studio product portrait";p.dispatchEvent(new Event("input",{bubbles:true}));const g=document.querySelector("[data-puter-generate]");g.click();g.click();return true;');await waitUntil('return document.querySelector("[data-puter-result]")?.classList.contains("is-on");',{timeout:16000,label:'Puter result'});
  await expect('Generator','One request per Generate action','return window.__qaPuterCalls.length===1;');await expect('Generator','Selected style reached provider prompt','return window.__qaPuterCalls[0].prompt.startsWith("Original clean brand-mark concept");');
  await expect('Generator','Result actions visible and readable','const buttons=[...document.querySelectorAll(".nxputer-actions button")];return buttons.length===3&&buttons.every(button=>{const r=button.getBoundingClientRect(),s=getComputedStyle(button);return r.width>40&&r.height>25&&s.visibility!=="hidden"&&s.color!=="rgba(0, 0, 0, 0)"});');
  await expect('Generator','Truthful allowance delta','return /This image used 0.70%/.test(document.querySelector("[data-puter-result-meta]")?.textContent||"");');await screenshot('generator-result-functional-qa');
  await click('.nxlock-gen-back');await expect('Navigation','Generated result Back one level','return !document.querySelector("[data-puter-result]").classList.contains("is-on")&&document.querySelector(".nx-canva-v3").classList.contains("is-open");');await click('.nxlock-gen-back');await expect('Navigation','Generator Back to Studio Home','return !document.querySelector(".nxlock-home").hidden;');

  await click('[data-nxlock="ai"]');await waitUntil('return !document.querySelector("[data-puter-generate]").disabled;',{label:'Generator reopen'});await execute('const p=document.querySelector("[data-puter-prompt]");p.value="Second generated design";p.dispatchEvent(new Event("input",{bubbles:true}));document.querySelector("[data-puter-generate]").click();return true;');await waitUntil('return document.querySelector("[data-puter-result]")?.classList.contains("is-on");',{timeout:16000,label:'second Puter result'});await click('[data-puter-use-design]');await waitUntil('return document.querySelector("[data-v3-tab=design]")?.classList.contains("is-active");',{timeout:16000,label:'generated image in Design'});await expect('Generator','Use in Design works','return !!window.__qaRoot.__nxCanvaWorkspaceV3.getState().designId;');await goHome();

  await waitUntil('return !!document.querySelector(".nxlock-recent-item[data-nx-project-id]");',{label:'Recent real card'});const beforeDelete=await execute('return Object.keys(JSON.parse(localStorage.getItem("nx_design_projects_v1")||"{}")).length;');
  await click('.nxlock-recent-item[data-nx-project-id]');await waitUntil('return document.querySelector("[data-v3-tab=design]")?.classList.contains("is-active");',{label:'Recent project open'});await expect('Recent Creations','Card opens correct saved project','return !!window.__qaRoot.__nxCanvaWorkspaceV3.getState().designId;');await goHome();
  await click('.nxlock-recent-item[data-nx-project-id] .nxfix-recent-menu');await expect('Recent Creations','Three-dot menu is real button','return !document.querySelector(".nxfix-recent-popover").hidden&&document.querySelector(".nxfix-recent-menu").tagName==="BUTTON";');await click('.nxfix-recent-popover [data-delete]');await delay(120);const afterDelete=await execute('return Object.keys(JSON.parse(localStorage.getItem("nx_design_projects_v1")||"{}")).length;');record('Recent Creations','Delete updates storage and Home immediately',afterDelete===beforeDelete-1,`${beforeDelete} → ${afterDelete}`);

  await screenshot('home-after-functional-qa');
}catch(error){record('Harness','Uncaught test failure',false,error?.stack||error);try{await screenshot('uncaught-failure')}catch{}}
finally{await quit();driver.kill('SIGTERM');fs.closeSync(driverLog)}

const failed=checks.filter(check=>!check.pass),report={generatedAt:new Date().toISOString(),viewport:{width:393,height:852},summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks};fs.writeFileSync(`${outDir}/behavior-report.json`,`${JSON.stringify(report,null,2)}\n`);fs.writeFileSync(`${outDir}/behavior-report.md`,`# AI Photo flagship behavioral QA\n\n- Total: ${checks.length}\n- Passed: ${checks.length-failed.length}\n- Failed: ${failed.length}\n\n| Area | Control / flow | Status | Evidence |\n|---|---|---|---|\n${checks.map(check=>`| ${check.area} | ${check.control} | ${check.pass?'PASS':'FAIL'} | ${check.evidence.replace(/\|/g,'\\|').replace(/\n/g,' ')} |`).join('\n')}\n`);
if(failed.length){console.error(`Behavior QA FAIL — ${failed.length}/${checks.length} checks failed.`);process.exit(1)}
console.log(`Behavior QA PASS — ${checks.length} interaction checks passed.`);
