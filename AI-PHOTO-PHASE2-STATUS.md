# AI Photo Phase 2 — Photo Adjust

Status: **PENDING final full regression QA after HSL race stabilization**

Exact source baseline under test: `7195a7e3a1753266ad631becfdf0aa2861015c0e`.

Phase 2 includes the v18 worker-backed Photo Adjust editor: Light, Color, RGB channels, 8-color HSL mix, interactive RGB curves, live histogram, local masks, history/copy-paste/presets, and full-resolution export.

Repairs completed before this gate:
- restored missing editor state sync;
- dedicated Photo Adjust QA opens the visible Photo Editor route instead of testing hidden DOM below Studio Home;
- v18 eight-control Light panel expectations aligned in regression QA;
- local mask exposure/status synchronization corrected, including live 2-decimal exposure output;
- AI edit completion waits for the visible worker-rendered paint before reporting success;
- export status explicitly states local full-resolution export;
- HSL Color Mix preserves pixels outside the adjusted color range instead of introducing round-trip quantization changes;
- HSL QA now waits for the tab-triggered worker preview to settle before measuring the first red range, eliminating a test race without weakening pixel assertions.

Do not mark Phase 2 complete until this fresh full browser regression run is reviewed. Phone acceptance remains separate and unconfirmed.
