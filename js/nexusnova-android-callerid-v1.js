/* NexusNova Android Caller ID bridge.
 * Safe no-op on normal web/PWA builds.
 */
(() => {
  "use strict";
  const ACCOUNT_SCOPED_ACTIONS = new Set(["saveContact", "deleteContact"]);
  const hasNative = () => typeof window.NexusAndroid?.postMessage === "function";
  const activeAccountId = () => { const accountId=String(window.nexusAccountId||"").trim(); return accountId.length<=128?accountId:""; };

  window.nexusPostNativeAction = function (action, payload = {}) {
    if (!hasNative()) return false;
    try {
      const message = { action, ...payload };
      if (ACCOUNT_SCOPED_ACTIONS.has(action)) { const accountId=activeAccountId(); if(!accountId)return false; message.accountId=accountId; }
      window.NexusAndroid.postMessage(JSON.stringify(message)); return true;
    } catch (error) { console.warn("NexusNova native bridge:", error); return false; }
  };

  window.nexusRequestAndroidCallerRole = function () { if (!window.nexusPostNativeAction("requestCallerRole")) alert("Android Caller ID is available in the NexusNova Android app."); };
  function updateButton(){const b=document.getElementById("androidCallerSetupBtn");if(b)b.style.display=hasNative()?"block":"none";}
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",updateButton,{once:true});else updateButton();

  function syncActiveAccount({allowClear=false}={}){const accountId=activeAccountId();if(accountId)window.nexusPostNativeAction("setActiveAccount",{accountId});else if(allowClear)window.nexusPostNativeAction("clearActiveAccount");}
  function installLogoutClearHook(){
    const descriptor=Object.getOwnPropertyDescriptor(window,"handleLogout");if(descriptor&&!descriptor.configurable)return;let current=descriptor?.value;
    const wrap=handler=>{if(typeof handler!=="function"||handler.__nexusNativeLogoutWrapped)return handler;const wrapped=async function(...args){const accountId=activeAccountId();const result=await handler.apply(this,args);if(accountId&&!activeAccountId())window.nexusPostNativeAction("clearActiveAccount",{accountId});return result;};Object.defineProperty(wrapped,"__nexusNativeLogoutWrapped",{value:true});return wrapped;};
    Object.defineProperty(window,"handleLogout",{configurable:true,enumerable:descriptor?.enumerable??true,get:()=>current,set:value=>{current=wrap(value);}});current=wrap(current);
  }

  function loadNovaAIEnhancements(){
    if(window.__nxNovaAILoaderV1)return;window.__nxNovaAILoaderV1=true;
    const load=(src,id)=>new Promise(resolve=>{if(document.getElementById(id))return resolve();const s=document.createElement("script");s.id=id;s.src=src;s.defer=true;s.onload=()=>resolve();s.onerror=()=>{console.warn("NOVA AI module unavailable:",src);resolve();};document.head.appendChild(s);});
    load("./js/nexusnova-ai-mobile-v1.js?v=2","nxNovaAIMobileV1Script")
      .then(()=>load("./js/nexusnova-ai-website-mode-v1.js?v=2","nxNovaAIWebsiteModeV1Script"))
      .then(()=>load("./js/nexusnova-ai-options-v1.js?v=2","nxNovaAIOptionsV1Script"))
      .then(()=>load("./js/nexusnova-ai-memory-v1.js?v=1","nxNovaAIMemoryV1Script"))
      .then(()=>load("./js/nexusnova-ai-power-v2.js?v=1","nxNovaAIPowerV2Script"))
      .then(()=>load("./js/nexusnova-ai-v6.js?v=6","nxNovaAIV6Script"))
      .then(()=>load("./js/nexusnova-ai-v6-connection-test-v1.js?v=1","nxNovaAIV6ConnectionTestV1Script"))
      .then(()=>load("./js/nexusnova-ai-chatstyle-v1.js?v=1","nxNovaAIChatStyleV1Script"))
      .then(()=>load("./js/nexusnova-ai-sol57-v1.js?v=1","nxNovaAISol57V1Script"))
      .then(()=>load("./js/nexusnova-ai-sol57-context-v1.js?v=1","nxNovaAISol57ContextV1Script"))
      .then(()=>load("./js/nexusnova-ai-sol57-files-v1.js?v=1","nxNovaAISol57FilesV1Script"));
  }

  installLogoutClearHook();
  window.addEventListener("nexusaccountready",()=>syncActiveAccount());
  window.addEventListener("nexusaccountcleared",()=>syncActiveAccount({allowClear:true}));
  syncActiveAccount();loadNovaAIEnhancements();
})();