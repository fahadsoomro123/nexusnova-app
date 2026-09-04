const CATEGORY_SPECS=[
  ['logos',1080,1080,'Logo'],['instagram-posts',1080,1080,'Instagram'],['instagram-stories',1080,1920,'Story'],['facebook-posts',1200,630,'Facebook'],['youtube-thumbnails',1280,720,'YouTube'],['youtube-banners',2560,1440,'Channel'],['flyers',1240,1754,'Flyer'],['posters',1240,1754,'Poster'],['business-cards',1050,600,'Business'],['invitations',1400,1000,'Invitation'],['certificates',1600,1131,'Certificate'],['resumes',1240,1754,'Resume'],['presentations',1920,1080,'Presentation'],['product-promos',1080,1080,'Product'],['menus',1240,1754,'Menu'],['brochures',1754,1240,'Brochure'],['event-covers',1920,1080,'Event'],['quotes',1080,1080,'Quote'],['ads',1200,628,'Ad'],['web-hero',1600,900,'Website']
];
const PALETTES=[
  ['#0b1020','#6d5dfc','#ffffff','#a8b3cf'],['#101820','#ffb000','#fff8e8','#d4dae6'],['#17121f','#c43cff','#fff7ff','#cdb8d8'],['#07251d','#24d18f','#f3fff9','#a7d7c6'],['#24140a','#ff7a1a','#fff6ed','#e4c1a7'],['#081b2d','#2aa8ff','#f2f9ff','#a9cbe2'],['#201010','#ff4d67','#fff5f6','#e3b7bd'],['#161616','#d6ff3f','#ffffff','#bdbdbd']
];

const clone=v=>JSON.parse(JSON.stringify(v));
const pct=n=>Math.max(0,Math.min(1,n));

function templateElements(index,label,palette){
  const [bg,accent,text,muted]=palette;
  const variant=index%10;
  const title=`${label} ${String(index+1).padStart(2,'0')}`;
  const subtitle=['Bold ideas. Clear message.','Designed for modern brands.','Make the first look count.','Simple. Premium. Memorable.','Your message, beautifully framed.'][index%5];
  const corner=variant%2?.08:.16;
  const accentX=variant%3===0?.08:variant%3===1?.64:.34;
  return [
    {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true},
    {id:'accent',type:variant%4===0?'circle':'rect',x:pct(accentX),y:.08,w:.26,h:.18,fill:accent,opacity:.95,radius:.08,rotation:(variant-4)*2},
    {id:'title',type:'text',x:.08,y:.36,w:.84,h:.18,text:title,fill:text,fontFamily:'system-ui',fontWeight:800,fontSize:.088,align:variant%2?'left':'center',letterSpacing:.01},
    {id:'subtitle',type:'text',x:.12,y:.57,w:.76,h:.12,text:subtitle,fill:muted,fontFamily:'system-ui',fontWeight:500,fontSize:.034,align:variant%2?'left':'center',lineHeight:1.25},
    {id:'rule',type:'rect',x:.08,y:.76,w:variant%2?.34:.84,h:.012,fill:accent,radius:corner},
    {id:'tag',type:'text',x:.08,y:.82,w:.84,h:.08,text:'NEXUSNOVA TEMPLATE',fill:muted,fontFamily:'system-ui',fontWeight:700,fontSize:.022,align:variant%2?'left':'center',letterSpacing:.08}
  ];
}

function buildTemplate(category,width,height,label,index){
  const palette=PALETTES[(index+CATEGORY_SPECS.findIndex(x=>x[0]===category))%PALETTES.length];
  return {
    id:`nx-${category}-${String(index+1).padStart(3,'0')}`,
    name:`${label} Template ${index+1}`,
    category,
    tags:[category,label.toLowerCase(),'premium','modern',index%2?'dark':'clean',index%3?'minimal':'bold'],
    canvas:{width,height},
    background:palette[0],
    elements:templateElements(index,label,palette)
  };
}

export const NEXUSNOVA_TEMPLATE_CATEGORIES=Object.freeze(CATEGORY_SPECS.map(([id,, ,label])=>({id,label})));
export const NEXUSNOVA_TEMPLATES=Object.freeze(CATEGORY_SPECS.flatMap(([category,width,height,label])=>Array.from({length:50},(_,i)=>buildTemplate(category,width,height,label,i))));

export function getTemplateById(id){
  const t=NEXUSNOVA_TEMPLATES.find(x=>x.id===id);
  return t?clone(t):null;
}

export function searchTemplates({query='',category='all',limit=80,offset=0}={}){
  const needle=String(query||'').trim().toLowerCase();
  const rows=NEXUSNOVA_TEMPLATES.filter(t=>{
    if(category!=='all'&&t.category!==category)return false;
    if(!needle)return true;
    return `${t.name} ${t.category} ${t.tags.join(' ')}`.toLowerCase().includes(needle);
  });
  return {total:rows.length,items:rows.slice(offset,offset+limit).map(clone)};
}

export function templateLibraryStats(){
  return {templates:NEXUSNOVA_TEMPLATES.length,categories:NEXUSNOVA_TEMPLATE_CATEGORIES.length};
}
