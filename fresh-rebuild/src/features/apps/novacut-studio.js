/*
 * NovaCut Studio Interaction Core
 * Touch seek, clip drag, and dual-edge trim handlers.
 *
 * This module is scoped to the mounted NovaCut root and does not
 * create or modify any global application namespace.
 */

const DEFAULT_INTERACTION = Object.freeze({
  pixelsPerSecond: 36,
  longPressMs: 160,
  moveThresholdPx: 6,
  minFrameMs: 1000 / 30,
  edgeAutoScrollPx: 28
});

function finite(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(finite(value), min), max);
}

function getTouch(event) {
  return event.changedTouches?.[0] || event.touches?.[0] || null;
}

function isPrimaryInteractiveTarget(target) {
  if (!(target instanceof Element)) {
    return false;
  }

  return Boolean(
    target.closest(
      "button,input,select,textarea,a,[contenteditable='true']"
    )
  );
}

function getClipElement(target) {
  if (!(target instanceof Element)) {
    return null;
  }

  return target.closest(
    "[data-clip-id], [data-clip]"
  );
}

function getClipId(element) {
  return (
    element?.dataset?.clipId ||
    element?.dataset?.clip ||
    null
  );
}

function ensureStyle(root) {
  if (
    root.querySelector(
      "style[data-novacut-interaction-style]"
    )
  ) {
    return;
  }

  const style = root.ownerDocument.createElement("style");
  style.dataset.novacutInteractionStyle = "true";

  style.textContent = [
    ".nx-novacut__timeline{position:relative;overscroll-behavior-x:contain;touch-action:pan-y;}",
    ".nx-novacut__timeline.novacut-gesture-active{touch-action:none;user-select:none;-webkit-user-select:none;}",
    ".nx-novacut__clip{position:relative;flex:0 0 auto;will-change:transform,width;margin-left:0;transition:none;}",
    ".nx-novacut__clip.novacut-selected{border-color:#45a8ff;box-shadow:0 0 0 1px rgba(69,168,255,.18);}",
    ".novacut-clip__handle{position:absolute;top:0;bottom:0;width:18px;z-index:4;display:block;touch-action:none;}",
    ".novacut-clip__handle::after{content:'';position:absolute;top:8px;bottom:8px;width:3px;border-radius:3px;background:rgba(245,245,247,.72);box-shadow:0 0 0 1px rgba(0,0,0,.28);}",
    ".novacut-clip__handle[data-novacut-edge='start']{left:0;cursor:ew-resize;}",
    ".novacut-clip__handle[data-novacut-edge='start']::after{left:5px;}",
    ".novacut-clip__handle[data-novacut-edge='end']{right:0;cursor:ew-resize;}",
    ".novacut-clip__handle[data-novacut-edge='end']::after{right:5px;}",
    ".nx-novacut__interaction-playhead{position:absolute;z-index:20;width:1px;top:25px;bottom:0;pointer-events:none;background:linear-gradient(180deg,#45a8ff,#45a8ff22);box-shadow:0 0 8px rgba(69,168,255,.36);}",
    ".nx-novacut__interaction-playhead::before{content:'';position:absolute;top:-1px;left:50%;width:9px;height:9px;border-radius:3px;background:#45a8ff;border:1px solid #fff;transform:translate(-50%,-50%);box-shadow:0 0 10px rgba(69,168,255,.5);}",
    ".nx-novacut__clip[data-novacut-dragging='true']{z-index:8;opacity:.92;}",
    ".nx-novacut__clip[data-novacut-trimming='true']{z-index:9;}",
    "@media (prefers-reduced-motion:no-preference){.nx-novacut__interaction-playhead{transition:left 40ms linear;}}"
  ].join("");

  root.appendChild(style);
}

