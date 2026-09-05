import fs from 'node:fs';
import { spawn } from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: design-editor-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const driverPort=9517,driverLog=fs.openSync(`${outDir}/chromedriver-design.log`,'a'),driver=spawn(driverBinary,[`--port=${driverPort}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',driverLog,driverLog]});
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
async function createSession(width=393,height=852){const created=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome',pageLoadStrategy:'normal','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-default-apps','--disable-extensions','--force-color-profile=srgb','--hide-scrollbars'],mobileEmulation:{deviceMetrics:{width,height,pixelRatio:1,mobile:true,touch:true}}}}}});sessionId=created.sessionId;await command('POST',`/session/${sessionId}/timeouts`,{pageLoad:20000,script:20000,implicit:0});await command('POST',`/session/${sessionId}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});await waitUntil('return document.documentElement.dataset.qaReady || document.documentElement.dataset.qaError || "";',{timeout:20000,label:'design editor harness'});const error=await execute('return document.documentElement.dataset.qaError || "";');if(error)throw new Error(`Harness failed: ${error}`)}
async function quit(){if(!sessionId)return;try{await command('DELETE',`/session/${sessionId}`)}catch{}sessionId=''}
async function pointerDrag(startX,startY,endX,endY){return command('POST',`/session/${sessionId}/actions`,{actions:[{type:'pointer',id:'design-pointer',parameters:{pointerType:'mouse'},actions:[{type:'pointerMove',duration:0,x:Math.round(startX),y:Math.round(startY),origin:'viewport'},{type:'pointerDown',button:0},{type:'pause',duration:50},{type:'pointerMove',duration:180,x:Math.round(endX),y:Math.round(endY),origin:'viewport'},{type:'pointerUp',button:0}]}]})}

const checks=[];
function record(control,pass,evidence=''){checks.push({area:'Design Editor',control,pass:Boolean(pass),evidence:String(evidence??'')});if(!pass)console.error(`::error::Design Editor — ${control}: ${evidence}`)}
async function expect(control,script,evidence=''){let value=false;try{value=await execute(script)}catch(error){evidence=error.message}record(control,Boolean(value),evidence||JSON.stringify(value));return value}
async function setRange(selector,value){return execute(`const input=document.querySelector(arguments[0]);if(!input)return false;input.focus();input.value=String(arguments[1]);input.dispatchEvent(new Event('input',{bubbles:true}));input.blur();return true;`,[selector,value])}
async function injectPhoto(){return executeAsync(`const done=arguments[arguments.length-1],input=document.querySelector('[data-v3-photo-file]');if(!input){done(false);return}const canvas=document.createElement('canvas');canvas.width=96;canvas.height=72;const ctx=canvas.getContext('2d');ctx.fillStyle='#2d57db';ctx.fillRect(0,0,96,72);ctx.fillStyle='#fff';ctx.fillRect(28,16,40,40);canvas.toBlob(blob=>{if(!blob){done(false);return}const transfer=new DataTransfer();transfer.items.add(new File([blob],'replacement.png',{type:'image/png'}));input.files=transfer.files;input.dispatchEvent(new Event('change',{bubbles:true}));setTimeout(()=>done(true),80)},'image/png');`)}

