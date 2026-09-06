import fs from 'node:fs';
import { spawn } from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: slider-focus-global-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const driverPort=9518;
const driverLog=fs.openSync(`${outDir}/chromedriver-slider-focus.log`,'a');
const driver=spawn(driverBinary,[`--port=${driverPort}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',driverLog,driverLog]});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let sessionId='';
const checks=[];

async function command(method,path,body){
  const response=await fetch(`http://127.0.0.1:${driverPort}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
  const raw=await response.text();let parsed={};
  try{parsed=raw?JSON.parse(raw):{}}catch{throw new Error(`${method} ${path} invalid JSON: ${raw.slice(0,260)}`)}
  if(!response.ok||parsed?.value?.error)throw new Error(`${method} ${path} failed: ${JSON.stringify(parsed.value||parsed)}`);
  return parsed.value;
}
async function waitForDriver(){for(let i=0;i<60;i++){try{if((await command('GET','/status'))?.ready)return}catch{}await delay(100)}throw new Error('ChromeDriver did not become ready')}
async function execute(script,args=[]){return command('POST',`/session/${sessionId}/execute/sync`,{script,args})}
async function waitUntil(script,{timeout=12000,label='condition'}={}){const started=Date.now();while(Date.now()-started<timeout){const value=await execute(script);if(value)return value;await delay(60)}throw new Error(`Timed out waiting for ${label}`)}
function record(control,pass,evidence=''){checks.push({control,pass:Boolean(pass),evidence:String(evidence)});if(!pass)console.error(`::error::Slider Focus — ${control}: ${evidence}`)}
async function check(control,script,evidence=''){let value=false;try{value=await execute(script)}catch(error){evidence=error.message}record(control,Boolean(value),evidence||JSON.stringify(value));return value}
async function screenshot(name){const png=await command('GET',`/session/${sessionId}/screenshot`);fs.writeFileSync(`${outDir}/${name}.png`,Buffer.from(png,'base64'))}
async function createSession(){
  const created=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome',pageLoadStrategy:'normal','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-default-apps','--disable-extensions','--force-color-profile=srgb','--hide-scrollbars'],mobileEmulation:{deviceMetrics:{width:393,height:852,pixelRatio:1,mobile:true,touch:true}}}}}});
  sessionId=created.sessionId;
  await command('POST',`/session/${sessionId}/timeouts`,{pageLoad:20000,script:20000,implicit:0});
  await command('POST',`/session/${sessionId}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});
  await waitUntil('return document.documentElement.dataset.qaReady || document.documentElement.dataset.qaError || "";',{timeout:20000,label:'slider focus harness'});
  const error=await execute('return document.documentElement.dataset.qaError || "";');
  if(error)throw new Error(`Harness failed: ${error}`);
}
async function quit(){if(!sessionId)return;try{await command('DELETE',`/session/${sessionId}`)}catch{}sessionId=''}

try{
  await waitForDriver();await createSession();
  await execute(`
    const root=window.__qaRoot;
    root.__nxStudioNavigation.openEditor({pick:false});
    const canvas=root.querySelector('[data-photo-canvas]');
    canvas.hidden=false;canvas.width=640;canvas.height=480;
    Object.assign(canvas.style,{width:'320px',height:'240px',display:'block'});
    const context=canvas.getContext('2d');
    const gradient=context.createLinearGradient(0,0,640,480);gradient.addColorStop(0,'#38216f');gradient.addColorStop(1,'#20a6c9');context.fillStyle=gradient;context.fillRect(0,0,640,480);
    const adjust=root.querySelector('[data-photo-panel-open="adjust"]');adjust?.click();
    return !!canvas&&!!adjust;
  `);
  await waitUntil('return document.querySelector("[data-photo-sheet-panel=adjust]")?.classList.contains("is-active");',{label:'Adjust panel'});
  await check('Focus is off before slider interaction','return !window.__qaRoot.dataset.nxSliderFocus&&!window.__qaRoot.querySelector("[data-nx-slider-focus-muted]");');
  const baseline=await execute(`
    const root=window.__qaRoot,panel=root.querySelector('[data-photo-sheet-panel="adjust"].is-active'),slider=panel?.querySelector('input[type="range"]');
    if(!slider)return null;
    const row=slider.closest('.nx-photo-field')||slider.parentElement,canvas=root.querySelector('[data-photo-canvas]'),rr=row.getBoundingClientRect(),cr=canvas.getBoundingClientRect();
    return {row:{x:rr.x,y:rr.y,w:rr.width,h:rr.height},canvas:{x:cr.x,y:cr.y,w:cr.width,h:cr.height}};
  `);
  if(!baseline)throw new Error('No Adjust slider found');

  await execute(`
    const root=window.__qaRoot,slider=root.querySelector('[data-photo-sheet-panel="adjust"].is-active input[type="range"]');
    slider.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:71,pointerType:'touch',buttons:1}));return true;
  `);
  await waitUntil('return window.__qaRoot.dataset.nxSliderFocus==="on";',{label:'pointer slider focus'});
  await check('Touched slider row stays fully visible','const root=window.__qaRoot,row=root.querySelector("[data-nx-slider-focus-active=true]");return !!row&&Number(getComputedStyle(row).opacity)>.95&&!!row.querySelector("input[type=range]");');
  await check('Editing image stays fully visible','const root=window.__qaRoot,canvas=root.querySelector("[data-photo-canvas]");return canvas?.getAttribute("data-nx-slider-focus-preview")==="true"&&Number(getComputedStyle(canvas).opacity)>.95;');
  await check('Unrelated UI fades while slider is touched','const root=window.__qaRoot,nodes=[...root.querySelectorAll("[data-nx-slider-focus-muted=true]")];return nodes.length>0&&nodes.some(node=>Number(getComputedStyle(node).opacity)<.3);');
  await check('Only one slider row is promoted','return window.__qaRoot.querySelectorAll("[data-nx-slider-focus-active=true]").length===1;');
  await check('Slider focus does not move slider or image',`const root=window.__qaRoot,row=root.querySelector('[data-nx-slider-focus-active=true]'),canvas=root.querySelector('[data-photo-canvas]'),rr=row.getBoundingClientRect(),cr=canvas.getBoundingClientRect(),b=${JSON.stringify(baseline)};return Math.abs(rr.x-b.row.x)<1&&Math.abs(rr.y-b.row.y)<1&&Math.abs(rr.width-b.row.w)<1&&Math.abs(rr.height-b.row.h)<1&&Math.abs(cr.x-b.canvas.x)<1&&Math.abs(cr.y-b.canvas.y)<1&&Math.abs(cr.width-b.canvas.w)<1&&Math.abs(cr.height-b.canvas.h)<1;`);
  await screenshot('slider-focus-pointer-active');

  await execute("window.dispatchEvent(new PointerEvent('pointerup',{bubbles:true,pointerId:71,pointerType:'touch',buttons:0}));return true;");await delay(150);
  await check('Pointer release restores complete UI','const root=window.__qaRoot;return !root.dataset.nxSliderFocus&&!root.querySelector("[data-nx-slider-focus-active],[data-nx-slider-focus-preview],[data-nx-slider-focus-muted]");');

  await execute(`const root=window.__qaRoot,slider=root.querySelector('[data-photo-sheet-panel="adjust"].is-active input[type="range"]');slider.focus();return true;`);
  await waitUntil('return window.__qaRoot.dataset.nxSliderFocus==="on";',{label:'keyboard slider focus'});
  await check('Keyboard focus gets same slider-only mode','return !!window.__qaRoot.querySelector("[data-nx-slider-focus-active=true] input[type=range]")&&!!window.__qaRoot.querySelector("[data-nx-slider-focus-preview=true]");');
  await execute(`const slider=window.__qaRoot.querySelector('[data-nx-slider-focus-active=true] input[type="range"]');slider.dispatchEvent(new KeyboardEvent('keydown',{bubbles:true,key:'Escape'}));return true;`);await delay(30);
  await check('Escape restores complete UI','const root=window.__qaRoot;return !root.dataset.nxSliderFocus&&!root.querySelector("[data-nx-slider-focus-active],[data-nx-slider-focus-preview],[data-nx-slider-focus-muted]");');

  await execute(`
    const panel=window.__qaRoot.querySelector('[data-photo-sheet-panel="adjust"].is-active'),field=document.createElement('div');field.className='nx-photo-field';field.dataset.nxDynamicSlider='1';field.innerHTML='<span>Dynamic QA</span><input type="range" min="0" max="100" value="50"><output>50</output>';panel.appendChild(field);const slider=field.querySelector('input');slider.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true,pointerId:72,pointerType:'touch',buttons:1}));return true;
  `);
  await waitUntil('return window.__qaRoot.dataset.nxSliderFocus==="on";',{label:'dynamic slider focus'});
  await check('Dynamically added slider works without reinstall','return window.__qaRoot.querySelector("[data-nx-dynamic-slider]")?.getAttribute("data-nx-slider-focus-active")==="true";');
  await execute("window.dispatchEvent(new PointerEvent('pointercancel',{bubbles:true,pointerId:72,pointerType:'touch',buttons:0}));return true;");await delay(150);
  await check('Pointer cancel also restores UI','const root=window.__qaRoot;return !root.dataset.nxSliderFocus&&!root.querySelector("[data-nx-slider-focus-active],[data-nx-slider-focus-preview],[data-nx-slider-focus-muted]");');
}catch(error){record('Uncaught test failure',false,error?.stack||error);try{await screenshot('slider-focus-failure')}catch{}}
finally{await quit();driver.kill('SIGTERM');fs.closeSync(driverLog)}

const failed=checks.filter(check=>!check.pass),report={generatedAt:new Date().toISOString(),viewport:{width:393,height:852},summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks};
fs.writeFileSync(`${outDir}/slider-focus-report.json`,`${JSON.stringify(report,null,2)}\n`);
fs.writeFileSync(`${outDir}/slider-focus-report.md`,`# AI Photo global slider focus QA\n\n- Total: ${checks.length}\n- Passed: ${checks.length-failed.length}\n- Failed: ${failed.length}\n\n| Control | Status | Evidence |\n|---|---|---|\n${checks.map(check=>`| ${check.control} | ${check.pass?'PASS':'FAIL'} | ${check.evidence.replace(/\|/g,'\\|').replace(/\n/g,' ')} |`).join('\n')}\n`);
if(failed.length){console.error(`Global slider focus QA FAIL — ${failed.length}/${checks.length} checks failed.`);process.exit(1)}
console.log(`Global slider focus QA PASS — ${checks.length} checks passed.`);
