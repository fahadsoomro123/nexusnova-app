import fs from 'node:fs';
import {spawn} from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: remove-bg-ml-v16-qa.mjs <chrome> <chromedriver> <server-port> <out-dir>');
fs.mkdirSync(outDir,{recursive:true});
const port=9534,log=fs.openSync(`${outDir}/chromedriver-remove-bg-v16.log`,'a'),driver=spawn(driverBinary,[`--port=${port}`,'--allowed-ips=127.0.0.1'],{stdio:['ignore',log,log]});
const delay=ms=>new Promise(r=>setTimeout(r,ms));let sid='';const checks=[];
async function cmd(method,path,body){const r=await fetch(`http://127.0.0.1:${port}${path}`,{method,headers:body===undefined?undefined:{'content-type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)}),raw=await r.text(),j=raw?JSON.parse(raw):{};if(!r.ok||j?.value?.error)throw new Error(`${method} ${path}: ${JSON.stringify(j.value||j)}`);return j.value}
async function ex(script,args=[]){return cmd('POST',`/session/${sid}/execute/sync`,{script,args})}
async function exa(script,args=[]){return cmd('POST',`/session/${sid}/execute/async`,{script,args})}
async function wait(script,label,timeout=16000){const st=Date.now();while(Date.now()-st<timeout){if(await ex(script))return;await delay(60)}throw new Error(`Timeout: ${label}`)}
function rec(name,pass,evidence=''){checks.push({name,pass:Boolean(pass),evidence:String(evidence)});if(!pass)console.error(`::error::${name}: ${evidence}`)}
async function expect(name,script){try{const v=await ex(script);rec(name,!!v,JSON.stringify(v));return!!v}catch(e){rec(name,false,e.message);return false}}
async function start(){for(let i=0;i<60;i++){try{if((await cmd('GET','/status'))?.ready)break}catch{}await delay(100)}const made=await cmd('POST','/session',{capabilities:{alwaysMatch:{browserName:'chrome','goog:chromeOptions':{binary:chromeBinary,args:['--headless=new','--no-sandbox','--disable-dev-shm-usage'],mobileEmulation:{deviceMetrics:{width:393,height:852,pixelRatio:1,mobile:true,touch:true}}}}}});sid=made.sessionId;await cmd('POST',`/session/${sid}/timeouts`,{pageLoad:20000,script:20000,implicit:0});await cmd('POST',`/session/${sid}/url`,{url:`http://127.0.0.1:${serverPort}/tools/ai-photo-flagship-qa/harness.html`});await wait('return document.documentElement.dataset.qaReady||document.documentElement.dataset.qaError||"";','harness',20000);const err=await ex('return document.documentElement.dataset.qaError||"";');if(err)throw new Error(err)}

try{
  await start();
  await expect('V16 Remove BG installer is active','return window.__qaRoot?.dataset.aiPhotoFlagship==="flagship-repair-v16"&&!!window.__qaRoot.__nxAiPhotoRemoveBgMlV16&&!!document.getElementById("nx-ai-photo-remove-bg-ml-v16");');
  const result=await exa(`
    const done=arguments[arguments.length-1];
    (async()=>{
      const text=await fetch('/fresh-rebuild/src/features/apps/ai-photo-remove-bg-ml-v16.js').then(r=>{if(!r.ok)throw new Error('source fetch '+r.status);return r.text()});
      const exposed=text+'\nexport { confidenceAlpha, categoryAlpha, applyMatte };';
      const url=URL.createObjectURL(new Blob([exposed],{type:'text/javascript'}));
      try{
        const mod=await import(url),w=24,h=24,n=w*h;
        const portrait=new Float32Array(n);
        for(let y=0;y<h;y++)for(let x=0;x<w;x++){
          const head=(x-12)*(x-12)+(y-6)*(y-6)<=16;
          const torso=x>=8&&x<=16&&y>=9&&y<=20;
          const armL=x>=5&&x<8&&y>=10&&y<=16;
          const armR=x>16&&x<=19&&y>=10&&y<=16;
          if(head||torso||armL||armR)portrait[y*w+x]=.97;
          else if((x>=7&&x<=17&&y>=8&&y<=21))portrait[y*w+x]=.22;
          else portrait[y*w+x]=.01;
        }
        const confidence=mod.confidenceAlpha({width:w,height:h,getAsFloat32Array:()=>portrait});
        let emptyRejected=false,fullRejected=false;
        try{mod.confidenceAlpha({width:w,height:h,getAsFloat32Array:()=>new Float32Array(n)})}catch{emptyRejected=true}
        try{mod.confidenceAlpha({width:w,height:h,getAsFloat32Array:()=>new Float32Array(n).fill(1)})}catch{fullRejected=true}
        const categories=new Uint8Array(n);for(let y=5;y<=20;y++)for(let x=6;x<=18;x++)categories[y*w+x]=1;
        const semantic=mod.categoryAlpha({width:w,height:h,getAsUint8Array:()=>categories});
        let semanticEmptyRejected=false;try{mod.categoryAlpha({width:w,height:h,getAsUint8Array:()=>new Uint8Array(n)})}catch{semanticEmptyRejected=true}
        const src=document.createElement('canvas');src.width=w;src.height=h;const sx=src.getContext('2d');sx.fillStyle='#ef4565';sx.fillRect(0,0,w,h);const matte=mod.applyMatte(src,confidence),px=matte.getContext('2d').getImageData(0,0,w,h).data;
        const alphaAt=(x,y)=>px[(y*w+x)*4+3];
        done({
          ok:true,
          confidenceCenter:confidence.alpha[14*w+12],confidenceCorner:confidence.alpha[0],confidenceCoverage:confidence.coverage,
          semanticCenter:semantic.alpha[14*w+12],semanticCorner:semantic.alpha[0],semanticCoverage:semantic.coverage,
          emptyRejected,fullRejected,semanticEmptyRejected,
          matteCenter:alphaAt(12,14),matteCorner:alphaAt(0,0),
          engines:[confidence.engine,semantic.engine]
        });
      }finally{URL.revokeObjectURL(url)}
    })().catch(e=>done({ok:false,error:e?.stack||String(e)}));
  `);
  rec('Production matte internals are executable',result?.ok,result?.error||JSON.stringify(result));
  if(result?.ok){
    rec('Portrait matte preserves head/body subject',result.confidenceCenter>.9&&result.matteCenter>220,JSON.stringify(result));
    rec('Portrait matte clears distant background',result.confidenceCorner<.08&&result.matteCorner<32,JSON.stringify(result));
    rec('Portrait coverage guard rejects empty and full-frame masks',result.emptyRejected&&result.fullRejected,JSON.stringify(result));
    rec('Semantic object matte preserves recognized object',result.semanticCenter>.9&&result.engines?.[1]==='Object AI',JSON.stringify(result));
    rec('Semantic object matte clears background',result.semanticCorner<.08,JSON.stringify(result));
    rec('Semantic coverage guard rejects empty masks',result.semanticEmptyRejected,JSON.stringify(result));
    rec('Portrait coverage stays in sane subject range',result.confidenceCoverage>.08&&result.confidenceCoverage<.75,JSON.stringify(result));
  }
}catch(e){rec('Uncaught Remove BG v16 QA',false,e?.stack||e)}
finally{if(sid)try{await cmd('DELETE',`/session/${sid}`)}catch{}driver.kill('SIGTERM');fs.closeSync(log)}
const failed=checks.filter(x=>!x.pass);fs.writeFileSync(`${outDir}/remove-bg-ml-v16-report.json`,JSON.stringify({generatedAt:new Date().toISOString(),summary:{total:checks.length,passed:checks.length-failed.length,failed:failed.length},checks},null,2));if(failed.length){console.error(`Remove BG ML v16 QA FAIL — ${failed.length}/${checks.length}`);process.exit(1)}console.log(`Remove BG ML v16 QA PASS — ${checks.length} checks passed.`);
