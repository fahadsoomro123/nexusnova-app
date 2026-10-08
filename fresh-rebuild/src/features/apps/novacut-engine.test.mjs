import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import test from "node:test";

const source = fs.readFileSync(
  new URL("./novacut-engine.js", import.meta.url),
  "utf8"
).replace(/export \{[\s\S]*?\};\nexport const createNovaCutEngine[\s\S]*$/, "");

class FakeEventTarget {
  constructor() { this.listeners = new Map(); }
  addEventListener(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
  }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatch(name) { this.listeners.get(name)?.forEach((fn) => fn()); }
  setAttribute() {}
  removeAttribute() {}
}

class FakeVideo extends FakeEventTarget {
  constructor() {
    super();
    this.tagName = "video";
    this.readyState = 0;
    this.currentTime = 0;
    this.videoWidth = 1920;
    this.videoHeight = 1080;
    this.paused = true;
    this.ended = false;
    this.playCalls = 0;
    this.pauseCalls = 0;
    this._src = "";
  }
  set src(value) {
    this._src = value;
    this.readyState = 2;
    queueMicrotask(() => {
      this.dispatch("loadeddata");
      this.dispatch("canplay");
    });
  }
  get src() { return this._src; }
  load() {}
  play() {
    this.playCalls += 1;
    this.paused = false;
    this.ended = false;
    return Promise.resolve();
  }
  pause() {
    this.pauseCalls += 1;
    this.paused = true;
  }
}

const createdVideos = [];
const context = {
  navigator: { hardwareConcurrency: 4, deviceMemory: 4 },
  crypto: { randomUUID: () => "test-id" },
  URL: {
    createObjectURL: (file) => "blob:" + String(file),
    revokeObjectURL: () => {}
  },
  HTMLVideoElement: FakeVideo,
  Image: class extends FakeEventTarget {
    constructor() {
      super();
      this.complete = false;
      this.naturalWidth = 1920;
      this.naturalHeight = 1080;
      this.videoWidth = 1920;
      this.videoHeight = 1080;
    }
    set src(value) {
      this._src = value;
      this.complete = true;
      queueMicrotask(() => this.dispatch("load"));
    }
    get src() { return this._src; }
  },
  document: {
    createElement: (tag) => {
      if (tag === "video") {
        const value = new FakeVideo();
        createdVideos.push(value);
        return value;
      }
      throw new Error("Unexpected element: " + tag);
    }
  },
  performance: { now: () => 1000 },
  requestAnimationFrame: () => 1,
  cancelAnimationFrame: () => {},
  ResizeObserver: undefined,
  devicePixelRatio: 1,
  SharedArrayBuffer: class SharedArrayBuffer {}
};

vm.runInNewContext(source + "\nthis.NovaCutEngine = NovaCutEngine;\nthis.NovaCutCanvasPreview = NovaCutCanvasPreview;", context, { filename: "novacut-engine.js" });

test("resolve() reuses one in-flight decoder per clip", async () => {
  const engine = new context.NovaCutEngine();
  const canvas = {
    width: 0,
    height: 0,
    getBoundingClientRect: () => ({ width: 320, height: 180 }),
    getContext: () => ({
      setTransform() {},
      fillRect() {},
      drawImage() {},
      save() {},
      restore() {},
      measureText: () => ({ width: 10 }),
      fillText() {}
    })
  };
  const preview = new context.NovaCutCanvasPreview(engine, canvas);
  const clip = { id: "clip-1", file: "blob:test-video" };

  const first = preview.resolve(clip);
  const second = preview.resolve(clip);
  assert.notStrictEqual(first, second, "async wrapper promises are independent");
  await Promise.all([first, second]);

  assert.equal(createdVideos.length, 1);
  assert.equal(preview.media.size, 1);
});

test("play() invokes the real video element and pause() stops it", async () => {
  const engine = new context.NovaCutEngine();
  const canvas = {
    width: 0,
    height: 0,
    getBoundingClientRect: () => ({ width: 320, height: 180 }),
    getContext: () => ({
      setTransform() {},
      fillRect() {},
      drawImage() {},
      save() {},
      restore() {},
      measureText: () => ({ width: 10 }),
      fillText() {}
    })
  };
  engine.preview = new context.NovaCutCanvasPreview(engine, canvas);
  engine.addVideoClip({
    id: "clip-play",
    file: "blob:play-video",
    startTime: 0,
    duration: 2000,
    sourceStartTime: 0
  });

  const result = await engine.play();
  assert.equal(result, true);
  assert.equal(engine.isPlaying, true);
  const media = engine.preview.media.get("clip-play");
  assert.equal(media.playCalls, 1);

  engine.pause();
  assert.equal(engine.isPlaying, false);
  assert.equal(media.pauseCalls, 1);
});
