const PALETTES=[
  ['#07101f','#7657ff','#f8f9ff','#adb8d4','#142b52'],
  ['#15100b','#ffad32','#fff8e9','#d9bea0','#4d2712'],
  ['#160d20','#d451ff','#fff5ff','#d5b7df','#3c1752'],
  ['#071d19','#20d9a0','#f2fff9','#a7d8c9','#103e34'],
  ['#210e13','#ff5d76','#fff4f6','#e0adb6','#561828'],
  ['#071b27','#24bfff','#effaff','#a7d0e1','#0b4564'],
  ['#17151a','#e8cf9d','#fffaf0','#cabda7','#403625'],
  ['#10122b','#6c7dff','#f4f5ff','#b2b9e8','#252a68'],
  ['#211207','#ff7b32','#fff6ed','#e5b89c','#5b2a0e'],
  ['#061d25','#32e0d0','#efffff','#a6d9d7','#0b4b53'],
  ['#180d19','#ff54bf','#fff2fa','#deb2d0','#53143f'],
  ['#11151d','#9faeff','#f7f8ff','#aeb7cc','#2b3348']
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
const STYLE_GROUPS={
  brand:['Monoline','Emblem','Geometric','Heritage','Neon Mark'],
  social:['Gradient Pop','Photo Story','Bold Type','Creator Grid','Luxe Campaign'],
  video:['Cinematic','Creator Energy','Studio Light','Editorial Frame','Neon Broadcast'],
  print:['Gallery','Modernist','Spotlight','Editorial Noir','Vibrant Grid'],
  professional:['Executive','Structured','Refined','Data-Led','Contemporary'],
  event:['Spotlight','Festival','Formal Luxe','Playful','Cinematic Night'],
  commerce:['Product-Led','Studio Retail','Editorial Sale','Clean Catalog','Electric Launch'],
  editorial:['Magazine','Swiss Grid','Photo Essay','Modern Serif','Color Block'],
  web:['Product UI','Gradient Tech','Editorial Web','Human Focus','Dark Launch']
};

const clone=value=>JSON.parse(JSON.stringify(value));
const slug=value=>String(value).toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'');
const id=(name,index)=>`${name}-${index}`;

function styleGroup(category){
  if(category==='logos')return STYLE_GROUPS.brand;
  if(['instagram-posts','instagram-stories','facebook-posts','quotes'].includes(category))return STYLE_GROUPS.social;
  if(['youtube-thumbnails','youtube-banners'].includes(category))return STYLE_GROUPS.video;
  if(['flyers','posters'].includes(category))return STYLE_GROUPS.print;
  if(['business-cards','certificates','resumes','presentations'].includes(category))return STYLE_GROUPS.professional;
  if(['invitations','event-covers'].includes(category))return STYLE_GROUPS.event;
  if(['product-promos','menus','ads'].includes(category))return STYLE_GROUPS.commerce;
  if(category==='brochures')return STYLE_GROUPS.editorial;
  return STYLE_GROUPS.web;
}

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
    flyers:`Print-ready flyer for ${useCase.toLowerCase()}.`,posters:`Large-format poster for ${useCase.toLowerCase()}.`,
    'business-cards':`Professional contact card for a ${useCase.toLowerCase()}.`,invitations:`Event invitation for ${useCase.toLowerCase()}.`,
    certificates:`Formal certificate for ${useCase.toLowerCase()}.`,resumes:`Resume layout tailored to a ${useCase.toLowerCase()}.`,
    presentations:`Slide-cover concept for ${useCase.toLowerCase()}.`,'product-promos':`Product-focused campaign creative for ${useCase.toLowerCase()}.`,
    menus:`Menu cover and pricing layout for a ${useCase.toLowerCase()}.`,brochures:`Brochure cover for ${useCase.toLowerCase()}.`,
    'event-covers':`Event cover for ${useCase.toLowerCase()}.`,quotes:`Shareable ${useCase.toLowerCase()} quote card.`,
    ads:`Performance ad layout for ${useCase.toLowerCase()}.`,'web-hero':`Website hero section for ${useCase.toLowerCase()}.`
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

