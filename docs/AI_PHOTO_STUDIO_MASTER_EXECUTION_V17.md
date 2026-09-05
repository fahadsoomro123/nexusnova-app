# NexusNova AI Photo Studio — Flagship Parity Master Execution V17

## Non-negotiable execution rule

Work is strictly sequential. Do not abandon an active item because a newer request arrives. New requests are appended to the queue unless they directly refine the current active item. A phase is closed only after implementation + executable QA + regression checks pass. Phone acceptance remains the final acceptance gate.

## Benchmark basis completed before implementation

The target is feature/workflow parity with the strongest patterns found across Canva, Adobe Express / Photoshop web, Photoroom, Picsart, Pixelcut and Fotor, implemented with original NexusNova UI/assets and without copying proprietary artwork, branding, or source code.

### Canva patterns to match functionally
- Upload or template -> editable design workspace.
- Layered design objects, grouping, locking, alignment, forward/back/front/back ordering.
- Photo editor + Magic-style AI tools in one workflow.
- Background Remover with erase/restore refinement.
- Magic Eraser / object removal, Magic Edit / replace, Magic Grab / subject isolation, background generation, generative expand.
- Foreground/background-aware light/color editing.
- AI-generated or flattened visual -> editable layered design concept.
- Resize, templates, text, elements, filters, enhancers and export integrated around the same canvas.

### Adobe Express / Photoshop web patterns to match functionally
- Home quick actions + open-in-editor continuation.
- Editor with canvas, object selection, property panels, Layers panel, multi-select, lock/reorder.
- Insert/replace/remove object with brush mask + prompt + multiple results + Keep/Discard.
- Generative expand when changing canvas dimensions.
- Professional adjustment stack: brightness/contrast, exposure, highlights/shadows, hue/saturation, vibrance, color balance, levels, curves, RGB channel editing, black & white and selective color style controls.
- Non-destructive layer/adjustment behavior wherever feasible.
- Text tool with font, size, color, alignment, duplicate/copy style/delete.

### Photoroom patterns to match functionally
- Subject-first workflow optimized for product photos.
- High-quality background removal and editable subject layer.
- Replaceable-subject templates.
- AI backgrounds, realistic AI shadows, recolor/product staging.
- Retouch with erase/add modes, brush selection and prompt-driven changes.
- Batch editor for repeatable backgrounds, sizes, positions and templates.
- Brand/template settings reusable across future images.

### Picsart patterns to match functionally
- Full editor and fast AI quick tools in one product.
- AI Enhance, background remover, object remover/fill, retouch, filters/effects.
- Core photo controls plus advanced Curves, HSL and selective adjustments.
- Text/templates/elements layered on top of photo editing.

### Pixelcut / Fotor patterns to match functionally
- 2x/4x upscale workflow and detail-enhancement mode.
- Relight, product-photo tools, background generation/removal, object removal, recolor and product presentation features.
- One-click Enhance plus manual post-adjustment.
- Portrait retouch, unblur/sharpen, restore/colorize style utilities where technically supported.

## NexusNova target architecture

### A. Studio Home
- New Design
- Upload Photo
- AI Generate
- Templates
- Recent Projects
- Quick Tools
- Batch Studio
- Product Studio

### B. Universal editor shell
- Top: Back/Home, project name, Undo, Redo, Before/After, Resize, Export.
- Canvas: zoom/pan, selection bounds, crop overlay, guides/snap.
- Primary tool rail: Templates, Media/Uploads, Elements, Text, Photo, Adjust, AI, Layers.
- Mobile: bottom rail + context sheet; never cram desktop controls into phone width.
- Layer model: image/text/shape/background/AI-result layers; select, multi-select, reorder, duplicate, hide, lock, front/back, align, center, delete.
- Every tool returns to the same working project instead of creating disconnected result screens.

### C. Photo Adjust / RGB engine
- Light: Exposure, Brightness, Contrast, Highlights, Shadows, Whites, Blacks.
- Color: Temperature, Tint, Vibrance, Saturation.
- Detail: Clarity, Dehaze, Sharpness, Noise Reduction, Blur.
- Effects: Vignette, Grain, Fade.
- Color Mix / HSL: red, orange, yellow, green, aqua, blue, purple, magenta.
- Curves: master RGB + Red + Green + Blue channels.
- Histogram.
- Selective masks for local light/color edits.
- Presets with intensity control.

