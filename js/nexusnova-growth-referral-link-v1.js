/* NexusNova Growth Referral Link Guard v1.2
   Sends every referral copy/share action to the official NexusNova website
   account gateway so the referral can be captured before signup. */
(() => {
  'use strict';
  if (window.__nxGrowthReferralLinkV1) return;
  window.__nxGrowthReferralLinkV1 = true;

  const CODE_RE=/^NVX-[A-Z0-9]{8,16}$/;
  const WEBSITE_SIGNUP='https://nexusnovatools.com/register.html';

  function currentCode(){
    const code=String(document.getElementById('nxReferralCode')?.textContent||'').trim().toUpperCase();
    return CODE_RE.test(code)?code:'';
  }

  function referralUrl(code){
    const clean=String(code||'').trim().toUpperCase();
    if(!CODE_RE.test(clean)) return WEBSITE_SIGNUP;
    return `${WEBSITE_SIGNUP}?ref=${encodeURIComponent(clean)}`;
  }

  function setStatus(text){
    const el=document.getElementById('nxGrowthStatus');
    if(el){el.textContent=text;el.style.color='#22c55e';}
  }

  async function copy(url){
    if(navigator.clipboard?.writeText){
      await navigator.clipboard.writeText(url);
      return;
    }
    const area=document.createElement('textarea');
    area.value=url;
    area.style.position='fixed';
    area.style.opacity='0';
    document.body.appendChild(area);
    area.select();
    document.execCommand?.('copy');
    area.remove();
  }

  async function copyCurrentReferral(){
    const code=currentCode();
    if(!code){
      window.nexusOpenGrowthCenter?.();
      setStatus('Referral code is still syncing…');
      return false;
    }
    await copy(referralUrl(code));
    setStatus('Website signup referral link copied. Share it with a real new user.');
    return true;
  }

  function syncLegacyProfile(){
    const code=currentCode();
    const legacy=document.getElementById('refCodeDisplay');
    if(code&&legacy) legacy.textContent=code;
    window.copyReferral=copyCurrentReferral;
  }

  document.addEventListener('click',event=>{
    const button=event.target?.closest?.('#nxCopyReferral,#nxShareReferral');
    if(!button)return;
    const code=currentCode();
    if(!code)return;
    const url=referralUrl(code);
    event.preventDefault();
    event.stopImmediatePropagation();

    if(button.id==='nxShareReferral'&&navigator.share){
      navigator.share({title:'Join NexusNova',text:'Join NexusNova with my referral link.',url})
        .then(()=>setStatus('Website signup invite shared.'))
        .catch(()=>copy(url).then(()=>setStatus('Website signup referral link copied.')));
      return;
    }
    copy(url).then(()=>setStatus('Website signup referral link copied. Share it with a real new user.'))
      .catch(error=>console.warn('NexusNova referral link copy:',error));
  },true);

  window.nexusGrowthReferralUrl=code=>referralUrl(code);
  window.nexusCopySecureReferral=copyCurrentReferral;
  [0,300,800,1600,3200,6000].forEach(ms=>setTimeout(syncLegacyProfile,ms));
})();
