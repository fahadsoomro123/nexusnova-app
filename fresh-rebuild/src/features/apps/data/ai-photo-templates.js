const STYLES=[
  ['Minimal','#0b1020','#6d5dfc','#ffffff','#a8b3cf'],
  ['Bold','#121317','#ffb000','#fff9ea','#c8cbd4'],
  ['Elegant','#17121f','#c43cff','#fff7ff','#cdb8d8'],
  ['Fresh','#08231d','#24d18f','#f3fff9','#a7d7c6'],
  ['Editorial','#24140a','#ff7a1a','#fff6ed','#e4c1a7']
];

const SPECS=[
  ['logos',1080,1080,'Logo',['Coffee Shop','Tech Startup','Real Estate','Gaming Team','Beauty Studio','Restaurant','Fitness Brand','Photography','Legal Firm','Fashion Label']],
  ['instagram-posts',1080,1080,'Instagram Post',['Flash Sale','New Arrival','Product Launch','Restaurant Special','Fitness Challenge','Beauty Offer','Real Estate Listing','Event Promo','Course Launch','Giveaway']],
  ['instagram-stories',1080,1920,'Instagram Story',['Limited Offer','Behind the Scenes','New Collection','Event Countdown','Question Poll','Daily Special','Before & After','Booking Open','New Episode','Shop Now']],
  ['facebook-posts',1200,630,'Facebook Post',['Weekend Sale','Grand Opening','Community Event','Product Spotlight','Property Listing','Restaurant Deal','Hiring Now','Course Enrollment','Customer Review','Holiday Greeting']],
  ['youtube-thumbnails',1280,720,'YouTube Thumbnail',['Tech Review','Gaming Highlight','Travel Vlog','Recipe Video','Fitness Workout','Finance Guide','Tutorial','Podcast Episode','Reaction Video','Product Comparison']],
  ['youtube-banners',2560,1440,'YouTube Banner',['Tech Channel','Gaming Channel','Travel Channel','Food Channel','Fitness Channel','Business Channel','Education Channel','Music Channel','Podcast Channel','Lifestyle Channel']],
  ['flyers',1240,1754,'Flyer',['Grand Opening','Restaurant Menu Deal','Music Night','Real Estate Open House','Fitness Bootcamp','Beauty Services','Business Seminar','School Admission','Charity Event','Seasonal Sale']],
  ['posters',1240,1754,'Poster',['Concert Night','Movie Premiere','Art Exhibition','Sports Event','Conference','Restaurant Festival','Fashion Show','Workshop','Travel Campaign','Product Launch']],
  ['business-cards',1050,600,'Business Card',['Creative Agency','Real Estate Agent','Photographer','Lawyer','Doctor','Salon','Restaurant Owner','Consultant','Developer','Fitness Coach']],
  ['invitations',1400,1000,'Invitation',['Wedding','Birthday','Engagement','Baby Shower','Corporate Dinner','Graduation','Eid Gathering','Anniversary','Housewarming','Launch Party']],
  ['certificates',1600,1131,'Certificate',['Achievement','Course Completion','Employee Award','Volunteer','Sports Winner','Training','Workshop','Appreciation','Membership','Excellence']],
  ['resumes',1240,1754,'Resume',['Software Engineer','Product Designer','Marketing Manager','Accountant','Teacher','Photographer','Sales Executive','Project Manager','Customer Support','Fresh Graduate']],
  ['presentations',1920,1080,'Presentation',['Startup Pitch','Marketing Plan','Company Profile','Sales Deck','Project Proposal','Training Deck','Portfolio','Real Estate Pitch','Product Roadmap','Annual Report']],
  ['product-promos',1080,1080,'Product Promo',['Skincare Product','Smartphone','Fashion Item','Coffee Pack','Furniture','Headphones','Watch','Shoes','Food Product','Mobile App']],
  ['menus',1240,1754,'Menu',['Coffee Shop','Burger Restaurant','Fine Dining','Pizza Shop','Dessert Cafe','Juice Bar','Breakfast','Bakery','Street Food','Catering']],
  ['brochures',1754,1240,'Brochure',['Real Estate','Travel Agency','Clinic','School','Restaurant','Beauty Salon','Construction','Consulting','Hotel','Software Company']],
  ['event-covers',1920,1080,'Event Cover',['Business Conference','Music Festival','Webinar','Sports Tournament','Workshop','Networking Night','Product Launch','Charity Drive','Food Festival','Award Night']],
  ['quotes',1080,1080,'Quote',['Motivation','Business','Fitness','Travel','Success','Mindfulness','Leadership','Creativity','Education','Lifestyle']],
  ['ads',1200,628,'Ad',['Ecommerce Sale','Lead Generation','App Install','Restaurant Offer','Real Estate','Course Signup','Beauty Booking','Fitness Membership','Travel Package','Local Service']],
  ['web-hero',1600,900,'Website Hero',['SaaS Startup','Creative Agency','Restaurant','Real Estate','Fitness Coach','Online Course','Ecommerce Store','Travel Agency','Medical Clinic','Portfolio']]
];

