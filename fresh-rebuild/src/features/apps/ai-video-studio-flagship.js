const CORE_MODULE = './premium-studio-core.js';

async function getCore(){
  try { return await import(CORE_MODULE); }
  catch (error) { console.warn('[NexusNova Video] optional studio core unavailable:', error); return null; }
}
function downloadBlob(blob,name){
  const url=URL.createObjectURL(blob);
  const a=document.createElement('a');
  a.href=url;
  a.download=String(name||'nexusnova-export').replace(/[^a-z0-9._-]+/gi,'-');
  document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>{try{URL.revokeObjectURL(url)}catch{}},1800);
}
function safeName(value,fallback='nexusnova'){
  return (String(value||fallback).replace(/\.[^.]+$/,'').replace(/[^a-z0-9._-]+/gi,'-').replace(/^-+|-+$/g,'')||fallback).slice(0,80);
}
function fileToInline(file,maxMb=15){
  if(!file) return Promise.reject(new Error('Choose a file first.'));
  if(file.size>maxMb*1024*1024) return Promise.reject(new Error(`File must be ${maxMb} MB or smaller.`));
  return new Promise((resolve,reject)=>{
    const reader=new FileReader();
    reader.onerror=()=>reject(reader.error||new Error('File read failed.'));
    reader.onload=()=>{
      const value=String(reader.result||''),comma=value.indexOf(',');
      if(comma<0)return reject(new Error('Invalid file data.'));
      resolve({mimeType:file.type||'application/octet-stream',data:value.slice(comma+1)});
    };
    reader.readAsDataURL(file);
  });
}
async function aiModel(systemInstruction){
  const core=await getCore();
  if(!core?.aiModel) throw new Error('AI provider is unavailable.');
  return core.aiModel(systemInstruction);
}

const STYLE_ID = 'nx-video-flagship-v1';
const DEFAULT_DUR = 3;

function ensureVideoFlagshipStyles() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');