import {
  EmailAuthProvider,
  deleteUser,
  reauthenticateWithCredential
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js';
import {
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import {
  firebaseAuth,
  firestoreDb,
  requireFirebaseUser
} from '../../core/firebase-backend.js';

const ACTIVE_HTML_CLASS = 'nx-profile-v1-active';
const SCREEN_CLASS = 'nx-profile-v1';
const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
// Firestore rules allow photoDataUrl as JPEG up to 180000 characters.
// Keep a safety margin for the data URL prefix and future rule checks.
const MAX_PROFILE_DATA_URL = 174_000;

const stage = document.getElementById('nx-stage');
const themeMeta = document.querySelector('meta[name="theme-color"]');
const schemeMeta = document.querySelector('meta[name="color-scheme"]');
const originalThemeColor = themeMeta?.content || '#07111f';
const originalColorScheme = schemeMeta?.content || 'dark';
const lightQuery = window.matchMedia?.('(prefers-color-scheme: light)') || null;

let activeCleanup = null;
let activeScreen = null;

function imageFromFile(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('This image could not be opened.'));
    };
    image.src = url;
  });
}

function renderSquareDataUrl(image, size, quality) {
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext('2d', { alpha: false });
  if (!context) throw new Error('Photo processing is unavailable on this device.');

  const sourceWidth = Math.max(1, Number(image.naturalWidth || image.width) || 1);
  const sourceHeight = Math.max(1, Number(image.naturalHeight || image.height) || 1);
  const side = Math.min(sourceWidth, sourceHeight);
  const sourceX = Math.max(0, (sourceWidth - side) / 2);
  const sourceY = Math.max(0, (sourceHeight - side) / 2);

  context.fillStyle = '#ffffff';
  context.fillRect(0, 0, size, size);
  context.drawImage(image, sourceX, sourceY, side, side, 0, 0, size, size);
  return canvas.toDataURL('image/jpeg', quality);
}

async function prepareProfilePhoto(file) {
  if (!(file instanceof File)) throw new Error('Choose a photo first.');
  if (!/^image\//i.test(file.type || '')) throw new Error('Choose a valid image file.');
  if (file.size > MAX_SOURCE_BYTES) throw new Error('Choose a photo smaller than 12 MB.');

  const image = await imageFromFile(file);
  const passes = [
    [320, 0.82],
    [288, 0.78],
    [256, 0.74],
    [224, 0.68],
    [192, 0.62]
  ];

  for (const [size, quality] of passes) {
    const dataUrl = renderSquareDataUrl(image, size, quality);
    if (/^data:image\/jpeg;base64,/i.test(dataUrl) && dataUrl.length <= MAX_PROFILE_DATA_URL) return dataUrl;
  }
  throw new Error('This photo is still too large after safe compression. Try another image.');
}

function setAvatarPhoto(avatar, dataUrl) {
  const safe = /^data:image\/jpeg;base64,/i.test(String(dataUrl || ''))
    ? String(dataUrl)
    : '';
  if (safe) {
    avatar.style.backgroundImage = `url("${safe}")`;
    avatar.classList.add('has-profile-photo');
  } else {
    avatar.style.removeProperty('background-image');
    avatar.classList.remove('has-profile-photo');
  }
}

function createPhotoInput() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = 'image/*';
  input.hidden = true;
  input.setAttribute('data-profile-photo-file', '');
  return input;
}

function createPhotoToast() {
  const toast = document.createElement('div');
  toast.className = 'nx-profile-photo-toast';
  toast.hidden = true;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');
  Object.assign(toast.style, {
    position:'fixed',
    left:'50%',
    bottom:'calc(env(safe-area-inset-bottom, 0px) + 18px)',
    transform:'translateX(-50%)',
    zIndex:'2147482500',
    maxWidth:'min(88vw, 420px)',
    padding:'10px 14px',
    borderRadius:'14px',
    color:'#ffffff',
    font:'700 11px/1.35 system-ui, -apple-system, Segoe UI, sans-serif',
    textAlign:'center',
    boxShadow:'0 12px 34px rgba(0,0,0,.32)',
    pointerEvents:'none'
  });
  document.body.appendChild(toast);
  return toast;
}

function showPhotoToast(toast, message, tone = 'info', holdMs = 2400) {
  if (!toast) return;
  clearTimeout(toast._hideTimer);
  toast.dataset.tone = tone;
  toast.style.background = tone === 'error'
    ? 'rgba(127,29,29,.97)'
    : tone === 'success'
      ? 'rgba(6,78,59,.97)'
      : 'rgba(17,24,39,.96)';
  toast.textContent = String(message || '');
  toast.hidden = false;
  toast._hideTimer = setTimeout(() => {
    toast.hidden = true;
  }, Math.max(900, Number(holdMs) || 2400));
}

