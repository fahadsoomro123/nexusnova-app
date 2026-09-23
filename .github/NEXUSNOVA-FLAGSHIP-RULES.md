# NexusNova Global Flagship Rules

These are mandatory product and engineering rules for every NexusNova app in this repository.

## 1. Product quality
Every app must feel intentional, coherent, modern, responsive, and production-grade. Avoid generic dashboards, random card grids, excessive borders, cramped controls, decorative filler, and visual noise.

## 2. UX
The main task must be obvious within seconds. Primary action, secondary actions, current state, and recovery paths must be clear. Empty/loading/error/success states are first-class UI.

## 3. Functionality
Every visible primary control must perform its stated action. No fake buttons, dead-end dialogs, non-functional toggles, or visual-only demos in production paths.

## 4. Media
For media tools, the full source frame should be correctly visible by default. Detect intrinsic dimensions/aspect ratio. Default to FIT/CONTAIN; do not silently crop. FIT/FILL/CROP/ratio options should be explicit.

## 5. Responsive quality
At minimum verify 360x800, 390x844, and 412x915 where applicable. Check for clipping, overflow, overlapping controls, tiny tap targets, keyboard obstruction, and broken scrolling.

## 6. Performance
Avoid avoidable jank, excessive re-renders, large unnecessary assets, blocking operations on the main thread, and memory leaks.

## 7. Accessibility
Use semantic labels, readable typography, adequate contrast, touch targets, and keyboard/focus support where applicable.

## 8. Reliability
Handle permission denial, cancel, retry, interrupted operations, missing files, unsupported formats, network failure, and malformed input gracefully.

## 9. Integrity
Do not claim QA PASS, release-ready, or production-ready without evidence. Keep exact commit/run/artifact identifiers for release claims.

## 10. Regression protection
Do not remove or break existing working features without explicit scope. Every change must consider affected neighboring flows.

## 11. Editorial polish
Spacing, alignment, typography, icons, animation, hierarchy, and copy must be deliberate. A visually impressive screenshot is not enough; interaction behavior must match the visual promise.

## 12. Required closure
Every app change follows:
INSPECT -> AUDIT -> IMPLEMENT -> REAL TEST -> RESPONSIVE QA -> REGRESSION -> POLISH -> VERIFY -> EVIDENCE

A failed check must trigger:
FAIL -> ROOT CAUSE -> PATCH -> VERIFY -> RETEST

The current AI Video Studio is included under these rules immediately.
