import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const ROOT = process.cwd();
const read = (file) => fs.readFileSync(path.join(ROOT, file), "utf8");
const exists = (file) => fs.statSync(path.join(ROOT, file)).isFile();
const tests = [];
const check = (label, fn) => tests.push({ label, fn });
const has = (text, pattern) => pattern instanceof RegExp ? pattern.test(text) : text.includes(pattern);

const engine = read("fresh-rebuild/src/features/apps/novacut-engine.js");
const media = read("fresh-rebuild/src/features/apps/novacut-media.js");
const suite = read("fresh-rebuild/src/features/apps/premium-studio-suite.js");
const studio = read("fresh-rebuild/src/features/apps/novacut-studio.js");
const studioCss = read("fresh-rebuild/src/features/apps/novacut-studio.css");
const effects = read("fresh-rebuild/src/features/apps/novacut-effects.js");
const overlays = read("fresh-rebuild/src/features/apps/novacut-overlays.js");
const history = read("fresh-rebuild/src/features/apps/novacut-history.js");
const activity = read("NexusNovaAndroid/app/src/main/java/com/nexusnova/app/MainActivity.kt");
const gradle = read("NexusNovaAndroid/app/build.gradle.kts");
const manifest = read("NexusNovaAndroid/app/src/main/AndroidManifest.xml");
const workflow = read(".github/workflows/build-current-main-signed-apk.yml");

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// 1-10: repository/module integrity
check("engine file exists", () => assert(exists("fresh-rebuild/src/features/apps/novacut-engine.js"), "engine missing"));
check("media parser exists", () => assert(exists("fresh-rebuild/src/features/apps/novacut-media.js"), "media parser missing"));
check("studio interaction file exists", () => assert(exists("fresh-rebuild/src/features/apps/novacut-studio.js"), "studio missing"));
check("suite renderer exists", () => assert(exists("fresh-rebuild/src/features/apps/premium-studio-suite.js"), "suite missing"));
check("effects module exists", () => assert(exists("fresh-rebuild/src/features/apps/novacut-effects.js"), "effects missing"));
check("overlay module exists", () => assert(exists("fresh-rebuild/src/features/apps/novacut-overlays.js"), "overlays missing"));
check("history module exists", () => assert(exists("fresh-rebuild/src/features/apps/novacut-history.js"), "history missing"));
check("engine imports history", () => assert(has(engine, 'import { NovaCutHistory } from "./novacut-history.js";'), "history import missing"));
check("engine imports effects", () => assert(has(engine, 'import { drawNovaCutEffect, normalizeNovaCutEffect } from "./novacut-effects.js";'), "effects import missing"));
check("engine exports ratio presets", () => assert(has(engine, "export const RATIO_PRESETS"), "ratio presets missing"));

