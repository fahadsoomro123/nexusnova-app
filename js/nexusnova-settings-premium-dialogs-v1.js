/* NexusNova Settings Premium Dialogs v1
   Late additive replacement for legacy browser alert/confirm Settings actions.
   Existing account/profile, theme and settings storage logic stays untouched.
*/
(() => {
  'use strict';
  if (window.__nxSettingsPremiumDialogsV1) return;
  window.__nxSettingsPremiumDialogsV1 = true;

  const $ = id => document.getElementById(id);
  let uiPromise = null;
  let authPromise = null;

  function getUI() {
    if (window.NexusNovaUI) return Promise.resolve(window.NexusNovaUI);
    if (uiPromise) return uiPromise;
    uiPromise = new Promise(resolve => {
      const done = () => resolve(window.NexusNovaUI || null);
      const existing = document.querySelector('script[data-nx-premium-ui],script[data-nx-experience-premium],script[data-nx-popup-premium]');
      if (existing) {
        window.addEventListener('nexusnova:premium-ui-ready', done, {once:true});
        setTimeout(done,1400);
        return;
      }
      const script = document.createElement('script');
      script.src = './js/nexusnova-premium-ui-v1.js?v=1';
      script.dataset.nxPremiumUi = '1';
      script.onload = done;
      script.onerror = done;
      document.body.appendChild(script);
    }).finally(() => { uiPromise = null; });
    return uiPromise;
  }

  async function authParts() {
    if (authPromise) return authPromise;
    authPromise = Promise.all([
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js'),
      import('https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js')
    ]).then(([appMod,authMod]) => {
      const apps = appMod.getApps();
      if (!apps.length) throw new Error('Firebase account service is not ready yet.');
      return {auth:authMod.getAuth(apps[0]), authMod};
    }).finally(() => { authPromise = null; });
    return authPromise;
  }

  async function notice({title='NexusNova',subtitle='',text='',icon='spark',buttonText='OK'}={}) {
    const ui = await getUI();
    if (ui?.alert) return ui.alert({eyebrow:'NEXUSNOVA SETTINGS',title,subtitle,text,icon,buttonText});
    const status = $('settingsActionStatus');
    if (status) status.textContent = text || title;
    return true;
  }

  async function confirmAction({title,text,icon='security',confirmText='Continue',cancelText='Cancel'}={}) {
    const ui = await getUI();
    if (!ui?.confirm) return false;
    return ui.confirm({eyebrow:'NEXUSNOVA SETTINGS',title,text,icon,confirmText,cancelText});
  }

  function paintVerification(user) {
    const status = $('emailVerificationStatus');
    const refresh = $('refreshEmailVerificationBtn');
    const resend = $('resendEmailVerificationBtn');
    const verified = Boolean(user?.emailVerified);
    const canVerify = Boolean(user?.email);
    if (status) {
      status.textContent = !user
        ? 'Sign in to check verification.'
        : !canVerify
          ? 'No verified email is attached to this account.'
          : verified
            ? 'Verified. Secure account access is refreshed.'
            : 'Not verified. Open the latest email, then choose Refresh.';
    }
    if (refresh) refresh.disabled = !canVerify || verified;
    if (resend) resend.disabled = !canVerify || verified;
  }

  async function currentUser() {
    const {auth} = await authParts();
    const user = auth.currentUser;
    if (!user) throw new Error('Sign in first to use this account action.');
    return user;
  }

  async function sendPasswordResetPremium() {
    try {
      const {auth,authMod} = await authParts();
      const user = auth.currentUser;
      if (!user?.email) throw new Error('No account email is available.');
      await authMod.sendPasswordResetEmail(auth,user.email);
      await notice({
        title:'Password Reset Email Sent',
        subtitle:user.email,
        text:'Open the latest email from Firebase/Auth and follow the secure password-reset link.',
        icon:'security'
      });
    } catch (error) {
      await notice({title:'Could Not Send Reset Email',text:error?.message || 'Password reset is unavailable right now.',icon:'security'});
    }
  }

  async function refreshEmailVerificationPremium() {
    try {
      const user = await currentUser();
      await user.reload();
      await user.getIdToken(true);
      paintVerification(user);
      await notice({
        title:user.emailVerified ? 'Email Verified' : 'Email Not Verified Yet',
        subtitle:user.email || '',
        text:user.emailVerified
          ? 'Secure account access has been refreshed.'
          : 'Open the latest verification email, complete verification, then tap Refresh again.',
        icon:user.emailVerified ? 'security' : 'contact'
      });
    } catch (error) {
      await notice({title:'Could Not Refresh Verification',text:error?.message || 'Verification status could not be refreshed.',icon:'security'});
    }
  }

  async function resendEmailVerificationPremium() {
    try {
      const {auth,authMod} = await authParts();
      const user = auth.currentUser;
      if (!user?.email) throw new Error('No account email is available.');
      await user.reload();
      if (user.emailVerified) {
        paintVerification(user);
        await notice({title:'Already Verified',subtitle:user.email,text:'This account email is already verified.',icon:'security'});
        return;
      }
      await authMod.sendEmailVerification(user);
      paintVerification(user);
      await notice({title:'Verification Email Sent',subtitle:user.email,text:'Open the newest verification email, complete it, then return to NexusNova and tap Refresh.',icon:'contact'});
    } catch (error) {
      await notice({title:'Could Not Send Verification Email',text:error?.message || 'Verification email could not be sent.',icon:'security'});
    }
  }

  async function clearAiDataPremium() {
    const yes = await confirmAction({
      title:'Clear Saved AI Data?',
      text:'This removes NexusNova AI chat history, saved AI memory and AI notes stored locally on this device for this app. It does not delete your Firebase account.',
      icon:'security',
      confirmText:'Clear AI Data',
      cancelText:'Keep Data'
    });
    if (!yes) return;
    const remove = [];
    for (let i=0;i<localStorage.length;i+=1) {
      const key = localStorage.key(i);
      if (!key) continue;
      if (/^(?:nexusnova_ai_|nexusnova_chat_history$)/i.test(key)) remove.push(key);
    }
    remove.forEach(key=>localStorage.removeItem(key));
    await notice({title:'Local AI Data Cleared',text:`Removed ${remove.length} saved AI data item${remove.length===1?'':'s'} from this device.`,icon:'security'});
  }

  async function requestLocationPremium() {
    if (!navigator.geolocation) {
      await notice({title:'Location Not Supported',text:'This browser/device does not expose geolocation to NexusNova.',icon:'security'});
      return;
    }
    await new Promise(resolve => {
      navigator.geolocation.getCurrentPosition(async position => {
        await notice({
          title:'Location Permission Working',
          subtitle:'Privacy check complete',
          text:`NexusNova received a one-time location fix with about ${Math.round(Number(position.coords.accuracy)||0)} meter accuracy.`,
          icon:'search'
        });
        resolve();
      },async error => {
        await notice({title:'Location Permission Unavailable',text:error?.message || 'Location permission was not granted.',icon:'security'});
        resolve();
      },{enableHighAccuracy:false,timeout:12000,maximumAge:30000});
    });
  }

  async function mediaPermission(kind) {
    const label = kind === 'video' ? 'Camera' : 'Microphone';
    if (!navigator.mediaDevices?.getUserMedia) {
      await notice({title:`${label} Not Supported`,text:`This browser/device does not expose ${label.toLowerCase()} access to NexusNova.`,icon:'security'});
      return;
    }
    try {
      const constraints = kind === 'video' ? {video:true,audio:false} : {video:false,audio:true};
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      stream.getTracks().forEach(track=>track.stop());
      await notice({title:`${label} Permission Working`,text:`NexusNova successfully checked ${label.toLowerCase()} access and immediately released the device.`,icon:'security'});
    } catch (error) {
      await notice({title:`${label} Permission Unavailable`,text:error?.message || `${label} permission was not granted.`,icon:'security'});
    }
  }

  function install() {
    // Re-assert these late because page2-core is a module and may finish after
    // classic scripts on a slow connection. Profile editing is intentionally
    // excluded because Complete Profile owns that newer flow.
    window.sendPasswordReset = sendPasswordResetPremium;
    window.refreshEmailVerification = refreshEmailVerificationPremium;
    window.resendEmailVerification = resendEmailVerificationPremium;
    window.clearNexusAIData = clearAiDataPremium;
    window.requestNexusLocation = requestLocationPremium;
    window.checkNexusCamera = () => mediaPermission('video');
    window.checkNexusMicrophone = () => mediaPermission('audio');
    getUI().catch(()=>{});
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded',install,{once:true});
  else install();
  [700,1800,4000,8000,14000].forEach(ms=>setTimeout(install,ms));
})();