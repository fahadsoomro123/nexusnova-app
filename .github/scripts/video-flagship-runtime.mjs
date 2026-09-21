import { chromium } from 'playwright';
import fs from 'node:fs';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:1});
fs.mkdirSync('artifacts/video-browser',{recursive:true});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});

await page.goto('http://127.0.0.1:4173/video-runtime-harness.html',{waitUntil:'networkidle'});
await page.waitForSelector('.nx-video-flagship');

const util=await page.evaluate(()=>{
  const u=window.__videoRoot.__videoTestUtils;
  return {
    image:u.normalizeImportKind({type:'image/png'})==='image',
    video:u.normalizeImportKind({type:'video/webm'})==='video',
    bad:u.normalizeImportKind({type:'application/pdf'})===null,
    timeline:(()=>{const x=u.mapTimeline([{id:'a',in:0,out:2,speed:1},{id:'b',in:0,out:1,speed:1}],2.2);return x.clipId==='b'&&Math.abs(x.local-.2)<.001;})(),
    motion:(()=>{const x=u.interpolateMotion({in:0,out:2,speed:1,motionStartScale:1,motionEndScale:1.5,motionStartRotation:0,motionEndRotation:20},1);return Math.abs(x.scale-1.25)<.001&&Math.abs(x.rotation-10)<.001;})(),
    srt:u.parseSrt('1\n00:00:00,000 --> 00:00:01,000\nHello')[0]?.text==='Hello'
  };
});
if(!Object.values(util).every(Boolean)) throw new Error('UTILITY QA FAIL');

const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=','base64');
const input=page.locator('[data-file]');

await input.setInputFiles([{name:'photo.png',mimeType:'image/png',buffer:png}]);
await page.waitForFunction(()=>document.querySelectorAll('.nx-video-clip').length===1);
if(await page.locator('[data-main-image]').evaluate(el=>el.classList.contains('nx-video-hidden'))) throw new Error('PHOTO PREVIEW FAIL');
await page.waitForFunction(()=>document.querySelector('[data-main-image]')?.naturalWidth>0,{timeout:5000});

const videoBytes=fs.readFileSync('fresh-rebuild/fixtures/generated.webm');
if(videoBytes.length<1000) throw new Error('VIDEO FIXTURE EMPTY');

await input.setInputFiles([{name:'generated.webm',mimeType:'video/webm',buffer:videoBytes}]);
await page.waitForFunction(()=>document.querySelectorAll('.nx-video-clip').length===2);
if(await page.locator('[data-main-video]').evaluate(el=>el.classList.contains('nx-video-hidden'))) throw new Error('VIDEO PREVIEW FAIL');
await page.waitForFunction(()=>{const v=document.querySelector('[data-main-video]');return Boolean(v&&v.readyState>=1&&Number.isFinite(v.duration)&&v.duration>0);},{timeout:8000});

await page.locator('.nx-video-clip').nth(1).locator('[data-select]').click();

await page.locator('[data-tool="audio"]').click();
await page.locator('[data-volume]').fill('0.7');
if(Math.abs(Number(await page.locator('[data-volume]').inputValue())-.7)>.001) throw new Error('AUDIO CONTROL FAIL');

await page.locator('[data-tool="speed"]').click();
await page.locator('[data-speed]').fill('1.5');
if(await page.locator('[data-speed]').inputValue()!=='1.5') throw new Error('SPEED FAIL');

await page.locator('[data-tool="transform"]').click();
await page.locator('[data-scale]').fill('1.25');
await page.locator('[data-rotation]').fill('15');
if(await page.locator('[data-scale]').inputValue()!=='1.25'||await page.locator('[data-rotation]').inputValue()!=='15') throw new Error('TRANSFORM FAIL');

await page.locator('[data-tool="motion"]').click();
await page.locator('[data-motion-end-scale]').fill('1.4');
await page.locator('[data-motion-end-rotation]').fill('12');
if(await page.locator('[data-motion-end-scale]').inputValue()!=='1.4'||await page.locator('[data-motion-end-rotation]').inputValue()!=='12') throw new Error('MOTION FAIL');

await page.locator('[data-tool="transitions"]').click();
await page.locator('[data-transition]').selectOption('fade');
await page.locator('[data-transition-duration]').fill('0.35');
if(await page.locator('[data-transition]').inputValue()!=='fade') throw new Error('TRANSITION FAIL');

await page.locator('[data-play]').click();
await page.waitForFunction(()=>document.querySelector('[data-current-time]').textContent!=='00:00',{timeout:5000});
await page.locator('[data-play]').click();

await page.locator('[data-tool="text"]').click();
await page.locator('[data-text]').fill('TEST TITLE');
await page.locator('[data-apply-text]').click();
if(await page.locator('[data-preview-text]').textContent()!=='TEST TITLE') throw new Error('TEXT OVERLAY FAIL');

