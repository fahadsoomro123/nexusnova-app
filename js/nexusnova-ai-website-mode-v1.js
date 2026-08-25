/* NexusNova NOVA AI Website Mode v1
   Easy controls for a non-developer owner. Requires nexusnova-ai-mobile-v1.js.
*/
(() => {
  'use strict';
  if (window.__nxNovaAIWebsiteModeV1) return;
  window.__nxNovaAIWebsiteModeV1 = true;

  const CFG_KEY='nexusnova_nova_ai_mobile_v1';
  const $=id=>document.getElementById(id);

  const tasks={
    auto:'Meri NexusNova website ko khud deeply inspect karo. Current useful trends aur search demand ko web se research karo, repo ka technical/SEO/design/content audit karo, phir sabse high-value safe improvements khud choose karke implement karo. Mujhse file names, code, keywords ya implementation details mat poochna jab repo/web research se pata chal sakta ho. Working features mat torna. Random/mass content mat banana. Branch banao, relevant files khud choose karo, useful design/SEO/content/internal-link/performance fixes karo, checks chalao, diff verify karo aur clean commit banao. GitHub writes armed hon to PR ready karo; main branch ko direct push mat karna.',
    design:'Meri website ko inspect karo aur jo page/section main next message me bataun uska design modern, beautiful, mobile-friendly aur fast banao. Working features ko break mat karna. Repo khud inspect karke required files khud choose karo.',
    seo:'Meri website ka SEO audit karo aur jo high-value safe improvements tum khud kar sakte ho wo implement karo. Technical SEO, titles/meta, internal linking, crawl discovery, useful content aur performance dekho. Mass/fake keyword pages mat banana. Branch, checks aur diff khud handle karo.',
    article:'Meri website ke niche aur current useful trends ko research karo. Ek genuinely useful, original, publish-ready article choose karke likho aur website ke existing article system me properly add karo. Canonical/meta/structured data/internal links/article hub/sitemap/feed jahan relevant ho update karo.',
    fix:'Meri website repo deeply inspect karo. Broken links, obvious UI bugs, console-risk patterns, missing assets ya mobile layout issues dhoondo. Safe fixes khud implement karo, checks chalao aur exact diff verify karo.',
    audit:'Meri website ka full website-owner audit karo: design, mobile UX, speed, SEO, content, navigation, trust, accessibility aur maintainability. Sabse important safe fixes pehle khud implement karo. Sirf report dekar mat rukna jab fix repo me possible ho.',
    publish:'Current website task ka git status aur diff inspect karo. Agar work complete hai to checks chalao, clean commit banao aur GitHub writes enabled hon to non-main branch push karke PR create karo. Main branch ko directly push mat karna.'
  };

  function cfg(){
    try{return {mode:'chat',...JSON.parse(localStorage.getItem(CFG_KEY)||'{}')}}catch(_){return {mode:'chat'}}
  }
  function save(patch){
    const next={...cfg(),...patch};
    try{localStorage.setItem(CFG_KEY,JSON.stringify(next))}catch(_){}
    return next;
  }
  function css(){
    if($('nxNovaWebsiteModeStyle'))return;
    const s=document.createElement('style');s.id='nxNovaWebsiteModeStyle';s.textContent=`
      #tab-ai .nx-nova-mode[data-mode="website"].active{background:#e4dcff!important;border-color:#e4dcff!important;color:#141019!important}
      #tab-ai .nx-nova-website-actions{display:none;gap:6px;padding:0 12px 8px;background:#111214;overflow-x:auto;scrollbar-width:none}
      #tab-ai .nx-nova-website-actions::-webkit-scrollbar{display:none}
      #tab-ai .nx-nova-website-actions.show{display:flex}
      #tab-ai .nx-nova-webtask{height:31px;padding:0 10px;border:1px solid #35373c;border-radius:10px;background:#202125;color:#c9cbd0;font:650 10px/1 system-ui;white-space:nowrap}
      #tab-ai .nx-nova-webtask.auto{background:#f1f1f1;color:#111;border-color:#f1f1f1;font-weight:800}
      #tab-ai .nx-nova-webtask:active{transform:translateY(1px)}
      #tab-ai .nx-nova-website-hint{display:none;margin:0 12px 8px;padding:9px 10px;border:1px solid rgba(183,157,255,.22);border-radius:12px;background:rgba(159,126,255,.07);color:#a9aab0;font:500 10px/1.45 system-ui}
      #tab-ai .nx-nova-website-hint.show{display:block}
      #tab-ai .nx-nova-website-hint strong{color:#e8e0ff;font-weight:700}
    `;document.head.appendChild(s);
  }
  function update(){
    const mode=cfg().mode;
    document.querySelectorAll('#tab-ai .nx-nova-mode').forEach(b=>b.classList.toggle('active',b.dataset.mode===mode));
    $('nxNovaWebsiteActions')?.classList.toggle('show',mode==='website');
    $('nxNovaWebsiteHint')?.classList.toggle('show',mode==='website');
    if(mode==='website'){
      const sub=$('nxNovaAISubtitle');if(sub)sub.textContent='Website • autonomous builder';
      const st=$('nxNovaAIStatus');if(st)st.textContent='Website Mode • simple instruction do, technical kaam NOVA AI karegi';
    }
  }
  function selectWebsite(){save({mode:'website'});update();$('aiInput')?.focus();}
  function putTask(key){
    const input=$('aiInput');if(!input)return;
    selectWebsite();
    input.value=tasks[key]||'';
    input.dispatchEvent(new Event('input',{bubbles:true}));
    input.focus();
    input.setSelectionRange?.(input.value.length,input.value.length);
  }
  function build(){
    css();
    const modes=$('nxNovaAIModes');if(!modes)return false;
    if(!modes.querySelector('[data-mode="website"]')){
      const b=document.createElement('button');b.className='nx-nova-mode';b.dataset.mode='website';b.textContent='Website';b.title='Website ko NOVA AI se manage karo';
      const dev=modes.querySelector('[data-mode="dev"]');modes.insertBefore(b,dev||null);
      b.addEventListener('click',selectWebsite);
    }
    if(!$('nxNovaWebsiteActions')){
      const bar=document.createElement('div');bar.id='nxNovaWebsiteActions';bar.className='nx-nova-website-actions';
      bar.innerHTML='<button class="nx-nova-webtask auto" data-webtask="auto">Auto Improve</button><button class="nx-nova-webtask" data-webtask="design">Design</button><button class="nx-nova-webtask" data-webtask="seo">SEO</button><button class="nx-nova-webtask" data-webtask="article">Article</button><button class="nx-nova-webtask" data-webtask="fix">Fix</button><button class="nx-nova-webtask" data-webtask="audit">Full Audit</button><button class="nx-nova-webtask" data-webtask="publish">PR / Publish</button>';
      modes.insertAdjacentElement('afterend',bar);
      bar.addEventListener('click',e=>{const b=e.target.closest('[data-webtask]');if(b)putTask(b.dataset.webtask)});
    }
    if(!$('nxNovaWebsiteHint')){
      const hint=document.createElement('div');hint.id='nxNovaWebsiteHint';hint.className='nx-nova-website-hint';
      hint.innerHTML='<strong>Easy Website Mode:</strong> “bhai website khud check karke jo zaruri ho kar do” bhi kaafi hai. <strong>Auto Improve</strong> trends + SEO + design + content + technical audit karke high-value safe work choose karega.';
      $('nxNovaWebsiteActions')?.insertAdjacentElement('afterend',hint);
    }
    update();return true;
  }

  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',build,{once:true});else build();
  [500,1200,2400,4200,7000].forEach(ms=>setTimeout(build,ms));
})();
