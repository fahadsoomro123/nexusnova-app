import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});
const context=await browser.newContext();
const page=await context.newPage();
const errors=[];
page.on('pageerror',e=>errors.push(e.message||String(e)));

try{
  await page.goto(base+'/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><body>
    <input id="cryptoSearch" placeholder="Search coin...">
    <div id="marketCount"></div><div id="marketList"></div>
    <div id="walletAssetList"></div><div id="walletTotalUsd"></div><div id="walletActionStatus"></div>
  </body></html>`);

  await page.evaluate(()=>{
    const rows=Array.from({length:100},(_,i)=>({
      id:`coin-${i+1}`,
      symbol:i===0?'BTC':`C${i+1}`,
      name:i===0?'Bitcoin':`Coin ${i+1}`,
      current_price:i===0?65000:(i+1)*1.25,
      price_change_percentage_24h:i%2===0?1.5:-0.75,
      market_cap_rank:i+1,
      image:''
    }));
    window.fetch=async url=>{
      if(String(url).includes('api.coingecko.com/api/v3/coins/markets')){
        return {ok:true,status:200,json:async()=>rows};
      }
      throw new Error('Unexpected runtime request '+url);
    };
  });

  await page.addScriptTag({url:base+'/js/nexusnova-top100-live-fix-v3.js?v=4'});
  await page.waitForFunction(()=>window.nexusMarketIntegrityVersion==='live-v4');
  await page.waitForFunction(()=>document.querySelectorAll('#marketList .coin-row').length===100,null,{timeout:5000});
  assert.match(await page.textContent('#marketCount'),/100 coins .* Market-cap live/i);
  assert.match(await page.textContent('#marketList .coin-row:first-child'),/#1.*Bitcoin.*BTC/s);

  await page.fill('#cryptoSearch','coin 42');
  await page.dispatchEvent('#cryptoSearch','input');
  await page.waitForFunction(()=>document.querySelectorAll('#marketList .coin-row').length===1);
  assert.match(await page.textContent('#marketList'),/Coin 42/);
  assert.match(await page.textContent('#marketCount'),/1 match/i);

  await page.fill('#cryptoSearch','btc');
  await page.dispatchEvent('#cryptoSearch','input');
  await page.waitForFunction(()=>document.querySelectorAll('#marketList .coin-row').length===1);
  assert.match(await page.textContent('#marketList'),/Bitcoin/);

  await page.fill('#cryptoSearch','nothing-here');
  await page.dispatchEvent('#cryptoSearch','input');
  await page.waitForFunction(()=>/No matching coin found/i.test(document.getElementById('marketList')?.textContent||''));
  assert.match(await page.textContent('#marketCount'),/0 matches/i);

  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS Market — primary live source, truthful ranking label, and authoritative search cache passed');
}finally{
  await page.close();
  await context.close();
  await browser.close();
}