function logoElements(copy,symbol,palette,variant){
  const [bg,accent,text,muted,deep]=palette,v=variant%5,items=[{id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true}];
  if(v===0)items.push({id:'halo',type:'circle',x:.27,y:.10,w:.46,h:.46,fill:deep},{id:'mark',type:'circle',x:.33,y:.16,w:.34,h:.34,fill:accent},{id:'symbol',type:'symbol',symbol,x:.405,y:.235,w:.19,h:.19,fill:text});
  if(v===1)items.push({id:'rail',type:'rect',x:.07,y:.12,w:.12,h:.76,fill:accent,radius:.04},{id:'mark',type:'rect',x:.25,y:.17,w:.26,h:.26,fill:deep,radius:.08},{id:'symbol',type:'symbol',symbol,x:.30,y:.22,w:.16,h:.16,fill:accent});
  if(v===2)items.push({id:'frame',type:'rect',x:.16,y:.10,w:.68,h:.68,fill:deep,radius:.04},{id:'seal',type:'circle',x:.34,y:.16,w:.32,h:.32,fill:bg},{id:'symbol',type:'symbol',symbol,x:.405,y:.225,w:.19,h:.19,fill:accent},{id:'rule-a',type:'line',x:.22,y:.58,w:.56,h:.01,fill:accent,strokeWidth:.007});
  if(v===3)items.push({id:'block-a',type:'rect',x:.18,y:.11,w:.28,h:.28,fill:accent,radius:.03,rotation:-8},{id:'block-b',type:'rect',x:.40,y:.21,w:.28,h:.28,fill:deep,radius:.03,rotation:8},{id:'symbol',type:'symbol',symbol,x:.36,y:.22,w:.18,h:.18,fill:text});
  if(v===4)items.push({id:'neon-frame',type:'rect',x:.16,y:.10,w:.68,h:.46,fill:deep,radius:.12},{id:'mark',type:'circle',x:.37,y:.16,w:.26,h:.26,fill:accent},{id:'symbol',type:'symbol',symbol,x:.425,y:.215,w:.15,h:.15,fill:text},{id:'spark',type:'circle',x:.72,y:.14,w:.035,h:.035,fill:text});
  const horizontal=v===1;items.push(
    {id:'brand',role:'brand',type:'text',x:horizontal?.25:.10,y:horizontal?.54:.56,w:horizontal?.68:.80,h:.13,text:copy[0],fill:text,fontWeight:900,fontSize:horizontal?.064:.074,align:horizontal?'left':'center'},
    {id:'tagline',role:'tagline',type:'text',x:horizontal?.25:.16,y:horizontal?.67:.70,w:horizontal?.68:.68,h:.07,text:copy[1],fill:muted,fontWeight:650,fontSize:.026,align:horizontal?'left':'center'},
    {id:'rule',type:'line',x:horizontal?.25:.30,y:.80,w:horizontal?.42:.40,h:.01,fill:accent,strokeWidth:.007},
    {id:'est',type:'text',x:horizontal?.25:.20,y:.84,w:horizontal?.68:.60,h:.05,text:copy[2],fill:muted,fontWeight:750,fontSize:.019,align:horizontal?'left':'center'}
  );return items;
}

function businessCardElements(copy,symbol,palette,variant){const[bg,accent,text,muted,deep]=palette,v=variant%3;return[
  {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true},{id:'side',type:'rect',x:v===1?.62:0,y:0,w:v===1?.38:.31,h:1,fill:deep},{id:'accent',type:'rect',x:v===1?.62:.28,y:0,w:.035,h:1,fill:accent},
  {id:'mark',type:'circle',x:v===1?.73:.075,y:.18,w:.16,h:.28,fill:accent},{id:'symbol',type:'symbol',symbol,x:v===1?.77:.115,y:.245,w:.08,h:.14,fill:bg},
  {id:'name',role:'name',type:'text',x:v===1?.08:.38,y:.23,w:.5,h:.13,text:copy[0],fill:text,fontWeight:900,fontSize:.07,align:'left'},{id:'role',role:'role',type:'text',x:v===1?.08:.38,y:.39,w:.48,h:.08,text:copy[1].toUpperCase(),fill:accent,fontWeight:800,fontSize:.027,align:'left'},
  {id:'contact',role:'contact',type:'text',x:v===1?.08:.38,y:.63,w:.48,h:.08,text:copy[2],fill:muted,fontWeight:600,fontSize:.026,align:'left'},{id:'web',type:'text',x:v===1?.08:.38,y:.75,w:.48,h:.06,text:'www.yourbrand.com',fill:muted,fontWeight:600,fontSize:.022,align:'left'}
]}