export class NovaCutStudioInteractions {
  constructor(root, engine, options = {}) {
    if (!root) {
      throw new Error("NovaCut interactions require a mounted root.");
    }

    if (!engine) {
      throw new Error("NovaCut interactions require a NovaCutEngine instance.");
    }

    this.root = root;
    this.engine = engine;

    this.options = Object.freeze({
      ...DEFAULT_INTERACTION,
      ...options
    });

    this.timeline = null;
    this.playhead = null;

    this.mode = "idle";
    this.touchState = null;

    this.pendingFrame = 0;
    this.pendingMutationFrame = 0;

    this.pendingTimelineSeekX = null;
    this.pendingClipDx = null;

    this.longPressTimer = 0;
    this.resizeObserver = null;
    this.mutationObserver = null;

    this.unsubscribe = [];

    ensureStyle(root);
    this.mount();
  }

  mount() {
    this.timeline =
      this.root.querySelector(".novacut-timeline") ||
      this.root.querySelector(".nx-novacut__timeline");

    if (!this.timeline) {
      return this;
    }

    this.installPlayhead();
    this.bind();
    this.observeDom();
    this.syncTimeline();

    return this;
  }

  installPlayhead() {
    if (!this.timeline) {
      return;
    }

    let element = this.timeline.querySelector(
      ".nx-novacut__interaction-playhead"
    );

    if (!element) {
      element = this.root.ownerDocument.createElement("span");
      element.className = "nx-novacut__interaction-playhead";
      element.setAttribute("aria-hidden", "true");
      this.timeline.appendChild(element);
    }

    this.playhead = element;

    if (
      typeof ResizeObserver !== "undefined"
    ) {
      this.resizeObserver?.disconnect();

      this.resizeObserver =
        new ResizeObserver(() => {
          this.scheduleSync();
        });

      this.resizeObserver.observe(this.timeline);
    }
  }

  bind() {
    const controller =
      new AbortController();

    this.abortController = controller;

    const signal =
      controller.signal;

    this.root.addEventListener(
      "touchstart",
      (event) => {
        this.onTouchStart(event);
      },
      {
        signal,
        passive: false
      }
    );

    this.root.addEventListener(
      "touchmove",
      (event) => {
        this.onTouchMove(event);
      },
      {
        signal,
        passive: false
      }
    );

    this.root.addEventListener(
      "touchend",
      (event) => {
        this.onTouchEnd(event);
      },
      {
        signal,
        passive: false
      }
    );

    this.root.addEventListener(
      "touchcancel",
      (event) => {
        this.onTouchCancel(event);
      },
      {
        signal,
        passive: false
      }
    );

    this.root.addEventListener(
      "click",
      (event) => {
        this.onClick(event);
      },
      {
        signal
      }
    );

    this.timeline.addEventListener(
      "scroll",
      () => {
        this.scheduleSync();
      },
      {
        signal,
        passive: true
      }
    );

    this.unsubscribe.push(
      this.engine.on(
        "playheadchange",
        () => this.scheduleSync()
      )
    );

    this.unsubscribe.push(
      this.engine.on(
        "statechange",
        () => this.scheduleSync()
      )
    );
  }

  observeDom() {
    if (!this.timeline) {
      return;
    }

    this.mutationObserver?.disconnect();

    this.mutationObserver =
      new MutationObserver(() => {
        if (this.pendingMutationFrame) {
          return;
        }

        this.pendingMutationFrame =
          requestAnimationFrame(() => {
            this.pendingMutationFrame = 0;

            try {
              this.decorateVideoClips();
              this.syncTimeline();
            } catch (error) {
              this.engine.reportError(
                "interaction-dom",
                error
              );
            }
          });
      });

    this.mutationObserver.observe(
      this.timeline,
      {
        childList: true,
        subtree: true
      }
    );

    this.decorateVideoClips();
  }

  onClick(event) {
    const clipElement =
      getClipElement(event.target);

    if (!clipElement) {
      return;
    }

    const clipId =
      getClipId(clipElement);

    if (!clipId) {
      return;
    }

    this.selectClip(
      clipElement,
      clipId
    );
  }

  selectClip(element, clipId) {
    try {
      this.engine.selectClip(
        clipId
      );
    } catch {
      this.engine.activeTrackId =
        clipId;
    }

    this.root
      .querySelectorAll(
        "[data-clip-id], [data-clip]"
      )
      .forEach((clipElement) => {
        clipElement.classList.toggle(
          "novacut-selected",
          getClipId(clipElement) ===
            String(clipId)
        );
      });

    element?.classList.add(
      "novacut-selected"
    );
  }

