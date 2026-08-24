import { firebaseApp } from '../../core/firebase-backend.js';
import { documentsSuiteRenderers } from './documents-suite.js';

let modelPromise=null,pdfPromise=null;
async function model(){
  if(!modelPromise) modelPromise=import('https://www.gstatic.com/firebasejs/12.1.0/firebase-ai.js').then(ai=>ai.getGenerativeModel(ai.getAI(firebaseApp,{backend:new ai.GoogleAIBackend()}),{model:'gemini-3.6-flash',systemInstruction:{parts:[{text:'Analyze only visible document or receipt content. Never invent unreadable values.'}]},generationConfig:{temperature:.2,maxOutputTokens:1000}})).catch(e=>{modelPromise=null;throw e;});
  return modelPromise;
}
function inline(file){return new Promise((resolve,reject)=>{const r=new FileReader();r.onerror=()=>reject(r.error||new Error('Could not read image.'));r.onload=()=>{const s=String(r.result||''),i=s.indexOf(',');i<0?reject(new Error('Invalid image data.')):resolve({mimeType:file.type,data:s.slice(i+1)});};r.readAsDataURL(file);});}
function pdfLib(){
  if(window.PDFLib?.PDFDocument)return Promise.resolve(window.PDFLib);
  if(pdfPromise)return pdfPromise;
  pdfPromise=new Promise((resolve,reject)=>{const s=document.createElement('script');s.src='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';s.onload=()=>window.PDFLib?.PDFDocument?resolve(window.PDFLib):reject(new Error('PDF library did not initialize.'));s.onerror=()=>reject(new Error('PDF library failed to load.'));document.head.appendChild(s);}).finally(()=>{pdfPromise=null;});return pdfPromise;
}
async function asPng(file){
  if(file.type==='image/png')return file.arrayBuffer();
  const url=URL.createObjectURL(file);
  try{const img=await new Promise((res,rej)=>{const i=new Image();i.onload=()=>res(i);i.onerror=()=>rej(new Error('Image could not be decoded.'));i.src=url;});const scale=Math.min(1,2400/Math.max(img.naturalWidth||1,img.naturalHeight||1)),c=document.createElement('canvas');c.width=Math.max(1,Math.round(img.naturalWidth*scale));c.height=Math.max(1,Math.round(img.naturalHeight*scale));const ctx=c.getContext('2d');if(!ctx)throw new Error('Canvas unavailable.');ctx.drawImage(img,0,0,c.width,c.height);const blob=await new Promise(res=>c.toBlob(res,'image/png',.95));if(!blob)throw new Error('Image conversion failed.');return blob.arrayBuffer();}finally{URL.revokeObjectURL(url);}
}
async function makePdfBlob(file){
  const {PDFDocument}=await pdfLib(),pdf=await PDFDocument.create();
  const image=file.type==='image/jpeg'?await pdf.embedJpg(await file.arrayBuffer()):await pdf.embedPng(await asPng(file));
  const W=595.28,H=841.89,m=24,scale=Math.min((W-m*2)/image.width,(H-m*2)/image.height,1),w=image.width*scale,h=image.height*scale,page=pdf.addPage([W,H]);
  page.drawImage(image,{x:(W-w)/2,y:(H-h)/2,width:w,height:h});
  return new Blob([await pdf.save()],{type:'application/pdf'});
}
function downloadPdf(blob,file){
  const url=URL.createObjectURL(blob),a=document.createElement('a'),base=String(file.name||'document').replace(/\.[^.]+$/,'').replace(/[^a-z0-9._-]+/gi,'-')||'document';
  a.href=url;a.download=`${base}.pdf`;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1500);
}

