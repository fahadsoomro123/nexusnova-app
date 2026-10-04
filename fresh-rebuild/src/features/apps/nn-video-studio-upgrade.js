import NexusNovaVideoEditor from '../../../assets/js/nn-video-studio-core.js';

const STYLE_ID = 'nn-video-studio-timeline-style';
const EDITOR_CLASS = 'nn-video-editor';

function ensureStyle() {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = `
    .nx-video-timeline:has(.nn-video-editor){min-height:0!important;overflow:hidden!important}
    .nx-video-timeline:has(.nn-video-editor) .nx-video-cliprow{position:relative!important;min-height:132px!important;height:132px!important}
    .nn-video-editor{position:absolute!important;inset:0!important;z-index:10!important}
  `;
  document.head.appendChild(style);

  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = new URL('../../../assets/styles/nn-video-studio.css', import.meta.url).href;
  document.head.appendChild(link);
}

function uid(prefix='nn') {
  return prefix + '-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2,8);
}

function formatTime(ms) {
  const total = Math.max(0, Math.floor(Number(ms) || 0) / 1000);
  const minutes = Math.floor(total / 60);
  const seconds = Math.floor(total % 60);
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

function createTrackGrid(editor) {
  const host = document.createElement('div');
  host.className = EDITOR_CLASS;
  host.setAttribute('aria-label','NexusNova AI Video Studio timeline');
  host.innerHTML = `
    <div class="nn-video-editor__scroll">
      <div class="nn-video-editor__content">
        <div class="nn-video-editor__track-labels"></div>
        <div class="nn-video-editor__canvas"></div>
      </div>
    </div>
    <div class="nn-video-editor__status" aria-live="polite"></div>
  `;

  const canvas = host.querySelector('.nn-video-editor__canvas');
  const labels = host.querySelector('.nn-video-editor__track-labels');
  const status = host.querySelector('.nn-video-editor__status');

  function render() {
    const snapshot = editor.getSnapshot();
    const canvasWidth = Math.max(420, editor.timeToPixels(Math.max(snapshot.project.durationMs, 1000), snapshot.zoom) + 80);
    const content = host.querySelector('.nn-video-editor__content');
    content.style.width = `${canvasWidth + 62}px`;
    canvas.innerHTML = '';
    labels.innerHTML = '';

    const ruler = document.createElement('div');
    ruler.className = 'nn-timeline__ruler';
    for (let t=0; t<=Math.max(snapshot.project.durationMs,1000); t += snapshot.project.durationMs > 30000 ? 5000 : snapshot.project.durationMs > 10000 ? 2000 : 1000) {
      const tick = document.createElement('span');
      tick.textContent = formatTime(t);
      tick.style.left = `${editor.timeToPixels(t,snapshot.zoom)}px`;
      ruler.appendChild(tick);
    }
    canvas.appendChild(ruler);

    snapshot.project.tracks.forEach((track, index) => {
      const label = document.createElement('div');
      label.className = 'nn-track__label';
      label.textContent = track.name;
      labels.appendChild(label);

      const row = document.createElement('div');
      row.className = 'nn-track__row';
      row.dataset.trackId = track.id;
      row.dataset.trackIndex = String(index);
      snapshot.project.clips.filter(clip => clip.trackId === track.id).forEach(clip => {
        const body = document.createElement('div');
        body.className = 'nn-clip__body' + (snapshot.selection.clipIds.includes(clip.id) ? ' is-selected' : '');
        body.dataset.clipId = clip.id;
        body.style.left = `${editor.timeToPixels(clip.startMs,snapshot.zoom)}px`;
        body.style.width = `${Math.max(10,editor.timeToPixels(clip.durationMs,snapshot.zoom))}px`;
        body.title = `${clip.name} • ${formatTime(clip.durationMs)}`;

        const labelText = document.createElement('span');
        labelText.className = 'nn-clip__label';
        labelText.textContent = clip.name;
        body.appendChild(labelText);

        for (const edge of ['left','right']) {
          const handle = document.createElement('span');
          handle.className = 'nn-clip__handle';
          handle.dataset.edge = edge;
          handle.dataset.clipId = clip.id;
          handle.setAttribute('aria-label', `${edge} trim handle`);
          body.appendChild(handle);
        }
        row.appendChild(body);
      });
      canvas.appendChild(row);
    });

    const playhead = document.createElement('div');
    playhead.className = 'nn-playhead';
    playhead.style.left = `${editor.timeToPixels(snapshot.playheadMs,snapshot.zoom)}px`;
    canvas.appendChild(playhead);

    status.textContent = `${snapshot.project.clips.length} clips • ${formatTime(snapshot.project.durationMs)} • ${Math.round(snapshot.zoom)} px/s`;
  }

  let gesture = null;
  function pointerToTime(event) {
    const rect = canvas.getBoundingClientRect();
    const localX = event.clientX - rect.left + canvas.scrollLeft;
    return editor.pixelsToTime(localX, editor.zoom);
  }

  canvas.addEventListener('pointerdown', event => {
    const handle = event.target.closest('.nn-clip__handle');
    const body = event.target.closest('.nn-clip__body');
    if (!handle && !body) {
      editor.setPlayheadMs(pointerToTime(event));
      return;
    }
    const clipId = handle?.dataset.clipId || body?.dataset.clipId;
    const clip = editor.getClip(clipId);
    if (!clip) return;
    editor.setSelection([clip.id], clip.id);
    event.currentTarget.setPointerCapture?.(event.pointerId);

    gesture = {
      pointerId:event.pointerId,
      clipId,
      mode:handle ? `trim-${handle.dataset.edge}` : 'move',
      originX:event.clientX,
      originStart:clip.startMs,
      originIn:clip.sourceInMs,
      originOut:clip.sourceOutMs,
      originTrack:clip.trackId
    };
  });

  canvas.addEventListener('pointermove', event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    const deltaMs = editor.pixelsToTime(event.clientX - gesture.originX, editor.zoom);
    try {
      if (gesture.mode === 'trim-left') {
        const nextIn = Math.max(0, gesture.originIn + deltaMs);
        editor.trimClipLeft(gesture.clipId, nextIn);
      } else if (gesture.mode === 'move') {
        const nextStart = Math.max(0, gesture.originStart + deltaMs);
        editor.moveClip(gesture.clipId, nextStart, gesture.originTrack);
      }
      render();
    } catch (_) {
      // Invalid intermediate geometry is ignored until the pointer is released.
    }
  });

  canvas.addEventListener('pointerup', event => {
    if (!gesture || gesture.pointerId !== event.pointerId) return;
    gesture = null;
  });

  canvas.addEventListener('pointercancel', () => { gesture = null; });
  canvas.addEventListener('click', event => {
    const clip = event.target.closest('.nn-clip__body');
    if (clip) editor.setSelection([clip.dataset.clipId], clip.dataset.clipId);
  });

  editor.subscribe(snapshot => {
    render();
    window.dispatchEvent(new CustomEvent('nexusnova:video-studio-state', { detail:snapshot }));
  });

  return { host, render };
}

