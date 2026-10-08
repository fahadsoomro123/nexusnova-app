import {
  STICKER_LIBRARY,
  stickerMetrics,
  visualPointFromClient,
  distance,
  angleDegrees
} from "./novacut-visuals.js";

const MIN_SCALE = 0.2;
const MAX_SCALE = 4;

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(finite(value), min), max);
}

function setStyle(element, styles) {
  Object.assign(element.style, styles);
}

function getActiveVisuals(engine) {
  const timestamp = engine.currentTimestamp;
  const visuals = [
    ...(engine.registry.stickerTracks || []).map((item) => ({ type: "stickerTracks", item })),
    ...engine.registry.textTracks.map((item) => ({ type: "textTracks", item }))
  ];
  return visuals
    .filter(({ item }) => timestamp >= item.startTime && timestamp < item.startTime + item.duration)
    .reverse();
}

export class NovaCutVisualEditor {
  constructor(root, engine) {
    if (!root || !engine) throw new Error("NovaCut visual editor requires root and engine.");
    this.root = root;
    this.engine = engine;
    this.shell = root.querySelector(".nx-novacut__canvas-shell");
    this.canvas = root.querySelector("[data-role='preview-canvas']");
    this.overlay = null;
    this.selection = null;
    this.gesture = null;
    this.pointerId = null;
    this.unsubscribe = [];

    this.mount();
  }

  mount() {
    if (!this.shell || !this.canvas) return this;
    this.overlay = this.root.ownerDocument.createElement("div");
    this.overlay.className = "nx-novacut__visual-overlay";
    this.overlay.setAttribute("aria-label", "Visual layer controls");
    this.shell.appendChild(this.overlay);

    this.shell.addEventListener("pointerdown", (event) => this.onPointerDown(event), { passive: false });
    this.shell.addEventListener("pointermove", (event) => this.onPointerMove(event), { passive: false });
    this.shell.addEventListener("pointerup", (event) => this.onPointerUp(event), { passive: false });
    this.shell.addEventListener("pointercancel", (event) => this.onPointerCancel(event), { passive: false });

    const refresh = () => this.render();
    this.unsubscribe.push(this.engine.on("statechange", refresh));
    this.unsubscribe.push(this.engine.on("selectionchange", refresh));
    this.unsubscribe.push(this.engine.on("playheadchange", refresh));
    this.unsubscribe.push(this.engine.on("visualchange", refresh));

    this.render();
    return this;
  }

  getLogicalSize() {
    return {
      width: Math.max(1, this.canvas.width || this.canvas.clientWidth || 1),
      height: Math.max(1, this.canvas.height || this.canvas.clientHeight || 1)
    };
  }

  getClientScale() {
    const logical = this.getLogicalSize();
    return {
      x: this.canvas.clientWidth / logical.width,
      y: this.canvas.clientHeight / logical.height
    };
  }

  getBounds(record) {
    const { width, height } = this.getLogicalSize();
    const scale = this.getClientScale();
    const item = record.item;

    if (record.type === "stickerTracks") {
      const ctx = this.canvas.getContext("2d");
      if (!ctx) return { x: width / 2, y: height / 2, width: 120, height: 80, rotation: 0 };
      const metrics = stickerMetrics(item, ctx, width, height, window.devicePixelRatio || 1);
      return {
        x: metrics.x * scale.x,
        y: metrics.y * scale.y,
        width: metrics.width * scale.x,
        height: metrics.height * scale.y,
        rotation: metrics.rotation
      };
    }

    const style = item.style || {};
    const size = Math.max(8, finite(style.fontSize, 48)) * (window.devicePixelRatio || 1);
    const text = String(item.text || "Text");
    const lines = text.split(/\r?\n/).slice(0, 8);
    const ctx = this.canvas.getContext("2d");
    let widest = size * 2;
    if (ctx) {
      ctx.save();
      ctx.font = `${style.bold ? "800 " : "600 "}${size}px ${style.fontFamily || "system-ui"}`;
      widest = Math.max(size * 2, ...lines.map((line) => ctx.measureText(line).width));
      ctx.restore();
    }
    const lineHeight = size * 1.2;
    const boxWidth = widest + size * 0.7;
    const boxHeight = lines.length * lineHeight + size * 0.4;
    return {
      x: clampUnit(style.x) * this.canvas.clientWidth,
      y: clampUnit(style.y) * this.canvas.clientHeight,
      width: boxWidth * scale.x,
      height: boxHeight * scale.y,
      rotation: finite(style.rotation)
    };
  }