function certificateElements(copy,symbol,palette,variant){const[bg,accent,text,muted,deep]=palette;return[
  {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true},{id:'frame',type:'rect',x:.035,y:.05,w:.93,h:.90,fill:deep,radius:.018},{id:'paper',type:'rect',x:.055,y:.075,w:.89,h:.85,fill:bg,radius:.012},
  {id:'line-top',type:'line',x:.15,y:.16,w:.70,h:.01,fill:accent,strokeWidth:.006},{id:'seal',type:'circle',x:.43,y:.15,w:.14,h:.20,fill:accent},{id:'symbol',type:'symbol',symbol,x:.465,y:.20,w:.07,h:.10,fill:bg},
  {id:'title',role:'award-title',type:'text',x:.12,y:.39,w:.76,h:.11,text:copy[0],fill:text,fontWeight:900,fontSize:.066,align:'center'},{id:'award',role:'recipient',type:'text',x:.12,y:.55,w:.76,h:.10,text:copy[2],fill:accent,fontWeight:800,fontSize:.041,align:'center'},
  {id:'reason',type:'text',x:.22,y:.68,w:.56,h:.07,text:copy[1],fill:muted,fontWeight:600,fontSize:.026,align:'center'},{id:'sign-a',type:'line',x:.18,y:.83,w:.20,h:.01,fill:muted,strokeWidth:.003},{id:'sign-b',type:'line',x:.62,y:.83,w:.20,h:.01,fill:muted,strokeWidth:.003}
]}

function resumeElements(copy,palette,variant){const[bg,accent,text,muted,deep]=palette,v=variant%2;return[
  {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true},{id:'side',type:'rect',x:v?.67:0,y:0,w:.33,h:1,fill:deep},{id:'portrait',role:'photo',type:'photo',x:v?.73:.075,y:.07,w:.18,h:.14,fill:accent,label:'PHOTO',radius:.50},
  {id:'name',role:'name',type:'text',x:v?.08:.39,y:.08,w:.5,h:.08,text:copy[0],fill:text,fontWeight:900,fontSize:.053,align:'left'},{id:'role',role:'role',type:'text',x:v?.08:.39,y:.17,w:.5,h:.05,text:copy[1],fill:accent,fontWeight:800,fontSize:.022,align:'left'},
  {id:'summary-h',type:'text',x:v?.08:.39,y:.29,w:.45,h:.05,text:'PROFILE',fill:accent,fontWeight:850,fontSize:.020,align:'left'},{id:'summary',type:'text',x:v?.08:.39,y:.35,w:.50,h:.11,text:'Focused professional with a record of clear results and thoughtful collaboration.',fill:muted,fontWeight:520,fontSize:.018,align:'left',lineHeight:1.35},
  {id:'experience-h',type:'text',x:v?.08:.39,y:.50,w:.45,h:.05,text:'EXPERIENCE',fill:accent,fontWeight:850,fontSize:.020,align:'left'},{id:'experience',role:'experience',type:'text',x:v?.08:.39,y:.57,w:.51,h:.17,text:'ROLE / COMPANY\nKey achievement and measurable impact\n\nROLE / COMPANY\nKey achievement and measurable impact',fill:text,fontWeight:620,fontSize:.018,align:'left',lineHeight:1.55},
  {id:'skills-h',type:'text',x:v?.72:.07,y:.70,w:.20,h:.04,text:'SKILLS',fill:accent,fontWeight:850,fontSize:.019,align:'left'},{id:'skills',role:'skills',type:'text',x:v?.72:.07,y:.76,w:.20,h:.13,text:'STRATEGY\nDESIGN\nCOMMUNICATION\nLEADERSHIP',fill:muted,fontWeight:650,fontSize:.016,align:'left',lineHeight:1.55}
]}