  onTouchStart(event) {
    const touch =
      getTouch(event);

    if (!touch) {
      return;
    }

    const target =
      event.target instanceof Element
        ? event.target
        : null;

    if (!target) {
      return;
    }

    const timeline =
      target.closest(
        ".novacut-timeline, .nx-novacut__timeline"
      );

    if (
      !timeline ||
      timeline !== this.timeline
    ) {
      return;
    }

    const clipElement =
      getClipElement(target);

    const edge =
      target.closest(
        ".novacut-clip__handle"
      )?.dataset?.novacutEdge || null;

    const clipId =
      getClipId(clipElement);

    if (clipElement && clipId) {
      this.selectClip(
        clipElement,
        clipId
      );

      const record =
        this.engine.registry.getById(
          clipId
        );

      if (
        record &&
        record.type === "videoTracks"
      ) {
        this.beginClipTouch(
          event,
          touch,
          clipElement,
          record.item,
          edge
        );

        return;
      }
    }

    if (
      !isPrimaryInteractiveTarget(target)
    ) {
      this.beginTimelineTouch(
        event,
        touch
      );
    }
  }

  beginClipTouch(
    event,
    touch,
    element,
    clip,
    edge
  ) {
    this.cancelLongPress();

    this.engine.beginHistoryTransaction?.("Timeline edit");

    this.touchState = {
      originX: touch.clientX,
      originY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startedAt: performance.now(),
      element,
      clip,
      clipId: clip.id,
      edge,
      originalStartTime:
        finite(clip.startTime),
      originalDuration:
        Math.max(1, finite(clip.duration)),
      originalSourceStartTime:
        Math.max(
          0,
          finite(clip.sourceStartTime)
        ),
      timelineScrollLeft:
        this.timeline.scrollLeft,
      mode: edge
        ? "trim-pending"
        : "drag-pending"
    };

    this.cancelLongPress();

    this.longPressTimer =
      window.setTimeout(() => {
        if (
          this.touchState &&
          this.touchState.mode ===
            "drag-pending"
        ) {
          this.enterClipMode(
            "drag"
          );
        }
      }, this.options.longPressMs);

    /*
     * A handle is an immediate resize target.
     */
    if (edge) {
      this.enterClipMode(
        edge === "start"
          ? "trim-start"
          : "trim-end"
      );
      event.preventDefault();
    }
  }

  beginTimelineTouch(
    event,
    touch
  ) {
    this.cancelLongPress();

    this.touchState = {
      originX: touch.clientX,
      originY: touch.clientY,
      lastX: touch.clientX,
      lastY: touch.clientY,
      startedAt: performance.now(),
      timelineScrollLeft:
        this.timeline.scrollLeft,
      mode: "timeline-pending"
    };

    void event;
  }

  enterClipMode(mode) {
    if (!this.touchState) {
      return;
    }

    this.mode = mode;
    this.touchState.mode = mode;

    this.timeline.classList.add(
      "novacut-gesture-active"
    );

    if (this.touchState.element) {
      this.touchState.element.dataset.novacutDragging =
        mode === "drag"
          ? "true"
          : "";

      this.touchState.element.dataset.novacutTrimming =
        mode.startsWith("trim")
          ? "true"
          : "";
    }

    this.cancelLongPress();
  }

