# NexusNova AI Video Studio — Flagship V2 Master Plan

Status: ACTIVE
Owner: NexusNova
Applies to: Current AI Video Studio and all follow-up implementation work
Primary repository: fahadsoomro123/nexusnova-app
Related OTA repository: fahadsoomro123/nexusnova-website

## 1. Mission

Transform the current NexusNova AI Video Studio from a feature-heavy editor surface into a coherent, professional, mobile-first video editing product with real behavior.

The target is not a mockup, feature checklist, or visual-only redesign.

The target is:

IMPORT -> PREVIEW -> TIMELINE -> EDIT -> PREVIEW RESULT -> PLAYBACK -> EXPORT

with one consistent edit state powering the entire flow.

## 2. Non-negotiable product principles

1. Real functionality over decorative UI.
2. Full media visibility by default; never silently crop user media.
3. FIT/CONTAIN is the default preview behavior.
4. Crop/FILL/REFRAME must be an explicit user choice.
5. Preview, playback, timeline and export must derive from the same edit state.
6. Every primary visible control must have real behavior.
7. Existing working functionality must not be removed without explicit scope.
8. Mobile-first layout must work at 360x800, 390x844 and 412x915 where applicable.
9. Loading, empty, error, cancel, retry and success states are first-class product states.
10. No release may be called flagship-ready without runtime evidence.

## 3. Current issues that are release gates

These remain active until verified PASS:

### A. Android media import
Selecting a supported photo/video through Android must load a usable media item into Video Studio.

### B. Preview framing
The uploaded media must display as a complete correctly fitted frame by default. No tiny, partial, clipped, stretched or unexplained rendering.

### C. Real canvas ratios
16:9, 9:16, 1:1 and 4:5 must change the actual preview canvas. The selected media must fit inside the selected canvas without accidental crop.

### D. Playback consistency
Playback must show the same correctly framed media represented by the editor preview.

### E. Edit-state behavior
Trim/in-out, split, delete, duplicate, speed, volume, transform, filters/effects, text, captions, motion and transitions must update actual editor state when exposed as production controls.

### F. Timeline synchronization
Timeline position, playhead, clip order, clip boundaries and preview must remain synchronized.

### G. Export consistency
Export must use the same edit state as preview. Intended edits must survive export.

## 4. V2 architecture

Use a single canonical project/edit state.

Project
- projectName
- canvas: ratio, background
- clips[]

Each clip
- id
- sourceKey
- mediaType
- sourceDuration
- trimIn
- trimOut
- speed
- audio: volume, muted
- visual: brightness, contrast, saturation, effect
- transform: scale, rotation, flip, position
- text overlays
- captions
- motion
- transition

Render layers:

EDIT STATE
  -> timeline model
  -> preview renderer
  -> playback controller
  -> export renderer

No independent duplicated state for the same edit property.

## 5. UI/UX transformation

### Editor hierarchy

Header
-> Preview Canvas
-> Playback controls
-> Timeline
-> Contextual Inspector
-> Tool dock
-> Add Media / Export

Keep the primary editing workspace visually dominant.

### Preview

Default:
- FIT/CONTAIN
- centered
- full source frame visible
- aspect ratio preserved
- responsive recalculation on viewport changes

Explicit modes:
- FIT
- FILL
- CROP/REFRAME

Canvas formats:
- 16:9
- 9:16
- 1:1
- 4:5

### Timeline

Replace the current card-only mental model with a true timeline interaction model.

Required:
- visible clip segments
- playhead
- clip selection
- trim handles
- split at playhead
- delete
- reorder
- synchronized preview

### Contextual tools

Do not expose every control as a permanent crowded grid.

Selecting a tool opens a focused contextual control surface.

Examples:
- Edit: trim, split, delete, duplicate
- Audio: volume, mute
- Speed: speed presets + fine control
- Adjust: brightness, contrast, saturation
- Text: add/edit/position/timing
- Effects: selectable effects + reset
- Transform: move, scale, rotate, flip
- Canvas: ratio + fit mode + background
- Captions: timed caption editing
- Motion: motion/keyframe controls
- Transitions: transition and duration
- AI: analysis, suggestions, apply/reject

## 6. Core transformations in implementation order

### Phase 1 — Preview + Canvas
- Stabilize media sizing.
- Detect intrinsic dimensions.
- Implement real canvas frame sizing.
- Implement FIT/FILL/CROP behavior.
- Handle orientation/viewport changes.
- Verify no accidental crop.

Gate: preview is correct on all target mobile sizes.

### Phase 2 — Timeline foundation
- Build canonical timeline model.
- Add playhead mapping.
- Add clip selection.
- Add trim handles.
- Add split/delete/reorder behavior.

Gate: every timeline operation is reflected immediately in preview/playback.

