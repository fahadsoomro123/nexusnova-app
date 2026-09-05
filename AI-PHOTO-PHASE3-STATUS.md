# AI Photo Phase 3 — Remove Background

Status: **ACTIVE — hardening landed; full regression QA pending**

Exact product baseline under test: `034ee1c201effb186c0d5bcb40a07da74468c035`.

Phase 3 hardening now includes:
- on-device MediaPipe portrait segmentation with semantic object fallback;
- hair/fabric-friendly soft alpha trimap before dilation;
- coverage guards for invalid empty/full masks;
- atomic loading handoff so the old heuristic refiner and result actions cannot be used while ML is replacing the canvas;
- ML success installs the AI Edge Refine controls before result actions are re-enabled;
- ML failure explicitly unlocks the protected local fallback;
- Restore / Erase / brush size / softness / feather / Undo / Reset AI;
- behavior QA waits for the Remove BG result to settle to `ready` or `fallback` before exercising refine/export actions, while keeping real alpha-change and undo assertions.

Internal CI is not phone acceptance. Do not mark Phase 3 phone-complete until real-device photos confirm subject, hair, hands, clothing and soft-edge preservation.