const SYMBOLS=['cup','bolt','home','game','flower','fork','dumbbell','camera','shield','diamond'];
const clone=v=>JSON.parse(JSON.stringify(v));
const slug=v=>String(v).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');

function fieldsFor(category){
  if(category==='logos')return ['Brand name','Tagline','Symbol','Brand colors'];
  if(category==='business-cards')return ['Name','Role','Phone','Email','Website','Logo'];
  if(category==='resumes')return ['Name','Role','Summary','Experience','Education','Skills'];
  if(category==='certificates')return ['Recipient','Award title','Date','Signature'];
  if(category==='menus')return ['Restaurant name','Section','Item names','Prices','Contact'];
  if(category==='invitations')return ['Event title','Names','Date','Time','Venue','RSVP'];
  if(category==='presentations')return ['Title','Subtitle','Key message','Presenter'];
  if(category==='quotes')return ['Quote','Author','Accent color'];
  return ['Headline','Subheadline','Call to action','Photo','Colors'];
}

function purposeFor(category,useCase){
  const map={
    logos:`Brand identity concept for a ${useCase.toLowerCase()}.`,
    'instagram-posts':`Square social post for ${useCase.toLowerCase()}.`,
    'instagram-stories':`Vertical story layout for ${useCase.toLowerCase()}.`,
    'facebook-posts':`Facebook-ready promotional layout for ${useCase.toLowerCase()}.`,
    'youtube-thumbnails':`High-contrast video thumbnail for ${useCase.toLowerCase()}.`,
    'youtube-banners':`Channel cover for a ${useCase.toLowerCase()}.`,
    flyers:`Print-ready flyer for ${useCase.toLowerCase()}.`,
    posters:`Large-format poster for ${useCase.toLowerCase()}.`,
    'business-cards':`Professional contact card for a ${useCase.toLowerCase()}.`,
    invitations:`Event invitation for ${useCase.toLowerCase()}.`,certificates:`Formal certificate for ${useCase.toLowerCase()}.`,
    resumes:`Resume layout tailored to a ${useCase.toLowerCase()}.`,presentations:`Slide-cover concept for ${useCase.toLowerCase()}.`,
    'product-promos':`Product-focused campaign creative for ${useCase.toLowerCase()}.`,menus:`Menu cover and pricing layout for a ${useCase.toLowerCase()}.`,
    brochures:`Brochure cover for ${useCase.toLowerCase()}.`,'event-covers':`Event cover for ${useCase.toLowerCase()}.`,
    quotes:`Shareable ${useCase.toLowerCase()} quote card.`,ads:`Performance ad layout for ${useCase.toLowerCase()}.`,'web-hero':`Website hero section for a ${useCase.toLowerCase()}.`
  };return map[category]||`${useCase} design template.`;
}

function copyFor(category,useCase){
  if(category==='logos')return ['YOUR BRAND',useCase.toUpperCase(),'EST. 2026'];
  if(category==='business-cards')return ['ALEX MORGAN',useCase,'hello@example.com'];
  if(category==='invitations')return [useCase.toUpperCase(),'YOU ARE INVITED','SATURDAY · 7:00 PM'];
  if(category==='certificates')return ['CERTIFICATE',useCase.toUpperCase(),'PRESENTED TO YOUR NAME'];
  if(category==='resumes')return ['YOUR NAME',useCase.toUpperCase(),'EXPERIENCE · EDUCATION · SKILLS'];
  if(category==='menus')return [useCase.toUpperCase(),'SIGNATURE MENU','Freshly made · Daily'];
  if(category==='quotes')return ['“MAKE IT\nMEMORABLE.”',useCase.toUpperCase(),'YOUR NAME'];
  if(category==='presentations')return [useCase.toUpperCase(),'A CLEAR STORY. A STRONG IDEA.','NEXUSNOVA DESIGN'];
  if(category==='youtube-thumbnails')return [useCase.toUpperCase(),'WATCH THIS','NEW VIDEO'];
  if(category==='youtube-banners')return [useCase.toUpperCase(),'NEW VIDEOS EVERY WEEK','SUBSCRIBE'];
  if(category==='web-hero')return [useCase.toUpperCase(),'BUILD SOMETHING PEOPLE REMEMBER','GET STARTED'];
  return [useCase.toUpperCase(),'MAKE YOUR MESSAGE STAND OUT','LEARN MORE'];
}

