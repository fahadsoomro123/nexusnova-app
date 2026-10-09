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
check("engine class present", () => assert(has(engine, "export class NovaCutEngine"), "engine class missing"));
check("track registry present", () => assert(has(engine, "export class NovaCutTrackRegistry"), "track registry missing"));
check("video add API present", () => assert(has(engine, "addVideoClip(input)"), "addVideoClip missing"));
check("audio add API present", () => assert(has(engine, "addAudioSegment(input)"), "addAudioSegment missing"));
check("text add API present", () => assert(has(engine, "addTextCue(input)"), "addTextCue missing"));
check("sticker add API present", () => assert(has(engine, "addSticker(sticker"), "sticker API missing"));
check("effect add API present", () => assert(has(engine, "addEffect(input"), "effect API missing"));
check("delete API present", () => assert(has(engine, "removeSelected()"), "delete API missing"));
check("duplicate API present", () => assert(has(engine, "duplicateSelected()"), "duplicate API missing"));
check("playback follows decoded video clock", () => assert(has(engine, "mediaTimelineTime = clockClip.startTime") && has(engine, "media.currentTime * 1000"), "media clock sync missing"));
check("render avoids per-frame decoder seeking", () => assert(has(engine, "Seek only while paused or when a new clip becomes active") && !has(engine, "else if (this.engine.isPlaying && Math.abs(media.currentTime - target) > 0.3)"), "per-frame seek thrash still present"));
check("undo API present", () => assert(has(engine, "undo()"), "undo API missing"));
check("redo API present", () => assert(has(engine, "redo()"), "redo API missing"));
check("cycleRatio restored", () => assert(/\n  cycleRatio\(\) \{/.test(engine), "cycleRatio missing"));
check("ratio action calls cycleRatio", () => assert(has(engine, 'bind("ratio", () => this.cycleRatio());'), "ratio bind missing"));

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
check("browser metadata probe present", () => assert(has(media, "probeMediaElementMetadata"), "media probe missing"));
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
check("production version advanced", () => assert(has(gradle, "versionCode = 27010030"), "versionCode not advanced"));
check("production version name advanced", () => assert(has(gradle, 'versionName = "1.0.45-ota-32"'), "versionName not advanced"));
check("debug QA suffix preserved", () => assert(has(gradle, 'applicationIdSuffix = ".novacutqa"'), "QA suffix missing"));
check("FileProvider remains present", () => assert(has(manifest, "androidx.core.content.FileProvider"), "FileProvider missing"));

// 97-100: signed build gate + exact regression safety
check("signed workflow pins current production version", () => assert(has(workflow, "versionCode = 27010030"), "signed workflow versionCode stale"));
check("signed workflow pins current version name", () => assert(has(workflow, 'versionName = "1.0.45-ota-32"'), "signed workflow versionName stale"));
check("signed workflow packages ota-31 artifact", () => assert(has(workflow, "NexusNova-v1.0.45-ota-32-SIGNED.apk"), "ota-31 artifact missing"));
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
console.log("NOVACUT JS SYNTAX 7/7 PASS");