### D. Background / subject system
- AI/ML subject segmentation as primary path, not border-color guessing.
- Transparent alpha matte with hair/soft-edge refinement.
- Erase / Restore brush, brush size, softness/feather, undo/reset.
- Background replace with solid, gradient, uploaded image, template or AI-generated background.
- Subject position/scale/rotation independent from background.
- Subject shadow controls plus AI shadow path.

### E. Generative AI edit system
- Uses Puter keyless/user-pays integration where supported.
- Text-to-image generation.
- Image-to-image editing using source image input.
- Brush mask workflow for replace/remove/add where provider/model supports masked edit/inpainting.
- Prompt-driven whole-image edit when mask support is unavailable.
- Generate multiple candidates where possible, then Keep/Discard/Regenerate.
- AI Background, AI Replace, AI Remove/Object Cleanup, AI Expand, style/scene changes.
- No fake local filter may be labeled as equivalent to generative AI.

### F. Enhance / upscale / repair
- Auto Enhance with scene analysis and responsive preview.
- Portrait / Detail / Low Light modes.
- 2x/4x upscale plus enhanced-detail option where real AI/provider support is available.
- Unblur/sharpen/noise cleanup.
- Face/portrait polish only when output materially changes and is tested.
- Full-resolution commit separated from live preview to avoid Android slider hangs.

### G. Retouch / repair editor
- Heal / remove distraction.
- Clone/repair brush.
- Blemish cleanup.
- Selective smoothing/detail.
- Red-eye / teeth / portrait utilities only if real output is implemented.
- Undo/Redo history for brush operations.

### H. Product Studio
- Remove BG.
- White/solid background.
- AI background scenes.
- Relight.
- AI/realistic shadows.
- Product recolor.
- Resize to marketplace/social presets.
- Reusable branded template.
- Batch processing architecture.

### I. Templates / Design Editor
- Templates are structured editable projects, not flat thumbnails.
- Replaceable subject/image slots.
- Editable text, shapes, images, colors and background.
- Save custom template.
- Apply template to one or multiple images.
- Existing target remains exactly 1000 templates = 20 categories × 50.

### J. Projects / persistence / export
- Autosave working project state.
- Recent creations open/load/delete.
- Preserve editable layers/settings, not just flattened JPEG.
- Export PNG/JPG/WebP where supported; transparent PNG for cutouts.
- Result actions must wait for full-resolution render before export/use/edit.

## Strict ascending implementation queue

1. CORE EDITOR ARCHITECTURE parity and navigation integrity.
2. PHOTO ADJUST + RGB/HSL/CURVES professional engine.
3. REMOVE BG / SUBJECT MATTE production-grade path + refine workflow.
4. GENERATIVE AI EDIT workflow: source-image edit, brush mask, replace/remove/add, candidate results.
5. ENHANCE / UPSCALE / UNBLUR quality and performance.
6. RETOUCH / REPAIR / CLONE / HEAL workflow.
7. PRODUCT STUDIO: AI backgrounds, relight, shadows, recolor.
8. TEMPLATES / DESIGN EDITOR full structured-project workflow.
9. BATCH STUDIO + reusable brand/template settings.
10. PROJECTS / HISTORY / AUTOSAVE / EXPORT end-to-end.
11. EXHAUSTIVE FUNCTIONAL QA across 360x640, 360x740, 393x852, 415x858, 430x865 + Android build.
12. PHONE ACCEPTANCE. Only user confirmation closes the flagship rebuild.

## Acceptance rules for every queue item

- Presence of a button is not PASS.
- Execute the workflow with actual pixels/state changes.
- Test large images and rapid touch/slider input.
- No dead/misrouted buttons.
- No export of temporary preview buffers.
- Android Back/Home behavior must not unexpectedly exit the app.
- Existing protected NexusNova modules must remain unaffected.
- No public OTA/release unless explicitly requested.
- No paid external service without explicit approval.

## Current lock

Benchmark is complete. The only active implementation item after this document is Queue Item 1: CORE EDITOR ARCHITECTURE parity and navigation integrity. Do not jump to later tools until Item 1 is closed by executable QA.