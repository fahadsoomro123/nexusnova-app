import { escapeHtml } from '../../core/local-store.js';

const QUERIES=Object.freeze({
  breaking:'Pakistan breaking latest news',
  urdu:'پاکستان اردو خبریں',
  sindhi:'سنڌ پاڪستان خبرون',
  pakistan:'Pakistan news politics economy',
  entertainment:'Pakistan entertainment film drama music'
});

function node(html){const root=document.createElement('div');root.className='nx-app-body';root.innerHTML=html;return root;}
function openExternal(url){try{const parsed=new URL(url);if(!['http:','https:'].includes(parsed.protocol))return false;if(typeof window.nexusPostNativeAction==='function'&&window.nexusPostNativeAction('openExternal',{url:parsed.href}))return true;window.open(parsed.href,'_blank','noopener,noreferrer');return true;}catch{return false;}}
async function gdelt(q){const response=await fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${encodeURIComponent(q)}&mode=artlist&maxrecords=20&format=json&sort=datedesc`,{cache:'no-store'});if(!response.ok)throw new Error(`News HTTP ${response.status}`);const data=await response.json();return Array.isArray(data.articles)?data.articles:[];}

export function renderPakistanSuite(){
  const root=node(`<section class="nx-tool-card"><strong>Pakistan Hub • Live Regional Headlines</strong><div class="nx-action-row"><button class="nx-primary" type="button" data-pk-cat="breaking">BREAKING</button><button type="button" data-pk-cat="urdu">URDU</button><button type="button" data-pk-cat="sindhi">SINDHI</button><button type="button" data-pk-cat="pakistan">PAKISTAN</button><button type="button" data-pk-cat="entertainment">ENTERTAINMENT</button></div><p class="nx-tool-meta" data-pk-status>Loading live regional news through GDELT…</p></section><section class="nx-stack" data-pk-list><div class="nx-empty">Loading…</div></section>`);
  const status=root.querySelector('[data-pk-status]'),list=root.querySelector('[data-pk-list]');let active='breaking',cancelled=false;
  const load=async cat=>{active=QUERIES[cat]?cat:'breaking';root.querySelectorAll('[data-pk-cat]').forEach(button=>button.classList.toggle('nx-primary',button.dataset.pkCat===active));status.textContent='Loading live regional news…';list.innerHTML='<div class="nx-empty">Loading live headlines…</div>';try{const rows=await gdelt(QUERIES[active]);if(cancelled)return;list.innerHTML=rows.length?rows.map((row,index)=>`<article class="nx-list-card"><strong>${escapeHtml(row.title||'News')}</strong><p>${escapeHtml([row.domain,row.seendate].filter(Boolean).join(' • '))}</p><button type="button" data-pk-read="${index}">READ SOURCE</button></article>`).join(''):'<div class="nx-empty">No live articles returned right now. Try another category.</div>';list.querySelectorAll('[data-pk-read]').forEach(button=>button.addEventListener('click',()=>{const row=rows[Number(button.dataset.pkRead)];if(row?.url)openExternal(row.url);}));status.textContent=`Live ${active} feed • ${rows.length} article${rows.length===1?'':'s'}`;}catch(error){if(cancelled)return;list.innerHTML='<div class="nx-empty">Regional live feed is temporarily unavailable.</div>';status.textContent='GDELT live feed unavailable. No cached/fabricated headline was substituted.';console.warn('[NexusNova Fresh] Pakistan news:',error);}};
  root.querySelectorAll('[data-pk-cat]').forEach(button=>button.addEventListener('click',()=>load(button.dataset.pkCat)));load('breaking');root.__cleanup=()=>{cancelled=true;};return root;
}
export const pakistanSuiteRenderers=Object.freeze({pakistan:renderPakistanSuite});