  render() {
    if (!this.overlay) return;
    this.overlay.innerHTML = "";
    this.selection = null;

    const selectedId = this.engine.activeTrackId;
    const record = selectedId ? this.engine.registry.getById(selectedId) : null;
    if (!record || !["textTracks", "stickerTracks"].includes(record.type)) return;

    const time = this.engine.currentTimestamp;
    if (time < record.item.startTime || time >= record.item.startTime + record.item.duration) return;

    const bounds = this.getBounds(record);
    this.selection = { record, bounds };

    const box = this.root.ownerDocument.createElement("div");
    box.className = "nx-novacut__visual-selection";
    setStyle(box, {
      left: `${bounds.x - bounds.width / 2}px`,
      top: `${bounds.y - bounds.height / 2}px`,
      width: `${Math.max(20, bounds.width)}px`,
      height: `${Math.max(20, bounds.height)}px`,
      transform: `rotate(${bounds.rotation}deg)`
    });
    box.dataset.visualSelection = record.item.id;

    const badge = this.root.ownerDocument.createElement("span");
    badge.className = "nx-novacut__visual-label";
    badge.textContent = record.type === "stickerTracks" ? "STICKER" : "TEXT";
    box.appendChild(badge);

    const handles = [
      ["scale-nw", "↖"],
      ["scale-ne", "↗"],
      ["scale-sw", "↙"],
      ["scale-se", "↘"]
    ];
    handles.forEach(([action, glyph]) => {
      const handle = this.root.ownerDocument.createElement("span");
      handle.className = `nx-novacut__visual-handle nx-novacut__visual-handle--${action}`;
      handle.dataset.visualAction = action;
      handle.textContent = glyph;
      handle.setAttribute("aria-label", "Resize visual layer");
      box.appendChild(handle);
    });

    const rotate = this.root.ownerDocument.createElement("span");
    rotate.className = "nx-novacut__visual-handle nx-novacut__visual-handle--rotate";
    rotate.dataset.visualAction = "rotate";
    rotate.textContent = "↻";
    rotate.setAttribute("aria-label", "Rotate visual layer");
    box.appendChild(rotate);

    const move = this.root.ownerDocument.createElement("span");
    move.className = "nx-novacut__visual-move-hint";
    move.textContent = "DRAG TO MOVE";
    box.appendChild(move);

    this.overlay.appendChild(box);
  }

  findVisualAt(point) {
    const visuals = getActiveVisuals(this.engine);
    const { width, height } = this.getLogicalSize();
    const logicalPoint = { x: point.x * width, y: point.y * height };

    for (const record of visuals) {
      const bounds = this.getBounds(record);
      const center = {
        x: bounds.x / Math.max(1e-6, this.getClientScale().x),
        y: bounds.y / Math.max(1e-6, this.getClientScale().y)
      };
      const scale = this.getClientScale();
      const halfW = bounds.width / Math.max(1e-6, scale.x) / 2;
      const halfH = bounds.height / Math.max(1e-6, scale.y) / 2;
      if (
        Math.abs(logicalPoint.x - center.x) <= halfW &&
        Math.abs(logicalPoint.y - center.y) <= halfH
      ) {
        return record;
      }
    }
    return null;
  }

