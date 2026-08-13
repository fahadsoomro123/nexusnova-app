/* NexusNova Documents Live v1
   Genuine local/browser document actions:
   - receipt image -> NexusNova AI analysis
   - image -> real PDF using pdf-lib in the browser
*/
(() => {
  'use strict';
  if (window.__nxDocumentsLiveV1) return;
  window.__nxDocumentsLiveV1 = true;

  const $ = id => document.getElementById(id);
  let pendingMode = '';
  let pdfLibPromise = null;

  function status(text) {
    const out = $('nxMegaDocOut');
    if (out) out.textContent = text;
  }

  function findButton(labelPart) {
    const wanted = labelPart.toLowerCase();
    return Array.from(document.querySelectorAll('#tab-mega-documents button')).find(button =>
      String(button.textContent || '').replace(/\s+/g,' ').trim().toLowerCase().includes(wanted)
    );
  }

  function claim(label,id,handler) {
    const button=findButton(label);
    if(!button || button.dataset.nxDocLive==='1') return false;
    button.id=id;
    button.dataset.nxDocLive='1';
    button.addEventListener('click',event=>{
      event.preventDefault();
      event.stopPropagation();
      handler();
    });
    return true;
  }

  function selectFor(mode) {
    const input=$('nxMegaDoc');
    if(!input) return alert('Document picker is unavailable.');
    pendingMode=mode;
    if(mode==='receipt') input.accept='image/jpeg,image/png,image/webp';
    else if(mode==='pdf') input.accept='image/*';
    input.click();
  }

  function openAI() {
    if(typeof window.openMoreTab==='function') window.openMoreTab('ai');
    else window.switchTab?.('ai',null);
  }

  function transferToAI(file) {
    const target=$('aiImageInput');
    if(!target) throw new Error('AI image input is unavailable.');
    if(typeof DataTransfer==='undefined') throw new Error('This browser cannot hand the selected image to AI automatically.');
    const dt=new DataTransfer();
    dt.items.add(file);
    target.files=dt.files;
    window.handleAIImage?.(target);
    return target;
  }

  function analyzeReceipt(file) {
    if(!file || !/^image\//i.test(file.type)) {
      status('Choose a receipt photo (JPG, PNG or WebP).');
      return;
    }
    try {
      transferToAI(file);
      openAI();
      const input=$('aiInput');
      if(!input || typeof window.sendAIMessage!=='function') throw new Error('NexusNova AI is not ready.');
      input.value='Analyze this receipt image. Extract merchant/store, date, currency, subtotal, tax, total, payment method if visible, and item lines if readable. Do not invent unreadable values; mark them unclear.';
      window.sendAIMessage();
      status('Receipt sent to NexusNova AI for real image analysis.');
    } catch(error) {
      console.warn('Receipt analysis:',error);
      status(error.message || 'Receipt analysis could not start.');
    }
  }

  function loadPdfLib() {
    if(window.PDFLib?.PDFDocument) return Promise.resolve(window.PDFLib);
    if(pdfLibPromise) return pdfLibPromise;
    pdfLibPromise=new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-nx-pdf-lib]');
      if(existing){
        existing.addEventListener('load',()=>window.PDFLib?.PDFDocument?resolve(window.PDFLib):reject(new Error('PDF library did not initialize.')),{once:true});
        existing.addEventListener('error',()=>reject(new Error('PDF library failed to load.')),{once:true});
        return;
      }
      const script=document.createElement('script');
      script.src='https://cdn.jsdelivr.net/npm/pdf-lib@1.17.1/dist/pdf-lib.min.js';
      script.setAttribute('data-nx-pdf-lib','1');
      script.onload=()=>window.PDFLib?.PDFDocument?resolve(window.PDFLib):reject(new Error('PDF library did not initialize.'));
      script.onerror=()=>reject(new Error('PDF library failed to load.'));
      document.head.appendChild(script);
    }).finally(()=>{ pdfLibPromise=null; });
    return pdfLibPromise;
  }

  async function imageAsPngBytes(file) {
    if(file.type==='image/png') return await file.arrayBuffer();
    const url=URL.createObjectURL(file);
    try {
      const image=await new Promise((resolve,reject)=>{
        const img=new Image();
        img.onload=()=>resolve(img);
        img.onerror=()=>reject(new Error('Image could not be decoded.'));
        img.src=url;
      });
      const maxSide=2400;
      const scale=Math.min(1,maxSide/Math.max(image.naturalWidth||1,image.naturalHeight||1));
      const width=Math.max(1,Math.round(image.naturalWidth*scale));
      const height=Math.max(1,Math.round(image.naturalHeight*scale));
      const canvas=document.createElement('canvas');
      canvas.width=width;canvas.height=height;
      const ctx=canvas.getContext('2d');
      if(!ctx) throw new Error('Canvas is unavailable.');
      ctx.drawImage(image,0,0,width,height);
      const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/png',0.95));
      if(!blob) throw new Error('Image conversion failed.');
      return await blob.arrayBuffer();
    } finally {
      URL.revokeObjectURL(url);
    }
  }

  async function makePdf(file) {
    if(!file || !/^image\//i.test(file.type)) {
      status('Choose an image to convert into PDF.');
      return;
    }
    if(file.size>20*1024*1024) {
      status('Please choose an image smaller than 20 MB.');
      return;
    }
    status('Creating real PDF locally…');
    try {
      const {PDFDocument}=await loadPdfLib();
      const pdf=await PDFDocument.create();
      let image;
      if(file.type==='image/jpeg') image=await pdf.embedJpg(await file.arrayBuffer());
      else image=await pdf.embedPng(await imageAsPngBytes(file));

      const maxW=595.28,maxH=841.89,margin=24;
      const scale=Math.min((maxW-margin*2)/image.width,(maxH-margin*2)/image.height,1);
      const drawW=image.width*scale,drawH=image.height*scale;
      const page=pdf.addPage([maxW,maxH]);
      page.drawImage(image,{x:(maxW-drawW)/2,y:(maxH-drawH)/2,width:drawW,height:drawH});
      const bytes=await pdf.save();
      const blob=new Blob([bytes],{type:'application/pdf'});
      const url=URL.createObjectURL(blob);
      const link=document.createElement('a');
      const base=String(file.name||'document').replace(/\.[^.]+$/,'').replace(/[^a-z0-9._-]+/gi,'-')||'document';
      link.href=url;
      link.download=`${base}.pdf`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(()=>URL.revokeObjectURL(url),1500);
      status(`PDF created locally from ${file.name}.`);
    } catch(error) {
      console.error('NexusNova PDF maker:',error);
      status(error.message || 'PDF creation failed.');
    }
  }

  function onDocumentChange() {
    const input=$('nxMegaDoc');
    const file=input?.files?.[0];
    if(!file || !pendingMode) return;
    const mode=pendingMode;
    pendingMode='';
    if(mode==='receipt') analyzeReceipt(file);
    if(mode==='pdf') makePdf(file);
  }

  function install() {
    const input=$('nxMegaDoc');
    if(!input || !$('tab-mega-documents')) return;
    if(!input.dataset.nxDocLiveChange){
      input.dataset.nxDocLiveChange='1';
      input.addEventListener('change',onDocumentChange);
    }
    claim('Receipt Scanner','nxReceiptScannerLive',()=>selectFor('receipt'));
    claim('PDF Maker','nxPdfMakerLive',()=>{
      const file=input.files?.[0];
      if(file && /^image\//i.test(file.type)) makePdf(file);
      else selectFor('pdf');
    });
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',()=>setTimeout(install,1400),{once:true});
  else setTimeout(install,1400);
  [2400,4200,7000].forEach(ms=>setTimeout(install,ms));
})();