# NexusNova AI Photo Studio — flagship repair baseline audit

Audit date: 2026-09-05 (UTC)

## Source and visual contract

- Repository: `fahadsoomro123/nexusnova-app`
- Branch: `ai-photo-real-canva-ai-generator-correction`
- Authoritative inherited code HEAD verified through GitHub before changes: `9ef070ba55f76506851a1366fc9dc3863e50578d`
- Internal source-transfer checkpoint: `9d49399a5889410e5eb6ae21590408eb16859e0d`
- Home reference inspected: `NexusNova AI Photo Studio Dashboard(1).png`
- Generator reference inspected: `NexusNova AI Layout Fix Preview.png`
- Generator target: RIGHT-HAND phone marked `FIXED LAYOUT (Final Setup)` only.
- No image generation is permitted or used.

## Evidence reviewed

- Original Home reference at 942 × 1672 pixels.
- Original Generator comparison at 1024 × 1536 pixels.
- Existing rendered artifacts at 360 × 640, 360 × 740, 393 × 852, 415 × 858, and 430 × 865.
- Existing Home/Generator DOM geometry reports and source implementation.
- Existing six-round workflows, which prove syntax, selected wiring, overflow, asset checksums, and Android compilation but do not prove complete user flows.

## Confirmed baseline defects (not PASS)

### Navigation

- Generator Back closes the workspace into Photo Editor instead of returning predictably to Studio Home.
- Android system Back calls the app-level router before any AI Photo Studio internal-navigation handler.
- Templates, Projects, Design, generated result, Photo Editor sheets, and deeper tool flows have no single logical internal Back stack.
- The only Studio Home affordance can be visually hidden by the active mode.

### Home visual contract

- At 393 × 852 the hero is about twice the approved reference's proportional height.
- The hero's source nebula/star artwork is replaced by a generic CSS purple glow.
- The hero icon is not the approved source icon.
- Several controls use generic Unicode glyphs rather than a consistent vector icon system.
- At 360 × 640 primary-card descriptions are intentionally hidden, contrary to the approved source.
- Labels and cards are compressed to satisfy a no-overflow assertion rather than preserving the approved visual hierarchy.

### Home behavior

- Remove BG, Enhance, and Upscale all route to the generic Photo Editor picker; none performs its named operation.
- AI Filters opens the generic AI panel with no specific filter workflow.
- Collage and Text Art route to generic Templates.
- Featured cards open the generic library rather than the selected template detail.
- Favorites routes to Projects and has no favorites behavior.
- Fallback Recent cards present demo projects as if they were saved projects.

### Generator

- Custom ratio is injected as malformed visible text (`0::9`) and only shows an alert.
- Several visible styles share the same provider value, so backend intent is not distinguishable.
- Selected ratio/style states are too subtle and lack reliable pressed/ARIA state.
- Result Back behavior is not a logical level; generated state can be lost by closing the workspace.
- Existing one-call Puter guard and truthful before/after allowance calculation are present and must be preserved.

### Templates and Design Editor

- Exactly 1000 templates and 20 × 50 counts are present.
- The library is produced from only five named palettes and two dominant composition families, causing repetitive palette-swap results.
- Added mini thumbnails are unrelated reference crops and can disagree with the editable canvas preview.
- Design inspector range inputs re-render the inspector on every input event, risking focus/pointer continuity.
- `Center` performs horizontal centering only and does not clearly disclose this.
- Workspace Back closes to Photo Editor even when entered from Studio Home.

### Photo Editor and AI actions

- Most professional controls have real local implementations, but the previous QA never executes them.
- AI actions expose busy text but no per-button selected/busy state and are not covered by a success/undo behavioral test.
- File-import errors rely on transient toast only.
- Current design language is light/white inside a dark flagship suite and visually disconnects from the approved Home/Generator language.

## Independent control inventory status

Inventory discovery covers all current button, input, select, range, file, canvas, card, menu, Home, Back, tab, result, and export selectors. Final per-control status remains `NOT TESTED` until the new behavioral harness executes the associated action. Presence alone will not be recorded as PASS.

## Protected scope baseline

The following user-protected files are unchanged from inherited HEAD at this checkpoint:

- `fresh-rebuild/assets/styles/ai-photo-route-fullscreen.css`
- `fresh-rebuild/src/features/apps/app-screen.js`
- `fresh-rebuild/src/features/apps/ai-photo-studio-flagship.js`
- `fresh-rebuild/src/features/apps/ai-photo-focus-interaction.js`

Unrelated protected modules (Qibla, Prayer Times, Pakistan Hub, News, Articles, My Location, Nova Drive, Nova Track, mining, timer, balance, auth, and unrelated apps) are unchanged.

## Release status

- OTA: **NOT RELEASED**
- Signed APK: **NOT RELEASED**

## Next exact action

Implement a Studio-owned navigation controller plus real dedicated Quick Tools workflows, then execute the new behavioral harness before any visual PASS claim.