### Phase 3 — Edit-state consolidation
- Migrate exposed editing controls to the canonical state.
- Remove duplicated state paths.
- Add undo/redo transaction integrity.

Gate: one edit value produces one consistent result everywhere.

### Phase 4 — Contextual flagship UX
- Redesign tool access around task-oriented contextual panels.
- Improve hierarchy, spacing, typography, touch targets and feedback.
- Add polished empty/loading/error/success states.

Gate: no dead/fake/decorative primary controls and no major responsive defects.

### Phase 5 — Real editing capabilities
Implement and verify:
- trim
- split
- delete
- duplicate
- reorder
- speed
- audio/mute
- filters/effects
- text overlays
- transform
- motion
- captions
- transitions

Gate: each exposed feature has real preview behavior.

### Phase 6 — Export parity
- Export from canonical edit state.
- Preserve timeline order and trim boundaries.
- Preserve supported visual edits.
- Verify output opens and reflects intended result.

Gate: exported result matches the editor intent.

### Phase 7 — AI layer
AI is an assistive layer, not decorative animation.

Workflow:
MEDIA -> ANALYZE -> SUGGEST -> USER APPROVES -> EDIT STATE CHANGES -> PREVIEW -> EXPORT

AI features may include:
- director/edit suggestions
- caption generation
- short-form reframing suggestions
- pacing suggestions
- highlight suggestions

No fake progress or fabricated analysis.

### Phase 8 — Final polish
- typography
- spacing
- icon consistency
- animation
- focus states
- touch feedback
- empty/loading/error/success states
- accessibility
- performance and memory review

## 7. QA system

Every release candidate must pass:

### Functional
Import -> preview -> play -> seek -> trim -> split -> delete -> reorder -> speed -> audio -> text -> effect -> transform -> canvas -> captions -> transition -> export.

### Responsive
360x800
390x844
412x915

### Reliability
- picker cancel
- permission denial
- unsupported format
- malformed media
- decode failure
- interrupted interaction
- retry
- empty project
- multiple clips
- undo/redo

### Media
- landscape
- portrait
- square
- different intrinsic dimensions
- source aspect ratios unlike selected canvas ratio

### Regression
Existing NexusNova app flows outside Video Studio must remain functional.

## 8. QA rule

FAIL -> ROOT CAUSE -> PATCH -> BUILD -> VERIFY -> RETEST

Never weaken or delete a test merely to make CI green.

A CI green result does not override a failed real-device/runtime check.

## 9. Release strategy

Native Android changes:
- require a correctly signed APK upgrade
- preserve the installed app signing identity
- increment Android versionCode correctly
- verify APK certificate and version before delivery

Web/editor changes:
- use OTA only when the installed native baseline can consume that OTA
- verify manifest base
- verify file hashes and sizes
- verify public raw endpoints
- verify OTA status/proof badge
- only then call the OTA package server-verified

## 10. Branch strategy

Preferred implementation branch:
video-studio-flagship-v2

Keep unrelated work out of the V2 branch.

Current media-import/native repair history must be preserved.

## 11. Evidence requirements

For every completed gate, record:
- commit SHA
- workflow run ID
- test result
- relevant artifact ID
- screenshot/video evidence when visual behavior is involved
- exact unresolved blockers, if any

## 12. Definition of flagship-ready

Video Studio is FLAGSHIP-READY only when ALL of the following are true:

1. Real end-to-end user flow works.
2. Media preview is correct and responsive.
3. Timeline and preview remain synchronized.
4. Primary editing actions have real behavior.
5. Preview and export share the same edit state.
6. Canvas ratio and framing behave intentionally.
7. Error/retry/cancel states work.
8. Responsive target sizes are verified.
9. Regression checks pass.
10. Real Android runtime testing passes.
11. Evidence is recorded.
12. No known release-blocking issue is hidden.

## 13. What is NOT acceptable

- Calling a screen flagship because it looks good in one screenshot.
- Feature-count inflation without real behavior.
- Permanent control grids that create clutter.
- Accidental media crop.
- Tiny or partial media preview.
- UI-only split/delete/trim buttons.
- Export that differs from the editor.
- Fake AI processing.
- Fake QA.
- Removing tests just to obtain PASS.
- Calling an OTA active without verifying public integrity and device consumption.
- Calling the product complete while release-blocking issues remain.

## 14. Current target

The immediate V2 target is:

1. Real preview canvas + FIT/FILL/CROP
2. Real timeline foundation
3. Canonical edit state
4. Contextual flagship UX
5. Real editing behavior
6. Export parity
7. AI assistant layer
8. Full QA
9. Signed APK / OTA delivery
10. Physical Android verification

This document is the permanent project memory for AI Video Studio Flagship V2.