  onTouchMove(event) {
    const touch =
      getTouch(event);

    const state =
      this.touchState;

    if (!touch || !state) {
      return;
    }

    const dx =
      touch.clientX -
      state.originX;

    const dy =
      touch.clientY -
      state.originY;

    state.lastX =
      touch.clientX;

    state.lastY =
      touch.clientY;

    if (
      Math.abs(dx) <
        this.options.moveThresholdPx &&
      Math.abs(dy) <
        this.options.moveThresholdPx
    ) {
      return;
    }

    if (
      state.mode === "timeline-pending"
    ) {
      if (
        Math.abs(dx) >
        Math.abs(dy)
      ) {
        this.enterTimelineMode();
      } else {
        return;
      }
    }

    if (
      state.mode === "drag-pending"
    ) {
      if (
        Math.abs(dx) >
        Math.abs(dy)
      ) {
        this.enterClipMode(
          "drag"
        );
      } else {
        return;
      }
    }

    if (
      state.mode === "trim-pending"
    ) {
      this.enterClipMode(
        "trim-start"
      );
    }

    switch (state.mode) {
      case "timeline":
        event.preventDefault();
        this.pendingTimelineSeekX =
          touch.clientX;
        this.scheduleTimelineGesture(
          touch.clientX,
          dx
        );
        break;

      case "drag":
        event.preventDefault();
        this.pendingClipDx =
          dx;
        this.scheduleClipDrag();
        this.edgeScroll(
          touch.clientX
        );
        break;

      case "trim-start":
        event.preventDefault();
        this.pendingClipDx =
          dx;
        this.scheduleTrim(
          "start"
        );
        this.edgeScroll(
          touch.clientX
        );
        break;

      case "trim-end":
        event.preventDefault();
        this.pendingClipDx =
          dx;
        this.scheduleTrim(
          "end"
        );
        this.edgeScroll(
          touch.clientX
        );
        break;

      default:
        break;
    }
  }

  enterTimelineMode() {
    if (!this.touchState) {
      return;
    }

    this.mode = "timeline";
    this.touchState.mode =
      "timeline";

    this.timeline.classList.add(
      "novacut-gesture-active"
    );

    this.cancelLongPress();
  }

  onTouchEnd(event) {
    if (
      !this.touchState
    ) {
      return;
    }

    const state =
      this.touchState;

    const mode =
      state.mode;

    this.cancelLongPress();

    if (
      mode === "drag" ||
      mode === "trim-start" ||
      mode === "trim-end"
    ) {
      event.preventDefault();

      try {
        this.commitClipMutation();
        this.engine.commitHistoryTransaction?.();
      } catch (error) {
        this.engine.cancelHistoryTransaction?.();
        this.engine.reportError(
          "interaction-commit",
          error
        );
      }
    } else if (
      mode === "drag-pending" ||
      mode === "trim-pending"
    ) {
      this.engine.cancelHistoryTransaction?.();
    }

    if (
      mode === "timeline"
    ) {
      event.preventDefault();
      this.flushTimelineSeek();
    }

    this.cleanupGesture();
  }

  onTouchCancel(event) {
    if (
      this.touchState &&
      (
        this.touchState.mode ===
          "drag" ||
        this.touchState.mode ===
          "trim-start" ||
        this.touchState.mode ===
          "trim-end"
      )
    ) {
      this.restoreClipMutation();
    }

    this.engine.cancelHistoryTransaction?.();

    event.preventDefault();
    this.cleanupGesture();
  }

  scheduleTimelineGesture(
    clientX,
    dx
  ) {
    this.pendingTimelineSeekX =
      clientX;

    if (
      this.pendingFrame
    ) {
      return;
    }

    this.pendingFrame =
      requestAnimationFrame(() => {
        this.pendingFrame = 0;

        const currentX =
          this.pendingTimelineSeekX;

        if (
          currentX === null
        ) {
          return;
        }

        const scrollDelta =
          dx * -0.55;

        this.timeline.scrollLeft =
          clamp(
            this.touchState.timelineScrollLeft +
              scrollDelta,
            0,
            Math.max(
              0,
              this.timeline.scrollWidth -
                this.timeline.clientWidth
            )
          );

        const timestamp =
          this.timestampFromClientX(
            currentX
          );

        this.engine.setPlayhead(
          timestamp
        );
      });
  }

  flushTimelineSeek() {
    if (
      this.pendingTimelineSeekX ===
      null
    ) {
      return;
    }

    const timestamp =
      this.timestampFromClientX(
        this.pendingTimelineSeekX
      );

    this.engine.setPlayhead(
      timestamp
    );

    this.pendingTimelineSeekX =
      null;
  }

  timestampFromClientX(
    clientX
  ) {
    const rect =
      this.timeline.getBoundingClientRect();

    const target =
      this.timeline.querySelector(
        "[data-role='video-lane'], .nx-novacut__lane"
      ) ||
      this.timeline;

    const targetRect =
      target.getBoundingClientRect();

    const viewportX =
      clientX -
      targetRect.left;

    const contentX =
      viewportX +
      this.timeline.scrollLeft;

    const pxPerMs =
      this.options.pixelsPerSecond /
      1000;

    return Math.max(
      0,
      contentX /
        pxPerMs
    );
  }

