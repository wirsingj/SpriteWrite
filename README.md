# SpriteWrite

SpriteWrite is a local-first, AI-assisted pixel asset studio for making editable game and creative assets. It exists because asking an opaque image model to "make a sprite sheet" is a great way to produce folders of unusable almost-art, and a terrible way to make production assets.

The source of truth in SpriteWrite is not a PNG. It is explicit sprite data: canvas dimensions, palette IDs, layers, frames, frame notes/tags, animations, anchors, hitboxes, metadata, and JSON patch operations.

## What SpriteWrite Is

- A structured pixel editor for game and creative assets.
- A structured sprite data model that can be exported, inspected, tested, and patched.
- A workflow where AI can propose constrained, reviewable edits, and the user can preview, accept, reject, undo, or manually change every result.
- A first vertical slice for assets like animated characters and creatures, static props, tiles, walls, terrain, backgrounds, visual effects, icons, UI assets, animation strips, and complete sprite sheets.
- An engine-neutral source format with generic exports first; engine profiles can come later.

## What SpriteWrite Is Not

- It is not an AI image generator.
- It does not ask a model to regenerate a sprite sheet as an opaque raster image.
- It is not an OozeTactics-specific or Godot-specific utility. OozeTactics is a proving ground, not the product boundary.
- It does not depend on cloud APIs, auth, a database, a backend, Cuddler, or OllamaSaddle.
- It does not hide sprite state in magic blobs.

## Why It Exists

SpriteWrite is built around one practical frustration: software and game prototypes often die at the asset stage. Systems, mechanics, tools, and workflows can be built, but production-ready visual assets need a disciplined pipeline. SpriteWrite is that pipeline's first rail: editable grid data with strict patch validation.

SpriteWrite should support multiple pixel-art resolutions and visual styles. Avoid using "N-bit" phrases as technical assumptions; represent concrete properties such as canvas dimensions, cell dimensions, palette constraints, export scale, animation structure, and export profile.

## CodexCuddler Doctrine

1. AI is not the product. The rails around AI are the product.
2. Never ask an AI to "make a sprite sheet" as an opaque image.
3. AI may only suggest structured, inspectable edits: cell patches, editable frame drafts, palette changes, duplicated-and-modified frames, or explicit layer operations.
4. The user must be able to preview, accept, reject, undo, and manually edit every change.
5. The data model must be boring, explicit, portable, and testable.
6. No magic blobs. No hidden state. No hallucinated PNGs.
7. Prefer a small working vertical slice over a giant half-working architecture.
8. The app should be local-first and friendly to future Ollama, OllamaSaddle, and Cuddler integration.
9. Every feature should help turn chaotic AI output into usable production assets.
10. Build a tool, not a demo.

## Current MVP Features

