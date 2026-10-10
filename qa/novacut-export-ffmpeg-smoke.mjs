import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { NovaCutCommandCompiler } from "../fresh-rebuild/src/features/apps/novacut-engine.js";

const temp = fs.mkdtempSync(path.join(os.tmpdir(), "novacut-export-smoke-"));
const sourceVideo = path.join(temp, "source-with-audio.mp4");
const silentVideo = path.join(temp, "source-silent.mp4");
const musicFile = path.join(temp, "music.mp3");
const stickerFile = path.join(temp, "sticker.png");

function run(binary, args) {
  try {
    return execFileSync(binary, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch (error) {
    const stderr = String(error.stderr || "").trim();
    const stdout = String(error.stdout || "").trim();
    console.error(stderr || stdout || String(error));
    throw new Error(binary + " failed with exit code " + error.status + ".");
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function probeStreams(file) {
  const output = run("ffprobe", [
    "-v", "error",
    "-show_entries", "stream=codec_type,width,height",
    "-of", "json",
    file
  ]);
  return JSON.parse(output).streams || [];
}

function probeDuration(file) {
  const output = run("ffprobe", [
    "-v", "error",
    "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1",
    file
  ]);
  return Number(output.trim());
}

function makeEngine({ videoName, hasAudio, audios = [], stickers = [], clipOptions = {} }) {
  const video = {
    id: "source-video",
    file: { name: videoName, type: "video/mp4" },
    startTime: 0,
    duration: 2000,
    sourceStartTime: 0,
    volume: 0.7,
    x_offset: 0,
    scale: 1,
    transform: { scale: 1, rotation: 0, flipX: false, flipY: false },
    brightness: 100,
    contrast: 100,
    saturation: 100,
    fadeInMs: 0,
    fadeOutMs: 0,
    keyframes: [],
    metadata: { hasAudio, width: 90, height: 160 },
    ...clipOptions
  };
  const tracks = [video, ...audios, ...stickers];
  return {
    aspectRatio: "9:16",
    registry: {
      videoTracks: [video],
      audioTracks: audios,
      textTracks: [],
      overlayTracks: stickers,
      effectTracks: [],
      durationMs: () => Math.max(1, ...tracks.map((item) =>
        Math.max(0, Number(item.startTime) || 0) + Math.max(0, Number(item.duration) || 0)
      ))
    }
  };
}

function planAndRun({ name, hasAudio, audios = [], stickers = [], clipOptions = {} }) {
  const engine = makeEngine({ videoName: hasAudio ? "source-with-audio.mp4" : "source-silent.mp4", hasAudio, audios, stickers, clipOptions });
  const output = path.join(temp, name);
  const compiled = new NovaCutCommandCompiler(engine).compile({
    ratio: "9:16",
    width: 180,
    height: 320,
    fps: 15,
    preset: "ultrafast",
    crf: 32,
    audioBitrate: "96k",
    outputFileName: name
  });

  assert(compiled.width === 180 && compiled.height === 320, "Compiler did not honor the portrait output size.");
  const inputFiles = compiled.inputs.map((input) => {
    if (input.kind === "video") return hasAudio ? sourceVideo : silentVideo;
    if (input.kind === "audio") return musicFile;
    if (input.stickerAsset) return stickerFile;
    throw new Error("Unexpected smoke-test input kind: " + input.kind);
  });
  const args = compiled.args.map((arg) => {
    const input = compiled.inputs.find((item) => item.path === arg);
    if (input) return inputFiles[input.index];
    if (arg === compiled.outputPath) return output;
    return arg;
  });

  const videoFilters = args[args.indexOf("-filter_complex") + 1];
  assert(videoFilters.includes("scale=180:320:force_original_aspect_ratio=decrease"), "Export graph does not fit source media to the selected portrait canvas.");
  assert(
    videoFilters.includes("overlay=x=(W-w)/2+0:y=(H-h)/2") ||
      videoFilters.includes("overlay=x='(W-w)/2+("),
    "Export graph does not center the fitted source video or express its animated offset."
  );
  run("ffmpeg", args);
  assert(fs.existsSync(output) && fs.statSync(output).size > 0, "FFmpeg returned without a usable exported file.");
  const streams = probeStreams(output);
  assert(streams.some((stream) => stream.codec_type === "video" && stream.width === 180 && stream.height === 320), "Exported portrait MP4 has the wrong video dimensions.");
  const duration = probeDuration(output);
  assert(duration >= 1.8 && duration <= 2.2, "Exported MP4 duration drifted from the two-second source: " + duration);
  return { output, streams, duration, filters: videoFilters };
}

try {
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=blue:s=90x160:r=15:d=2",
    "-f", "lavfi", "-i", "sine=frequency=440:sample_rate=44100:duration=2",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-c:a", "aac", "-shortest", sourceVideo
  ]);
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=green:s=90x160:r=15:d=2",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p",
    "-an", silentVideo
  ]);
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "sine=frequency=660:sample_rate=44100:duration=1.2",
    "-c:a", "libmp3lame", "-q:a", "5", musicFile
  ]);
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=red:s=64x64:d=1",
    "-frames:v", "1", "-vf", "format=rgba", stickerFile
  ]);

  const sourcePlan = planAndRun({ name: "source-audio-export.mp4", hasAudio: true });
  assert(sourcePlan.streams.some((stream) => stream.codec_type === "audio"), "Source-video export lost its original audio stream.");
  console.log("FFMPEG EXPORT 1/3 PASS  source audio is present and duration is preserved");

  const mixedPlan = planAndRun({
    name: "mixed-audio-sticker-export.mp4",
    hasAudio: true,
    clipOptions: {
      brightness: 115, contrast: 125, saturation: 135, fadeInMs: 250, fadeOutMs: 500,
      keyframes: [
        { timeMs: 0, scale: 1, rotation: 0, x_offset: 0, y_offset: 0 },
        { timeMs: 2000, scale: 1.5, rotation: 30, x_offset: 18, y_offset: -12 }
      ]
    },
    audios: [{
      id: "music-track",
      file: { name: "music.mp3", type: "audio/mpeg" },
      startTime: 250,
      duration: 1200,
      volume: 0.3
    }],
    stickers: [{
      id: "sticker-1", asset: "smoke-test", label: "Smoke sticker", glyph: "★",
      x: 0.5, y: 0.5, width: 0.25, height: 0.25, scale: 1,
      rotation: 0, startTime: 250, duration: 1000, zIndex: 20
    }]
  });
  assert(mixedPlan.streams.some((stream) => stream.codec_type === "audio"), "Mixed export has no audio stream.");
  assert(mixedPlan.filters.includes("scale=44:80:force_original_aspect_ratio=decrease"), "Sticker was not resized before overlay composition.");
  assert(mixedPlan.filters.includes("lutrgb=r='min(255,val*1.150)':g='min(255,val*1.150)':b='min(255,val*1.150)'"), "Brightness adjustment filter is missing from export.");
  assert(mixedPlan.filters.includes("eq=contrast=1.250:saturation=1.350"), "Contrast/saturation filters are missing from export.");
  assert(mixedPlan.filters.includes("fade=t=in:st=0.000:d=0.250:alpha=1"), "Fade-in alpha transition is missing from export.");
  assert(mixedPlan.filters.includes("fade=t=out:st=1.500:d=0.500:alpha=1"), "Fade-out alpha transition is missing from export.");
  assert(mixedPlan.filters.includes("eval=frame") && mixedPlan.filters.includes("rotate=angle='(") &&
    mixedPlan.filters.includes("overlay=x='(W-w)/2+("),
    "Animated scale, rotation, or position expressions are missing from FFmpeg export.");
  console.log("FFMPEG EXPORT 2/3 PASS  original audio, music and sticker filters render");

  const silentPlan = planAndRun({ name: "silent-video-export.mp4", hasAudio: false });
  assert(!silentPlan.streams.some((stream) => stream.codec_type === "audio"), "Silent video generated an invalid audio stream.");
  console.log("FFMPEG EXPORT 3/3 PASS  silent source exports without phantom audio");

  console.log("NOVACUT FFmpeg export smoke 3/3 PASS");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
