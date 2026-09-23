# Current AI Video Studio — Explicit Issue & Acceptance Checklist

This file is part of the NexusNova flagship standard for the CURRENT AI Video Studio. These items are mandatory acceptance criteria until verified PASS.

## Issue 1 — Android media import
The app previously had a native Android photo/video picker/import problem. The current native fix must remain intact.
PASS requires: selecting a supported image/video from the Android picker produces a usable media item in Video Studio; no silent rejection, broken URI, or empty import state.

## Issue 2 — Uploaded video preview is too small / only a partial area is visible
The uploaded video's actual frame must be visible correctly in the editor preview.
PASS requires:
- intrinsic video dimensions/aspect ratio are detected
- FIT/CONTAIN is the default presentation
- the complete source frame is visible by default
- no accidental clipping, zoom, or tiny postage-stamp rendering
- no unexplained black/empty preview area
- crop/fill/reframe happens only when explicitly selected
- preview remains correctly sized after rotation/orientation changes and responsive viewport changes

## Issue 3 — Playback must use the visible edited frame
Playback must render the same correctly fitted media that the user sees in the editor.
PASS requires: play/pause/seek displays the expected full frame without unexplained cropping, black frames, stretching, or sudden scale changes.

## Issue 4 — Editing controls must affect real media state
Primary editor actions must update the real edit state, not merely change UI.
PASS requires that trim/in-out, split, delete, speed, transform, text/effects, or other exposed primary actions have real preview behavior before being considered functional.

## Issue 5 — Timeline/editor and preview must stay synchronized
Timeline selection, playhead, clip boundaries, and preview must represent the same edit state.
PASS requires: moving/splitting/deleting/trimming a clip is reflected immediately and correctly in playback.

## Issue 6 — Export must match the editor result
Export must be generated from the same edit state used by preview.
PASS requires: the exported media reproduces the intended clip boundaries and enabled edits; no feature may silently disappear at export.

## Current completion rule
These six items are release-blocking for Video Studio until the relevant runtime evidence exists. Do not call Video Studio flagship-ready merely because the app compiles, imports a file, or looks visually polished.