function menuElements(copy,symbol,palette,variant){const[bg,accent,text,muted,deep]=palette,v=variant%2;return[
  {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true},{id:'header',type:'rect',x:0,y:0,w:1,h:v?.27:.34,fill:deep},{id:'mark',type:'circle',x:.39,y:v?.07:.10,w:.22,h:.15,fill:accent},{id:'symbol',type:'symbol',symbol,x:.445,y:v?.095:.135,w:.11,h:.075,fill:bg},
  {id:'name',role:'restaurant',type:'text',x:.10,y:v?.24:.27,w:.80,h:.08,text:copy[0],fill:text,fontWeight:900,fontSize:.052,align:'center'},{id:'section',role:'section',type:'text',x:.16,y:v?.34:.39,w:.68,h:.05,text:copy[1],fill:accent,fontWeight:800,fontSize:.023,align:'center'},
  ...Array.from({length:5},(_,index)=>({id:id('menu-item',index),role:'menu-item',type:'text',x:.12,y:.49+index*.082,w:.76,h:.05,text:`SIGNATURE ITEM ${index+1}  •  ${8+index*3}`,fill:index%2?muted:text,fontWeight:650,fontSize:.020,align:'left'})),
  {id:'footer',type:'rect',x:.12,y:.92,w:.76,h:.015,fill:accent,radius:.01},{id:'contact',role:'contact',type:'text',x:.16,y:.95,w:.68,h:.03,text:copy[2],fill:muted,fontWeight:650,fontSize:.015,align:'center'}
]}

function invitationElements(copy,symbol,palette,variant){const[bg,accent,text,muted,deep]=palette;return[
  {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true},{id:'panel',type:'rect',x:.06,y:.08,w:.88,h:.84,fill:deep,radius:.035},{id:'inner',type:'rect',x:.085,y:.11,w:.83,h:.78,fill:bg,radius:.028},
  {id:'symbol',type:'symbol',symbol,x:.45,y:.17,w:.10,h:.14,fill:accent},{id:'eyebrow',type:'text',x:.20,y:.34,w:.60,h:.06,text:copy[1],fill:accent,fontWeight:800,fontSize:.025,align:'center'},
  {id:'title',role:'event-title',type:'text',x:.12,y:.44,w:.76,h:.14,text:copy[0],fill:text,fontWeight:900,fontSize:.065,align:'center'},{id:'date',role:'date',type:'text',x:.20,y:.63,w:.60,h:.07,text:copy[2],fill:muted,fontWeight:650,fontSize:.028,align:'center'},
  {id:'venue',role:'venue',type:'text',x:.20,y:.73,w:.60,h:.06,text:'YOUR VENUE · RSVP 000 000 000',fill:muted,fontWeight:600,fontSize:.020,align:'center'},{id:'rule',type:'line',x:.32,y:.82,w:.36,h:.01,fill:accent,strokeWidth:.005}
]}

function quoteElements(copy,symbol,palette,variant){const[bg,accent,text,muted,deep]=palette,v=variant%3;return[
  {id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true},{id:'shape-a',type:v===1?'circle':'rect',x:v===2?.55:.06,y:v===1?.08:.06,w:v===2?.48:.42,h:v===2?.48:.42,fill:deep,radius:.10,rotation:v===2?9:0},{id:'shape-b',type:'circle',x:.68,y:.72,w:.28,h:.28,fill:accent,opacity:.35},
  {id:'symbol',type:'symbol',symbol,x:.10,y:.12,w:.12,h:.12,fill:accent},{id:'quote',role:'quote',type:'text',x:.10,y:.30,w:.80,h:.28,text:copy[0],fill:text,fontWeight:900,fontSize:.068,align:v===1?'center':'left',lineHeight:1.04},
  {id:'rule',type:'line',x:.10,y:.68,w:.25,h:.01,fill:accent,strokeWidth:.008},{id:'topic',type:'text',x:.10,y:.73,w:.80,h:.06,text:copy[1],fill:accent,fontWeight:800,fontSize:.024,align:'left'},{id:'author',role:'author',type:'text',x:.10,y:.82,w:.80,h:.06,text:copy[2],fill:muted,fontWeight:650,fontSize:.022,align:'left'}
]}

