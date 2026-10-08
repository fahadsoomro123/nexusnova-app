/* NovaCut Section 2 history engine
 * Structural project history only. Playback ticks and transient media state
 * are deliberately excluded from undo/redo snapshots.
 */

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function cloneValue(value, depth = 0) {
  if (value === null || typeof value !== "object") return value;
  if (depth > 8) return value;
  if (typeof Blob !== "undefined" && value instanceof Blob) return value;
  if (Array.isArray(value)) return value.map((item) => cloneValue(item, depth + 1));
  const output = {};
  for (const [key, item] of Object.entries(value)) {
    if (key === "file" || key === "blob" || key === "source") {
      output[key] = item;
    } else {
      output[key] = cloneValue(item, depth + 1);
    }
  }
  return output;
}

function fileSummary(file) {
  if (!file) return null;
  return {
    name: String(file.name || ""),
    type: String(file.type || ""),
    size: Math.max(0, finite(file.size)),
    lastModified: Math.max(0, finite(file.lastModified))
  };
}

function normalizeTrack(track) {
  const clone = cloneValue(track);
  if (clone && "file" in clone) clone.file = track.file;
  return clone;
}

function normalizeState(state = {}) {
  return {
    videoTracks: (state.videoTracks || []).map(normalizeTrack),
    audioTracks: (state.audioTracks || []).map(normalizeTrack),
    textTracks: (state.textTracks || []).map(normalizeTrack),
    aspectRatio: String(state.aspectRatio || "16:9"),
    currentTimestamp: Math.max(0, finite(state.currentTimestamp)),
    activeTrackId: state.activeTrackId ? String(state.activeTrackId) : null
  };
}

function signatureForState(state) {
  const normalized = normalizeState(state);
  const strip = (track) => {
    const output = cloneValue(track);
    if (output && output.file) output.file = fileSummary(track.file);
    return output;
  };

  return JSON.stringify({
    videoTracks: normalized.videoTracks.map(strip),
    audioTracks: normalized.audioTracks.map(strip),
    textTracks: normalized.textTracks.map(strip),
    aspectRatio: normalized.aspectRatio,
    currentTimestamp: normalized.currentTimestamp,
    activeTrackId: normalized.activeTrackId
  });
}

export class NovaCutHistory {
  constructor(engine, options = {}) {
    this.engine = engine;
    this.limit = Math.max(10, Math.floor(finite(options.limit, 100)));
    this.undoStack = [];
    this.redoStack = [];
  }

  snapshot() {
    return normalizeState(this.engine.getState());
  }

  canUndo() {
    return this.undoStack.length > 0;
  }

  canRedo() {
    return this.redoStack.length > 0;
  }

  commit(before, label = "Edit") {
    const after = this.snapshot();
    if (signatureForState(before) === signatureForState(after)) {
      return false;
    }

    this.undoStack.push({
      label: String(label),
      state: normalizeState(before)
    });

    if (this.undoStack.length > this.limit) {
      this.undoStack.shift();
    }

    this.redoStack.length = 0;
    this.emitChange();
    return true;
  }

  run(label, mutator) {
    const before = this.snapshot();
    const result = mutator();
    this.commit(before, label);
    return result;
  }

  undo() {
    if (!this.canUndo()) return false;

    const current = this.snapshot();
    const entry = this.undoStack.pop();

    this.redoStack.push({
      label: entry.label,
      state: current
    });

    this.engine.restoreState(entry.state, { fromHistory: true });
    this.emitChange();
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;

    const current = this.snapshot();
    const entry = this.redoStack.pop();

    this.undoStack.push({
      label: entry.label,
      state: current
    });

    this.engine.restoreState(entry.state, { fromHistory: true });
    this.emitChange();
    return true;
  }

  clear() {
    this.undoStack.length = 0;
    this.redoStack.length = 0;
    this.emitChange();
  }

  emitChange() {
    this.engine.events.emit("historychange", {
      canUndo: this.canUndo(),
      canRedo: this.canRedo(),
      undoDepth: this.undoStack.length,
      redoDepth: this.redoStack.length
    });
  }
}

export function createNovaCutHistory(engine, options = {}) {
  return new NovaCutHistory(engine, options);
}
