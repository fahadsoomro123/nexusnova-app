import fs from 'node:fs';
import { spawn } from 'node:child_process';

const [chromeBinary,driverBinary,serverPort,outDir]=process.argv.slice(2);
if(!chromeBinary||!driverBinary||!serverPort||!outDir)throw new Error('Usage: render-qa.mjs <chrome> <chromedriver> <server-port> <output-dir>');

const driverPort=9515;
const driverLog=fs.openSync(outDir+'/chromedriver.log','a');
const driver=spawn(driverBinary,['--port='+driverPort,'--allowed-ips=127.0.0.1'],{
  stdio:['ignore',driverLog,driverLog]
});
let sessionId='';

const delay=(ms)=>new Promise((resolve)=>setTimeout(resolve,ms));
async function command(method,path,body){
  const response=await fetch('http://127.0.0.1:'+driverPort+path,{
    method,
    headers:body===undefined?undefined:{'content-type':'application/json'},
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const raw=await response.text();
  let parsed={};
  try{parsed=raw?JSON.parse(raw):{}}catch{throw new Error(method+' '+path+' returned invalid JSON: '+raw.slice(0,300))}
  if(!response.ok||parsed?.value?.error)throw new Error(method+' '+path+' failed: '+JSON.stringify(parsed.value||parsed));
  return parsed.value;
}
async function waitForDriver(){
  for(let attempt=0;attempt<50;attempt++){
    try{
      const status=await command('GET','/status');
      if(status?.ready)return;
    }catch{}
    await delay(100);
  }
  throw new Error('ChromeDriver did not become ready');
}
async function execute(script){
  return command('POST','/session/'+sessionId+'/execute/sync',{script,args:[]});
}
async function quit(){
  if(!sessionId)return;
  try{await command('DELETE','/session/'+sessionId)}catch{}
  sessionId='';
}

await waitForDriver();
const sizes=[[360,640],[360,740],[393,852],[415,858],[430,865]];
const screens=['home','generator'];
let failed=false;

for(const [width,height] of sizes){
  for(const screen of screens){
    const size=width+'x'+height;
    const base=outDir+'/'+screen+'-'+size;
    try{
      const created=await command('POST','/session',{
        capabilities:{
          alwaysMatch:{
            browserName:'chrome',
            pageLoadStrategy:'normal',
            'goog:chromeOptions':{
              binary:chromeBinary,
              args:[
                '--headless=new',
                '--no-sandbox',
                '--disable-dev-shm-usage',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-extensions',
                '--disable-features=Translate',
                '--force-color-profile=srgb',
                '--hide-scrollbars'
              ],
              mobileEmulation:{
                deviceMetrics:{width,height,pixelRatio:1,mobile:true,touch:true}
              }
            }
          }
        }
      });
      sessionId=created.sessionId;
      await command('POST','/session/'+sessionId+'/timeouts',{pageLoad:15000,script:15000,implicit:0});
      await command('POST','/session/'+sessionId+'/url',{
        url:'http://127.0.0.1:'+serverPort+'/tools/ai-photo-locked-visual/harness.html?screen='+screen
      });
      let ready='';
      for(let attempt=0;attempt<80;attempt++){
        ready=await execute('return document.documentElement.dataset.qaReady || "";');
        if(ready)break;
        await delay(100);
      }
      if(!ready)throw new Error('harness did not publish qaReady');
      const report=JSON.parse(await execute('return document.getElementById("qa-metrics").textContent;'));
      const html=await execute('return document.documentElement.outerHTML;');
      const png=await command('GET','/session/'+sessionId+'/screenshot');
      fs.writeFileSync(base+'.json',JSON.stringify(report,null,2)+'\n');
      fs.writeFileSync(base+'.html',html);
      fs.writeFileSync(base+'.png',Buffer.from(png,'base64'));
      if(report.viewport.width!==width||report.viewport.height!==height){
        report.pass=false;
        report.errors.push('emulated viewport mismatch: '+report.viewport.width+'x'+report.viewport.height);
        fs.writeFileSync(base+'.json',JSON.stringify(report,null,2)+'\n');
      }
      if(!report.pass){
        failed=true;
        console.error('::error::'+screen+' '+size+' rendered QA failed: '+report.errors.join('; '));
      }else{
        console.log('RENDER PASS — '+screen+' '+size);
      }
    }catch(error){
      failed=true;
      fs.writeFileSync(base+'.error.log',String(error?.stack||error)+'\n');
      console.error('::error::'+screen+' '+size+' render failed: '+String(error?.message||error));
    }finally{
      await quit();
    }
  }
}

driver.kill('SIGTERM');
fs.closeSync(driverLog);
if(failed)process.exit(1);
console.log('Rendered visual QA PASS — Home and Generator fit all five Android viewport contracts.');
