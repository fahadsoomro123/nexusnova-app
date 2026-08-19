import { discoverRenderers } from './discover-apps.js';
import { escapeHtml, loadJson, saveJson } from '../../core/local-store.js';

const STORAGE='nexusnova_entertainment_recent_v1';
const PROVIDERS=Object.freeze({
  youtube:{label:'YouTube',url:q=>`https://www.youtube.com/results?search_query=${encodeURIComponent(q)}`},
  music:{label:'YouTube Music',url:q=>`https://music.youtube.com/search?q=${encodeURIComponent(q)}`},
  dailymotion:{label:'Dailymotion',url:q=>`https://www.dailymotion.com/search/${encodeURIComponent(q)}/videos`},
  imdb:{label:'IMDb',url:q=>`https://www.imdb.com/find/?q=${encodeURIComponent(q)}`},
  netflix:{label:'Netflix',url:q=>`https://www.netflix.com/search?q=${encodeURIComponent(q)}`}
});

function openExternal(url){
  try{const parsed=new URL(url);if(parsed.protocol!=='https:')return false;if(typeof window.nexusPostNativeAction==='function'&&window.nexusPostNativeAction('openExternal',{url:parsed.href}))return true;window.open(parsed.href,'_blank','noopener,noreferrer');return true;}catch{return false;}
}
function recent(){const rows=loadJson(STORAGE,[]);return Array.isArray(rows)?rows.filter(row=>row&&row.q).slice(0,6):[];}
function remember(q,provider){const clean=String(q||'').trim().slice(0,120);if(!clean)return;saveJson(STORAGE,[{q:clean,provider,at:Date.now()},...recent().filter(row=>String(row.q).toLowerCase()!==clean.toLowerCase())].slice(0,6));}

export function renderEntertainmentSuite(){
  const root=discoverRenderers.entertainment();
  const search=document.createElement('section');search.className='nx-tool-card';
  search.innerHTML=`<strong>Find Entertainment</strong><p class="nx-tool-meta">Search movies, shows, songs, creators or videos on the provider you choose. NexusNova does not host copyrighted media.</p><label class="nx-field"><span>Search</span><input type="search" maxlength="140" autocomplete="off" data-ent-query placeholder="Movie, song, creator, topic…"></label><div class="nx-two-col"><label class="nx-field"><span>Provider</span><select data-ent-provider>${Object.entries(PROVIDERS).map(([key,value])=>`<option value="${key}">${value.label}</option>`).join('')}</select></label><button class="nx-primary" type="button" data-ent-search>SEARCH PROVIDER</button></div><p class="nx-tool-meta">Recent searches</p><div class="nx-action-row" data-ent-recent></div><p class="nx-tool-meta" data-ent-status>Ready.</p>`;
  root.prepend(search);
  const query=search.querySelector('[data-ent-query]'),provider=search.querySelector('[data-ent-provider]'),recentBox=search.querySelector('[data-ent-recent]'),status=search.querySelector('[data-ent-status]');
  const drawRecent=()=>{const rows=recent();recentBox.innerHTML=rows.length?rows.map((row,index)=>`<button type="button" data-ent-recent-index="${index}">${escapeHtml(row.q)}</button>`).join(''):'<span class="nx-tool-meta">No recent provider searches.</span>';recentBox.querySelectorAll('[data-ent-recent-index]').forEach(button=>button.addEventListener('click',()=>{const row=recent()[Number(button.dataset.entRecentIndex)];if(!row)return;query.value=row.q;provider.value=PROVIDERS[row.provider]?row.provider:'youtube';run();}));};
  const run=()=>{const q=query.value.trim();if(!q){status.textContent='Type a movie, song, creator or topic first.';query.focus();return;}const key=PROVIDERS[provider.value]?provider.value:'youtube';remember(q,key);drawRecent();if(openExternal(PROVIDERS[key].url(q)))status.textContent=`Opening ${PROVIDERS[key].label} search…`;else status.textContent='Could not open the selected provider.';};
  search.querySelector('[data-ent-search]').addEventListener('click',run);query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();run();}});drawRecent();
  return root;
}

export const entertainmentSuiteRenderers=Object.freeze({entertainment:renderEntertainmentSuite});
