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
const transitionRedVideo = path.join(temp, "transition-left-red.mp4");
const transitionBlueVideo = path.join(temp, "transition-right-blue.mp4");

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

function probeGrayLumaAt(file, timestamp) {
  const frame = path.join(temp, "luma-" + String(timestamp).replace(/\W/g, "_") + ".gray");
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", file, "-ss", String(timestamp),
    "-frames:v", "1", "-vf", "scale=1:1,format=gray",
    "-f", "rawvideo", frame
  ]);
  assert(fs.existsSync(frame) && fs.statSync(frame).size === 1, "Could not decode a single-pixel luma probe at " + timestamp + "s.");
  return fs.readFileSync(frame)[0];
}

function probeGrayLumaPixel(file, timestamp, x, y) {
  const frame = path.join(temp, "pixel-" + [timestamp, x, y].join("-").replace(/\W/g, "_") + ".gray");
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", file, "-ss", String(timestamp),
    "-frames:v", "1", "-vf", "crop=2:2:" + Math.max(0, Math.floor(x)) + ":" + Math.max(0, Math.floor(y)) + ",scale=1:1,format=gray",
    "-f", "rawvideo", frame
  ]);
  assert(fs.existsSync(frame) && fs.statSync(frame).size === 1, "Could not decode luma probe at " + x + "," + y + " and " + timestamp + "s.");
  return fs.readFileSync(frame)[0];
}

function probeRgbPixel(file, timestamp, x, y) {
  const frame = path.join(temp, "rgb-" + [timestamp, x, y].join("-").replace(/\W/g, "_") + ".rgb");
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-i", file, "-ss", String(timestamp),
    "-frames:v", "1",
    "-vf", "crop=2:2:" + Math.max(0, Math.floor(x)) + ":" + Math.max(0, Math.floor(y)) + ",scale=1:1,format=rgb24",
    "-f", "rawvideo", frame
  ]);
  assert(fs.existsSync(frame) && fs.statSync(frame).size === 3, "Could not decode RGB probe at " + x + "," + y + " and " + timestamp + "s.");
  return Array.from(fs.readFileSync(frame));
}

function makeEngine({ videoName, hasAudio, audios = [], stickers = [], effects = [], videoClips = null, clipOptions = {} }) {
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
  const videos = Array.isArray(videoClips) && videoClips.length ? videoClips : [video];
  const tracks = [...videos, ...audios, ...stickers, ...effects];
  return {
    aspectRatio: "9:16",
    registry: {
      videoTracks: videos,
      audioTracks: audios,
      textTracks: [],
      overlayTracks: stickers,
      effectTracks: effects,
      durationMs: () => Math.max(1, ...tracks.map((item) =>
        Math.max(0, Number(item.startTime) || 0) + Math.max(0, Number(item.duration) || 0)
      ))
    }
  };
}