  onPointerDown(event) {
    if (event.pointerType === "mouse" && event.button !== 0) return;
    if (!this.canvas) return;

    const point = visualPointFromClient(this.canvas, event.clientX, event.clientY);
    const target = event.target instanceof Element ? event.target : null;
    const action = target?.closest?.("[data-visual-action]")?.dataset?.visualAction || null;
    let record = this.selection?.record || null;

    if (!action) {
      record = this.findVisualAt(point);
      if (record) {
        this.engine.selectClip(record.item.id);
      } else {
        this.engine.events.emit("visualselectclear", {});
        return;
      }
    }

    if (!record) return;

    event.preventDefault();
    this.pointerId = event.pointerId;
    try { this.shell.setPointerCapture(event.pointerId); } catch (_) {}

    const item = record.item;
    const startPoint = point;
    const start = {
      x: finite(item.x, record.type === "stickerTracks" ? 0.5 : item.style?.x ?? 0.5),
      y: finite(item.y, record.type === "stickerTracks" ? 0.5 : item.style?.y ?? 0.5),
      scale: finite(item.scale, 1),
      rotation: finite(item.rotation, record.type === "textTracks" ? item.style?.rotation : 0)
    };

    const center = {
      x: start.x,
      y: start.y
    };

    this.gesture = {
      record,
      item,
      action: action || "move",
      startPoint,
      start,
      center,
      startDistance: distance(startPoint, center),
      startAngle: angleDegrees(center, startPoint),
      historyBefore: this.engine.history?.snapshot?.() || null
    };

    this.shell.classList.add("nx-novacut__visual-gesture");
  }

  onPointerMove(event) {
    if (this.pointerId !== event.pointerId || !this.gesture) return;
    event.preventDefault();

    const point = visualPointFromClient(this.canvas, event.clientX, event.clientY);
    const state = this.gesture;
    const item = state.item;

    if (state.action === "move") {
      const dx = point.x - state.startPoint.x;
      const dy = point.y - state.startPoint.y;
      const nextX = clamp(state.start.x + dx, 0, 1);
      const nextY = clamp(state.start.y + dy, 0, 1);
      this.engine.updateVisualTransform(item.id, { x: nextX, y: nextY }, { live: true });
    } else if (state.action.startsWith("scale")) {
      const startDistance = Math.max(0.02, distance(state.center, state.startPoint));
      const ratio = distance(state.center, point) / startDistance;
      this.engine.updateVisualTransform(
        item.id,
        { scale: clamp(state.start.scale * ratio, MIN_SCALE, MAX_SCALE) },
        { live: true }
      );
    } else if (state.action === "rotate") {
      const delta = angleDegrees(state.center, point) - state.startAngle;
      this.engine.updateVisualTransform(
        item.id,
        { rotation: state.start.rotation + delta },
        { live: true }
      );
    }
  }

  onPointerUp(event) {
    if (this.pointerId !== event.pointerId) return;
    const pointerId = this.pointerId;
    this.commitGesture();
    try { this.shell.releasePointerCapture(pointerId); } catch (_) {}
    this.pointerId = null;
  }

  onPointerCancel(event) {
    if (this.pointerId !== event.pointerId) return;
    const state = this.gesture;
    if (state) {
      this.engine.restoreVisualTransform(state.item.id, state.start);
    }
    try { this.shell.releasePointerCapture(event.pointerId); } catch (_) {}
    this.pointerId = null;
    this.gesture = null;
    this.shell.classList.remove("nx-novacut__visual-gesture");
    this.render();
  }

  commitGesture() {
    const state = this.gesture;
    this.gesture = null;
    this.shell.classList.remove("nx-novacut__visual-gesture");
    if (!state?.historyBefore) {
      this.render();
      return;
    }
    const changed = this.engine.recordExternalMutation(
      state.historyBefore,
      state.action === "move" ? "Move visual" :
      state.action === "rotate" ? "Rotate visual" : "Resize visual"
    );
    if (changed) this.engine.events.emit("visualchange", { id: state.item.id });
    this.render();
  }

  dispose() {
    this.unsubscribe.forEach((unsubscribe) => {
      try { unsubscribe(); } catch (_) {}
    });
    this.unsubscribe = [];
    this.overlay?.remove();
    this.overlay = null;
    this.gesture = null;
  }
}

function clampUnit(value, fallback = 0.5) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.min(1, Math.max(0, number)) : fallback;
}

export function createNovaCutVisualEditor(root, engine) {
  return new NovaCutVisualEditor(root, engine);
}