function generalElements(category,copy,symbol,palette,variant){
  const[bg,accent,text,muted,deep]=palette,portrait=['instagram-stories','flyers','posters'].includes(category),wide=['facebook-posts','youtube-thumbnails','youtube-banners','presentations','brochures','event-covers','ads','web-hero'].includes(category),v=variant%5,items=[{id:'bg',type:'rect',x:0,y:0,w:1,h:1,fill:bg,locked:true}];
  let photo;
  if(wide){
    if(v===0)photo={x:.55,y:.07,w:.40,h:.86};
    else if(v===1)photo={x:.43,y:0,w:.57,h:1};
    else if(v===2)photo={x:.06,y:.09,w:.88,h:.50};
    else photo={x:.60,y:.12,w:.32,h:.70};
  }else if(portrait){
    if(v===0)photo={x:.07,y:.06,w:.86,h:.42};
    else if(v===1)photo={x:0,y:0,w:1,h:.58};
    else if(v===2)photo={x:.38,y:.06,w:.55,h:.56};
    else photo={x:.08,y:.08,w:.84,h:.38};
  }else{
    if(v===0)photo={x:.08,y:.07,w:.84,h:.42};
    else if(v===1)photo={x:.50,y:.06,w:.44,h:.88};
    else if(v===2)photo={x:0,y:0,w:1,h:.56};
    else photo={x:.10,y:.10,w:.80,h:.40};
  }
  items.push({id:'photo',role:'photo',type:'photo',...photo,fill:accent,label:'REPLACE PHOTO',radius:v===1?.015:.035});
  if(v===1)items.push({id:'text-panel',type:'rect',x:wide?.05:.05,y:wide?.10:.52,w:wide?.43:.90,h:wide?.80:.43,fill:deep,radius:.035,opacity:.96});
  if(v===2)items.push({id:'accent-block',type:'rect',x:.05,y:portrait?.50:.49,w:portrait?.90:.42,h:portrait?.45:.46,fill:deep,radius:.035},{id:'badge',type:'circle',x:.78,y:.06,w:.13,h:.13,fill:accent},{id:'symbol',type:'symbol',symbol,x:.81,y:.09,w:.07,h:.07,fill:bg});
  if(v>=3)items.push({id:'accent-rail',type:'rect',x:.05,y:.08,w:.025,h:.84,fill:accent,radius:.01},{id:'symbol-bg',type:'circle',x:.78,y:.74,w:.15,h:.15,fill:deep},{id:'symbol',type:'symbol',symbol,x:.815,y:.775,w:.08,h:.08,fill:accent});
  const tx=wide?.07:.10,tw=wide?.45:.80,ty=wide?(v===2?.66:.20):(v===1?.61:v===2?.57:.53),titleSize=wide?.057:(portrait?.056:.060);
  items.push(
    {id:'eyebrow',type:'text',x:tx,y:ty-.075,w:tw,h:.05,text:category.replace(/-/g,' ').toUpperCase(),fill:accent,fontWeight:850,fontSize:.018,align:'left'},
    {id:'headline',role:'headline',type:'text',x:tx,y:ty,w:tw,h:.18,text:copy[0],fill:text,fontWeight:900,fontSize:titleSize,align:'left',lineHeight:1.02},
    {id:'subheadline',role:'subheadline',type:'text',x:tx,y:ty+(wide?.20:.15),w:wide?.40:.72,h:.10,text:copy[1],fill:muted,fontWeight:560,fontSize:wide?.024:.027,align:'left',lineHeight:1.22},
    {id:'cta-bg',type:'rect',x:tx,y:ty+(wide?.36:.28),w:wide?.20:.34,h:.075,fill:accent,radius:.03},
    {id:'cta',role:'cta',type:'text',x:tx,y:ty+(wide?.378:.298),w:wide?.20:.34,h:.045,text:copy[2],fill:bg,fontWeight:850,fontSize:.019,align:'center'}
  );return items;
}

function elementsFor(category,useCase,styleIndex,caseIndex,specIndex,palette){
  const copy=copyFor(category,useCase),symbol=SYMBOLS[(caseIndex+specIndex)%SYMBOLS.length],variant=(caseIndex+styleIndex*2+specIndex)%5;
  if(category==='logos')return logoElements(copy,symbol,palette,variant);
  if(category==='business-cards')return businessCardElements(copy,symbol,palette,variant);
  if(category==='certificates')return certificateElements(copy,symbol,palette,variant);
  if(category==='resumes')return resumeElements(copy,palette,variant);
  if(category==='menus')return menuElements(copy,symbol,palette,variant);
  if(category==='invitations')return invitationElements(copy,symbol,palette,variant);
  if(category==='quotes')return quoteElements(copy,symbol,palette,variant);
  return generalElements(category,copy,symbol,palette,variant);
}

