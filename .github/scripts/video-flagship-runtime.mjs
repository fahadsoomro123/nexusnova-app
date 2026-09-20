import { chromium } from 'playwright';
import fs from 'node:fs';

const browser=await chromium.launch({headless:true});
const page=await browser.newPage({viewport:{width:390,height:844}});
const errors=[];
page.on('pageerror',e=>errors.push(e.message));
page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});
await page.goto('http://127.0.0.1:4173/video-runtime-harness.html',{waitUntil:'networkidle'});
await page.waitForSelector('.nx-video-flagship');

const ok=await page.evaluate(()=>{
  const u=window.__videoRoot.__videoTestUtils;
  const image=new File(['x'],'photo.png',{type:'image/png'});
  const video=new File(['x'],'clip.webm',{type:'video/webm'});
  return {
    image:u.normalizeImportKind(image)==='image',
    video:u.normalizeImportKind(video)==='video',
    timeline:u.mapTimeline([{id:'a',in:0,out:2,speed:1},{id:'b',in:0,out:1,speed:1}],2.2).clipId==='b',
    motion:Math.abs(u.interpolateMotion({in:0,out:2,speed:1,motionStartScale:1,motionEndScale:1.4,motionStartRotation:0,motionEndRotation:20},1).scale-1.2)<0.01,
    srt:u.parseSrt('1\\n00:00:00,000 --> 00:00:01,000\\nHello').length===1
  };
});
if(!Object.values(ok).every(Boolean)) throw new Error('UTILITY QA FAIL');

const input=page.locator('[data-file]');
const png=fs.readFileSync('fixtures/tiny.png');
const webm=fs.readFileSync('fixtures/sample.webm');
await input.setInputFiles([{name:'photo.png',mimeType:'image/png',buffer:png}]);
await page.waitForFunction(()=>document.querySelectorAll('.nx-video-clip').length===1);
if(await page.locator('[data-main-image]').evaluate(el=>el.classList.contains('nx-video-hidden'))) throw new Error('PHOTO PREVIEW FAIL');

await input.setInputFiles([{name:'sample.webm',mimeType:'video/webm',buffer:webm}]);
await page.waitForFunction(()=>document.querySelectorAll('.nx-video-clip').length===2);

await page.locator('.nx-video-clip').nth(1).locator('[data-select]').click();
await page.locator('[data-tool="speed"]').click();
await page.locator('[data-speed]').fill('1.5');
if(await page.locator('[data-speed]').inputValue()!=='1.5') throw new Error('SPEED FAIL');

await page.locator('[data-tool="motion"]').click();
await page.locator('[data-motion-end-scale]').fill('1.4');
if(await page.locator('[data-motion-end-scale]').inputValue()!=='1.4') throw new Error('MOTION FAIL');

await page.locator('[data-tool="captions"]').click();
await page.locator('[data-caption-start]').fill('0');
await page.locator('[data-caption-end]').fill('0.5');
await page.locator('[data-caption-text]').fill('Hello');
await page.locator('[data-add-caption]').click();
if(await page.locator('.nx-video-caption-row').count()!==1) throw new Error('CAPTION FAIL');

await page.locator('[data-scrub]').fill('0.5');
await page.locator('[data-tool="edit"]').click();
const before=await page.locator('.nx-video-clip').count();
await page.locator('[data-split]').click();
if(await page.locator('.nx-video-clip').count()!==before+1) throw new Error('SPLIT FAIL');
await page.locator('[data-undo]').click();
await page.locator('[data-redo]').click();
if(await page.locator('.nx-video-clip').count()!==before+1) throw new Error('UNDO REDO FAIL');

const noScroll=await page.evaluate(()=>document.documentElement.scrollHeight<=innerHeight+2&&document.body.scrollHeight<=innerHeight+2);
if(!noScroll) throw new Error('NO SCROLL FAIL');

await browser.close();
if(errors.length) throw new Error('BROWSER ERROR: '+errors.join(' | '));
console.log('VIDEO FLAGSHIP CANDIDATE QA PASS');