function createAvatarEditBadge() {
  const badge = document.createElement('span');
  badge.setAttribute('aria-hidden', 'true');
  badge.textContent = '✎';
  Object.assign(badge.style, {
    position:'absolute',
    right:'-2px',
    bottom:'-2px',
    width:'20px',
    height:'20px',
    display:'grid',
    placeItems:'center',
    border:'2px solid #07111f',
    borderRadius:'50%',
    background:'linear-gradient(145deg,#5b7cff,#6950d8)',
    color:'#ffffff',
    font:'900 10px/1 system-ui, -apple-system, Segoe UI, sans-serif',
    boxShadow:'0 4px 10px rgba(0,0,0,.28)',
    pointerEvents:'none'
  });
  return badge;
}

function clearAccountScopedLocalData(uid) {
  const safeUid = String(uid || '').trim();
  if (!safeUid) return;
  const keys = [];
  for (let i = 0; i < localStorage.length; i += 1) {
    const key = localStorage.key(i);
    if (!key) continue;
    if (key.includes(safeUid)) keys.push(key);
  }
  keys.forEach(key => {
    try { localStorage.removeItem(key); } catch {}
  });
}

function applyProfileTheme() {
  if (!activeScreen) return;
  const light = Boolean(lightQuery?.matches);
  document.documentElement.dataset.nxProfileTheme = light ? 'light' : 'dark';
  if (themeMeta) themeMeta.content = light ? '#f5f7fb' : '#07111f';
  if (schemeMeta) schemeMeta.content = light ? 'light' : 'dark';
}

function restoreThemeMeta() {
  delete document.documentElement.dataset.nxProfileTheme;
  if (themeMeta) themeMeta.content = originalThemeColor;
  if (schemeMeta) schemeMeta.content = originalColorScheme;
}

function profileScreenFromStage() {
  const avatar = stage?.querySelector('[data-profile-avatar]');
  if (!avatar) return null;
  const screen = avatar.closest('.nx-screen');
  if (!screen) return null;
  return { screen, avatar };
}

function createDangerZone() {
  const section = document.createElement('section');
  section.className = 'nx-profile-danger';
  section.innerHTML = `
    <div>
      <p class="nx-profile-danger__eyebrow">DANGER ZONE</p>
      <h2>Delete account</h2>
      <p>Permanently deletes your Firebase sign-in identity, NexusNova profile document and account-scoped data stored on this device.</p>
    </div>
    <button type="button" data-profile-delete-open>DELETE ACCOUNT</button>`;
  return section;
}

function createDeleteModal() {
  const modal = document.createElement('div');
  modal.className = 'nx-profile-delete-modal';
  modal.hidden = true;
  modal.innerHTML = `
    <section class="nx-profile-delete-card" role="dialog" aria-modal="true" aria-labelledby="nxProfileDeleteTitle">
      <p class="nx-profile-danger__eyebrow">PERMANENT ACTION</p>
      <h2 id="nxProfileDeleteTitle">Delete NexusNova account?</h2>
      <p>This cannot be undone. Enter your current password and type <strong>DELETE</strong> to confirm.</p>
      <label><span>Current password</span><input type="password" autocomplete="current-password" data-profile-delete-password></label>
      <label><span>Type DELETE</span><input type="text" autocomplete="off" autocapitalize="characters" data-profile-delete-word></label>
      <p class="nx-profile-delete-status" data-profile-delete-status>No account data has been changed.</p>
      <div class="nx-profile-delete-actions">
        <button type="button" data-profile-delete-cancel>CANCEL</button>
        <button type="button" data-profile-delete-confirm>DELETE PERMANENTLY</button>
      </div>
    </section>`;
  document.body.appendChild(modal);
  return modal;
}