function elementsFor(category,useCase,styleIndex,caseIndex){
  const [style,bg,accent,text,muted]=STYLES[styleIndex],copy=copyFor(category,useCase),symbol=SYMBOLS[caseIndex%SYMBOLS.length];
  const logo=category==='logos',portrait=['instagram-stories','flyers','posters','resumes','menus'].includes(category),wide=['facebook-posts','youtube-thumbnails','youtube-banners','presentations','brochures','event-covers','ads','web-hero'].includes(category);
  if(logo){
    const compact=styleIndex%2===0;
    return [
      {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true},
      {id:'mark-bg',type:compact?'circle':'rect',x:.34,y:.12,w:.32,h:.32,fill:accent,radius:.12},
      {id:'symbol',type:'symbol',symbol,x:.405,y:.185,w:.19,h:.19,fill:text},
      {id:'brand',role:'brand',type:'text',x:.1,y:.52,w:.8,h:.13,text:copy[0],fill:text,fontWeight:900,fontSize:.076,align:'center'},
      {id:'tagline',role:'tagline',type:'text',x:.16,y:.67,w:.68,h:.08,text:copy[1],fill:muted,fontWeight:650,fontSize:.028,align:'center'},
      {id:'rule',type:'line',x:.28,y:.78,w:.44,h:.01,fill:accent,strokeWidth:.008},
      {id:'est',type:'text',x:.2,y:.83,w:.6,h:.06,text:copy[2],fill:muted,fontWeight:700,fontSize:.02,align:'center'}
    ];
  }
  const photoX=wide?.56:.08,photoY=wide?.09:.08,photoW=wide?.38:.84,photoH=wide?.82:portrait?.38:.42;
  const textY=wide?.16:portrait?.51:.54;
  const titleSize=wide?.058:portrait?.065:.06;
  return [
    {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true},
    {id:'accent-band',type:'rect',x:styleIndex%2?.03:.0,y:styleIndex%2?.03:.0,w:wide?.48:styleIndex%2?.94:1,h:wide?.94:.12,fill:accent,opacity:styleIndex%2?.18:.95,radius:.02},
    {id:'photo',role:'photo',type:'photo',x:photoX,y:photoY,w:photoW,h:photoH,fill:accent,label:'REPLACE PHOTO',radius:.035},
    {id:'eyebrow',type:'text',x:.08,y:wide?.11:textY-.07,w:wide?.42:.84,h:.05,text:style.toUpperCase()+' · '+useCase.toUpperCase(),fill:accent,fontWeight:800,fontSize:.018,align:'left'},
    {id:'headline',role:'headline',type:'text',x:.08,y:textY,w:wide?.42:.84,h:.2,text:copy[0],fill:text,fontWeight:900,fontSize:titleSize,align:'left',lineHeight:1.02},
    {id:'subheadline',role:'subheadline',type:'text',x:.08,y:textY+(wide?.22:.16),w:wide?.4:.78,h:.11,text:copy[1],fill:muted,fontWeight:550,fontSize:wide?.025:.028,align:'left',lineHeight:1.2},
    {id:'cta-bg',type:'rect',x:.08,y:textY+(wide?.38:.3),w:wide?.2:.34,h:.075,fill:accent,radius:.03},
    {id:'cta',role:'cta',type:'text',x:.08,y:textY+(wide?.398:.318),w:wide?.2:.34,h:.05,text:copy[2],fill:bg,fontWeight:850,fontSize:.02,align:'center'}
  ];
}

function buildTemplate(spec,caseIndex,styleIndex){
  const [category,width,height,label,useCases]=spec,useCase=useCases[caseIndex],style=STYLES[styleIndex][0];
  return {
    id:`nx-${category}-${slug(useCase)}-${slug(style)}`,
    name:`${useCase} ${label} — ${style}`,
    category,label,useCase,style,
    purpose:purposeFor(category,useCase),
    description:`A ${style.toLowerCase()} ${label.toLowerCase()} with clearly editable content and original NexusNova vector styling.`,
    editableFields:fieldsFor(category),
    sizeLabel:`${width} × ${height}px`,
    tags:[category,label.toLowerCase(),useCase.toLowerCase(),style.toLowerCase(),'editable','nexusnova'],
    canvas:{width,height},background:STYLES[styleIndex][1],
    elements:elementsFor(category,useCase,styleIndex,caseIndex)
  };
}

export const NEXUSNOVA_TEMPLATE_CATEGORIES=Object.freeze(SPECS.map(([id,width,height,label])=>({id,label,width,height,count:50})));
export const NEXUSNOVA_TEMPLATES=Object.freeze(SPECS.flatMap(spec=>spec[4].flatMap((_,caseIndex)=>STYLES.map((__,styleIndex)=>buildTemplate(spec,caseIndex,styleIndex)))));

export function getTemplateById(id){const t=NEXUSNOVA_TEMPLATES.find(x=>x.id===id);return t?clone(t):null}
export function searchTemplates({query='',category='all',limit=80,offset=0}={}){
  const terms=String(query||'').trim().toLowerCase().split(/\s+/).filter(Boolean);
  const rows=NEXUSNOVA_TEMPLATES.filter(t=>{
    if(category!=='all'&&t.category!==category)return false;
    if(!terms.length)return true;
    const haystack=[t.name,t.category,t.label,t.useCase,t.style,t.purpose,t.description,...t.editableFields,...t.tags].join(' ').toLowerCase();
    return terms.every(term=>haystack.includes(term));
  });
  return{total:rows.length,items:rows.slice(offset,offset+limit).map(clone)}
}
export function templateLibraryStats(){return{templates:NEXUSNOVA_TEMPLATES.length,categories:NEXUSNOVA_TEMPLATE_CATEGORIES.length,semantic:true}}