- Vite, React, TypeScript, plain CSS.
- Hero 32x32 sprite sheet demo with Idle, Jump, Crouch, and Sword Stab rows.
- Minimal 32x32 ooze reference template kept as a tiny comparison asset.
- Neutral blank-project palette for non-ooze assets, with slime colors limited to the ooze reference template.
- Sparse cell storage where transparent cells are omitted.
- Manual paint and erase tools.
- Fixed paint/erase keyboard shortcuts.
- Click and drag painting.
- Layer panel with add, delete, reorder, select, rename, visibility, PNG export inclusion, lock/editable, opacity, normal/multiply/screen blend mode controls, and simple art/guide/shadow/highlight presets.
- Top atlas strip with frame add, duplicate, delete, selected-frame metadata, notes/tags, sheet order, and at-least-one-frame safety.
- Animation selector with add, duplicate, rename, reorder, and delete controls.
- Snapshot undo/redo for painting, accepted patches, and frame/asset operations.
- Canvas-first creative-tool layout with compact header, left drawing/palette/layer dock, large center canvas, bottom atlas/filmstrip, and right preview/context inspector.
- Atlas overview that shows animation/static rows below the detailed cell editor, with click selection, shift/ctrl/cmd multi-select, selected-frame duplicate/delete, selected-frame duration/notes/tags editing, and drag reorder within a row.
- Draggable bottom atlas height and right preview/inspector width handles for fitting the workspace to the current asset.
- Center workspace toggle for detailed frame editing or full sprite sheet view; clicking a frame in the full-sheet view returns to editing.
- Focused AI Assist surface for Ollama/Mock structured edit proposals against editable grid data, with startup local Ollama model refresh plus manual refresh/download controls.
- First-pass Ollama animation-draft flow for broad prompts such as "hero wearing a cape, standing animation"; successful drafts become editable frame rows rather than opaque images.
- Animation preview with adjustable FPS, optional solid preview background color, and crisp nearest-neighbor rendering.
- Basic previous-frame onion skin.
- Palette editing for adding colors, reordering colors, editing selected-color name/hex, and deleting unused colors.
- Keyboard shortcuts plus a searchable command palette from the editor header or `Ctrl+K`.
- Optional AI Assistant with experimental Ollama provider and deterministic Mock provider.
- Proposed edit JSON preview before apply.
- Proposed edit diff summary with per-operation include/exclude and removal.
- Validation errors for bad edits.
- Export project JSON.
- Import project JSON with strong validation before replacing the current project.
- Home/start screen with New Project, templates, import, and current project entry.
- Templates for blank 32x32, blank 64x64, icon 32x32, UI button 64x24, hero 32x32 sprite sheet demo, and ooze 32x32 reference.
- Project identity with asset type and optional description.
- Export current frame PNG.
- Export current animation as a horizontal animation strip PNG.
- Export the complete project as a fixed row-per-animation sprite sheet PNG.
- Export full sprite sheet PNG plus matching metadata JSON.
- Export scale control for PNG and metadata outputs.
- Pure sprite sheet layout planning for deterministic dimensions and frame regions.
- Pure RGBA export rendering for pixel-level export tests.
- Vitest coverage for pure data and patch functions.

## Current App Flow

1. Start on the SpriteWrite home screen.
2. Choose New Project, New From Template, Import Project JSON, or Open Current Project.
3. Enter the editor with a valid project.
4. Paint from scratch on the central canvas, or open AI Assist for a structured edit proposal.
5. Inspect the atlas rows in the bottom filmstrip.
6. Click the static frame or animation row frame you want to edit.
7. Shift-click or ctrl/cmd-click row frames for multi-selection, duplicate or delete selected frames, set selected-frame duration/notes/tags, or drag a frame to reorder the row.
8. Use `Full Sheet` to pull back and see the sprite sheet rows in the center workspace; click any frame there to return to editing.
9. Pick the current animation, frame, and layer when deeper editing is needed.
10. Open Commands or press `Ctrl+K` if you are not sure what action to take.
11. Pick paint or erase.
12. Pick a palette color.
13. Paint cells on the grid.
14. Add or duplicate frames.
15. Use onion skin to compare against the previous frame.
16. Preview the current frame or animation.
17. Use the default Ollama local provider, optionally refresh/download a local model, or switch to the Mock local provider.
18. Use small edit prompts for selected-frame edits, or broad character/animation prompts for a structured frame-row draft.
19. Inspect valid proposed edit JSON and grid overlay.
20. Exclude or remove unwanted selected-frame edit operations if needed.
21. Apply or reject the edit or draft.
22. Undo or redo as needed.
23. Export project JSON, PNG frames, animation strips, full sprite sheets, or full sprite sheet metadata.

The non-negotiable rule: project data is canon. Canvas rendering and PNG export are derived from project data.

## Stack

- Vite
- React
- TypeScript
- Plain CSS
- Vitest

No backend, database, auth, cloud sync, paid provider APIs, or external UI framework.

## Run Locally

```bash
npm install
npm run dev
```

Then open the local URL printed by Vite.

On Windows, you can also double-click `Run SpriteWrite.bat` from the repo root. It starts Vite on `http://127.0.0.1:5173` and opens that URL in your browser. Leave the terminal window open while using the app, and press `Ctrl+C` in that window to stop it.