async function enhanceProfile(screen, avatar) {
  if (screen.dataset.profileV1Enhanced === '1') return () => {};
  screen.dataset.profileV1Enhanced = '1';
  screen.classList.add(SCREEN_CLASS);
  document.documentElement.classList.add(ACTIVE_HTML_CLASS);
  document.body.classList.add(ACTIVE_HTML_CLASS);
  activeScreen = screen;
  applyProfileTheme();

  const back = document.createElement('button');
  back.type = 'button';
  back.className = 'nx-profile-hub-back';
  back.setAttribute('aria-label', 'Back to Nova Hub');
  back.textContent = '‹';
  screen.appendChild(back);

  const hero = avatar.closest('.nx-profile-hero');
  const body = avatar.closest('.nx-app-body');
  if (!hero || !body) throw new Error('Profile layout could not be prepared.');

  const previousGridTemplate = body.style.getPropertyValue('grid-template-rows');
  const previousGridPriority = body.style.getPropertyPriority('grid-template-rows');
  body.style.setProperty('grid-template-rows', 'auto auto minmax(0,1fr) auto', 'important');

  const avatarInline = ['position','overflow','cursor','touch-action'].map(name => ({
    name,
    value:avatar.style.getPropertyValue(name),
    priority:avatar.style.getPropertyPriority(name)
  }));
  avatar.style.setProperty('position', 'relative', 'important');
  avatar.style.setProperty('overflow', 'visible', 'important');
  avatar.style.setProperty('cursor', 'pointer', 'important');
  avatar.style.setProperty('touch-action', 'manipulation', 'important');

  const fileInput = createPhotoInput();
  hero.appendChild(fileInput);
  const photoToast = createPhotoToast();
  const photoBadge = createAvatarEditBadge();
  avatar.appendChild(photoBadge);

  avatar.classList.add('is-photo-trigger');
  avatar.setAttribute('role', 'button');
  avatar.setAttribute('tabindex', '0');
  avatar.setAttribute('aria-label', 'Choose or change profile picture');
  avatar.setAttribute('title', 'Tap to change profile picture');

  const danger = createDangerZone();
  body.appendChild(danger);

  const deleteModal = createDeleteModal();
  const deleteOpen = danger.querySelector('[data-profile-delete-open]');
  const deletePassword = deleteModal.querySelector('[data-profile-delete-password]');
  const deleteWord = deleteModal.querySelector('[data-profile-delete-word]');
  const deleteStatus = deleteModal.querySelector('[data-profile-delete-status]');
  const deleteConfirm = deleteModal.querySelector('[data-profile-delete-confirm]');
  const deleteCancel = deleteModal.querySelector('[data-profile-delete-cancel]');

  let disposed = false;
  let photoBusy = false;
  let user = null;
  let profileRef = null;
  let latestProfile = null;
  let offProfile = null;

  const openHub = () => window.NexusNovaFresh?.openHub?.();
  back.addEventListener('click', openHub);

  const openPhotoPicker = () => {
    if (disposed || photoBusy) return;
    fileInput.click();
  };
  const handleAvatarKeydown = event => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    event.preventDefault();
    openPhotoPicker();
  };
  avatar.addEventListener('click', openPhotoPicker);
  avatar.addEventListener('keydown', handleAvatarKeydown);

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    fileInput.value = '';
    if (!file || disposed || photoBusy) return;

    photoBusy = true;
    avatar.classList.add('is-photo-saving');
    photoBadge.textContent = '…';
    showPhotoToast(photoToast, 'Preparing profile photo…', 'info', 6000);
    const previousPhoto = String(latestProfile?.photoDataUrl || '');

    try {
      const active = user || await requireFirebaseUser();
      const dataUrl = await prepareProfilePhoto(file);
      const ref = profileRef || doc(firestoreDb, 'users', active.uid);

      // Optimistic preview, but restore the old server-backed photo if the write fails.
      setAvatarPhoto(avatar, dataUrl);
      showPhotoToast(photoToast, 'Saving profile photo…', 'info', 6000);
      await updateDoc(ref, {
        photoDataUrl: dataUrl,
        profileUpdatedAt: serverTimestamp()
      });
      if (!disposed) showPhotoToast(photoToast, '✓ Profile picture saved.', 'success');
    } catch (error) {
      setAvatarPhoto(avatar, previousPhoto);
      if (!disposed) {
        const message = String(error?.message || 'Profile picture could not be saved.');
        showPhotoToast(photoToast, message, 'error', 4200);
      }
    } finally {
      photoBusy = false;
      avatar.classList.remove('is-photo-saving');
      photoBadge.textContent = '✎';
    }
  });

  const closeDeleteModal = () => {
    if (deleteConfirm.disabled) return;
    deleteModal.hidden = true;
    deletePassword.value = '';
    deleteWord.value = '';
    deleteStatus.textContent = 'No account data has been changed.';
  };

  deleteOpen.addEventListener('click', () => {
    deleteModal.hidden = false;
    deletePassword.value = '';
    deleteWord.value = '';
    deleteStatus.textContent = 'No account data has been changed.';
    setTimeout(() => deletePassword.focus(), 30);
  });
  deleteCancel.addEventListener('click', closeDeleteModal);
  deleteModal.addEventListener('click', event => {
    if (event.target === deleteModal) closeDeleteModal();
  });

  deleteConfirm.addEventListener('click', async () => {
    if (disposed || deleteConfirm.disabled) return;
    const password = deletePassword.value;
    const confirmWord = deleteWord.value.trim();
    if (!password) {
      deleteStatus.textContent = 'Enter your current password.';
      return;
    }
    if (confirmWord !== 'DELETE') {
      deleteStatus.textContent = 'Type DELETE exactly to confirm.';
      return;
    }

    deleteConfirm.disabled = true;
    deleteCancel.disabled = true;
    deleteOpen.disabled = true;
    deleteStatus.textContent = 'Re-authenticating account…';

    let deletedProfile = false;
    let backup = null;
    let ref = null;
    try {
      const active = firebaseAuth.currentUser || user || await requireFirebaseUser();
      if (!active?.email) throw new Error('This account has no email credential available for secure deletion.');
      const credential = EmailAuthProvider.credential(active.email, password);
      await reauthenticateWithCredential(active, credential);

      ref = profileRef || doc(firestoreDb, 'users', active.uid);
      backup = latestProfile && typeof latestProfile === 'object' ? { ...latestProfile } : null;
      deleteStatus.textContent = 'Deleting NexusNova profile data…';
      await deleteDoc(ref);
      deletedProfile = true;

      deleteStatus.textContent = 'Deleting sign-in identity…';
      await deleteUser(active);
      clearAccountScopedLocalData(active.uid);
      deleteStatus.textContent = '✓ Account deleted. Returning to sign in…';
      deleteModal.hidden = true;
    } catch (error) {
      if (deletedProfile && firebaseAuth.currentUser && ref && backup) {
        try { await setDoc(ref, backup); } catch (restoreError) {
          console.error('[NexusNova Profile] profile restore after failed auth deletion:', restoreError);
        }
      }
      if (!disposed) {
        const code = String(error?.code || '');
        deleteStatus.textContent = code === 'auth/invalid-credential' || code === 'auth/wrong-password'
          ? 'Current password is incorrect.'
          : (error?.message || 'Account could not be deleted. Nothing else was intentionally changed.');
      }
    } finally {
      if (!disposed && firebaseAuth.currentUser) {
        deleteConfirm.disabled = false;
        deleteCancel.disabled = false;
        deleteOpen.disabled = false;
      }
    }
  });

  try {
    user = await requireFirebaseUser();
    if (!disposed) {
      profileRef = doc(firestoreDb, 'users', user.uid);
      offProfile = onSnapshot(profileRef, snapshot => {
        if (disposed) return;
        latestProfile = snapshot.data() || null;
        if (!photoBusy) setAvatarPhoto(avatar, latestProfile?.photoDataUrl || '');
      }, error => {
        if (!disposed) showPhotoToast(photoToast, error?.message || 'Profile photo sync is unavailable.', 'error', 4200);
      });
    }
  } catch (error) {
    if (!disposed) showPhotoToast(photoToast, error?.message || 'Sign in to manage your profile picture.', 'error', 4200);
  }

  const themeListener = () => applyProfileTheme();
  lightQuery?.addEventListener?.('change', themeListener);

  return () => {
    disposed = true;
    offProfile?.();
    lightQuery?.removeEventListener?.('change', themeListener);
    clearTimeout(photoToast._hideTimer);
    photoToast.remove();
    photoBadge.remove();
    avatar.removeEventListener('click', openPhotoPicker);
    avatar.removeEventListener('keydown', handleAvatarKeydown);
    avatar.classList.remove('is-photo-trigger', 'is-photo-saving');
    avatar.removeAttribute('role');
    avatar.removeAttribute('tabindex');
    avatar.removeAttribute('aria-label');
    avatar.removeAttribute('title');
    avatarInline.forEach(item => {
      if (item.value) avatar.style.setProperty(item.name, item.value, item.priority);
      else avatar.style.removeProperty(item.name);
    });
    if (previousGridTemplate) body.style.setProperty('grid-template-rows', previousGridTemplate, previousGridPriority);
    else body.style.removeProperty('grid-template-rows');
    deleteModal.remove();
    back.remove();
    screen.classList.remove(SCREEN_CLASS);
    delete screen.dataset.profileV1Enhanced;
    document.documentElement.classList.remove(ACTIVE_HTML_CLASS);
    document.body.classList.remove(ACTIVE_HTML_CLASS);
    activeScreen = null;
    restoreThemeMeta();
  };
}

async function syncProfileEnhancement() {
  const found = profileScreenFromStage();
  if (!found) {
    if (activeCleanup) {
      const cleanup = activeCleanup;
      activeCleanup = null;
      cleanup();
    }
    return;
  }
  if (activeScreen === found.screen && activeCleanup) return;
  if (activeCleanup) {
    const cleanup = activeCleanup;
    activeCleanup = null;
    cleanup();
  }
  try {
    activeCleanup = await enhanceProfile(found.screen, found.avatar);
  } catch (error) {
    console.error('[NexusNova Profile] enhancement:', error);
    document.documentElement.classList.remove(ACTIVE_HTML_CLASS);
    document.body.classList.remove(ACTIVE_HTML_CLASS);
    restoreThemeMeta();
    activeScreen = null;
  }
}

if (stage) {
  const observer = new MutationObserver(() => queueMicrotask(syncProfileEnhancement));
  observer.observe(stage, { childList: true, subtree: true });
  syncProfileEnhancement();
}