  scheduleClipDrag() {
    if (
      this.pendingFrame ||
      !this.touchState
    ) {
      return;
    }

    this.pendingFrame =
      requestAnimationFrame(() => {
        this.pendingFrame = 0;

        const state =
          this.touchState;

        if (
          !state ||
          state.mode !== "drag"
        ) {
          return;
        }

        const deltaMs =
          finite(
            this.pendingClipDx
          ) /
          this.pixelsPerMs();

        const candidate =
          this.clampedDragStart(
            state.clip,
            state.originalStartTime +
              deltaMs
          );

        state.clip.startTime =
          candidate;

        this.applyClipGeometry(
          state.element,
          state.clip
        );

        this.engine.activeTrackId =
          state.clip.id;
      });
  }

  scheduleTrim(edge) {
    if (
      this.pendingFrame ||
      !this.touchState
    ) {
      return;
    }

    this.pendingFrame =
      requestAnimationFrame(() => {
        this.pendingFrame = 0;

        const state =
          this.touchState;

        if (
          !state ||
          !state.mode.startsWith("trim")
        ) {
          return;
        }

        const deltaMs =
          finite(
            this.pendingClipDx
          ) /
          this.pixelsPerMs();

        if (
          edge === "start"
        ) {
          this.applyStartTrim(
            state,
            deltaMs
          );
        } else {
          this.applyEndTrim(
            state,
            deltaMs
          );
        }

        this.applyClipGeometry(
          state.element,
          state.clip
        );
      });
  }

  applyStartTrim(
    state,
    deltaMs
  ) {
    const clip =
      state.clip;

    const minimum =
      this.options.minFrameMs;

    const originalStart =
      state.originalStartTime;

    const originalEnd =
      originalStart +
      state.originalDuration;

    const previous =
      this.getPreviousVideoClip(
        clip
      );

    const previousEnd =
      previous
        ? previous.startTime +
          previous.duration
        : 0;

    const lower =
      Math.max(
        previousEnd,
        0
      );

    const upper =
      originalEnd -
      minimum;

    const nextStart =
      clamp(
        originalStart +
          deltaMs,
        lower,
        upper
      );

    const actualDelta =
      nextStart -
      originalStart;

    clip.startTime =
      nextStart;

    clip.duration =
      state.originalDuration -
      actualDelta;

    clip.sourceStartTime =
      Math.max(
        0,
        state.originalSourceStartTime +
          actualDelta
      );
  }

  applyEndTrim(
    state,
    deltaMs
  ) {
    const clip =
      state.clip;

    const minimum =
      this.options.minFrameMs;

    const originalStart =
      state.originalStartTime;

    const next =
      this.getNextVideoClip(
        clip
      );

    const maximumEnd =
      next
        ? next.startTime
        : Infinity;

    const targetEnd =
      clamp(
        originalStart +
          state.originalDuration +
          deltaMs,
        originalStart +
          minimum,
        maximumEnd
      );

    clip.duration =
      Math.max(
        minimum,
        targetEnd -
          originalStart
      );
  }

  clampedDragStart(
    clip,
    desiredStart
  ) {
    const minimum =
      this.options.minFrameMs;

    const previous =
      this.getPreviousVideoClip(
        clip
      );

    const next =
      this.getNextVideoClip(
        clip
      );

    const previousEnd =
      previous
        ? previous.startTime +
          previous.duration
        : 0;

    const nextLimit =
      next
        ? next.startTime -
          clip.duration
        : Infinity;

    const upper =
      Math.max(
        previousEnd,
        nextLimit >= previousEnd
          ? nextLimit
          : previousEnd
      );

    return clamp(
      desiredStart,
      Math.max(0, previousEnd),
      Math.max(
        Math.max(0, previousEnd),
        upper
      )
    );
  }