Optional desktop shortcut: right-click `Run SpriteWrite.bat`, choose `Show more options`, then `Send to > Desktop (create shortcut)`. This is optional and local to your machine; the repo does not require or create a desktop shortcut.

## Test

```bash
npm test
```

## Typecheck

```bash
npm run typecheck
```

## Build

```bash
npm run build
```

## Project Docs

The source-of-truth docs live in `docs/`:

- `docs/STATE_OF_SPRITEWRITE.md`: current implementation truth, limitations, and next steps.
- `docs/PRODUCT_VISION.md`: corrected product scope, AI-assistance model, asset categories, recipe direction, and export direction.
- `docs/APP_FLOW.md`: intended user flow and state flow.
- `docs/AI_PATCH_DOCTRINE.md`: provider contract, validation rules, and AI boundaries.
- `docs/EXPORT_CONTRACT.md`: PNG and metadata export promises.
- `docs/AUDIT_CHECKLIST.md`: repeatable audit checklist after each Codex pass.
- `docs/DEV_LOOP.md`: future development loop and guardrails.

## Export Assets

Use the export buttons in the editor header or the command palette:

- `Export project JSON` saves the full structured SpriteWrite project.
- `Import project JSON` validates a saved SpriteWrite project before loading it. Invalid imports show errors and leave the current project untouched. Successful imports reset undo/redo history because they are treated as opening another project.
- `Export Current Frame PNG` renders the selected frame from grid data at exact canvas dimensions.
- `Export Current Animation Strip PNG` renders the current animation frame sequence in one horizontal row. A one-frame project still works as a static asset source.
- `Export Full Sprite Sheet PNG` renders the whole project as a fixed grid: one animation per row, one frame per column, transparent padding cells after shorter rows.
- `Export Full Sprite Sheet PNG + Metadata JSON` downloads the full sheet PNG and matching metadata JSON.

PNG exports are generated from SpriteWrite grid data through a tested RGBA buffer, then copied into browser canvas/ImageData for PNG encoding. The canvas is an export target, not the source of truth. Exports use transparent RGBA output, no smoothing, no grid lines, no checkerboard, no onion skin, and no selection or patch-preview overlays. A layer must be both visible and marked for PNG export to appear in exported PNGs. Normal, multiply, and screen blend modes are applied during raster export.

Full sprite sheet metadata JSON is intentionally boring for engine importers. It includes the image filename, sheet dimensions, frame/cell dimensions, row/column counts, animation ordering, row indices, frame columns, explicit frame rectangles, FPS, loop behavior, duration, anchor, tags, hitbox data when present, and a `grid` block with origin, cell size, margin, and spacing. It also includes `importHints` for straight alpha, transparent background, no premultiplied alpha, no smoothing, pixel rectangle units, and top-left rectangle basis. Generic importers should be able to slice by the grid or read the explicit `frames[]` rectangles; Godot and Unity profiles can build on that later.

SpriteWrite uses `Sprite Sheet` for the fixed row-and-column output. `Packed Atlas` is reserved for a future arbitrary rectangle-packing export.

## Saving Editable Work

SpriteWrite does not manage a project library or recent-project persistence yet. Export Project JSON is the editable source/save artifact. PNG exports are production artifacts, and metadata JSON supports engine/import workflows.

## Project JSON Concept

A SpriteWrite project stores explicit data:

```json
{
  "canvas": { "width": 32, "height": 32 },
  "palette": [{ "id": "accent", "hex": "#8de06f" }],
  "animations": [{ "id": "idle", "fps": 4, "frameIds": ["idle-001"] }],
  "frames": [
    {
      "id": "idle-001",
      "layers": [
        {
          "id": "base",
          "cells": {
            "12,18": "accent"
          }
        }
      ],
      "anchor": { "x": 16, "y": 24 }
    }
  ]
}
```

Transparent cells are omitted from layer cell maps. A visible pixel is effectively `x`, `y`, and `colorId`, stored compactly as `"x,y": "colorId"`.

