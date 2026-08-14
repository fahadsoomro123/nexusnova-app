/* NexusNova Growth Referral Link Guard v1
   Ensures Growth Center copy/share actions pass through referral.html so the
   referral code is captured before signup. */
(() => {
  'use strict';
  if (window.__nxGrowthReferralLinkV1) return;
  window.__nxGrowthReferralLinkV1 = true;

  const CODE_RE=/^NVX-[A-Z0-9]{8,16}$/;

  function currentCode(){
    const code=String(document.getElementById('nxReferralCode')?.textContent||'').trim().toUpperCase();
    return CODE_RE.test(code)?code:'';
  }

  function referralUrl(code){
    const path=window.location.pathname.replace(/[^/]*$/,'referral.html');
    return `${window.location.origin}${path}?ref=${encodeURIComponent(code)}`;
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
        .then(()=>setStatus('Referral invite shared.'))
        .catch(()=>copy(url).then(()=>setStatus('Referral link copied.')));
      return;
    }
    copy(url).then(()=>setStatus('Referral link copied. Share it with a real new user.'))
      .catch(error=>console.warn('NexusNova referral link copy:',error));
  },true);

  window.nexusGrowthReferralUrl=code=>referralUrl(String(code||'').trim().toUpperCase());
})();