  getVideoClipsInOrder() {
    return [
      ...this.engine.registry.videoTracks
    ].sort(
      (a, b) =>
        finite(a.startTime) -
        finite(b.startTime)
    );
  }

  getPreviousVideoClip(
    clip
  ) {
    const ordered =
      this.getVideoClipsInOrder();

    const index =
      ordered.findIndex(
        (item) =>
          item.id === clip.id
      );

    return index > 0
      ? ordered[index - 1]
      : null;
  }

  getNextVideoClip(
    clip
  ) {
    const ordered =
      this.getVideoClipsInOrder();

    const index =
      ordered.findIndex(
        (item) =>
          item.id === clip.id
      );

    return index >= 0 &&
      index < ordered.length - 1
      ? ordered[index + 1]
      : null;
  }

  commitClipMutation() {
    const state =
      this.touchState;

    if (!state) {
      return;
    }

    const clip =
      state.clip;

    clip.startTime =
      Math.max(
        0,
        finite(clip.startTime)
      );

    clip.duration =
      Math.max(
        this.options.minFrameMs,
        finite(clip.duration)
      );

    clip.sourceStartTime =
      Math.max(
        0,
        finite(clip.sourceStartTime)
      );

    this.engine.activeTrackId =
      clip.id;

    /*
     * One state refresh at gesture end only.
     * The live frames are mutated locally during touchmove.
     */
    if (
      typeof this.engine.refresh ===
      "function"
    ) {
      this.engine.refresh();
    } else {
      this.engine.events?.emit(
        "statechange",
        this.engine.getState?.()
      );
    }
  }

  restoreClipMutation() {
    const state =
      this.touchState;

    if (!state?.clip) {
      return;
    }

    state.clip.startTime =
      state.originalStartTime;

    state.clip.duration =
      state.originalDuration;

    state.clip.sourceStartTime =
      state.originalSourceStartTime;

    this.applyClipGeometry(
      state.element,
      state.clip
    );
  }

  edgeScroll(clientX) {
    if (!this.timeline) {
      return;
    }

    const rect =
      this.timeline.getBoundingClientRect();

    const distanceLeft =
      clientX -
      rect.left;

    const distanceRight =
      rect.right -
      clientX;

    if (
      distanceLeft <
      this.options.edgeAutoScrollPx
    ) {
      this.timeline.scrollLeft =
        Math.max(
          0,
          this.timeline.scrollLeft -
            8
        );
    } else if (
      distanceRight <
      this.options.edgeAutoScrollPx
    ) {
      this.timeline.scrollLeft +=
        8;
    }
  }

  decorateVideoClips() {
    if (!this.timeline) {
      return;
    }

    const elements =
      this.timeline.querySelectorAll(
        "[data-clip-id], [data-clip]"
      );

    elements.forEach(
      (element) => {
        const clipId =
          getClipId(element);

        if (!clipId) {
          return;
        }

        const record =
          this.engine.registry.getById(
            clipId
          );

        if (
          !record ||
          record.type !==
            "videoTracks"
        ) {
          return;
        }

        this.ensureTrimHandles(
          element
        );

        this.applyClipGeometry(
          element,
          record.item
        );

        element.classList.toggle(
          "novacut-selected",
          this.engine.activeTrackId ===
            record.item.id
        );
      }
    );
  }

  ensureTrimHandles(
    element
  ) {
    const hasStart =
      element.querySelector(
        ".novacut-clip__handle[data-novacut-edge='start']"
      );

    const hasEnd =
      element.querySelector(
        ".novacut-clip__handle[data-novacut-edge='end']"
      );

    if (!hasStart) {
      const start =
        this.root.ownerDocument.createElement(
          "span"
        );

      start.className =
        "novacut-clip__handle";

      start.dataset.novacutEdge =
        "start";

      start.setAttribute(
        "aria-label",
        "Trim clip start"
      );

      start.setAttribute(
        "role",
        "presentation"
      );

      element.prepend(
        start
      );
    }

    if (!hasEnd) {
      const end =
        this.root.ownerDocument.createElement(
          "span"
        );

      end.className =
        "novacut-clip__handle";

      end.dataset.novacutEdge =
        "end";

      end.setAttribute(
        "aria-label",
        "Trim clip end"
      );

      end.setAttribute(
        "role",
        "presentation"
      );

      element.append(
        end
      );
    }
  }