## Patch JSON Concept

Patch operations are small, inspectable edits:

```json
[
  { "op": "set", "x": 12, "y": 18, "colorId": "accent" },
  { "op": "clear", "x": 13, "y": 18 }
]
```

Validation rejects out-of-bounds cells, unknown color IDs, invalid operation names, malformed coordinates, extra fields such as dimension changes, and missing animations, frames, or layers.

## AI Assistant

The AI Assistant is the first AI-shaped workflow, but it does not require AI.

- `Ollama local` is the default provider. SpriteWrite auto-refreshes local models on browser startup when Ollama is reachable.
- `Mock local` returns deterministic local cell operations when you want a no-provider test path.
- `Ollama experimental` can call a local Ollama server and expects JSON cell operations only.
- Broad character/animation prompts can request a 3-6 frame draft object containing per-frame patch arrays.
- Proposed selected-frame edits are shown as JSON and previewed on the grid only when valid.
- Edits and drafts never apply automatically.
- Bad provider output is expected and should be caught by validation.
- Vision-oriented models such as `llava` may be available in Ollama, but text/instruction or code-style models are usually better at strict JSON patch output. When Ollama reports model capabilities, SpriteWrite refresh prefers a non-vision model if one is available.

## Future Ollama Plan

Ollama is the likely first real local AI provider. In SpriteWrite, Ollama is treated as a constrained creative assistant and co-editor for static or animated assets.

It should receive selected project, frame, layer, palette, current cells, onion context, neighboring frames, frame intent, fixed dimensions, palette constraints, and transformation constraints. It should return structured editable results: JSON patch operations, validated frame drafts, palette suggestions, or explicit layer operations. It must not return image files, base64, markdown as the primary output, prose as the primary output, or regenerated raster sprite sheets.

The current Ollama provider is intentionally experimental. It auto-refreshes local models on startup, can manually refresh local models from Ollama, pull/download a named model, ask the selected model for structured edit JSON against the selected frame/layer, and route broad whole-asset prompts to a first-pass structured animation draft. Drafts are still editable frame operations, not image blobs. Quality depends heavily on the selected local model, and bad JSON or incoherent drafts are rejected without mutating the project.

## Future Cuddler And OllamaSaddle Plan

Cuddler may eventually orchestrate project context, files, prompts, provider windows, and local tooling.

OllamaSaddle may eventually normalize calls across Ollama and other local/provider systems.

SpriteWrite should remain useful without either one. The long-term goal is for Cuddler or Saddle to hand SpriteWrite a structured patch request, not an image prompt.

This repo does not implement or import Cuddler or OllamaSaddle.

## Known Limitations

- Recent projects and project-library persistence are not implemented yet. Browser draft autosave is convenience recovery only.
- Undo/redo is snapshot-based and intentionally simple.
- Command palette shortcuts are not user-configurable yet.
- No PNG binary/golden tests yet; pure RGBA buffer tests cover exported pixels and jsdom tests cover the canvas PNG wrapper before real browser download checks exist.
- Edit diff supports side-by-side current/proposed previews, changed-cell highlights, summary, operation grouping, per-operation include/exclude, and removal.
- Keyboard shortcuts are fixed for now; the old paint/erase shortcut settings panel was removed to reduce sidebar clutter.
- No layer folders, silhouette locks, anchor locks, or engine-specific export yet.
- Ollama support is experimental and will fail gracefully if Ollama is not running or returns invalid output.

## Future Notes

Do not implement these until the core editor earns it:

- Real Ollama edit/draft generation improvements.
- Edit diff visualization.
- Palette extraction.
- Silhouette locks.
- Anchor locks.
- Bounding box locks.
- Animation intent layers.
- Engine export profiles, including Godot and Unity.
- Tilesets.
- Tokens and icons for LoreKeeper.
- Broader asset recipes for characters, creatures, tiles, props, backgrounds, effects, and UI assets.
- Cuddler integration.
- OllamaSaddle provider bridge.
