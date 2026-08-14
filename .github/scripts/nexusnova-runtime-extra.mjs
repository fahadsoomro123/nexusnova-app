import assert from 'node:assert/strict';
import { chromium } from 'playwright';

const base='http://127.0.0.1:4173';
const browser=await chromium.launch({headless:true});

async function originPage(context,html){
  const page=await context.newPage();
  const errors=[];
  page.on('pageerror',e=>errors.push(e.message||String(e)));
  await page.goto(base+'/.runtime-origin.html');
  await page.setContent(`<!doctype html><html><body>${html}</body></html>`);
  return {page,errors};
}

async function browserCallerQibla(){
  const context=await browser.newContext({geolocation:{latitude:27.9556,longitude:68.6382},permissions:['geolocation']});
  const html=`<input id="nxBrowserUrl" value="https://www.google.com/"><iframe id="nxBrowserFrame" src="about:blank"></iframe><div id="nxBrowserStatus"></div><input id="nxCallerNumber"><div id="nxCallerResult"></div><div id="qiblaStatus"></div><div id="qiblaDegree"></div><div id="qiblaArrow"></div>`;
  const {page,errors}=await originPage(context,html);
  await page.evaluate(()=>{window.nexusPostNativeAction=()=>true;});
  await page.addScriptTag({url:base+'/js/nexusnova-regional-qibla-browser-v1.js'});
  await page.evaluate(()=>window.nxBrowse());
  assert.match(await page.textContent('#nxBrowserStatus'),/Opened as a real web page/i);
  assert.equal(await page.getAttribute('#nxBrowserFrame','src'),'about:blank');
  console.log('PASS Browser — real external handoff + non-iframe fallback passed');
  await page.fill('#nxCallerNumber','+923001234567');
  await page.evaluate(()=>window.nxCallerLookup());
  const caller=await page.textContent('#nxCallerResult');
  assert.match(caller,/format looks valid/i);
  assert.match(caller,/will not guess/i);
  console.log('PASS Caller helper — validates number without inventing identity');
  await page.evaluate(()=>window.nxStartQibla());
  await page.waitForFunction(()=>/Qibla:/i.test(document.getElementById('qiblaDegree')?.textContent||''),null,{timeout:5000});
  assert.match(await page.textContent('#qiblaDegree'),/Qibla: \d/i);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS Qibla — geolocation bearing calculation passed');
  await page.close();await context.close();
}

async function smartBrief(){
  const context=await browser.newContext();
  const html=`<section id="tab-smart"><button>Open Camera</button><button>Build Brief</button></section><div id="balance">42.5000</div><div id="timer">MINING ACTIVE 10:00:00</div><input id="aiInput"><input id="aiImageInput" type="file">`;
  const {page,errors}=await originPage(context,html);
  await page.evaluate(()=>{window.openMoreTab=()=>{};window.sendAIMessage=()=>{window.__briefPrompt=document.getElementById('aiInput')?.value||'';};});
  await page.addScriptTag({url:base+'/js/nexusnova-smart-live-v1.js'});
  await page.waitForSelector('#nxSmartBriefLive');
  await page.click('#nxSmartBriefLive');
  const prompt=await page.evaluate(()=>window.__briefPrompt||'');
  assert.match(prompt,/42\.5000/);assert.match(prompt,/MINING ACTIVE 10:00:00/);assert.match(prompt,/do not invent missing information/i);
  assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS Smart Daily Brief — real app balance/mining context injected');
  await page.close();await context.close();
}

async function qrRepair(){
  const context=await browser.newContext();
  const html=`<section id="tab-mega-qr"><input id="nxMegaQRText"><button id="nxMegaQRBtn">Generate QR</button><button>📷 QR Scanner</button><button>📶 Wi-Fi QR</button><button>👤 Contact QR</button><button>💳 Payment QR</button></section>`;
  const {page,errors}=await originPage(context,html);
  await page.evaluate(()=>{window.nexusAccountId='runtime-qr';document.getElementById('nxMegaQRBtn').addEventListener('click',()=>{window.__qrGenerated=document.getElementById('nxMegaQRText').value;});});
  await page.addScriptTag({url:base+'/js/nexusnova-local-apps-repair-v1.js'});
  await page.waitForSelector('#nxMegaWifiQrLocal');
  let nativeDialogs=0;page.on('dialog',async dialog=>{nativeDialogs+=1;await dialog.dismiss();});
  await page.click('#nxMegaWifiQrLocal');await page.waitForSelector('.nxui-backdrop .nxui-modal',{timeout:5000});
  assert.match(await page.textContent('.nxui-title'),/Create Wi.?Fi QR/i);assert.ok(await page.$('.nxui-orb svg'));
  await page.fill('[data-nxui-field="ssid"]','RuntimeWiFi');await page.fill('[data-nxui-field="password"]','pass12345');await page.selectOption('[data-nxui-field="security"]','WPA');await page.click('.nxui-form .nxui-btn.primary');
  await page.waitForFunction(()=>Boolean(window.__qrGenerated),null,{timeout:3000});
  const payload=await page.evaluate(()=>window.__qrGenerated||'');
  assert.match(payload,/^WIFI:T:WPA;S:RuntimeWiFi;P:pass12345;;$/);assert.equal(nativeDialogs,0);assert.ok(await page.$('#nxMegaContactQrLocal'));assert.ok(await page.$('#nxMegaQrScannerLocal'));
  const payment=await page.locator('#tab-mega-qr button').filter({hasText:'Payment QR'}).count();assert.equal(payment,1);assert.equal(errors.length,0,errors.join('\n'));
  console.log('PASS QR Tools — premium Wi-Fi modal + Contact/Scanner wiring passed; Payment QR remains provider-pending');
  await page.close();await context.close();
}

