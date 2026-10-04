/**
 * NexusNova AI Video Studio — canonical timeline state + geometry engine.
 * Clean-room implementation. No third-party editor internals are used.
 */
export class NexusNovaVideoEditor {
  constructor(options = {}) {
    this.zoom = Number.isFinite(options.zoom) && options.zoom > 0 ? options.zoom : 80;
    this.minClipDurationMs = Math.max(1, Number(options.minClipDurationMs) || 50);
    this.project = {
      id: options.projectId || `nn-video-${Date.now().toString(36)}`,
      fps: Number(options.fps) || 30,
      durationMs: 0,
      tracks: Array.isArray(options.tracks) && options.tracks.length
        ? options.tracks.map(track => this.#normalizeTrack(track))
        : [this.#normalizeTrack({ id: 'video-1', type: 'video', name: 'Video 1', zIndex: 0 })],
      clips: Array.isArray(options.clips) ? options.clips.map(clip => this.#normalizeClip(clip)) : []
    };
    this.selection = { primaryClipId: null, clipIds: [] };
    this.playheadMs = 0;
    this.history = [];
    this.redoHistory = [];
    this.activeTransaction = null;
    this.listeners = new Set();
    this.destroyed = false;
    this.#recalculateDuration();
    if (this.project.clips.length) {
      this.selection.primaryClipId = this.project.clips[0].id;
      this.selection.clipIds = [this.project.clips[0].id];
    }
  }

  #normalizeTrack(track) {
    return {
      id: String(track?.id || `track-${Math.random().toString(36).slice(2, 8)}`),
      type: String(track?.type || 'video'),
      name: String(track?.name || 'Track'),
      zIndex: Number(track?.zIndex) || 0,
      locked: Boolean(track?.locked),
      muted: Boolean(track?.muted),
      visible: track?.visible !== false
    };
  }

  #normalizeClip(clip) {
    const sourceDurationMs = Math.max(
      this.minClipDurationMs,
      Number(clip?.sourceDurationMs ?? clip?.durationMs ?? 3000) || 3000
    );
    const sourceInMs = Math.max(0, Number(clip?.sourceInMs ?? 0) || 0);
    const sourceOutMs = Math.max(
      sourceInMs + this.minClipDurationMs,
      Math.min(sourceDurationMs, Number(clip?.sourceOutMs ?? sourceDurationMs) || sourceDurationMs)
    );
    const speed = Math.max(0.05, Number(clip?.speed) || 1);
    const mediaDurationMs = Math.max(this.minClipDurationMs, sourceOutMs - sourceInMs);
    return {
      id: String(clip?.id || `clip-${Math.random().toString(36).slice(2, 9)}`),
      trackId: String(clip?.trackId || this.project?.tracks?.[0]?.id || 'video-1'),
      sourceId: String(clip?.sourceId || clip?.id || ''),
      mediaType: String(clip?.mediaType || 'video'),
      name: String(clip?.name || 'Untitled media'),
      sourceDurationMs,
      sourceInMs,
      sourceOutMs,
      startMs: Math.max(0, Number(clip?.startMs) || 0),
      durationMs: mediaDurationMs / speed,
      speed,
      nativeSourceKey: clip?.nativeSourceKey || null,
      metadata: clip?.metadata ? structuredClone(clip.metadata) : {}
    };
  }

  #cloneState() {
    return {
      project: structuredClone(this.project),
      selection: structuredClone(this.selection),
      playheadMs: this.playheadMs,
      zoom: this.zoom
    };
  }

