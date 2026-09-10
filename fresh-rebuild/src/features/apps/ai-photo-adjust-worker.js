import {renderFinal} from './ai-photo-adjust-renderer.js';
let source=null,sourceUrl='',committed=null,committedKey='';
let queue=Promise.resolve();
onmessage=({data})=>{queue=queue.then(()=>run(data))};
async function run(data){
  const {id,url,state,options={},kind,type,quality}=data;
  try{
    if(url!==sourceUrl){const next=await createImageBitmap(await (await fetch(url)).blob());source?.close();source=next;sourceUrl=url;committed=null;committedKey=''}
    // A task boundary lets pending messages and teardown run before allocating output.
    await new Promise(resolve=>setTimeout(resolve,0));
    const key=JSON.stringify(state);
    if(kind==='preview'){
      const canvas=renderFinal(source,state,options),bitmap=canvas.transferToImageBitmap();postMessage({id,bitmap},[bitmap]);return;
    }
    if(!committed||committedKey!==key){committed=renderFinal(source,state,{maxDim:Infinity});committedKey=key}
    if(kind==='export')postMessage({id,blob:await committed.convertToBlob({type,quality}),width:committed.width,height:committed.height});
    else postMessage({id,width:committed.width,height:committed.height});
  }catch(error){postMessage({id,error:String(error?.message||error)})}
};