  applyClipGeometry(
    element,
    clip
  ) {
    if (!element || !clip) {
      return;
    }

    const scale =
      this.options.pixelsPerSecond /
      1000;

    const width =
      Math.max(
        46,
        finite(clip.duration) *
          scale
      );

    const start =
      Math.max(
        0,
        finite(clip.startTime)
      );

    element.style.width =
      width + "px";

    element.style.minWidth =
      width + "px";

    element.style.flex =
      "0 0 " + width + "px";

    element.style.marginLeft =
      start * scale + "px";

    element.style.transform =
      "translate3d(0,0,0)";
  }

  syncTimeline() {
    if (!this.timeline) {
      return;
    }

    this.installPlayhead();
    this.decorateVideoClips();
    this.syncPlayhead();
  }

  syncPlayhead() {
    if (
      !this.timeline ||
      !this.playhead
    ) {
      return;
    }

    const target =
      this.timeline.querySelector(
        "[data-role='video-lane'], .nx-novacut__lane"
      );

    if (!target) {
      return;
    }

    const timelineRect =
      this.timeline.getBoundingClientRect();

    const laneRect =
      target.getBoundingClientRect();

    const pxPerMs =
      this.pixelsPerMs();

    const contentX =
      this.engine.currentTimestamp *
      pxPerMs;

    const viewportX =
      laneRect.left -
      timelineRect.left +
      contentX;

    const boundedX =
      clamp(
        viewportX,
        0,
        Math.max(
          0,
          this.timeline.clientWidth
        )
      );

    this.playhead.style.left =
      boundedX + "px";
  }

  scheduleSync() {
    if (
      this.pendingFrame
    ) {
      return;
    }

    this.pendingFrame =
      requestAnimationFrame(() => {
        this.pendingFrame = 0;

        try {
          this.syncTimeline();
        } catch (error) {
          this.engine.reportError(
            "interaction-sync",
            error
          );
        }
      });
  }

  pixelsPerMs() {
    return (
      this.options.pixelsPerSecond /
      1000
    );
  }

  cancelLongPress() {
    if (
      this.longPressTimer
    ) {
      window.clearTimeout(
        this.longPressTimer
      );

      this.longPressTimer = 0;
    }
  }

  cleanupGesture() {
    this.cancelLongPress();

    this.pendingTimelineSeekX =
      null;

    this.pendingClipDx =
      null;

    this.mode =
      "idle";

    if (
      this.touchState?.element
    ) {
      delete this.touchState.element.dataset.novacutDragging;
      delete this.touchState.element.dataset.novacutTrimming;
      this.touchState.element.style.transform =
        "translate3d(0,0,0)";
    }

    this.timeline?.classList.remove(
      "novacut-gesture-active"
    );

    this.touchState =
      null;

    this.scheduleSync();
  }

  dispose() {
    this.cancelLongPress();

    if (
      this.pendingFrame
    ) {
      cancelAnimationFrame(
        this.pendingFrame
      );

      this.pendingFrame = 0;
    }

    if (
      this.pendingMutationFrame
    ) {
      cancelAnimationFrame(
        this.pendingMutationFrame
      );

      this.pendingMutationFrame = 0;
    }

    this.abortController?.abort();

    this.unsubscribe.forEach(
      (unsubscribe) => {
        try {
          unsubscribe();
        } catch {
          /* ignored */
        }
      }
    );

    this.unsubscribe = [];

    this.resizeObserver?.disconnect();
    this.mutationObserver?.disconnect();

    this.resizeObserver = null;
    this.mutationObserver = null;
    this.playhead?.remove();

    this.playhead = null;
    this.timeline = null;
    this.touchState = null;
  }
}

export function createNovaCutStudioInteractions(
  root,
  engine,
  options = {}
) {
  return new NovaCutStudioInteractions(
    root,
    engine,
    options
  );
}

export function attachNovaCutInteractions(
  root,
  engine,
  options = {}
) {
  return createNovaCutStudioInteractions(
    root,
    engine,
    options
  );
}
