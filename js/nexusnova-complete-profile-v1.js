/* NexusNova Complete Profile v1
   Privacy-first profile completion for the authenticated owner.
   Profile photos are resized to 256x256 JPEG before Firestore storage.
*/
(() => {
  'use strict';
  if (window.__nxCompleteProfileV1) return;
  window.__nxCompleteProfileV1 = true;

  const FIREBASE_VERSION = '12.1.0';
  const APP_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-app.js`;
  const AUTH_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-auth.js`;
  const FS_URL = `https://www.gstatic.com/firebasejs/${FIREBASE_VERSION}/firebase-firestore.js`;
  const MAX_SOURCE_BYTES = 8 * 1024 * 1024;
  const MAX_PHOTO_DATA_LENGTH = 180000;

  let auth = null;
  let db = null;
  let fs = null;
  let authMod = null;
  let profile = {};
  let pendingPhoto = '';
  let unsubscribe = null;

  const text = value => String(value ?? '').trim();
  const put = (id, value) => {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  };

  function ensureStyles() {
    if (document.getElementById('nxCompleteProfileStyle')) return;
    const style = document.createElement('style');
    style.id = 'nxCompleteProfileStyle';
    style.textContent = `
      #tab-profile .profile-avatar.nx-profile-avatar{width:104px;height:104px;margin:0 auto 12px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:linear-gradient(145deg,rgba(14,165,233,.18),rgba(34,211,238,.06));border:2px solid rgba(103,232,249,.28);box-shadow:0 12px 28px rgba(0,0,0,.25)}
      #tab-profile .nx-profile-avatar img{width:100%;height:100%;object-fit:cover;display:none}
      #tab-profile .nx-profile-avatar .nx-profile-placeholder{font-size:36px;font-weight:950;color:#67e8f9}
      .nx-profile-completion{margin-top:12px;padding:11px;border-radius:14px;background:rgba(15,23,42,.58);border:1px solid rgba(148,163,184,.1)}
      .nx-profile-completion-head{display:flex;justify-content:space-between;gap:12px;font-size:10px;color:#8ba4b7}.nx-profile-completion-head strong{color:#eaf7ff;font-size:11px}
      .nx-profile-bar{height:7px;margin-top:8px;border-radius:999px;background:rgba(148,163,184,.12);overflow:hidden}.nx-profile-bar>i{display:block;height:100%;width:0;background:linear-gradient(90deg,#0ea5e9,#22d3ee);transition:width .25s ease}
      .nx-profile-details-grid{display:grid;grid-template-columns:1fr 1fr;gap:9px;margin-top:12px}.nx-profile-detail{padding:10px;border-radius:13px;background:rgba(15,23,42,.5);border:1px solid rgba(148,163,184,.1)}.nx-profile-detail small{display:block;color:#6f879a;font-size:9px;text-transform:uppercase;letter-spacing:.07em}.nx-profile-detail strong{display:block;color:#edf8ff;font-size:11px;margin-top:4px;word-break:break-word}
      .nx-profile-bio{margin-top:10px;padding:11px;border-radius:13px;background:rgba(15,23,42,.44);border:1px solid rgba(148,163,184,.1);font-size:11px;line-height:1.5;color:#9eb3c3;white-space:pre-wrap}
      .nx-profile-verified{display:inline-flex;align-items:center;gap:5px;margin-top:7px;padding:4px 8px;border-radius:999px;font-size:9px;font-weight:900;background:rgba(34,197,94,.1);color:#4ade80;border:1px solid rgba(34,197,94,.18)}.nx-profile-verified.no{background:rgba(245,158,11,.08);color:#fbbf24;border-color:rgba(245,158,11,.18)}
      #nxProfileModal{position:fixed;inset:0;z-index:10050;display:none;align-items:center;justify-content:center;padding:18px;background:rgba(2,6,23,.78);backdrop-filter:blur(8px)}#nxProfileModal.open{display:flex}
      .nx-profile-modal-card{width:min(540px,100%);max-height:92vh;overflow:auto;border-radius:22px;background:linear-gradient(150deg,#071827,#0b2236);border:1px solid rgba(103,232,249,.2);box-shadow:0 28px 70px rgba(0,0,0,.5);padding:18px}
      .nx-profile-modal-head{display:flex;align-items:center;justify-content:space-between;gap:12px;margin-bottom:14px}.nx-profile-modal-head h3{margin:0;color:#f4fbff}.nx-profile-close{border:0;background:rgba(148,163,184,.1);color:#dbeafe;width:34px;height:34px;border-radius:11px;cursor:pointer;font-size:18px}
      .nx-profile-photo-edit{display:flex;align-items:center;gap:14px;padding:12px;border-radius:16px;background:rgba(15,23,42,.55);border:1px solid rgba(148,163,184,.1)}.nx-profile-photo-preview{width:78px;height:78px;border-radius:50%;overflow:hidden;display:grid;place-items:center;background:#0b1827;border:1px solid rgba(103,232,249,.25);flex:0 0 auto}.nx-profile-photo-preview img{width:100%;height:100%;object-fit:cover;display:none}.nx-profile-photo-preview span{font-size:27px;color:#67e8f9;font-weight:950}
      .nx-profile-photo-actions{display:flex;flex-wrap:wrap;gap:7px}.nx-profile-photo-actions label,.nx-profile-photo-actions button{border:1px solid rgba(103,232,249,.18);background:rgba(14,165,233,.12);color:#dff8ff;border-radius:10px;padding:8px 10px;font-size:10px;font-weight:800;cursor:pointer}.nx-profile-photo-actions button{background:rgba(239,68,68,.09);border-color:rgba(248,113,113,.18);color:#fecaca}
      .nx-profile-field{margin-top:12px}.nx-profile-field label{display:block;font-size:9px;text-transform:uppercase;letter-spacing:.08em;color:#7992a6;margin-bottom:5px}.nx-profile-field input,.nx-profile-field textarea{width:100%;border-radius:12px;border:1px solid rgba(148,163,184,.14);background:rgba(2,8,23,.72);color:#f8fafc;padding:11px 12px;outline:none}.nx-profile-field textarea{min-height:82px;resize:vertical}.nx-profile-two{display:grid;grid-template-columns:1fr 1fr;gap:10px}
      .nx-profile-save-row{display:flex;gap:9px;margin-top:15px}.nx-profile-save-row button{flex:1}.nx-profile-status{min-height:18px;margin-top:9px;font-size:10px;color:#8ba4b7;text-align:center}
      @media(max-width:540px){.nx-profile-details-grid,.nx-profile-two{grid-template-columns:1fr}.nx-profile-photo-edit{align-items:flex-start}}
    `;
    document.head.appendChild(style);
  }

  function ensureUI() {
    ensureStyles();
    const tab = document.getElementById('tab-profile');
    if (!tab) return false;

    const hero = tab.querySelector('.card');
    const avatar = hero?.querySelector('.profile-avatar');
    if (avatar && !avatar.classList.contains('nx-profile-avatar')) {
      avatar.classList.add('nx-profile-avatar');
      avatar.innerHTML = '<img id="nxProfilePhoto" alt="Profile picture"><span class="nx-profile-placeholder" id="nxProfilePlaceholder">N</span>';
    }

    if (hero && !document.getElementById('nxProfileCompletion')) {
      const completion = document.createElement('div');
      completion.id = 'nxProfileCompletion';
      completion.className = 'nx-profile-completion';
      completion.innerHTML = `
        <div class="nx-profile-completion-head"><strong>Profile completion</strong><span id="nxProfileCompletionText">0%</span></div>
        <div class="nx-profile-bar"><i id="nxProfileCompletionBar"></i></div>
        <div id="nxProfileVerifyBadge" class="nx-profile-verified no">○ EMAIL NOT VERIFIED</div>
        <button id="nxCompleteProfileBtn" type="button" class="action-btn primary" style="width:100%;margin-top:10px">COMPLETE PROFILE</button>`;
      hero.appendChild(completion);
      completion.querySelector('#nxCompleteProfileBtn')?.addEventListener('click', openModal);
    }

    if (!document.getElementById('nxProfileDetailsCard')) {
      const details = document.createElement('div');
      details.id = 'nxProfileDetailsCard';
      details.className = 'card';
      details.innerHTML = `
        <div class="market-header"><div><h3>Profile Details</h3><div class="market-count">Private account profile</div></div><button id="nxEditProfileBtn" class="refresh-btn" type="button">Edit</button></div>
        <div class="nx-profile-details-grid">
          <div class="nx-profile-detail"><small>Location</small><strong id="nxProfileLocation">Not added</strong></div>
          <div class="nx-profile-detail"><small>Member Since</small><strong id="nxProfileJoined">—</strong></div>
        </div>
        <div class="nx-profile-bio" id="nxProfileBio">Add a short bio so your profile feels complete.</div>`;
      const accountStats = Array.from(tab.querySelectorAll('.card')).find(card => /Account Stats/i.test(card.textContent || ''));
      if (accountStats) accountStats.insertAdjacentElement('beforebegin', details);
      else tab.appendChild(details);
      details.querySelector('#nxEditProfileBtn')?.addEventListener('click', openModal);
    }

    ensureModal();
    return true;
  }

  function ensureModal() {
    if (document.getElementById('nxProfileModal')) return;
    const modal = document.createElement('div');
    modal.id = 'nxProfileModal';
    modal.setAttribute('role', 'dialog');
    modal.setAttribute('aria-modal', 'true');
    modal.innerHTML = `
      <div class="nx-profile-modal-card">
        <div class="nx-profile-modal-head"><div><h3>Complete Your Profile</h3><div style="font-size:10px;color:#7891a5;margin-top:3px">Only your own account profile is updated.</div></div><button class="nx-profile-close" id="nxProfileClose" type="button" aria-label="Close">×</button></div>
        <div class="nx-profile-photo-edit">
          <div class="nx-profile-photo-preview"><img id="nxProfilePreview" alt="Selected profile picture"><span id="nxProfilePreviewPlaceholder">N</span></div>
          <div><div style="font-size:11px;font-weight:850;color:#edf8ff;margin-bottom:7px">Profile Picture</div><div class="nx-profile-photo-actions"><label>UPLOAD PHOTO<input id="nxProfileFile" type="file" accept="image/jpeg,image/png,image/webp" hidden></label><button id="nxProfileRemovePhoto" type="button">REMOVE</button></div><div style="font-size:9px;color:#71879a;margin-top:6px">JPG, PNG or WebP • automatically resized to 256×256</div></div>
        </div>
        <div class="nx-profile-field"><label>Display Name</label><input id="nxProfileNameInput" maxlength="80" autocomplete="name" placeholder="Your name"></div>
        <div class="nx-profile-field"><label>Short Bio</label><textarea id="nxProfileBioInput" maxlength="180" placeholder="A short line about you"></textarea></div>
        <div class="nx-profile-two"><div class="nx-profile-field"><label>City</label><input id="nxProfileCityInput" maxlength="80" placeholder="City"></div><div class="nx-profile-field"><label>Country</label><input id="nxProfileCountryInput" maxlength="80" placeholder="Country"></div></div>
        <div class="nx-profile-save-row"><button id="nxProfileCancel" type="button" class="action-btn">CANCEL</button><button id="nxProfileSave" type="button" class="action-btn primary">SAVE PROFILE</button></div>
        <div id="nxProfileStatus" class="nx-profile-status"></div>
      </div>`;
    document.body.appendChild(modal);

    modal.querySelector('#nxProfileClose')?.addEventListener('click', closeModal);
    modal.querySelector('#nxProfileCancel')?.addEventListener('click', closeModal);
    modal.addEventListener('click', event => { if (event.target === modal) closeModal(); });
    modal.querySelector('#nxProfileFile')?.addEventListener('change', onPhotoSelected);
    modal.querySelector('#nxProfileRemovePhoto')?.addEventListener('click', () => {
      pendingPhoto = '';
      renderPreview('');
      setStatus('Profile picture will be removed when you save.');
    });
    modal.querySelector('#nxProfileSave')?.addEventListener('click', saveProfile);
  }

  function completionFor(data) {
    let score = 0;
    const name = text(data?.name);
    if (name && name.toLowerCase() !== 'miner user') score += 25;
    if (text(data?.photoDataUrl)) score += 25;
    if (text(data?.bio)) score += 20;
    if (text(data?.city)) score += 15;
    if (text(data?.country)) score += 15;
    return score;
  }

  function initials(name) {
    const parts = text(name).split(/\s+/).filter(Boolean).slice(0, 2);
    return (parts.map(part => part[0]).join('') || 'N').toUpperCase();
  }

  function dateLabel(value) {
    try {
      const date = value?.toDate ? value.toDate() : value instanceof Date ? value : value ? new Date(value) : null;
      if (!date || Number.isNaN(date.getTime())) return '—';
      return date.toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'});
    } catch (_) { return '—'; }
  }

  function renderPhoto(dataUrl, name) {
    const img = document.getElementById('nxProfilePhoto');
    const placeholder = document.getElementById('nxProfilePlaceholder');
    if (img) {
      if (dataUrl) { img.src = dataUrl; img.style.display = 'block'; }
      else { img.removeAttribute('src'); img.style.display = 'none'; }
    }
    if (placeholder) {
      placeholder.textContent = initials(name);
      placeholder.style.display = dataUrl ? 'none' : 'block';
    }
  }

  function renderPreview(dataUrl) {
    const img = document.getElementById('nxProfilePreview');
    const placeholder = document.getElementById('nxProfilePreviewPlaceholder');
    const name = document.getElementById('nxProfileNameInput')?.value || profile?.name || 'N';
    if (img) {
      if (dataUrl) { img.src = dataUrl; img.style.display = 'block'; }
      else { img.removeAttribute('src'); img.style.display = 'none'; }
    }
    if (placeholder) {
      placeholder.textContent = initials(name);
      placeholder.style.display = dataUrl ? 'none' : 'block';
    }
  }

  function render(data = {}, user = auth?.currentUser) {
    profile = data || {};
    const name = text(profile.name) || text(user?.displayName) || 'Miner User';
    const email = text(profile.email) || text(user?.email) || 'No email';
    const photo = text(profile.photoDataUrl);
    const completion = completionFor({...profile, name});
    const location = [text(profile.city), text(profile.country)].filter(Boolean).join(', ') || 'Not added';

    put('profileName', name);
    put('profileEmailDisplay', email);
    put('settingsName', name);
    put('settingsEmail', email);
    put('nxProfileLocation', location);
    put('nxProfileJoined', dateLabel(profile.createdAt));
    put('nxProfileBio', text(profile.bio) || 'Add a short bio so your profile feels complete.');
    put('nxProfileCompletionText', `${completion}%`);
    const bar = document.getElementById('nxProfileCompletionBar');
    if (bar) bar.style.width = `${completion}%`;
    const button = document.getElementById('nxCompleteProfileBtn');
    if (button) button.textContent = completion >= 100 ? 'EDIT PROFILE' : 'COMPLETE PROFILE';

    const badge = document.getElementById('nxProfileVerifyBadge');
    if (badge) {
      const verified = Boolean(user?.emailVerified);
      badge.textContent = verified ? '✓ EMAIL VERIFIED' : '○ EMAIL NOT VERIFIED';
      badge.classList.toggle('no', !verified);
    }
    renderPhoto(photo, name);
  }

  function openModal() {
    ensureUI();
    const modal = document.getElementById('nxProfileModal');
    if (!modal) return;
    const user = auth?.currentUser;
    const name = text(profile.name) || text(user?.displayName) || 'Miner User';
    document.getElementById('nxProfileNameInput').value = name;
    document.getElementById('nxProfileBioInput').value = text(profile.bio);
    document.getElementById('nxProfileCityInput').value = text(profile.city);
    document.getElementById('nxProfileCountryInput').value = text(profile.country);
    pendingPhoto = text(profile.photoDataUrl);
    renderPreview(pendingPhoto);
    setStatus('');
    modal.classList.add('open');
    setTimeout(() => document.getElementById('nxProfileNameInput')?.focus(), 30);
  }

  function closeModal() {
    document.getElementById('nxProfileModal')?.classList.remove('open');
    const file = document.getElementById('nxProfileFile');
    if (file) file.value = '';
  }

  function setStatus(message, good = false) {
    const el = document.getElementById('nxProfileStatus');
    if (!el) return;
    el.textContent = message || '';
    el.style.color = good ? '#4ade80' : message ? '#fbbf24' : '#8ba4b7';
  }

  function fileToDataURL(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Could not read the selected image.'));
      reader.onload = () => resolve(String(reader.result || ''));
      reader.readAsDataURL(file);
    });
  }

  function imageFromURL(url) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error('The selected file is not a readable image.'));
      img.src = url;
    });
  }

  async function compressPhoto(file) {
    if (!file || !String(file.type || '').startsWith('image/')) throw new Error('Choose a JPG, PNG or WebP image.');
    if (file.size > MAX_SOURCE_BYTES) throw new Error('Photo is too large. Choose an image under 8 MB.');
    const source = await fileToDataURL(file);
    const img = await imageFromURL(source);
    const canvas = document.createElement('canvas');
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext('2d', {alpha:false});
    if (!ctx) throw new Error('Image processing is not available in this browser.');
    ctx.fillStyle = '#0b1827';
    ctx.fillRect(0, 0, 256, 256);
    const side = Math.min(img.naturalWidth || img.width, img.naturalHeight || img.height);
    const sx = ((img.naturalWidth || img.width) - side) / 2;
    const sy = ((img.naturalHeight || img.height) - side) / 2;
    ctx.drawImage(img, sx, sy, side, side, 0, 0, 256, 256);
    for (const quality of [0.82, 0.68, 0.54]) {
      const result = canvas.toDataURL('image/jpeg', quality);
      if (result.length <= MAX_PHOTO_DATA_LENGTH) return result;
    }
    throw new Error('Photo could not be compressed enough. Try another image.');
  }

  async function onPhotoSelected(event) {
    const file = event.target?.files?.[0];
    if (!file) return;
    setStatus('Preparing profile picture…');
    try {
      pendingPhoto = await compressPhoto(file);
      renderPreview(pendingPhoto);
      setStatus('Photo ready. Save profile to apply it.', true);
    } catch (error) {
      pendingPhoto = text(profile.photoDataUrl);
      renderPreview(pendingPhoto);
      setStatus(error.message || 'Could not prepare the photo.');
    }
  }

  async function saveProfile() {
    const user = auth?.currentUser;
    if (!user || !db || !fs) {
      setStatus('Your account is still loading. Try again in a moment.');
      return;
    }
    const name = text(document.getElementById('nxProfileNameInput')?.value);
    const bio = text(document.getElementById('nxProfileBioInput')?.value);
    const city = text(document.getElementById('nxProfileCityInput')?.value);
    const country = text(document.getElementById('nxProfileCountryInput')?.value);

    if (!name) return setStatus('Name cannot be empty.');
    if (name.length > 80 || bio.length > 180 || city.length > 80 || country.length > 80) return setStatus('One of the profile fields is too long.');
    if (pendingPhoto && (!pendingPhoto.startsWith('data:image/jpeg;base64,') || pendingPhoto.length > MAX_PHOTO_DATA_LENGTH)) return setStatus('Profile photo did not pass the safety check.');

    const saveBtn = document.getElementById('nxProfileSave');
    if (saveBtn) { saveBtn.disabled = true; saveBtn.textContent = 'SAVING…'; }
    setStatus('Saving secure profile…');

    try {
      await fs.updateDoc(fs.doc(db, 'users', user.uid), {
        name,
        photoDataUrl: pendingPhoto,
        bio,
        city,
        country,
        profileUpdatedAt: fs.serverTimestamp()
      });
      try { await authMod.updateProfile(user, {displayName:name}); } catch (_) {}
      profile = {...profile, name, photoDataUrl:pendingPhoto, bio, city, country};
      render(profile, user);
      setStatus('Profile saved.', true);
      setTimeout(closeModal, 450);
    } catch (error) {
      console.error('NexusNova profile save:', error);
      const denied = String(error?.code || '').includes('permission-denied');
      setStatus(denied ? 'Profile save is waiting for the latest Firestore security rules to be published.' : (error.message || 'Could not save profile.'));
    } finally {
      if (saveBtn) { saveBtn.disabled = false; saveBtn.textContent = 'SAVE PROFILE'; }
    }
  }

  async function waitForApp(appMod) {
    for (let i = 0; i < 48; i++) {
      const app = appMod.getApps()[0];
      if (app) return app;
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    return null;
  }

  async function connectFirebase() {
    try {
      const [appMod, authModule, fsModule] = await Promise.all([import(APP_URL), import(AUTH_URL), import(FS_URL)]);
      const app = await waitForApp(appMod);
      if (!app) return;
      authMod = authModule;
      fs = fsModule;
      auth = authModule.getAuth(app);
      db = fsModule.getFirestore(app);
      authModule.onAuthStateChanged(auth, user => {
        if (unsubscribe) { try { unsubscribe(); } catch (_) {} unsubscribe = null; }
        if (!user) { render({}, null); return; }
        const ref = fsModule.doc(db, 'users', user.uid);
        unsubscribe = fsModule.onSnapshot(ref, snap => {
          if (snap.exists()) render(snap.data() || {}, user);
        }, error => console.warn('NexusNova profile listener:', error));
      });
    } catch (error) {
      console.warn('NexusNova Complete Profile Firebase:', error);
    }
  }

  function boot() {
    ensureUI();
    [250, 900, 1800, 3500].forEach(ms => setTimeout(ensureUI, ms));
    window.nexusOpenCompleteProfile = openModal;
    // Settings "Edit" should open the same full profile editor instead of a name-only prompt.
    window.editSettingsProfile = openModal;
    document.addEventListener('keydown', event => {
      if (event.key === 'Escape' && document.getElementById('nxProfileModal')?.classList.contains('open')) closeModal();
    });
    connectFirebase();
  }

  window.nexusCompressProfilePhoto = compressPhoto;
  window.nexusProfileCompletion = completionFor;

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot, {once:true});
  else boot();
})();