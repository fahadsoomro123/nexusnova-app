/* NexusNova Premium Settings v1
   Replaces the native display-name prompt with a NexusNova visual profile form. */
(() => {
  'use strict';
  if (window.__nxPremiumSettingsV1) return;
  window.__nxPremiumSettingsV1 = true;
  let uiPromise = null;

  function getUI(){
    if(window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if(uiPromise) return uiPromise;
    uiPromise = new Promise((resolve,reject)=>{
      const existing=document.querySelector('script[data-nx-premium-ui]');
      const done=()=>window.NexusNovaUI?resolve(window.NexusNovaUI):reject(new Error('Premium UI did not initialize.'));
      if(existing){
        window.addEventListener('nexusnova:premium-ui-ready',done,{once:true});
        setTimeout(done,1200);
        return;
      }
      const script=document.createElement('script');
      script.src='./js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPremiumUi='1';
      script.onload=done;
      script.onerror=()=>reject(new Error('Premium UI could not be loaded.'));
      document.body.appendChild(script);
    }).finally(()=>{uiPromise=null;});
    return uiPromise;
  }

  async function firebase(){
    const [{getApps},authLib,dbLib]=await Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js')
    ]);
    const apps=getApps();
    if(!apps.length) throw new Error('Firebase app is not initialized.');
    return {auth:authLib.getAuth(apps[0]),db:dbLib.getFirestore(apps[0]),...dbLib};
  }

  async function editProfile(){
    const ui=await getUI();
    try{
      const f=await firebase();
      const user=f.auth.currentUser;
      if(!user){
        await ui.alert({eyebrow:'PROFILE SETTINGS',title:'Account Not Ready',text:'Sign in first to edit your NexusNova profile.',icon:'user'});
        return;
      }
      const currentName=(document.getElementById('settingsName')?.textContent||document.getElementById('profileName')?.textContent||user.displayName||'Miner User').trim();
      const data=await ui.form({
        eyebrow:'PROFILE SETTINGS',
        title:'Edit NexusNova Profile',
        subtitle:'Update the name shown across your NexusNova account.',
        icon:'user',
        submitText:'Save Profile',
        fields:[{name:'name',label:'Display Name',icon:'user',value:currentName,placeholder:'Your display name',required:true,wide:true,hint:'Maximum 80 characters.'}]
      });
      if(!data) return;
      const name=String(data.name||'').trim();
      if(!name || name.length>80){
        await ui.alert({eyebrow:'PROFILE SETTINGS',title:'Check Display Name',text:'Display name must be between 1 and 80 characters.',icon:'user'});
        return;
      }
      await f.updateDoc(f.doc(f.db,'users',user.uid),{name});
      const settingsName=document.getElementById('settingsName');
      const profileName=document.getElementById('profileName');
      if(settingsName) settingsName.textContent=name;
      if(profileName) profileName.textContent=name;
      ui.toast('NexusNova profile updated.');
    }catch(error){
      console.error('Premium profile settings:',error);
      await ui.alert({eyebrow:'PROFILE SETTINGS',title:'Could Not Update Profile',text:error?.message||'Profile could not be updated right now.',icon:'security'});
    }
  }

  function install(){
    window.editSettingsProfile=editProfile;
  }

  const boot=()=>{getUI().catch(()=>{});install();[1500,3500,7000].forEach(ms=>setTimeout(install,ms));};
  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',boot,{once:true});
  else boot();
})();