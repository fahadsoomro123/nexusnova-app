# NexusNova Global Flagship Engineering Standard

This repository is governed by the NexusNova Global Flagship Standard. It applies to EVERY app, feature, screen, UI change, refactor, bug fix, and future app added to this repository, including the current AI Video Studio work.

## Mandatory rule
Never declare an app, feature, UI, or release ready, complete, flagship, or production-ready from code inspection or screenshots alone. Real behavior must be verified.

## Quality bar
Build product-grade UX comparable in interaction quality, hierarchy, clarity, responsiveness, and polish to leading modern consumer tools. Use products such as CapCut, Canva, and professional creative suites as behavioral/UX references where appropriate, but do not copy branding or proprietary UI.

Every app MUST have:
- clear information hierarchy and purposeful layout
- mobile-first responsive behavior
- correct media sizing/aspect-ratio handling
- touch-friendly controls
- useful loading, empty, error, retry, cancel, and success states
- no clipped, overflowing, duplicated, placeholder, dead, decorative-only, or fake controls
- no unexplained black/empty panels or broken visual states
- real functionality behind every primary action
- accessible labels, focus/keyboard support where relevant, adequate contrast, and sensible touch targets
- predictable state management and safe recovery from failures
- no unnecessary feature deletion or regression of existing working functionality

## Mandatory engineering workflow
For any app change, follow:
INSPECT -> AUDIT -> DEFINE USER FLOW -> PLAN -> IMPLEMENT -> TEST REAL BEHAVIOR -> RESPONSIVE QA -> REGRESSION QA -> POLISH -> VERIFY -> REPORT EVIDENCE

Before editing, inspect the existing app and relevant code. Preserve working capabilities unless the change explicitly replaces them.

## Media/editor rule
For apps handling photos/video/audio, uploaded media must be visible correctly in the editor/preview. Preserve original aspect ratio by default; use FIT/CONTAIN as the safe default and require explicit user choice for crop/fill/reframe. Preview and export must derive from the same edit state.

## Definition of Done
A change is DONE only when:
1. the intended user flow works end-to-end
2. primary interactions have real behavior
3. supported mobile viewports are checked (at minimum 360x800, 390x844, 412x915 when applicable)
4. important existing flows still work
5. visual defects are corrected
6. relevant automated/runtime QA is passed
7. evidence exists for the claim being made
8. unresolved blockers are explicitly reported instead of hidden

## Current Video Studio issue gates
The exact current issues raised for AI Video Studio are tracked in `.github/CURRENT-VIDEO-STUDIO-ISSUES.md` and are release-blocking until runtime evidence proves PASS.

Mandatory gates include:
- Android photo/video import must work end-to-end.
- Uploaded video must render as a complete correctly fitted frame by default; no tiny/partial/clipped preview.
- Playback must use the same correct framing as the preview.
- Timeline/edit actions must change real media state, not only the UI.
- Timeline, playhead, clip boundaries, and preview must remain synchronized.
- Export must reproduce the same intended edit state seen in the editor.

## Current app binding
The current NexusNova AI Video Studio is subject to this standard immediately. Fixes must prioritize real media import, correct preview framing, timeline/editor behavior, and export consistency.

## Agent behavior
When asked to build or improve any app:
- treat this file as mandatory repository policy
- do not substitute mockups for working functionality
- do not weaken tests just to obtain a green status
- do not report partial work as complete
- when a test fails: FAIL -> ROOT CAUSE -> PATCH -> VERIFY -> RETEST
- keep changes targeted and audit the diff before finalizing
