# VEYTRIX DESIGN DIRECTION — INSTRUMENT FIRST

## Decision

The previous preview is rejected. VEYTRIX is being redesigned as an **engineering control instrument**, not a dark SaaS dashboard.

The redesign stops at the preview gate. Remaining workspaces are intentionally not expanded until this visual direction is accepted.

## Research synthesis

The research principles are translated rather than copied:

- CI/CD systems → make execution traceable through a persistent causal sequence.
- Command tools → make intent entry the dominant interaction, with suggestions as secondary accelerators.
- Deployment systems → expose current state and next action without decorative analytics.
- Build diagnostics → show evidence, stage timing, and failure context close to the execution path.
- Error monitoring → treat failure as an investigation transition: signal → cause → repair → retest → verification.
- Progressive disclosure → expose the control-critical layer first and keep raw logs/evidence behind deliberate depth.
- Mobile engineering tools → retain the same command/state/evidence hierarchy rather than stacking desktop cards.
- WCAG → semantic status labels, strong contrast, visible focus, and touch-safe controls.

## Three internal visual explorations

### A — Mission Ledger
A ruled technical ledger with dense rows and a command bar. Rejected because it could drift toward a terminal/log viewer and under-emphasize autonomous orchestration.

### B — Signal Field
A highly spatial field with radial status nodes and ambient motion. Rejected because it risks cyberpunk/neon aesthetics and weakens evidence density.

### C — Control Instrument **SELECTED**
A precision instrument with:

- an edge-to-edge command aperture
- a large mission state readout
- a vertical causal execution spine
- evidence treated as signed/ruled records
- logs treated as a diagnostic feed rather than a panel
- artifact identity represented as an inspection specimen
- verification represented as a proof chain
- asymmetrical composition with intentional empty space
- no repeated card grid
- no decorative KPI tiles
- restrained, non-neon semantic colour

## Visual grammar

### Composition
The page is a **control surface**: masthead → command aperture → mission instrument → evidence field. It is not header → cards → cards.

### Surfaces
Use one continuous dark material with ruled separators, recesses, and elevation only where interaction requires it. Avoid rounded-card repetition.

### Geometry
Execution is represented as a vertical spine with a moving inspection cursor. The spine communicates causality; it is not a percentage/progress bar.

### Typography
Large, calm mission state; compact labels; monospaced identifiers only for technical values. Typography should feel like an instrument readout, not a marketing dashboard.

### Colour
New palette:

- Void: `#070A0F`
- Graphite: `#0E131A`
- Raised graphite: `#151C25`
- Text: `#F2F5F7`
- Muted: `#9BA7B4`
- Rule: `#29323C`
- Brand: `#B7A3FF` (violet-lilac, used for control/focus)
- Info: `#69B9D6`
- Success: `#74C69D`
- Warning: `#D9AE62`
- Failure: `#E47A86`

No neon/cyberpunk glow, no rainbow gradients, and none of the rejected warm palette values.

### Interaction language
- Command field has the strongest affordance.
- Primary action is a solid control key, not a pill.
- Status uses a glyph + text + semantic colour.
- Secondary controls are quiet and rectangular.
- Evidence uses stamped states and ruled records.

## Preview gate

Only the shell, Home, Command Console, Execution Rail, Current Mission, logs, artifact evidence and verification evidence are being redesigned now. The other workspaces remain on the existing implementation and are not treated as part of the new visual direction until the preview is accepted.
