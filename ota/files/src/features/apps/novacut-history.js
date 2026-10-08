/* NovaCut history/state transactions. Media File/Blob references are preserved. */
function isBlobLike(value) {
  return typeof Blob !== 'undefined' && value instanceof Blob;
}
function cloneValue(value) {
  if (isBlobLike(value)) return value;
  if (Array.isArray(value)) return value.map(cloneValue);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  Object.keys(value).forEach((key) => { out[key] = cloneValue(value[key]); });
  return out;
}
function comparable(value) {
  if (isBlobLike(value)) return { name: value.name || '', size: Number(value.size) || 0, type: value.type || '', lastModified: Number(value.lastModified) || 0 };
  if (Array.isArray(value)) return value.map(comparable);
  if (!value || typeof value !== 'object') return value;
  const out = {};
  Object.keys(value).sort().forEach((key) => { out[key] = comparable(value[key]); });
  return out;
}
function equalState(a, b) { return JSON.stringify(comparable(a)) === JSON.stringify(comparable(b)); }

export class NovaCutHistory {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.limit = Math.max(20, Math.floor(Number(options.limit) || 100));
    this.undoStack = [];
    this.redoStack = [];
    this.transaction = null;
  }
  capture() {
    const r = this.engine.registry;
    return cloneValue({ videoTracks: r.videoTracks, audioTracks: r.audioTracks, textTracks: r.textTracks, overlayTracks: r.overlayTracks, effectTracks: r.effectTracks });
  }
  restore(snapshot) {
    const r = this.engine.registry;
    const state = cloneValue(snapshot || {});
    r.videoTracks = state.videoTracks || [];
    r.audioTracks = state.audioTracks || [];
    r.textTracks = state.textTracks || [];
    r.overlayTracks = state.overlayTracks || [];
    r.effectTracks = state.effectTracks || [];
    this.engine.activeTrackId = this.engine.findFirstExistingId(this.engine.activeTrackId);
    this.engine.preview?.syncRegistry?.();
    this.engine.refresh();
  }
  record(before, label = 'Edit') {
    if (!before) return false;
    const after = this.capture();
    if (equalState(before, after)) return false;
    this.undoStack.push({ label: String(label || 'Edit'), before: cloneValue(before), after: cloneValue(after) });
    while (this.undoStack.length > this.limit) this.undoStack.shift();
    this.redoStack.length = 0;
    this.engine.emitHistoryState();
    return true;
  }
  begin(label = 'Edit') {
    if (this.transaction) return this.transaction.before;
    this.transaction = { label: String(label || 'Edit'), before: this.capture() };
    return this.transaction.before;
  }
  commit() {
    if (!this.transaction) return false;
    const tx = this.transaction;
    this.transaction = null;
    return this.record(tx.before, tx.label);
  }
  cancel() {
    if (!this.transaction) return;
    const tx = this.transaction;
    this.transaction = null;
    this.restore(tx.before);
    this.engine.emitHistoryState();
  }
  undo() {
    const entry = this.undoStack.pop();
    if (!entry) return false;
    this.redoStack.push(entry);
    this.restore(entry.before);
    this.engine.emitHistoryState();
    return true;
  }
  redo() {
    const entry = this.redoStack.pop();
    if (!entry) return false;
    this.undoStack.push(entry);
    this.restore(entry.after);
    this.engine.emitHistoryState();
    return true;
  }
  canUndo() { return this.undoStack.length > 0; }
  canRedo() { return this.redoStack.length > 0; }
  clear() { this.undoStack.length = 0; this.redoStack.length = 0; this.transaction = null; this.engine.emitHistoryState(); }
}