try{
  await waitForDriver();await createSession();
  await execute('return window.__qaRoot.__nxCanvaWorkspaceV3.openTemplate("nx-approved-featured-photo-portrait");');
  await waitUntil('return document.querySelector("[data-v3-detail]")?.classList.contains("is-open");',{label:'approved template detail'});
  await click('[data-v3-use]');
  await waitUntil('return window.__qaRoot.__nxCanvaWorkspaceV3.getState().tab==="design"&&!!window.__qaRoot.__nxCanvaWorkspaceV3.getDesign();',{label:'template design'});
  await expect('Use this template opens editable design','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign();return !!d&&d.elements.length>0&&document.querySelector("[data-v3-export]").disabled===false;');

  const initialCount=await execute('return window.__qaRoot.__nxCanvaWorkspaceV3.getDesign().elements.length;');
  await click('[data-v3-add-text]');
  await expect('Add Text creates and selects text layer',`const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),id=d.selection[0],el=d.elements.find(x=>x.id===id);return d.elements.length===${initialCount+1}&&el?.type==='text'&&!!document.querySelector('[data-v3-text]');`);

  await execute(`const t=document.querySelector('[data-v3-text]');t.focus();t.value='A';t.dispatchEvent(new Event('input',{bubbles:true}));const first=document.activeElement===t&&t.value==='A';t.value='AB';t.dispatchEvent(new Event('input',{bubbles:true}));const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return first&&document.activeElement===t&&el?.text==='AB';`);
  await expect('Keyboard continuity survives repeated text input','const t=document.querySelector("[data-v3-text]");const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return document.activeElement===t&&t?.value==="AB"&&el?.text==="AB";');
  await click('[data-v3-text-select]');await delay(50);
  await expect('Select All selects complete text','const t=document.querySelector("[data-v3-text]");return document.activeElement===t&&t.selectionStart===0&&t.selectionEnd===t.value.length;');
  await click('[data-v3-text-clear]');
  await expect('Clear Text updates selected layer','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return document.querySelector("[data-v3-text]")?.value===""&&el?.text==="";');
  await execute(`const t=document.querySelector('[data-v3-text]');t.value='NEXUSNOVA';t.dispatchEvent(new Event('input',{bubbles:true}));t.blur();return true;`);

  await setRange('[data-v3-font-size]',0.09);await expect('Text size range mutates selected text','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return Math.abs(el.fontSize-.09)<.0001;');
  await execute(`const input=document.querySelector('[data-v3-fill]');input.focus();input.value='#12abef';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();return true;`);await expect('Fill color updates selected layer','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return el.fill==="#12abef";');
  await setRange('[data-v3-opacity]',0.55);await expect('Opacity range mutates selected layer','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return Math.abs(el.opacity-.55)<.001;');
  await setRange('[data-v3-rotation]',27);await expect('Rotation range mutates selected layer','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return el.rotation===27;');
  await setRange('[data-v3-width]',0.44);await setRange('[data-v3-height]',0.16);await expect('Width and Height ranges mutate selected layer','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return Math.abs(el.w-.44)<.001&&Math.abs(el.h-.16)<.001;');

  await click('[data-v3-center]');await expect('Center places selected layer in canvas center','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return Math.abs(el.x-(1-el.w)/2)<.001&&Math.abs(el.y-(1-el.h)/2)<.001;');
  const beforeDuplicate=await execute('return window.__qaRoot.__nxCanvaWorkspaceV3.getDesign().elements.length;');await click('[data-v3-duplicate]');await expect('Duplicate creates a new selected layer',`const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign();return d.elements.length===${beforeDuplicate+1}&&d.selection.length===1&&d.elements.some(x=>x.id===d.selection[0]);`);
  await click('[data-v3-back]');await expect('Back sends selected layer to bottom','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return el?.z===0;');
  await click('[data-v3-front]');await expect('Front sends selected layer to top','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return el?.z===d.elements.length-1;');
  await click('[data-v3-lock]');await expect('Lock toggles selected layer locked','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return el?.locked===true;');await click('[data-v3-lock]');
  await click('[data-v3-hide]');await expect('Hide toggles selected layer hidden','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return el?.hidden===true;');await click('[data-v3-hide]');

  const beforeShape=await execute('return window.__qaRoot.__nxCanvaWorkspaceV3.getDesign().elements.length;');await click('[data-v3-add-shape]');await expect('Add Shape creates and selects rectangle',`const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return d.elements.length===${beforeShape+1}&&el?.type==='rect';`);
  const dragStart=await execute(`const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id)),c=document.querySelector('[data-v3-canvas]'),r=c.getBoundingClientRect();return {x:r.left+(el.x+el.w/2)*r.width,y:r.top+(el.y+el.h/2)*r.height,beforeX:el.x,beforeY:el.y};`);
  await pointerDrag(dragStart.x,dragStart.y,dragStart.x+24,dragStart.y+16);await delay(80);
  await expect('Canvas drag moves selected layer',`const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return Math.abs(el.x-${dragStart.beforeX})>.005||Math.abs(el.y-${dragStart.beforeY})>.005;`);

  const selectedShapeId=await execute('return window.__qaRoot.__nxCanvaWorkspaceV3.getDesign().selection[0];');await click('[data-v3-tab="layers"]');await expect('Layers tab renders actual design layers','return document.querySelectorAll("[data-layer]").length===window.__qaRoot.__nxCanvaWorkspaceV3.getDesign().elements.length;');await click(`.nxv3-layer[data-layer="${selectedShapeId}"] button`);await expect('Layer row selects correct layer and returns to Design',`const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign();return d.selection[0]===${JSON.stringify(selectedShapeId)}&&window.__qaRoot.__nxCanvaWorkspaceV3.getState().tab==='design';`);

  await execute(`const c=document.querySelector('[data-v3-canvas]'),r=c.getBoundingClientRect();c.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:77,clientX:r.left+r.width*.985,clientY:r.top+r.height*.985}));return true;`);await delay(40);
  await expect('Canvas empty-area selection exposes canvas inspector','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign();return d.selection.length===0&&!!document.querySelector("[data-v3-bg]");');
  await execute(`const input=document.querySelector('[data-v3-bg]');if(!input)return false;input.focus();input.value='#102030';input.dispatchEvent(new Event('input',{bubbles:true}));input.dispatchEvent(new Event('change',{bubbles:true}));input.blur();return true;`);await expect('Canvas background color control works','return window.__qaRoot.__nxCanvaWorkspaceV3.getDesign().background==="#102030";');

  await execute('return window.__qaRoot.__nxCanvaWorkspaceV3.openTemplate("nx-approved-featured-photo-portrait");');await click('[data-v3-use]');await click('[data-v3-tab="layers"]');
  const photoId=await execute('const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>x.type==="photo");return el?.id||"";');
  if(photoId){await click(`.nxv3-layer[data-layer="${photoId}"] button`);await expect('Photo layer exposes Replace Photo','return !!document.querySelector("[data-v3-replace-photo]");');await click('[data-v3-replace-photo]');await injectPhoto();await waitUntil('const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return typeof el?.src==="string"&&el.src.startsWith("data:image/png");',{label:'replacement photo'});await expect('Replace Photo writes selected photo and clears source crop','const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign(),el=d.elements.find(x=>d.selection.includes(x.id));return el?.type==="photo"&&el.src.startsWith("data:image/png")&&el.sourceCrop===null;');}else record('Replace Photo writes selected photo and clears source crop',false,'Approved photo template has no photo layer');

  const beforeExport=await execute('return window.__qaDownloads.length;');await click('[data-v3-export]');await waitUntil(`return window.__qaDownloads.length>${beforeExport};`,{label:'design export'});await expect('Export downloads rendered PNG','return /\.png$/i.test(window.__qaDownloads.at(-1)?.download||"");');
  await delay(900);await click('[data-v3-tab="projects"]');await expect('Autosave creates project row','return document.querySelectorAll("[data-project]").length>=1;');
  const projectId=await execute('return document.querySelector("[data-project]")?.dataset.project||"";');
  if(projectId){await click(`.nxv3-project[data-project="${projectId}"] button:not([data-del])`);await expect('Project Open loads exact saved project',`const d=window.__qaRoot.__nxCanvaWorkspaceV3.getDesign();return d?.id===${JSON.stringify(projectId)}&&window.__qaRoot.__nxCanvaWorkspaceV3.getState().tab==='design';`);await delay(50);await click('[data-v3-tab="projects"]');const beforeRows=await execute('return document.querySelectorAll("[data-project]").length;');await click(`.nxv3-project[data-project="${projectId}"] [data-del]`);await expect('Project Delete removes saved row without autosave recreation',`return document.querySelectorAll('[data-project]').length===${Math.max(0,beforeRows-1)};`);}else record('Project Open loads exact saved project',false,'No autosaved project row');

  await execute('return window.__qaRoot.__nxCanvaWorkspaceV3.openTemplate("nx-approved-featured-photo-portrait");');await click('[data-v3-use]');const beforeDelete=await execute('return window.__qaRoot.__nxCanvaWorkspaceV3.getDesign().elements.length;');await click('[data-v3-add-text]');await click('[data-v3-delete]');await expect('Delete removes selected layer',`return window.__qaRoot.__nxCanvaWorkspaceV3.getDesign().elements.length===${beforeDelete};`);

  const passed=checks.filter(x=>x.pass).length,failed=checks.length-passed;fs.writeFileSync(`${outDir}/design-editor-report.json`,JSON.stringify({total:checks.length,passed,failed,checks},null,2));const rows=checks.map(c=>`| ${c.control.replace(/\|/g,'\\|')} | ${c.pass?'PASS':'FAIL'} | ${String(c.evidence).replace(/\|/g,'\\|')} |`).join('\n');fs.writeFileSync(`${outDir}/design-editor-report.md`,`# AI Photo Design Editor execution QA\n\n- Total: ${checks.length}\n- Passed: ${passed}\n- Failed: ${failed}\n\n| Control / flow | Status | Evidence |\n|---|---|---|\n${rows}\n`);console.log(`Design Editor QA: ${passed}/${checks.length} passed`);if(failed)process.exitCode=1;
}catch(error){console.error(error?.stack||error);process.exitCode=1}finally{await quit();driver.kill('SIGTERM')}