async function walletActions(){
  const context=await browser.newContext();
  const html=`<div id="walletActionStatus"></div><div id="walletAssetList"></div>`;
  const {page,errors}=await originPage(context,html);
  const from='0x1111111111111111111111111111111111111111';const to='0x2222222222222222222222222222222222222222';
  await page.evaluate(({from})=>{
    const provider={isRabby:true,selectedAddress:from,async request({method,params}){if(method==='eth_accounts')return[from];if(method==='eth_chainId')return'0x1';if(method==='eth_sendTransaction'){window.__walletTx=params?.[0]||null;return'0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa';}throw new Error('Unexpected method '+method);}};
    window.ethereum=provider;window.nexusConnectedAddress=from;window.nexusConnectedChainId='0x1';window.connectNexusWallet=async()=>{};window.refreshNexusOnchainWallet=async()=>{};
  },{from});
  await page.addScriptTag({url:base+'/js/wallet-actions-v2.js?v=3'});
  await page.waitForFunction(()=>window.nexusWalletActionsVersion==='non-custodial-v3');
  await page.evaluate(()=>window.handleDeposit());
  await page.waitForSelector('#nexusWalletActionModal .nx-wallet-modal-backdrop');
  assert.match(await page.textContent('#nexusWalletActionModal'),/Ethereum Mainnet/i);assert.match(await page.textContent('#nexusWalletActionModal'),new RegExp(from,'i'));
  const depositAssets=await page.locator('#nxDepositAsset option').allTextContents();assert.deepEqual(depositAssets,['ETH','USDT','USDC']);
  await page.click('#nexusModalClose');
  await page.evaluate(()=>window.handleWithdraw());await page.waitForSelector('#nxWithdrawSubmit');await page.selectOption('#nxWithdrawAsset','ETH');await page.fill('#nxWithdrawAmount','0.01');await page.fill('#nxWithdrawAddress',to);await page.click('#nxWithdrawSubmit');await page.waitForFunction(()=>Boolean(window.__walletTx));
  const nativeTx=await page.evaluate(()=>window.__walletTx);assert.equal(nativeTx.from.toLowerCase(),from.toLowerCase());assert.equal(nativeTx.to.toLowerCase(),to.toLowerCase());assert.equal(nativeTx.value,'0x2386f26fc10000');await page.click('#nexusModalClose');
  await page.evaluate(()=>{window.__walletTx=null;window.handleWithdraw();});await page.waitForSelector('#nxWithdrawSubmit');await page.selectOption('#nxWithdrawAsset','USDC');await page.fill('#nxWithdrawAmount','1.5');await page.fill('#nxWithdrawAddress',to);await page.click('#nxWithdrawSubmit');await page.waitForFunction(()=>Boolean(window.__walletTx));
  const tokenTx=await page.evaluate(()=>window.__walletTx);assert.equal(tokenTx.to.toLowerCase(),'0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48');assert.match(tokenTx.data,/^0xa9059cbb/i);assert.ok(tokenTx.data.toLowerCase().includes(to.slice(2).toLowerCase().padStart(64,'0')));assert.ok(tokenTx.data.toLowerCase().endsWith(BigInt(1500000).toString(16).padStart(64,'0')));
  assert.equal(errors.length,0,errors.join('\n'));console.log('PASS Wallet — connected deposit address + native/ERC20 wallet-signed transfer payloads passed');
  await page.close();await context.close();
}

try{await browserCallerQibla();await smartBrief();await qrRepair();await walletActions();console.log('\nExtra runtime smoke complete: 6 feature groups passed.');}finally{await browser.close();}
