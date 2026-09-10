import { NEXUSNOVA_TEMPLATES } from './data/ai-photo-templates.js';

const PHOTO_SPRITE='./assets/visuals/ai-photo-locked-featured.webp';

function slotFor(templateId,elementId,index){
  const text=`${templateId}|${elementId}|${index}`;
  let hash=2166136261;
  for(let i=0;i<text.length;i+=1){
    hash^=text.charCodeAt(i);
    hash=Math.imul(hash,16777619);
  }
  return (hash>>>0)%4;
}

export function hydrateAiPhotoTemplatePhotos(){
  let hydrated=0;
  for(const template of NEXUSNOVA_TEMPLATES){
    const elements=Array.isArray(template?.elements)?template.elements:[];
    for(let index=0;index<elements.length;index+=1){
      const element=elements[index];
      if(!element||element.type!=='photo'||element.src)continue;
      const slot=slotFor(template.id,element.id,index);
      element.src=PHOTO_SPRITE;
      if(!element.sourceCrop)element.sourceCrop={x:slot/4,y:0,w:.25,h:1};
      if(!element.label||element.label==='REPLACE PHOTO')element.label='PHOTO';
      hydrated+=1;
    }
  }
  return hydrated;
}