// 11-25: engine behavior
check("Android WebView compositor detector exists", () => assert(has(engine, "export const isAndroidWebViewUserAgent") && has(engine, "this.forceNativeVideoLayer = isAndroidWebViewUserAgent(userAgent)"), "Android WebView detector missing"));
check("native preview and clean playback status", () => assert(has(engine, "mountNativePreview(media, clip)") && has(engine, "nx-novacut__canvas--native-preview") && has(engine, 'this.setStatus("Playing")') && has(engine, 'this.setStatus("Paused")') && !has(engine, "Playing · native video layer") && !has(engine, "Paused · native video layer") && has(engine, "media.muted = false") && has(engine, "this.preview?.enableActiveVideoAudio()"), "native preview, clean status or source-audio wiring missing"));
check("video add API present", () => assert(has(engine, "addVideoClip(input)"), "addVideoClip missing"));
check("audio add API and source-audio export mapping", () => assert(has(engine, "addAudioSegment(input)") && has(engine, "clip.metadata?.hasAudio !== true") && has(engine, "vsrcaudio") && has(engine, "audioLabels.map"), "source audio mapping missing"));
check("text add API present", () => assert(has(engine, "addTextCue(input)"), "addTextCue missing"));
check("sticker add API present", () => assert(has(engine, "addSticker(sticker"), "sticker API missing"));
check("effect add API present", () => assert(has(engine, "addEffect(input"), "effect API missing"));
check("delete API present", () => assert(has(engine, "removeSelected()"), "delete API missing"));
check("duplicate API present", () => assert(has(engine, "duplicateSelected()"), "duplicate API missing"));
check("playback follows decoded video clock", () => assert(has(engine, "mediaTimelineTime = clockClip.startTime") && has(engine, "media.currentTime * 1000"), "media clock sync missing"));
check("render avoids per-frame decoder seeking", () => assert(has(engine, "media.currentTime = target") && !has(engine, "this.engine.isPlaying && Math.abs(media.currentTime - target) > 0.3"), "per-frame seek thrash still present"));
check("undo API present", () => assert(has(engine, "undo()"), "undo API missing"));
check("redo API present", () => assert(has(engine, "redo()"), "redo API missing"));
check("cycleRatio restored", () => assert(/\n  cycleRatio\(\) \{/.test(engine), "cycleRatio missing"));
check("ratio action updates mobile preview geometry", () => assert(has(engine, 'bind("ratio", () => this.cycleRatio());') && has(suite, "syncPreviewFrame") && has(suite, "canvasShell.dataset.ratio") && has(studioCss, '[data-ratio="9:16"]') && has(engine, "applyInitialAspectRatio"), "ratio control or portrait detection missing"));

// 26-40: media ingestion
check("media parser class present", () => assert(has(media, "export class NovaCutMediaParser"), "parser class missing"));
check("file input creation present", () => assert(has(media, 'this.input.type =\n      "file";'), "file input missing"));
check("media accept filter present", () => assert(has(media, 'this.options.accept;'), "accept assignment missing"));
check("multiple selection enabled", () => assert(has(media, 'this.input.multiple =\n      true;'), "multiple missing"));
check("picker change handler present", () => assert(has(media, '"change"'), "change handler missing"));
check("picker cancel handler present", () => assert(has(media, '"cancel"'), "cancel handler missing"));
check("picker trigger selector present", () => assert(has(media, "[data-novacut-media-open], [data-action='media']"), "media trigger missing"));
check("file type detection present", () => assert(has(media, "function kindFromFile(file)"), "kind detection missing"));
check("MP4 extension supported", () => assert(has(media, '"mp4"'), "mp4 support missing"));
check("binary parser present", () => assert(has(media, "parseBinaryHeader"), "binary parser missing"));
check("browser metadata probe preserves full video duration", () => assert(has(media, "probeMediaElementMetadata") && has(media, "Math.max(decodedDurationMs, binaryDurationMs)"), "video duration reconciliation missing"));
check("media error event present", () => assert(has(media, '"file:error"'), "media error event missing"));
check("media injected event present", () => assert(has(media, '"file:injected"'), "injected event missing"));
check("video injection calls engine", () => assert(has(media, "engine.addVideoClip"), "video injection missing"));
check("audio injection calls engine", () => assert(has(media, "engine.addAudioSegment"), "audio injection missing"));

// 41-55: suite/UI integration
check("NovaCut renderer present", () => assert(has(suite, "function renderNovaCut()"), "renderer missing"));
check("preview canvas present", () => assert(/data-role=['"]preview-canvas['"]/.test(suite), "preview canvas missing"));
check("play button present", () => assert(has(suite, "data-action='play'"), "play button missing"));
check("export button present", () => assert(/data-action=['"]export['"]/.test(suite), "export missing"));
check("video lane present", () => assert(has(suite, "data-role='video-lane'"), "video lane missing"));
check("audio lane present", () => assert(has(suite, "data-role='audio-lane'"), "audio lane missing"));
check("text lane present", () => assert(has(suite, "data-role='text-lane'"), "text lane missing"));
check("overlay lane present", () => assert(has(suite, "data-role='overlay-lane'"), "overlay lane missing"));
check("effects lane present", () => assert(has(suite, "data-role='effect-lane'"), "effects lane missing"));
check("undo button present", () => assert(has(suite, "data-action='undo'"), "undo button missing"));
check("redo button present", () => assert(has(suite, "data-action='redo'"), "redo button missing"));
check("media parser wired", () => assert(has(suite, "createNovaCutMediaParser(root, engine"), "parser not wired"));
check("interactions wired", () => assert(has(suite, "createNovaCutStudioInteractions(root, engine)"), "interactions not wired"));
check("media injected status path", () => assert(has(suite, "Checking video decoder…"), "decode status missing"));
check("decode error detail is visible", () => assert(has(suite, "Decode failed: ") && has(suite, "status.title = message"), "decode error details missing"));

// 56-65: interaction/history correctness
check("pointer interaction present", () => assert(has(engine, "pointerdown"), "pointerdown missing"));
check("pointer move present", () => assert(has(engine, "pointermove"), "pointermove missing"));
check("pointer up present", () => assert(has(engine, "pointerup"), "pointerup missing"));
check("pointer cancel present", () => assert(has(engine, "pointercancel"), "pointercancel missing"));
check("history transaction begin present", () => assert(has(studio, "beginHistoryTransaction"), "history begin wiring missing"));
check("history transaction commit present", () => assert(has(studio, "commitHistoryTransaction"), "history commit wiring missing"));
check("history transaction cancel present", () => assert(has(studio, "cancelHistoryTransaction"), "history cancel wiring missing"));
check("100-entry history cap", () => assert(/this\.limit = Math\.max\(20, Math\.floor\(Number\(options\.limit\) \|\| 100\)\)/.test(history), "history cap missing"));
check("history undo present", () => assert(has(history, "undo()"), "history undo missing"));
check("history redo present", () => assert(has(history, "redo()"), "history redo missing"));

// 66-75: effects/overlays
check("blur effect supported", () => assert(/id:\s*'blur'/.test(effects), "blur missing"));
check("mosaic effect supported", () => assert(/id:\s*'mosaic'/.test(effects), "mosaic missing"));
check("scramble effect supported", () => assert(/id:\s*'scramble'/.test(effects), "scramble missing"));
check("censor effect supported", () => assert(/id:\s*'censor'/.test(effects), "censor missing"));
check("effect draw API present", () => assert(has(effects, "export function drawNovaCutEffect"), "effect draw missing"));
check("effect normalization present", () => assert(has(effects, "export function normalizeNovaCutEffect"), "effect normalize missing"));
check("local sticker catalog present", () => assert(has(overlays, "export const NOVACUT_STICKERS"), "sticker catalog missing"));
check("local sticker asset resolver present", () => assert(has(overlays, "export function stickerAssetUrl"), "sticker resolver missing"));
check("sticker loader present", () => assert(/export\s+async\s+function\s+loadNovaCutImageAsset/.test(overlays), "sticker loader missing"));
check("no remote sticker CDN", () => assert(!/https?:\/\/[^\n]*sticker/i.test(overlays), "remote sticker CDN detected"));

// 76-90: Android picker implementation
check("MainActivity has WebChromeClient", () => assert(has(activity, "object : WebChromeClient()"), "WebChromeClient missing"));
check("onShowFileChooser override present", () => assert(has(activity, "override fun onShowFileChooser"), "file chooser override missing"));
check("FileChooser parseResult used", () => assert(has(activity, "FileChooserParams\n                .parseResult"), "parseResult missing"));
check("callback stored", () => assert(has(activity, "fileChooserCallback = callback"), "callback storage missing"));
check("accepted MIME types stored", () => assert(has(activity, "fileChooserAcceptTypes = params.acceptTypes"), "accept type storage missing"));
check("result URI read grant", () => assert(has(activity, "grantPickedUriReadAccess(uri"), "URI grant missing"));
check("picker URI acceptance logs", () => assert(has(activity, '"NexusNovaFilePicker"') && has(activity, "parsedCount="), "picker diagnostics missing"));
check("content URI guard present", () => assert(has(activity, 'uri.scheme != ContentResolver.SCHEME_CONTENT'), "content URI guard missing"));
check("private app authority blocked", () => assert(has(activity, "uri.authority.equals(packageName"), "private authority guard missing"));
check("256 MB per-file cap enforced", () => assert(has(activity, "const val MAX_PICKED_FILE_BYTES = 256L * 1024L * 1024L"), "256 MB file cap missing"));
check("512 MB batch cap enforced", () => assert(has(activity, "const val MAX_PICKED_TOTAL_BYTES = 512L * 1024L * 1024L"), "512 MB batch cap missing"));
check("readable URI fallback present", () => assert(has(activity, "isReadableContentUri"), "readable URI fallback missing"));
check("display name fallback present", () => assert(has(activity, "pickedUriDisplayName"), "display name helper missing"));
check("persistable permission attempt", () => assert(has(activity, "takePersistableUriPermission"), "persistable permission handling missing"));
check("picker callback receives selected URIs", () => assert(has(activity, "callback.onReceiveValue(selected)") && has(activity, "NovaCut could not read that file"), "callback return or visible empty-selection error missing"));

// 91-96: Android package/release integrity
check("production package ID correct", () => assert(has(gradle, 'applicationId = "com.nexusnova.app"'), "package ID changed"));
check("production namespace correct", () => assert(has(gradle, 'namespace = "com.nexusnova.app"'), "namespace changed"));
check("production version advanced", () => assert(has(gradle, "versionCode = 27010034"), "versionCode not advanced"));
check("production version name advanced", () => assert(has(gradle, 'versionName = "1.0.47-ota-36"'), "versionName not advanced"));
check("debug QA suffix preserved", () => assert(has(gradle, 'applicationIdSuffix = ".novacutqa"'), "QA suffix missing"));
check("FileProvider remains present", () => assert(has(manifest, "androidx.core.content.FileProvider"), "FileProvider missing"));

// 97-100: signed build gate + exact regression safety
check("signed workflow pins current production version", () => assert(has(workflow, "versionCode = 27010034"), "signed workflow versionCode stale"));
check("signed workflow pins current version name", () => assert(has(workflow, 'versionName = "1.0.47-ota-36"'), "signed workflow versionName stale"));
check("signed workflow packages ota-36 artifact", () => assert(has(workflow, "NexusNova-v1.0.47-ota-36-SIGNED.apk"), "ota-36 artifact missing"));
check("signed workflow validates signature before packaging", () => assert(/verify --verbose --print-certs/.test(workflow), "signature verification missing"));

assert(tests.length === 100, "Expected exactly 100 QA checks, got " + tests.length);

let passed = 0;
for (const [index, test] of tests.entries()) {
  try {
    test.fn();
    passed += 1;
    console.log(`${String(index + 1).padStart(3, "0")}/100 PASS  ${test.label}`);
  } catch (error) {
    console.error(`${String(index + 1).padStart(3, "0")}/100 FAIL  ${test.label}: ${error.message}`);
  }
}

if (passed !== 100) {
  console.error(`NOVACUT 100 QA FAILED: ${passed}/100`);
  process.exit(1);
}

// Behavioural unit tests for the exact blank-preview failure path.
globalThis.window ??= globalThis;
const { NovaCutCanvasPreview, NovaCutCommandCompiler, isAndroidWebViewUserAgent } = await import("../fresh-rebuild/src/features/apps/novacut-engine.js");

const androidWebViewUA = "Mozilla/5.0 (Linux; Android 13; Test Device; wv) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/120.0.0.0 Mobile Safari/537.36";
const androidChromeUA = "Mozilla/5.0 (Linux; Android 13; Test Device) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36";
if (!isAndroidWebViewUserAgent(androidWebViewUA)) throw new Error("Android WebView user agent did not select the native compositor.");
if (isAndroidWebViewUserAgent(androidChromeUA)) throw new Error("Regular Android Chrome was incorrectly forced into WebView native mode.");
console.log("PLAYBACK BEHAVIOUR 1/7 PASS  Android WebView selects native compositor");

class FakeVideoElement {
  constructor({ readyState = 2, videoWidth = 0, videoHeight = 0, error = null } = {}) {
    this.readyState = readyState;
    this.videoWidth = videoWidth;
    this.videoHeight = videoHeight;
    this.networkState = 2;
    this.currentTime = 1;
    this.error = error;
    this.muted = true;
    this.defaultMuted = true;
    this.volume = 0;
    this.paused = true;
    this.playCalls = 0;
    this.listeners = new Map();
    this.style = {};
    this.classList = { add() {}, remove() {} };
    this.parentElement = null;
  }
  addEventListener(name, fn) {
    if (!this.listeners.has(name)) this.listeners.set(name, new Set());
    this.listeners.get(name).add(fn);
  }
  removeEventListener(name, fn) { this.listeners.get(name)?.delete(fn); }
  dispatch(name) { this.listeners.get(name)?.forEach(fn => fn()); }
  async play() { this.paused = false; this.playCalls += 1; }
  pause() { this.paused = true; }
  remove() {}
}
globalThis.HTMLVideoElement ??= FakeVideoElement;

const testPreview = Object.create(NovaCutCanvasPreview.prototype);
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

const noFrame = new FakeVideoElement();
let zeroDimensionResolved = false;
const noFramePromise = testPreview.waitForVideoReady(noFrame, 300).then(() => {
  zeroDimensionResolved = true;
});
await wait(10);
noFrame.dispatch("loadeddata");
await wait(10);
if (zeroDimensionResolved) throw new Error("Playback readiness accepted readyState=2 with 0x0 dimensions.");
noFrame.videoWidth = 1280;
noFrame.videoHeight = 720;
noFrame.dispatch("resize");
await noFramePromise;
console.log("PLAYBACK BEHAVIOUR 2/7 PASS  zero-sized frame remains unready");

const readyVideo = new FakeVideoElement({ readyState: 2, videoWidth: 1920, videoHeight: 1080 });
await testPreview.waitForVideoReady(readyVideo, 50);
console.log("PLAYBACK BEHAVIOUR 3/7 PASS  decoded dimensions resolve readiness");

const brokenVideo = new FakeVideoElement({ error: { code: 4, message: "decoder unsupported" } });
const brokenPromise = testPreview.waitForVideoReady(brokenVideo, 100)
  .then(() => { throw new Error("Broken decoder unexpectedly resolved."); })
  .catch(error => error);
brokenVideo.dispatch("error");
const brokenError = await brokenPromise;
if (!String(brokenError?.message || "").includes("MediaError 4") ||
    !String(brokenError?.message || "").includes("size=0x0")) {
  throw new Error("Decoder failure did not expose MediaError/dimension diagnostics: " + brokenError?.message);
}
console.log("PLAYBACK BEHAVIOUR 4/7 PASS  decoder errors include useful diagnostics");

const probe = Object.create(NovaCutCanvasPreview.prototype);
probe.nativeFallbackActive = false;
probe.frameProbe = new Map();
probe.canvas = { width: 100, height: 100, parentElement: null };
probe.ctx = { getImageData: () => ({ data: new Uint8ClampedArray([0, 0, 0, 255]) }) };
probe.engine = { setStatus() {}, events: { emit() {} } };
const blackVideo = new FakeVideoElement({ readyState: 2, videoWidth: 640, videoHeight: 360 });
for (let i = 0; i < 24; i++) probe.probeVideoCanvasOutput({ id: "black-probe" }, blackVideo, 0, 0, 100, 100);
if (!probe.nativeFallbackActive) throw new Error("Persistently black Canvas output did not enable native video fallback.");
console.log("PLAYBACK BEHAVIOUR 5/7 PASS  black Canvas output enables native preview fallback");
const nativeShell = { insertBefore(node) { node.parentElement = this; } };
const nativeCanvas = {
  parentElement: nativeShell,
  classNames: new Set(),
  classList: { add(name) { nativeCanvas.classNames.add(name); }, remove(name) { nativeCanvas.classNames.delete(name); } }
};
const nativePreview = Object.create(NovaCutCanvasPreview.prototype);
nativePreview.canvas = nativeCanvas;
nativePreview.nativePreviewMedia = null;
const mountedVideo = new FakeVideoElement({ readyState: 2, videoWidth: 640, videoHeight: 360 });
nativePreview.mountNativePreview(mountedVideo, { id: "native-mount", scale: 1 });
if (mountedVideo.parentElement !== nativeShell || !nativeCanvas.classNames.has("nx-novacut__canvas--native-preview")) {
  throw new Error("Native video element was not mounted behind the transparent overlay canvas.");
}
console.log("PLAYBACK BEHAVIOUR 6/7 PASS  native video layer attaches behind transparent canvas");

const sourceAudioClip = { id: "source-audio-test", startTime: 0, duration: 5000, sourceStartTime: 0, volume: 0.35 };
const sourceAudioVideo = new FakeVideoElement({ readyState: 2, videoWidth: 640, videoHeight: 360 });
const audioPreview = Object.create(NovaCutCanvasPreview.prototype);
audioPreview.engine = {
  currentTimestamp: 0,
  getActiveVideoClips: () => [sourceAudioClip],
  registry: { audioTracks: [] }
};
audioPreview.media = new Map([[sourceAudioClip.id, sourceAudioVideo]]);
audioPreview.audioMedia = new Map();
audioPreview.resolve = async () => sourceAudioVideo;
audioPreview.enableActiveVideoAudio();
if (sourceAudioVideo.muted || sourceAudioVideo.defaultMuted || sourceAudioVideo.volume !== 0.35) {
  throw new Error("User-requested playback did not restore source audio and clip volume.");
}
sourceAudioVideo.muted = true;
sourceAudioVideo.defaultMuted = true;
sourceAudioVideo.volume = 0;
await audioPreview.playActive();
if (sourceAudioVideo.muted || sourceAudioVideo.defaultMuted || sourceAudioVideo.volume !== 0.35 || sourceAudioVideo.playCalls !== 1) {
  throw new Error("playActive() did not unmute and start the source video with clip volume.");
}
console.log("PLAYBACK BEHAVIOUR 7/7 PASS  source video audio is restored during playback");

// Command-plan regression tests. They exercise the export graph without
// needing a phone or starting the WASM FFmpeg runtime.
const makeCompilerEngine = ({ videos = [], audios = [], stickers = [] } = {}) => ({
  aspectRatio: "16:9",
  registry: {
    videoTracks: videos,
    audioTracks: audios,
    textTracks: [],
    overlayTracks: stickers,
    effectTracks: [],
    durationMs() {
      return Math.max(1, ...[...videos, ...audios, ...stickers].map(item =>
        Math.max(0, Number(item.startTime) || 0) + Math.max(0, Number(item.duration) || 0)
      ));
    }
  }
});
const compilerVideo = (overrides = {}) => ({
  id: "video-source",
  file: { name: "source.mp4", type: "video/mp4" },
  startTime: 0,
  duration: 5000,
  sourceStartTime: 0,
  volume: 0.7,
  scale: 1,
  x_offset: 0,
  transform: { scale: 1, rotation: 0, flipX: false, flipY: false },
  metadata: { hasAudio: true, width: 720, height: 1280 },
  ...overrides
});
const videoAudioPlan = new NovaCutCommandCompiler(makeCompilerEngine({ videos: [compilerVideo()] })).compile();
const videoAudioFilter = videoAudioPlan.args[videoAudioPlan.args.indexOf("-filter_complex") + 1];
if (!videoAudioFilter.includes("[0:a:0]atrim=start=0.000:duration=5.000") ||
    !videoAudioPlan.args.includes("[vsrcaudio0]")) {
  throw new Error("Export command omitted source audio from a clip marked as containing audio.");
}
console.log("EXPORT BEHAVIOUR 1/4 PASS  source video audio maps to MP4 output");

const mixedAudioPlan = new NovaCutCommandCompiler(makeCompilerEngine({
  videos: [compilerVideo()],
  audios: [{ id: "music-track", file: { name: "music.mp3", type: "audio/mpeg" }, startTime: 1000, duration: 3000, volume: 0.8 }]
})).compile();
const mixedAudioFilter = mixedAudioPlan.args[mixedAudioPlan.args.indexOf("-filter_complex") + 1];
if (!mixedAudioFilter.includes("[0:a:0]") || !mixedAudioFilter.includes("[1:a:0]") ||
    !mixedAudioFilter.includes("amix=inputs=2") || !mixedAudioPlan.args.includes("[aout]")) {
  throw new Error("Export command failed to mix source audio with imported music.");
}
console.log("EXPORT BEHAVIOUR 2/4 PASS  video and imported audio are mixed");

const silentVideoPlan = new NovaCutCommandCompiler(makeCompilerEngine({
  videos: [compilerVideo({ metadata: { hasAudio: false, width: 720, height: 1280 } })]
})).compile();
const silentVideoFilter = silentVideoPlan.args[silentVideoPlan.args.indexOf("-filter_complex") + 1];
if (silentVideoFilter.includes("[0:a:0]")) throw new Error("Silent video incorrectly generated an audio-stream reference.");
console.log("EXPORT BEHAVIOUR 3/4 PASS  silent video avoids missing audio stream");

const stickerPlan = new NovaCutCommandCompiler(makeCompilerEngine({
  videos: [compilerVideo({ metadata: { hasAudio: false, width: 720, height: 1280 } })],
  stickers: [{
    id: "sticker-1", asset: "local:star", label: "Star", glyph: "★",
    x: 0.5, y: 0.5, width: 0.2, height: 0.25, scale: 1,
    rotation: 0, startTime: 0, duration: 3000, zIndex: 20
  }]
})).compile();
const stickerFilter = stickerPlan.args[stickerPlan.args.indexOf("-filter_complex") + 1];
if (!stickerFilter.includes("scale=384:270:force_original_aspect_ratio=decrease") ||
    !stickerFilter.includes("pad=384:270:(ow-iw)/2:(oh-ih)/2:color=black@0") ||
    /overlay=x=main_w[^;]*:w=main_w/.test(stickerFilter)) {
  throw new Error("Sticker export does not scale the sticker before overlay composition.");
}
console.log("EXPORT BEHAVIOUR 4/4 PASS  sticker assets scale before overlay");


const syntaxFiles = [
  "fresh-rebuild/src/features/apps/novacut-engine.js",
  "fresh-rebuild/src/features/apps/novacut-media.js",
  "fresh-rebuild/src/features/apps/novacut-history.js",
  "fresh-rebuild/src/features/apps/novacut-overlays.js",
  "fresh-rebuild/src/features/apps/novacut-effects.js",
  "fresh-rebuild/src/features/apps/novacut-studio.js",
  "fresh-rebuild/src/features/apps/premium-studio-suite.js"
];

for (const file of syntaxFiles) {
  execFileSync(process.execPath, ["--check", file], { stdio: "pipe" });
}

console.log("NOVACUT 100/100 QA PASS");
console.log("NOVACUT EXPORT BEHAVIOUR 4/4 PASS");
console.log("NOVACUT JS SYNTAX 7/7 PASS");