const FEATURED_SLOTS={
  'product-promos:0:0':['Photo Portrait',0],
  'facebook-posts:0:0':['Social Media',1],
  'posters:0:0':['Poster Design',2],
  'instagram-posts:0:0':['Instagram Post',3]
};

function featuredTemplate(spec,caseIndex,styleIndex,slot){
  const[category,,,label]=spec,[name,featuredOrder]=slot,width=1030,height=970;
  return {id:`nx-approved-featured-${slug(name)}`,name,category,label,useCase:name,style:'Approved Showcase',featuredOrder,purpose:`Editable ${name.toLowerCase()} starter matching the approved NexusNova showcase.`,description:'The approved showcase artwork opens as the actual replaceable design layer; add text and shapes in the Design editor.',editableFields:['Showcase artwork / photo','Add text','Add shapes','Opacity','Position','Layers'],sizeLabel:`${width} × ${height}px`,tags:[category,label.toLowerCase(),name.toLowerCase(),'approved showcase','editable','nexusnova'],canvas:{width,height},background:'#070d17',elements:[{id:'approved-artwork',role:'photo',type:'photo',x:0,y:0,w:1,h:1,src:'./assets/visuals/ai-photo-locked-featured.webp',sourceCrop:{x:featuredOrder/4,y:0,w:.25,h:1},label:'SHOWCASE ARTWORK',radius:0}]};
}

function buildTemplate(spec,caseIndex,styleIndex,specIndex){
  const[category,width,height,label,useCases]=spec,useCase=useCases[caseIndex],featured=FEATURED_SLOTS[`${category}:${caseIndex}:${styleIndex}`];if(featured)return featuredTemplate(spec,caseIndex,styleIndex,featured);
  const style=styleGroup(category)[styleIndex],palette=PALETTES[(specIndex*2+caseIndex*3+styleIndex)%PALETTES.length],variant=(caseIndex+styleIndex*2+specIndex)%5;
  return {id:`nx-${category}-${slug(useCase)}-${slug(style)}`,name:`${useCase} ${label} — ${style}`,category,label,useCase,style,purpose:purposeFor(category,useCase),description:`A ${style.toLowerCase()} ${label.toLowerCase()} with a distinct ${['split','framed','editorial','symbol-led','photo-led'][variant]} composition and editable NexusNova vector layers.`,editableFields:fieldsFor(category),sizeLabel:`${width} × ${height}px`,tags:[category,label.toLowerCase(),useCase.toLowerCase(),style.toLowerCase(),'editable','nexusnova'],canvas:{width,height},background:palette[0],elements:elementsFor(category,useCase,styleIndex,caseIndex,specIndex,palette)};
}

export const NEXUSNOVA_TEMPLATE_CATEGORIES=Object.freeze(SPECS.map(([id,width,height,label])=>({id,label,width,height,count:50})));
export const NEXUSNOVA_TEMPLATES=Object.freeze(SPECS.flatMap((spec,specIndex)=>spec[4].flatMap((_,caseIndex)=>Array.from({length:5},(__,styleIndex)=>buildTemplate(spec,caseIndex,styleIndex,specIndex)))));

export function getTemplateById(templateId){const template=NEXUSNOVA_TEMPLATES.find(item=>item.id===templateId);return template?clone(template):null}
export function searchTemplates({query='',category='all',limit=80,offset=0}={}){const terms=String(query||'').trim().toLowerCase().split(/\s+/).filter(Boolean),rows=NEXUSNOVA_TEMPLATES.filter(template=>{if(category!=='all'&&template.category!==category)return false;if(!terms.length)return true;const haystack=[template.name,template.category,template.label,template.useCase,template.style,template.purpose,template.description,...template.editableFields,...template.tags].join(' ').toLowerCase();return terms.every(term=>haystack.includes(term))});return{total:rows.length,items:rows.slice(offset,offset+limit).map(clone)}}
export function templateLibraryStats(){return{templates:NEXUSNOVA_TEMPLATES.length,categories:NEXUSNOVA_TEMPLATE_CATEGORIES.length,semantic:true,compositionFamilies:9,repeatedPaletteSwaps:false}}
