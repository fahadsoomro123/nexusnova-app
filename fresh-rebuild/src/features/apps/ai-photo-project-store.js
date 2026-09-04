const KEY='nx_design_projects_v1';
const clone=v=>JSON.parse(JSON.stringify(v));
function readAll(){try{return JSON.parse(localStorage.getItem(KEY)||'{}')}catch{return{}}}
function writeAll(v){localStorage.setItem(KEY,JSON.stringify(v))}

export function saveDesignProject(design){
  if(!design?.id)throw new Error('Project id required');const all=readAll(),copy=clone(design);copy.updatedAt=Date.now();copy.selection=[];all[copy.id]=copy;writeAll(all);return clone(copy);
}
export function loadDesignProject(id){const p=readAll()[id];return p?clone(p):null}
export function deleteDesignProject(id){const all=readAll();delete all[id];writeAll(all)}
export function listDesignProjects(){return Object.values(readAll()).sort((a,b)=>(b.updatedAt||0)-(a.updatedAt||0)).map(p=>({id:p.id,name:p.name||'Untitled',width:p.width,height:p.height,updatedAt:p.updatedAt||0,elements:p.elements?.length||0}))}
export function createProjectAutosave(getDesign,{delay=700,onSaved=()=>{}}={}){
  let timer=0,destroyed=false;
  return {
    schedule(){if(destroyed)return;clearTimeout(timer);timer=setTimeout(()=>{timer=0;const d=getDesign?.();if(!d)return;try{onSaved(saveDesignProject(d))}catch{}},delay)},
    flush(){if(destroyed)return;clearTimeout(timer);timer=0;const d=getDesign?.();if(d)return saveDesignProject(d)},
    destroy(){destroyed=true;clearTimeout(timer);timer=0}
  };
}
