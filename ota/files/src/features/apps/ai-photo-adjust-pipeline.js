// Independent preview and full-resolution workers prevent idle commits delaying a drag.
export function createAdjustPipeline(){
  let serial=0,timer=0,disposed=false,previewWorker=null,fullWorker=null,pendingPreview=null,previewBusy=false;
  const pending=new Map();
  function worker(full){
    const current=full?fullWorker:previewWorker;if(current)return current;
    const instance=new Worker(new URL('./ai-photo-adjust-worker.js',import.meta.url),{type:'module'});
    instance.onmessage=({data})=>{const job=pending.get(data.id);if(!job){data.bitmap?.close();return}pending.delete(data.id);data.error?job.reject(new Error(data.error)):job.resolve(data)};
    instance.onerror=()=>{for(const [id,job]of pending)if(job.worker===instance){job.reject(new Error('Photo worker unavailable'));pending.delete(id)}};
    if(full)fullWorker=instance;else previewWorker=instance;return instance;
  }
  function send(full,payload){if(disposed)return Promise.reject(new DOMException('Editor closed','AbortError'));return new Promise((resolve,reject)=>{try{const w=worker(full),id=++serial;pending.set(id,{resolve,reject,worker:w});w.postMessage({id,...payload})}catch(e){reject(e)}})}
  async function drain(){if(previewBusy||!pendingPreview)return;previewBusy=true;const job=pendingPreview;pendingPreview=null;try{const result=await send(false,job.payload);job.resolve(result.bitmap)}catch(e){job.reject(e)}finally{previewBusy=false;drain()}}
  function cancelFull(){clearTimeout(timer);timer=0;if(fullWorker){for(const[id,job]of pending)if(job.worker===fullWorker){job.reject(new DOMException('Superseded edit','AbortError'));pending.delete(id)}fullWorker.terminate();fullWorker=null}}
  return{
    preview(image,state,options){return new Promise((resolve,reject)=>{pendingPreview?.reject(new DOMException('Superseded preview','AbortError'));pendingPreview={resolve,reject,payload:{url:image.src,state:structuredClone(state),options,kind:'preview'}};drain()})},
    scheduleCommit(image,state){cancelFull();const snapshot=structuredClone(state),url=image.src;timer=setTimeout(()=>{timer=0;send(true,{url,state:snapshot,kind:'commit'}).catch(()=>{})},500)},
    async export(image,state,type,quality){clearTimeout(timer);timer=0;const result=await send(true,{url:image.src,state:structuredClone(state),kind:'export',type,quality});return result.blob},
    dispose(){disposed=true;clearTimeout(timer);previewWorker?.terminate();fullWorker?.terminate();for(const job of pending.values())job.reject(new DOMException('Editor closed','AbortError'));pending.clear();pendingPreview?.reject(new DOMException('Editor closed','AbortError'));pendingPreview=null}
  };
}