function createEditorFromFiles(files) {
  const tracks = [
    {id:'video-1',type:'video',name:'V1',zIndex:0},
    {id:'overlay-1',type:'overlay',name:'V2',zIndex:10},
    {id:'text-1',type:'text',name:'TEXT',zIndex:20}
  ];
  let cursor=0;
  const clips=[];
  files.forEach((file,index)=>{
    const duration = Number(file.__nnDurationMs) || 3000;
    clips.push({
      id:uid('clip'),
      sourceId:uid('media'),
      mediaType:file.type.startsWith('image/')?'image':'video',
      name:file.name || `Media ${index+1}`,
      sourceDurationMs:duration,
      sourceInMs:0,
      sourceOutMs:duration,
      startMs:cursor,
      durationMs:duration,
      speed:1
    });
    cursor += duration;
  });
  return new NexusNovaVideoEditor({clips,tracks,zoom:90});
}

export function enhanceAiVideoStudio(root) {
  if (!root || root.dataset.nnTimelineEnhanced === '1') return () => {};
  const timeline = root.querySelector('.nx-video-timeline');
  const clipRow = root.querySelector('[data-clip-row]');
  const fileInput = root.querySelector('[data-file]');
  const video = root.querySelector('[data-main-video]');
  if (!timeline || !clipRow || !fileInput) return () => {};

  ensureStyle();

  let editor = createEditorFromFiles([]);
  let objectUrls = [];
  const grid = createTrackGrid(editor);
  clipRow.appendChild(grid.host);

  const bindFiles = async files => {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    objectUrls = [];
    const enriched = [];
    for (const file of files.slice(0,5)) {
      if (file.type.startsWith('image/')) {
        file.__nnDurationMs = 3000;
        enriched.push(file);
        continue;
      }
      const url = URL.createObjectURL(file);
      objectUrls.push(url);
      const probe = document.createElement('video');
      probe.preload = 'metadata';
      probe.src = url;
      await new Promise(resolve => {
        probe.onloadedmetadata = () => {
          file.__nnDurationMs = Math.max(50, Math.round((Number(probe.duration)||3)*1000));
          URL.revokeObjectURL(url);
          resolve();
        };
        probe.onerror = () => { file.__nnDurationMs = 3000; resolve(); };
      });
      enriched.push(file);
    }
    editor = createEditorFromFiles(enriched);
    const current = editor.project.clips[0];
    if (current) editor.setSelection([current.id], current.id);
    grid.host.replaceWith(grid.host.cloneNode(false));
    const newGrid = createTrackGrid(editor);
    clipRow.appendChild(newGrid.host);
    bindBridge(root, editor, video);
  };

  const bindBridge = (hostRoot, model, previewVideo) => {
    model.subscribe(snapshot => {
      hostRoot.dataset.nnPlayheadMs = String(snapshot.playheadMs);
      hostRoot.dataset.nnSelectedClip = snapshot.selection.primaryClipId || '';
      const selected = model.getClip(snapshot.selection.primaryClipId);
      if (selected && previewVideo) {
        const localMs = Math.max(0, snapshot.playheadMs - selected.startMs);
        if (previewVideo.src && Math.abs(previewVideo.currentTime - localMs / 1000) > 0.12) {
          try { previewVideo.currentTime = Math.min(previewVideo.duration || 0, localMs / 1000 + selected.sourceInMs / 1000); } catch (_) {}
        }
      }
    });
  };

  fileInput.addEventListener('change', () => { void bindFiles([...fileInput.files || []]); });
  bindBridge(root, editor, video);
  root.dataset.nnTimelineEnhanced = '1';
  root.__nnVideoEditor = editor;

  return () => {
    objectUrls.forEach(url => URL.revokeObjectURL(url));
    delete root.__nnVideoEditor;
    root.dataset.nnTimelineEnhanced = '0';
  };
}
