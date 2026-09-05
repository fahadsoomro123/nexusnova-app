import fs from 'node:fs';
import {spawn} from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: core-architecture-v17-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const driverPort=9523,driverLog=fs.openSync(`${outDir}/chromedriver.log`,'a'),driver=spawn(driverBinary,[`--port=${driverPort}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',driverLog,driverLog]});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
let sessionId='';

async function command(method,path,body){
  const response=await fetch(`http://127.0.0.1:${driverPort}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),raw=await response.text();let parsed={};
  try{parsed=raw?JSON.parse(raw):{}}catch{throw new Error(`${method} ${path} returned invalid JSON: ${raw.slice(0,300)}`)}
  if(!response.ok||parsed?.value?.error)throw new Error(`${method} ${path} failed: ${JSON.stringify(parsed.value||parsed)}`);return parsed.value;
}
async function waitForDriver(){for(let attempt=0;attempt<60;attempt++){try{if((await command('GET','/status'))?.ready)return}catch{}await delay(100)}throw new Error('ChromeDriver did not become ready')}
async function execute(script,args=[]){return command('POST',`/session/${sessionId}/execute/sync`,{script,args})}
async function waitUntil(script,{timeout=10000,label='condition'}={}){const started=Date.now();while(Date.now()-started<timeout){const value=await execute(script);if(value)return value;await delay(60)}throw new Error(`Timed out waiting for ${label}`)}
async function click(selector){return execute('const node=document.querySelector(arguments[0]);if(!node)return false;node.click();return true;',[selector])}
async function screenshot(name){const png=await command('GET',`/session/${sessionId}/screenshot`);fs.writeFileSync(`${outDir}/${name}.png`,Buffer.from(png,'base64'))}
async function createSession(width=393,height=852){
  const created=await command('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome',pageLoadStrategy:'normal','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage','--disable-background-networking','--disable-default-apps','--disable-extensions','--force-color-profile=srgb','--hide-scrollbars'],mobileEmulation:{deviceMetrics:{width,height,pixelRatio:1,mobile:true,touch:true}}}}}});sessionId=created.sessionId;
  await command('POST',`/session/${sessionId}/timeouts`,{pageLoad:20000,script:20000,implicit:0});
  await command('POST',`/session/${sessionId}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});
  await waitUntil('return document.documentElement.dataset.qaReady || document.documentElement.dataset.qaError || "";',{timeout:20000,label:'core architecture harness'});
  const error=await execute('return document.documentElement.dataset.qaError || "";');if(error)throw new Error(`Harness failed: ${error}`);
}
async function quit(){if(!sessionId)return;try{await command('DELETE',`/session/${sessionId}`)}catch{}sessionId=''}

const checks=[];
function record(area,control,pass,evidence){checks.push({area,control,pass:Boolean(pass),evidence:String(evidence??'')});if(!pass)console.error(`::error::${area} — ${control}: ${evidence}`)}
async function expect(area,control,script,evidence=''){let value=false;try{value=await execute(script)}catch(error){evidence=error.message}record(area,control,Boolean(value),evidence||JSON.stringify(value));return value}
async function navCall(expression){return execute(`return window.__qaRoot.__nxStudioNavigation.${expression};`)}
async function waitScreen(screen){return waitUntil(`return window.__qaRoot?.__nxStudioNavigation?.getState?.().screen===${JSON.stringify(screen)};`,{label:`navigation screen ${screen}`})}

try{
  await waitForDriver();await createSession();
  const initialHistory=await execute('return history.length;');

  await expect('Core Router','V17 architecture router installed','const r=window.__qaRoot,a=r?.__nxStudioNavigation;return !!a&&r.dataset.aiPhotoArchitecture==="v17-core-router"&&typeof a.canHandleBack==="function"&&typeof a.syncFromDom==="function";');
  await expect('Core Router','Initial screen is Studio Home','const s=window.__qaRoot.__nxStudioNavigation.getState();return s.screen==="home"&&s.home===true&&s.canHandleBack===false;');

  await navCall('openWorkspace("templates")');await waitScreen('templates');
  await expect('Workspace','Templates owns canonical route','const s=window.__qaRoot.__nxStudioNavigation.getState();return s.workspace&&s.screen==="templates"&&document.querySelector("[data-v3-tab=templates]")?.classList.contains("is-active");');
  await execute('window.__qaRoot.__nxCanvaWorkspaceV3.setTab("design");return true;');await waitScreen('design');
  await execute('window.__qaRoot.__nxCanvaWorkspaceV3.setTab("layers");return true;');await waitScreen('layers');
  await expect('Workspace','Tab events synchronize canonical route','const s=window.__qaRoot.__nxStudioNavigation.getState();return s.screen==="layers"&&document.querySelector("[data-v3-tab=layers]")?.classList.contains("is-active");');

  await navCall('handleBack()');await waitScreen('design');
  await expect('Back Hierarchy','Layers Back returns Design','return document.querySelector("[data-v3-tab=design]")?.classList.contains("is-active");');
  await navCall('handleBack()');await waitScreen('templates');
  await expect('Back Hierarchy','Design Back returns Templates','return document.querySelector("[data-v3-tab=templates]")?.classList.contains("is-active");');
  await navCall('handleBack()');await waitScreen('home');
  await expect('Back Hierarchy','Templates Back returns Studio Home','const s=window.__qaRoot.__nxStudioNavigation.getState();return s.home&&!s.workspace&&!s.canHandleBack;');

  await navCall('openEditor({pick:false})');await waitScreen('photo-editor');
  await expect('Photo Editor','Editor owns canonical route','const s=window.__qaRoot.__nxStudioNavigation.getState();return s.screen==="photo-editor"&&!s.home&&!s.workspace&&s.canHandleBack;');
  await click('[data-photo-panel-open="adjust"]');await waitUntil('return document.querySelector("[data-photo-sheet]")?.classList.contains("is-open");',{label:'Adjust sheet'});
  await navCall('handleBack()');
  await expect('Back Hierarchy','Editor sheet closes before leaving editor','const s=window.__qaRoot.__nxStudioNavigation.getState();return !document.querySelector("[data-photo-sheet]")?.classList.contains("is-open")&&s.screen==="photo-editor";');
  await navCall('handleBack()');await waitScreen('home');
  await expect('Back Hierarchy','Editor Back then returns Studio Home','return window.__qaRoot.__nxStudioNavigation.getState().home===true;');

  await navCall('openWorkspace("ai-image")');await waitScreen('generator');
  await execute('const r=document.querySelector("[data-puter-result]");if(r)r.classList.add("is-on");return !!r;');
  await navCall('handleBack()');
  await expect('Generator','Generated result closes one level first','const s=window.__qaRoot.__nxStudioNavigation.getState();return s.screen==="generator"&&!document.querySelector("[data-puter-result]")?.classList.contains("is-on");');
  await navCall('handleBack()');await waitScreen('home');
  await expect('Generator','Generator Back returns Studio Home','return window.__qaRoot.__nxStudioNavigation.getState().home===true;');

  await click('[data-nxlock="edit"]');await waitScreen('photo-editor');
  await expect('Home Actions','Existing Edit Photo launcher synchronizes router','return window.__qaRoot.__nxStudioNavigation.getState().screen==="photo-editor";');
  await navCall('handleBack()');await waitScreen('home');
  await click('[data-nxlock="templates"]');await waitScreen('templates');
  await expect('Home Actions','Existing Templates launcher synchronizes router','return window.__qaRoot.__nxStudioNavigation.getState().screen==="templates";');
  await click('[data-v3-close]');await waitScreen('home');
  await expect('Home Actions','Workspace Back button uses same hierarchy','return window.__qaRoot.__nxStudioNavigation.getState().home===true;');

  await execute(`
    const root=window.__qaRoot,parent=root.parentNode,route=document.createElement('div'),back=document.createElement('button');
    route.className='nx-ai-photo-route-screen';back.type='button';back.setAttribute('data-app-back','');back.textContent='Outer Back';
    parent.insertBefore(route,root);route.append(back,root);window.__qaOuterBack=0;back.addEventListener('click',()=>window.__qaOuterBack++);return true;
  `);
  await navCall('openWorkspace("projects")');await waitScreen('projects');
  await click('[data-app-back]');await waitScreen('home');
  await expect('Route Back','Outer app Back is intercepted while internal screen active','return window.__qaOuterBack===0&&window.__qaRoot.__nxStudioNavigation.getState().home===true;');
  await click('[data-app-back]');await delay(80);
  await expect('Route Back','Outer app Back falls through at Studio Home','return window.__qaOuterBack===1&&window.__qaRoot.__nxStudioNavigation.getState().canHandleBack===false;');

  const finalHistory=await execute('return history.length;');record('Core Router','Internal navigation does not mutate browser history',finalHistory===initialHistory,`${initialHistory} → ${finalHistory}`);
  await expect('Core Router','Navigation trace is bounded and records hierarchy','const t=window.__qaRoot.__nxStudioNavigation.getState().trace;return Array.isArray(t)&&t.length>6&&t.length<=32&&t.some(r=>r.reason==="route-back");');
  await screenshot('core-architecture-v17');
}catch(error){record('Harness','Uncaught test failure',false,error?.stack||error);try{await screenshot('uncaught-failure')}catch{}}
finally{await quit();driver.kill('SIGTERM');fs.closeSync(driverLog)}

const failed=checks.filter(check=>!check.pass),report={generatedAt:new Date().toISOString(),viewport:{width:393,height:852},summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks};
fs.writeFileSync(`${outDir}/core-architecture-v17-report.json`,`${JSON.stringify(report,null,2)}\n`);
fs.writeFileSync(`${outDir}/core-architecture-v17-report.md`,`# AI Photo Core Architecture V17 QA\n\n- Total: ${checks.length}\n- Passed: ${checks.length-failed.length}\n- Failed: ${failed.length}\n\n| Area | Control / flow | Status | Evidence |\n|---|---|---|---|\n${checks.map(check=>`| ${check.area} | ${check.control} | ${check.pass?'PASS':'FAIL'} | ${check.evidence.replace(/\|/g,'\\|').replace(/\n/g,' ')} |`).join('\n')}\n`);
if(failed.length){console.error(`Core architecture V17 QA FAIL — ${failed.length}/${checks.length} checks failed.`);process.exit(1)}
console.log(`Core architecture V17 QA PASS — ${checks.length} navigation checks passed.`);
