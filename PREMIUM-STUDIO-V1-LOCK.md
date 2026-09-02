# NexusNova Premium Studio v1 — Locked Rules

Branch: `nova-sol57-pro-v128-premium-studio-v1`
Base: `nova-sol57-pro-v128`

## Six locked tools
1. AI Photo Studio — blue/cyan magic-photo visual
2. AI Video Studio — purple clapper/timeline/scissors visual
3. PDF Pro — red document-engine visual
4. AI Transcribe — green microphone/waveform visual
5. AI Writing Pro — orange/gold fountain-pen document visual
6. Digital Sign — pink signature/document visual

## UI rules
- No page scrolling inside any of the six tools.
- Content that would normally need vertical scrolling must be split into tabs or paged output controls.
- No empty black filler areas.
- Every tool uses the shared hyper-real 3D/tactile shell: layered gradients, inset highlights, physical button depth, controlled glow, premium panels and responsive compact layouts.
- All six tools use different accent colors.
- No placeholder buttons: visible primary feature controls must perform a real local action, a configured Nova AI action, or an explicitly labelled secure premium-provider handoff.
- Heavy AI generation providers are treated as provider-account/credit services rather than falsely described as free local generation.

## Safety / protected app scope
- Do not modify Mine logic, Mine branding/timer/balance/session/backend behavior.
- Do not modify Nova Drive / Nova Track approved visual assets or tracker logic.
- Do not replace unrelated NexusNova features while working on Premium Studio.

## Architecture
- Shared shell: `fresh-rebuild/src/features/apps/premium-studio-core.js`
- Renderer registry: `fresh-rebuild/src/features/apps/premium-studio-suite.js`
- Nova Hub registration: `fresh-rebuild/src/features/hub/app-registry.js`
- Router wiring: `fresh-rebuild/src/features/apps/app-screen.js`
- Premium Hub icon routing: `fresh-rebuild/src/features/hub/hub-screen.js`
- CI: `.github/workflows/nexusnova-premium-studio-v1.yml`
