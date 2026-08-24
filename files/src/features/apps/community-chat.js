import {
  addDoc,
  collection,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.1.0/firebase-firestore.js';
import { firestoreDb, readUserProfile, requireFirebaseUser } from '../../core/firebase-backend.js';
import { escapeHtml } from '../../core/local-store.js';

function node(html) {
  const root = document.createElement('div');
  root.className = 'nx-app-body';
  root.innerHTML = html;
  return root;
}

function timestampMs(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  if (typeof value.toDate === 'function') return value.toDate().getTime();
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

export function renderCommunityChat() {
  const root = node(`
    <section class="nx-tool-card">
      <div class="nx-list-card__head">
        <div><strong>NexusNova Community</strong><p class="nx-tool-meta" data-chat-status>Connecting to community…</p></div>
        <span class="nx-tool-meta">100 latest</span>
      </div>
    </section>
    <section class="nx-stack" data-chat-messages><div class="nx-empty">Connecting…</div></section>
    <section class="nx-tool-card">
      <label class="nx-field"><span>Message</span><textarea rows="2" maxlength="500" data-chat-input placeholder="Write to the NexusNova community…"></textarea></label>
      <div class="nx-list-card__head"><small data-chat-count>0 / 500</small><button class="nx-primary nx-fit" type="button" data-chat-send>SEND</button></div>
      <p class="nx-tool-meta">Signed-in users can read. Sending requires a verified email. Messages cannot be edited or deleted by clients.</p>
    </section>
  `);

  const status = root.querySelector('[data-chat-status]');
  const messages = root.querySelector('[data-chat-messages]');
  const input = root.querySelector('[data-chat-input]');
  const count = root.querySelector('[data-chat-count]');
  const send = root.querySelector('[data-chat-send]');
  let unsubscribe = null;
  let busy = false;
  let activeUid = '';
  let disposed = false;

  const draw = rows => {
    if (disposed) return;
    if (!rows.length) {
      messages.innerHTML = '<div class="nx-empty">No community messages yet.</div>';
      return;
    }
    messages.innerHTML = rows.map(row => {
      const mine = row.uid && row.uid === activeUid;
      const at = timestampMs(row.createdAt);
      return `<article class="nx-list-card${mine ? ' nx-chat-mine' : ''}">
        <div class="nx-list-card__head"><strong>${escapeHtml(row.name || 'NexusNova user')}</strong><small>${at ? new Date(at).toLocaleString() : 'sending…'}</small></div>
        <p>${escapeHtml(row.text || '').replace(/\n/g, '<br>')}</p>
      </article>`;
    }).join('');
    messages.lastElementChild?.scrollIntoView({ block: 'nearest' });
  };

  const connect = async () => {
    try {
      const user = await requireFirebaseUser();
      if (disposed) return;
      activeUid = user.uid;
      const feed = query(collection(firestoreDb, 'chatMessages'), orderBy('createdAt', 'desc'), limit(100));
      unsubscribe = onSnapshot(feed, snapshot => {
        if (disposed) return;
        const rows = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })).reverse();
        draw(rows);
        status.textContent = `Live • ${rows.length} message${rows.length === 1 ? '' : 's'} loaded`;
      }, error => {
        if (disposed) return;
        messages.innerHTML = '<div class="nx-empty">Community chat could not be loaded.</div>';
        status.textContent = String(error?.message || 'Chat listener failed.').slice(0, 220);
        console.warn('[NexusNova Fresh] community chat listener:', error);
      });
    } catch (error) {
      if (disposed) return;
      messages.innerHTML = '<div class="nx-empty">Sign in to view community chat.</div>';
      status.textContent = String(error?.message || error).slice(0, 220);
    }
  };

  const submit = async () => {
    const text = input.value.trim();
    if (!text || busy || disposed) return;
    if (text.length > 500) {
      status.textContent = 'Message must be 500 characters or fewer.';
      return;
    }
    busy = true;
    send.disabled = true;
    send.textContent = 'SENDING…';
    try {
      const user = await requireFirebaseUser({ verified: true });
      const profile = await readUserProfile(user).catch(() => ({}));
      const name = String(profile?.name || user.displayName || user.email?.split('@')[0] || 'NexusNova user').trim().slice(0, 80);
      await addDoc(collection(firestoreDb, 'chatMessages'), {
        uid: user.uid,
        name: name || 'NexusNova user',
        text,
        createdAt: serverTimestamp()
      });
      if (disposed) return;
      input.value = '';
      count.textContent = '0 / 500';
      status.textContent = 'Message sent.';
    } catch (error) {
      if (disposed) return;
      status.textContent = String(error?.message || 'Message could not be sent.').replace(/^FirebaseError:\s*/i, '').slice(0, 240);
      console.warn('[NexusNova Fresh] community chat send:', error);
    } finally {
      busy = false;
      if (!disposed) {
        send.disabled = false;
        send.textContent = 'SEND';
      }
    }
  };

  input.addEventListener('input', () => {
    count.textContent = `${input.value.length} / 500`;
  });
  input.addEventListener('keydown', event => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      submit();
    }
  });
  send.addEventListener('click', submit);
  connect();

  root.__cleanup = () => {
    disposed = true;
    unsubscribe?.();
    unsubscribe = null;
  };
  return root;
}

export const communityChatRenderers = Object.freeze({
  chat: renderCommunityChat
});