function planAndRun({ name, hasAudio, audios = [], stickers = [], effects = [], videoClips = null, clipOptions = {}, expectedDurationMs = 2000 }) {
  const engine = makeEngine({ videoName: hasAudio ? "source-with-audio.mp4" : "source-silent.mp4", hasAudio, audios, stickers, effects, videoClips, clipOptions });
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
    if (input.kind === "video") {
      if (input.file?.name === "transition-left-red.mp4") return transitionRedVideo;
      if (input.file?.name === "transition-right-blue.mp4") return transitionBlueVideo;
      return hasAudio ? sourceVideo : silentVideo;
    }
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
  const expectedDuration = Math.max(0.001, Number(expectedDurationMs) / 1000);
  assert(duration >= expectedDuration - 0.2 && duration <= expectedDuration + 0.2,
    "Exported MP4 duration drifted from the expected " + expectedDuration + " second timeline: " + duration);
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
    "-f", "lavfi", "-i", "color=c=red:s=90x160:r=15:d=2",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-an", transitionRedVideo
  ]);
  run("ffmpeg", [
    "-hide_banner", "-loglevel", "error", "-y",
    "-f", "lavfi", "-i", "color=c=blue:s=90x160:r=15:d=2",
    "-c:v", "libx264", "-preset", "ultrafast", "-pix_fmt", "yuv420p", "-an", transitionBlueVideo
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

  const animatedOpacityPlan = planAndRun({
    name: "animated-opacity-export.mp4",
    hasAudio: true,
    clipOptions: {
      keyframes: [
        { timeMs: 0, scale: 1, rotation: 0, x_offset: 0, y_offset: 0, opacity: 1 },
        { timeMs: 2000, scale: 1, rotation: 0, x_offset: 0, y_offset: 0, opacity: 0.2 }
      ]
    }
  });
  assert(animatedOpacityPlan.filters.includes("geq=r='r(X,Y)':g='g(X,Y)':b='b(X,Y)':a='alpha(X,Y)*("),
    "Animated opacity was not compiled to a per-frame alpha filter.");
  const earlyOpacityLuma = probeGrayLumaAt(animatedOpacityPlan.output, 0.2);
  const lateOpacityLuma = probeGrayLumaAt(animatedOpacityPlan.output, 1.5);
  assert(earlyOpacityLuma > 0 && lateOpacityLuma >= 0 && lateOpacityLuma < earlyOpacityLuma * 0.72,
    "Rendered video pixels did not become measurably more transparent over time: " + earlyOpacityLuma + " -> " + lateOpacityLuma);
  console.log("ANIMATED OPACITY RENDER 1/1 PASS  FFmpeg output pixels follow the opacity keyframe curve");

  const vignettePlan = planAndRun({
    name: "vignette-effect-export.mp4",
    hasAudio: true,
    effects: [{
      id: "vignette-qa",
      type: "vignette",
      x: 0, y: 0, width: 1, height: 1,
      startTime: 0, duration: 2000, intensity: 48, opacity: 0.96, seed: 7
    }]
  });
  assert(vignettePlan.filters.includes("vignette=angle=") &&
    vignettePlan.filters.includes("overlay=x=main_w*0.00000:y=main_h*0.00000"),
    "Vignette region was not compiled into a timed FFmpeg effect layer.");
  const vignetteCenter = probeGrayLumaPixel(vignettePlan.output, 0.5, 90, 160);
  const vignetteCorner = probeGrayLumaPixel(vignettePlan.output, 0.5, 0, 0);
  assert(vignetteCenter > 0 && vignetteCorner < vignetteCenter * 0.85,
    "Rendered vignette did not darken the corners relative to the center: " + vignetteCorner + " vs " + vignetteCenter);
  console.log("VIGNETTE EFFECT RENDER 1/1 PASS  exported pixels show darker corners than center");

  const transitionPlan = planAndRun({
    name: "cross-dissolve-export.mp4",
    hasAudio: false,
    expectedDurationMs: 3500,
    videoClips: [
      {
        id: "transition-red",
        file: { name: "transition-left-red.mp4", type: "video/mp4" },
        startTime: 0, duration: 2000, sourceStartTime: 0, sourceDuration: 2000,
        volume: 0, x_offset: 0, y_offset: 0, scale: 1,
        transform: { scale: 1, rotation: 0, flipX: false, flipY: false },
        brightness: 100, contrast: 100, saturation: 100,
        fadeInMs: 0, fadeOutMs: 0, keyframes: [], metadata: { hasAudio: false, width: 90, height: 160 }
      },
      {
        id: "transition-blue",
        file: { name: "transition-right-blue.mp4", type: "video/mp4" },
        startTime: 1500, duration: 2000, sourceStartTime: 0, sourceDuration: 2000,
        volume: 0, x_offset: 0, y_offset: 0, scale: 1,
        transform: { scale: 1, rotation: 0, flipX: false, flipY: false },
        brightness: 100, contrast: 100, saturation: 100,
        fadeInMs: 500, fadeOutMs: 0, keyframes: [], metadata: { hasAudio: false, width: 90, height: 160 },
        transitionIn: { type: "cross-dissolve", durationMs: 500, originalStartTime: 2000, rippledItems: [] }
      }
    ]
  });
  assert(transitionPlan.filters.includes("fade=t=in:st=1.500:d=0.500:alpha=1") &&
    transitionPlan.filters.includes("overlay=x=(W-w)/2+0:y=(H-h)/2"),
    "Cross-dissolve did not compile the timed alpha layer at the incoming clip's overlap point.");
  const beforeTransitionRgb = probeRgbPixel(transitionPlan.output, 1.0, 89, 159);
  const midwayTransitionRgb = probeRgbPixel(transitionPlan.output, 1.75, 89, 159);
  const afterTransitionRgb = probeRgbPixel(transitionPlan.output, 2.8, 89, 159);
  assert(beforeTransitionRgb[0] > 150 && beforeTransitionRgb[2] < 70,
    "Frame before the cut is not predominantly red: " + beforeTransitionRgb.join(","));
  assert(midwayTransitionRgb[0] > 55 && midwayTransitionRgb[2] > 55 &&
    Math.abs(midwayTransitionRgb[0] - midwayTransitionRgb[2]) < 90 &&
    midwayTransitionRgb[1] < 70,
    "Cross-dissolve midpoint did not contain a measurable red/blue pixel blend: " + midwayTransitionRgb.join(","));
  assert(afterTransitionRgb[2] > 140 && afterTransitionRgb[0] < 90,
    "Frame after the transition is not predominantly blue: " + afterTransitionRgb.join(","));
  console.log("CROSS-DISSOLVE RENDER 1/1 PASS  real MP4 frames blend red to blue through the transition");

  const mixedPlan = planAndRun({
    name: "mixed-audio-sticker-export.mp4",
    hasAudio: true,
    clipOptions: {
      brightness: 115, contrast: 125, saturation: 135, fadeInMs: 250, fadeOutMs: 500,
      keyframes: [
        { timeMs: 0, scale: 1, rotation: 0, x_offset: 0, y_offset: 0 },
        { timeMs: 2000, scale: 1.5, rotation: 30, x_offset: 18, y_offset: -12 }
      ],
      sourceDuration: 2000,
      speedCurvePreset: "custom",
      speedCurve: [
        { timeMs: 0, speed: 0.25 },
        { timeMs: 1000, speed: 1.75 },
        { timeMs: 2000, speed: 0.25 }
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
      rotation: 0, startTime: 250, duration: 1000, opacity: 0.5, fadeInMs: 250, fadeOutMs: 250,
      keyframes: [
        { timeMs: 0, x: 0.35, y: 0.4, scale: 1, rotation: 0, opacity: 1, easing: "linear" },
        { timeMs: 1000, x: 0.75, y: 0.7, scale: 2, rotation: 90, opacity: 0.2, easing: "ease-in" }
      ],
      zIndex: 20
    }]
  });
  assert(mixedPlan.filters.includes("sqrt(max(0") &&
    mixedPlan.filters.includes("asplit=2") &&
    mixedPlan.filters.includes("concat=n=2:v=0:a=1"),
    "Variable-speed export did not generate synchronized video/audio filter branches.");
  console.log("SPEED CURVE FFmpeg GRAPH 1/1 PASS  variable rate mapping and source audio graph");
  assert(mixedPlan.streams.some((stream) => stream.codec_type === "audio"), "Mixed export has no audio stream.");
  assert(mixedPlan.filters.includes("scale=44:80:force_original_aspect_ratio=decrease"), "Sticker was not resized before overlay composition.");
  const stickerLayerGraph = mixedPlan.filters.match(/\[2:v:0\](.*?)\[ssrc0\]/)?.[1] || "";
  assert(stickerLayerGraph.includes("eval=frame") && stickerLayerGraph.includes("rotate=angle='("),
    "Sticker scale/rotation keyframes were not compiled into the animated export layer.");
  assert(mixedPlan.filters.includes("overlay=x='clip(main_w*(") && mixedPlan.filters.includes("overlay_w/2,0,main_w-overlay_w)"),
    "Sticker position keyframes were not compiled into the overlay position expressions.");
  assert(mixedPlan.filters.includes("fade=t=in:st=0.250:d=0.250:alpha=1") &&
    mixedPlan.filters.includes("fade=t=out:st=1.000:d=0.250:alpha=1") &&
    mixedPlan.filters.includes("if(lt(T,0.2500") &&
    mixedPlan.filters.includes("if(lt(T,1.2500") &&
    mixedPlan.filters.includes("0.2000"),
    "Sticker opacity keyframes and timed fade filters were not aligned to the layer's timeline start.");
  assert(mixedPlan.filters.includes("lutrgb=r='min(255,val*1.150)':g='min(255,val*1.150)':b='min(255,val*1.150)'"), "Brightness adjustment filter is missing from export.");
  assert(mixedPlan.filters.includes("eq=contrast=1.250:saturation=1.350"), "Contrast/saturation filters are missing from export.");
  assert(mixedPlan.filters.includes("fade=t=in:st=0.000:d=0.250:alpha=1"), "Fade-in alpha transition is missing from export.");
  assert(mixedPlan.filters.includes("fade=t=out:st=1.500:d=0.500:alpha=1"), "Fade-out alpha transition is missing from export.");
  assert(mixedPlan.filters.includes("eval=frame") && mixedPlan.filters.includes("rotate=angle='(") &&
    mixedPlan.filters.includes("overlay=x='(W-w)/2+("),
    "Animated scale, rotation, or position expressions are missing from FFmpeg export.");
  console.log("FFMPEG EXPORT 2/3 PASS  original audio, music and sticker filters render");

  const timedStickerPlan = planAndRun({
    name: "sticker-layer-timing-export.mp4",
    hasAudio: true,
    stickers: [{
      id: "timed-sticker", asset: "smoke-test", label: "Timed smoke sticker", glyph: "★",
      x: 0.5, y: 0.5, width: 0.25, height: 0.25, scale: 1, rotation: 0,
      startTime: 400, duration: 1000, opacity: 1, fadeInMs: 400, fadeOutMs: 400,
      keyframes: [], zIndex: 20
    }]
  });
  assert(timedStickerPlan.filters.includes("fade=t=in:st=0.400:d=0.400:alpha=1") &&
    timedStickerPlan.filters.includes("fade=t=out:st=1.000:d=0.400:alpha=1"),
    "Delayed sticker fade filters were not placed on the global timeline.");
  const halfwayInPixel = probeRgbPixel(timedStickerPlan.output, 0.6, 90, 160);
  const fullyVisiblePixel = probeRgbPixel(timedStickerPlan.output, 0.8, 90, 160);
  const halfwayOutPixel = probeRgbPixel(timedStickerPlan.output, 1.2, 90, 160);
  const afterStickerPixel = probeRgbPixel(timedStickerPlan.output, 1.6, 90, 160);
  assert(halfwayInPixel[0] > 35 && halfwayInPixel[2] > 35 &&
    Math.abs(halfwayInPixel[0] - halfwayInPixel[2]) < 100,
    "Sticker was not partially transparent halfway through its delayed fade-in: " + halfwayInPixel.join(","));
  assert(fullyVisiblePixel[0] > 200 && fullyVisiblePixel[2] < 50,
    "Sticker was not fully visible after its delayed fade-in: " + fullyVisiblePixel.join(","));
  assert(halfwayOutPixel[0] > 35 && halfwayOutPixel[2] > 35 &&
    Math.abs(halfwayOutPixel[0] - halfwayOutPixel[2]) < 100,
    "Sticker was not partially transparent halfway through its delayed fade-out: " + halfwayOutPixel.join(","));
  assert(afterStickerPixel[0] < 40 && afterStickerPixel[2] > 200,
    "Sticker remained visible after its timeline interval ended: " + afterStickerPixel.join(","));
  console.log("STICKER TIMING RENDER 1/1 PASS  delayed sticker fade-in/fade-out follow real output pixels");

  const silentPlan = planAndRun({ name: "silent-video-export.mp4", hasAudio: false });
  assert(!silentPlan.streams.some((stream) => stream.codec_type === "audio"), "Silent video generated an invalid audio stream.");
  console.log("FFMPEG EXPORT 3/3 PASS  silent source exports without phantom audio");

  console.log("NOVACUT FFmpeg export smoke 3/3 PASS");
} finally {
  fs.rmSync(temp, { recursive: true, force: true });
}