  #restoreState(snapshot, emit = true) {
    this.project = structuredClone(snapshot.project);
    this.selection = structuredClone(snapshot.selection);
    this.playheadMs = snapshot.playheadMs;
    this.zoom = snapshot.zoom;
    this.#recalculateDuration();
    if (emit) this.#emit('state-restored');
  }

  #assertAlive() {
    if (this.destroyed) throw new Error('Video editor is destroyed.');
  }

  #mutate(label, mutator) {
    this.#assertAlive();
    const result = mutator();
    this.#validate();
    this.#recalculateDuration();
    this.#emit(label);
    return result;
  }

  #transaction(label, mutator) {
    this.#assertAlive();
    const before = this.#cloneState();
    try {
      const result = mutator();
      this.#validate();
      const after = this.#cloneState();
      this.history.push({ label, before, after });
      this.redoHistory.length = 0;
      this.#emit(label);
      return result;
    } catch (error) {
      this.#restoreState(before, false);
      throw error;
    }
  }

  #validate() {
    const trackIds = new Set(this.project.tracks.map(track => track.id));
    const clipIds = new Set();
    for (const clip of this.project.clips) {
      if (clipIds.has(clip.id)) throw new Error(`Duplicate clip id: ${clip.id}`);
      if (!trackIds.has(clip.trackId)) throw new Error(`Unknown track: ${clip.trackId}`);
      if (!(clip.startMs >= 0) || !(clip.durationMs >= this.minClipDurationMs)) {
        throw new Error('Invalid timeline geometry.');
      }
      if (!(clip.sourceInMs >= 0) || !(clip.sourceOutMs > clip.sourceInMs)) {
        throw new Error('Invalid source trim range.');
      }
      clipIds.add(clip.id);
    }
    this.playheadMs = Math.min(Math.max(0, this.playheadMs), this.project.durationMs);
  }

  #recalculateDuration() {
    this.project.durationMs = this.project.clips.reduce(
      (max, clip) => Math.max(max, clip.startMs + clip.durationMs), 0
    );
    this.playheadMs = Math.min(Math.max(0, this.playheadMs), this.project.durationMs);
  }

  #emit(reason) {
    if (this.destroyed) return;
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => {
      try { listener({ reason, ...snapshot }); } catch (_) {}
    });
  }

  subscribe(listener) {
    if (typeof listener !== 'function') return () => false;
    if (this.destroyed) return () => false;
    this.listeners.add(listener);
    listener({ reason: 'initial', ...this.getSnapshot() });
    return () => this.listeners.delete(listener);
  }

  getSnapshot() {
    return {
      project: structuredClone(this.project),
      selection: structuredClone(this.selection),
      playheadMs: this.playheadMs,
      zoom: this.zoom
    };
  }

  setPlayheadMs(timeMs) {
    this.#assertAlive();
    this.playheadMs = Math.min(
      Math.max(0, Number(timeMs) || 0),
      this.project.durationMs
    );
    this.#emit('playhead');
    return this.playheadMs;
  }

  setSelection(clipIds, primaryClipId = clipIds?.[0] || null) {
    this.#assertAlive();
    const valid = new Set(this.project.clips.map(clip => clip.id));
    const ids = [...new Set((Array.isArray(clipIds) ? clipIds : [clipIds]).filter(id => valid.has(id)))];
    this.selection = {
      primaryClipId: primaryClipId && valid.has(primaryClipId) ? primaryClipId : ids[0] || null,
      clipIds: ids
    };
    this.#emit('selection');
    return this.selection;
  }

  timeToPixels(timeMs, zoom = this.zoom) {
    const scale = Number(zoom);
    if (!Number.isFinite(scale) || scale <= 0) throw new Error('Zoom must be greater than zero.');
    return (Math.max(0, Number(timeMs) || 0) / 1000) * scale;
  }

  pixelsToTime(px, zoom = this.zoom) {
    const scale = Number(zoom);
    if (!Number.isFinite(scale) || scale <= 0) throw new Error('Zoom must be greater than zero.');
    return Math.max(0, (Number(px) || 0) / scale * 1000);
  }

  getClip(clipId) {
    return this.project.clips.find(clip => clip.id === clipId) || null;
  }

  splitClip(clipId, timeMs, options = {}) {
    const run = () => {
      const clip = this.getClip(clipId);
      if (!clip) throw new Error('Clip not found.');
      const localMs = Number(timeMs) - clip.startMs;
      if (!(localMs > 0 && localMs < clip.durationMs)) {
        throw new Error('Split point must be inside the selected clip.');
      }
      const sourceSplit = clip.sourceInMs + localMs * clip.speed;
      if (!(sourceSplit > clip.sourceInMs && sourceSplit < clip.sourceOutMs)) {
        throw new Error('Split point falls outside the source media.');
      }

      const right = {
        ...structuredClone(clip),
        id: `clip-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
        sourceInMs: sourceSplit,
        startMs: clip.startMs + localMs
      };
      clip.sourceOutMs = sourceSplit;
      clip.durationMs = localMs / clip.speed;
      right.durationMs = (right.sourceOutMs - right.sourceInMs) / right.speed;
      const index = this.project.clips.findIndex(item => item.id === clipId);
      this.project.clips.splice(index + 1, 0, right);
      this.selection = { primaryClipId: right.id, clipIds: [right.id] };
      this.#recalculateDuration();
      return right;
    };
    return options.transaction ? this.#mutate('split-clip', run) : this.#transaction('split-clip', run);
  }

  trimClipLeft(clipId, newInMs, options = {}) {
    const run = () => {
      const clip = this.getClip(clipId);
      if (!clip) throw new Error('Clip not found.');
      const nextIn = Math.max(0, Number(newInMs) || 0);
      if (!(nextIn < clip.sourceOutMs)) throw new Error('IN point must remain before OUT point.');
      const deltaSource = nextIn - clip.sourceInMs;
      const nextDuration = (clip.sourceOutMs - nextIn) / clip.speed;
      if (nextDuration < this.minClipDurationMs) throw new Error('Trim would make the clip too short.');
      clip.sourceInMs = nextIn;
      clip.startMs += deltaSource / clip.speed;
      clip.durationMs = nextDuration;
      this.playheadMs = clip.startMs;
      return clip;
    };
    return options.transaction ? this.#mutate('trim-clip-left', run) : this.#transaction('trim-clip-left', run);
  }

  trimClipRight(clipId, newOutMs, options = {}) {
    const run = () => {
      const clip = this.getClip(clipId);
      if (!clip) throw new Error('Clip not found.');
      const nextOut = Math.min(clip.sourceDurationMs, Number(newOutMs) || clip.sourceOutMs);
      if (!(nextOut > clip.sourceInMs)) throw new Error('OUT point must remain after IN point.');
      const nextDuration = (nextOut - clip.sourceInMs) / clip.speed;
      if (nextDuration < this.minClipDurationMs) throw new Error('Trim would make the clip too short.');
      clip.sourceOutMs = nextOut;
      clip.durationMs = nextDuration;
      this.playheadMs = Math.min(clip.startMs + nextDuration, this.project.durationMs);
      return clip;
    };
    return options.transaction ? this.#mutate('trim-clip-right', run) : this.#transaction('trim-clip-right', run);
  }

  moveClip(clipId, newStartMs, targetTrackId, options = {}) {
    const run = () => {
      const clip = this.getClip(clipId);
      if (!clip) throw new Error('Clip not found.');
      const track = this.project.tracks.find(item => item.id === targetTrackId);
      if (!track) throw new Error('Target track not found.');
      if (track.locked) throw new Error('Target track is locked.');
      clip.startMs = Math.max(0, Number(newStartMs) || 0);
      clip.trackId = track.id;
      this.#recalculateDuration();
      this.playheadMs = clip.startMs;
      return clip;
    };
    return options.transaction ? this.#mutate('move-clip', run) : this.#transaction('move-clip', run);
  }

  beginTransaction(label = 'edit') {
    this.#assertAlive();
    if (this.activeTransaction) throw new Error('A timeline transaction is already active.');
    this.activeTransaction = { label, before: this.#cloneState() };
  }

  commitTransaction() {
    if (!this.activeTransaction) return false;
    this.#validate();
    const transaction = this.activeTransaction;
    this.activeTransaction = null;
    const after = this.#cloneState();
    this.history.push({ label: transaction.label, before: transaction.before, after });
    this.redoHistory.length = 0;
    this.#emit(transaction.label);
    return true;
  }

  rollbackTransaction() {
    if (!this.activeTransaction) return false;
    const snapshot = this.activeTransaction.before;
    this.activeTransaction = null;
    this.#restoreState(snapshot);
    return true;
  }

  undo() {
    if (this.destroyed) return false;
    if (this.activeTransaction) this.rollbackTransaction();
    const entry = this.history.pop();
    if (!entry) return false;
    this.redoHistory.push(entry);
    this.#restoreState(entry.before);
    return true;
  }

  redo() {
    if (this.destroyed) return false;
    if (this.activeTransaction) this.rollbackTransaction();
    const entry = this.redoHistory.pop();
    if (!entry) return false;
    this.history.push(entry);
    this.#restoreState(entry.after);
    return true;
  }

  destroy() {
    if (this.destroyed) return false;
    this.activeTransaction = null;
    this.history.length = 0;
    this.redoHistory.length = 0;
    this.listeners.clear();
    this.destroyed = true;
    return true;
  }

  exportProject() {
    return this.getSnapshot();
  }
}

export default NexusNovaVideoEditor;