await page.locator('[data-tool="captions"]').click();
await page.locator('[data-caption-start]').fill('0');
await page.locator('[data-caption-end]').fill('0.5');
await page.locator('[data-caption-text]').fill('Hello world');
await page.locator('[data-add-caption]').click();
if(await page.locator('.nx-video-caption-row').count()!==1) throw new Error('CAPTION FAIL');
await page.locator('[data-scrub]').fill('3.05');
if(!await page.locator('[data-preview-caption]').evaluate(el=>el.classList.contains('is-visible'))) throw new Error('LIVE CAPTION PREVIEW FAIL');
await page.locator('[data-scrub]').fill('3.01');

await page.locator('[data-scrub]').fill('0.5');
await page.locator('[data-tool="edit"]').click();
const beforeDuplicate=await page.locator('.nx-video-clip').count();
await page.locator('[data-duplicate]').click();
if(await page.locator('.nx-video-clip').count()!==beforeDuplicate+1) throw new Error('DUPLICATE FAIL');
await page.locator('[data-undo]').click();
if(await page.locator('.nx-video-clip').count()!==beforeDuplicate) throw new Error('UNDO DUPLICATE FAIL');
await page.locator('[data-reset]').click();
const before=await page.locator('.nx-video-clip').count();
await page.locator('[data-split]').click();
if(await page.locator('.nx-video-clip').count()!==before+1) throw new Error('SPLIT FAIL');
await page.locator('[data-undo]').click();
if(await page.locator('.nx-video-clip').count()!==before) throw new Error('UNDO FAIL');
await page.locator('[data-redo]').click();
if(await page.locator('.nx-video-clip').count()!==before+1) throw new Error('REDO FAIL');

const beforeDelete=await page.locator('.nx-video-clip').count();
await page.locator('[data-delete]').click();
if(await page.locator('.nx-video-clip').count()!==beforeDelete-1) throw new Error('DELETE FAIL');
await page.locator('[data-undo]').click();
if(await page.locator('.nx-video-clip').count()!==beforeDelete) throw new Error('UNDO DELETE RESTORE FAIL');

for(const [width,height] of [[360,800],[360,900],[390,844],[412,915]]){
  await page.setViewportSize({width,height});
  await page.waitForTimeout(50);
  const layout=await page.evaluate(()=>{
    const root=document.querySelector('.nx-video-flagship');
    const all=[...root.querySelectorAll('*')];
    const viewportOk=document.documentElement.scrollHeight<=innerHeight+2&&document.body.scrollHeight<=innerHeight+2;
    const rootNoScroll=root.scrollWidth<=root.clientWidth+2&&root.scrollHeight<=root.clientHeight+2;
    const toolbar=document.querySelector('.nx-video-toolbar');
    const toolbarNoScroll=!toolbar||toolbar.scrollWidth<=toolbar.clientWidth+2;
    const panels=[...document.querySelectorAll('.nx-video-panel.is-active')].every(el=>el.scrollHeight<=el.clientHeight+2&&el.scrollWidth<=el.clientWidth+2);
    const interactive=all.filter(el=>el.matches('button,input,select,textarea,[role="button"]')&&!el.matches('[data-file]')).every(el=>{const r=el.getBoundingClientRect();if(r.width<=0||r.height<=0)return true;return r.width>=44&&r.height>=44;});
    return {viewportOk,rootNoScroll,toolbarNoScroll,panels,interactive};
  });
  if(!layout.viewportOk||!layout.rootNoScroll||!layout.toolbarNoScroll||!layout.panels||!layout.interactive) throw new Error('RESPONSIVE/TAP TARGET FAIL '+width+'x'+height+' '+JSON.stringify(layout));
  await page.screenshot({path:`artifacts/video-browser/video-studio-${width}x${height}.png`,fullPage:false});
}
await page.setViewportSize({width:390,height:844});

await page.reload({waitUntil:'networkidle'});
await page.waitForSelector('.nx-video-flagship');
await page.locator('[data-file]').setInputFiles([{name:'photo.png',mimeType:'image/png',buffer:png}]);
await page.waitForFunction(()=>document.querySelectorAll('.nx-video-clip').length===1);
await page.locator('[data-out]').fill('0.4');
await page.locator('[data-out]').press('Enter');
await page.locator('[data-open-export]').click();
await page.waitForFunction(()=>document.querySelector('[data-export-result]')?.getAttribute('hidden')===null,{timeout:30000});
if(!(await page.locator('[data-export-preview]').getAttribute('src'))?.startsWith('blob:')) throw new Error('EXPORT PREVIEW URL FAIL');

const dlPromise=page.waitForEvent('download',{timeout:15000});
await page.locator('[data-share-export]').click();
const download=await dlPromise;
const path=await download.path();
if(!path||!fs.existsSync(path)||fs.statSync(path).size<100) throw new Error('EXPORT OUTPUT FAIL');
if(!download.suggestedFilename().endsWith('.webm')) throw new Error('EXPORT TYPE FAIL');
if(await page.locator('[data-export-result]').getAttribute('hidden')!==null) throw new Error('EXPORT PREVIEW FAIL');

if(errors.length) throw new Error('BROWSER ERRORS: '+errors.join(' | '));
console.log('VIDEO FLAGSHIP BROWSER RUNTIME QA PASS');