export function renderDocumentsLiveSuite(){
  const root=documentsSuiteRenderers.documents(),panel=document.createElement('section');panel.className='nx-tool-card';
  panel.innerHTML=`<strong>Smart Document Actions</strong><p class="nx-tool-meta">Receipt analysis uses real Nova AI. PDF Maker runs locally. Unreadable values are never invented.</p><label class="nx-file-picker"><input type="file" accept="image/jpeg,image/png,image/webp" data-live-file><strong>Choose receipt / image</strong><span>JPG, PNG or WebP • PDF Maker max 20 MB</span></label><div class="nx-two-col"><button class="nx-primary" type="button" data-receipt>ANALYZE RECEIPT</button><button type="button" data-pdf>IMAGE → PDF</button></div><p class="nx-tool-meta" data-live-status>No image selected.</p><article class="nx-list-card" data-live-result hidden><strong>Receipt Analysis</strong><p></p></article>`;
  root.prepend(panel);
  const input=panel.querySelector('[data-live-file]'),status=panel.querySelector('[data-live-status]'),result=panel.querySelector('[data-live-result]'),receiptButton=panel.querySelector('[data-receipt]'),pdfButton=panel.querySelector('[data-pdf]');
  const baseCleanup=root.__cleanup;
  let active=true,revision=0,receiptBusy=false,pdfBusy=false;
  const same=(current,file)=>active&&current===revision&&input.files?.[0]===file;
  const paintBusy=()=>{if(!active)return;receiptButton.disabled=receiptBusy;pdfButton.disabled=pdfBusy;};

  input.addEventListener('change',()=>{
    revision+=1;
    result.hidden=true;
    result.querySelector('p').textContent='';
    const f=input.files?.[0];
    status.textContent=f?`${f.name} • ${(f.size/1024/1024).toFixed(2)} MB`:'No image selected.';
  });

  receiptButton.addEventListener('click',async()=>{
    const f=input.files?.[0];
    if(!f||!/^image\/(jpeg|png|webp)$/i.test(f.type)){status.textContent='Choose a JPG, PNG or WebP receipt first.';return;}
    if(receiptBusy)return;
    const current=revision;
    receiptBusy=true;paintBusy();status.textContent='Analyzing receipt with Nova AI…';result.hidden=true;
    try{
      const [m,d]=await Promise.all([model(),inline(f)]);
      if(!same(current,f))return;
      const r=await m.generateContent([{inlineData:d},{text:'Analyze this receipt image. Extract merchant/store, date, currency, subtotal, tax, total, payment method if visible, and item lines if readable. Do not invent unreadable values; mark them unclear.'}]);
      if(!same(current,f))return;
      const text=String(r?.response?.text?.()||'').trim();if(!text)throw new Error('AI returned no receipt analysis.');
      result.querySelector('p').textContent=text;result.hidden=false;status.textContent='Receipt analysis complete.';
    }catch(e){if(same(current,f))status.textContent=/app.?check|403|permission/i.test(String(e?.message||''))?'Receipt AI was blocked by Firebase App Check / provider configuration.':String(e?.message||'Receipt analysis unavailable.').slice(0,260);}
    finally{receiptBusy=false;paintBusy();}
  });

  pdfButton.addEventListener('click',async()=>{
    const f=input.files?.[0];
    if(!f||!/^image\//i.test(f.type)){status.textContent='Choose an image first.';return;}
    if(f.size>20*1024*1024){status.textContent='Choose an image smaller than 20 MB.';return;}
    if(pdfBusy)return;
    const current=revision;
    pdfBusy=true;paintBusy();status.textContent='Creating real PDF locally…';
    try{const blob=await makePdfBlob(f);if(!same(current,f))return;downloadPdf(blob,f);status.textContent=`PDF created locally from ${f.name}.`;}
    catch(e){if(same(current,f))status.textContent=String(e?.message||'PDF creation failed.').slice(0,260);}
    finally{pdfBusy=false;paintBusy();}
  });

  root.__cleanup=()=>{
    active=false;
    revision+=1;
    try{input.value='';}catch{}
    baseCleanup?.();
  };
  return root;
}
export const documentsLiveRenderers=Object.freeze({documents:renderDocumentsLiveSuite});
