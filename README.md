# SpriteWrite

SpriteWrite is a local-first structured pixel asset workbench. It exists because asking an opaque image model to "make a sprite sheet" is a great way to produce folders of unusable almost-art, and a terrible way to make production assets.

The source of truth in SpriteWrite is not a PNG. It is explicit sprite data: canvas dimensions, palette IDs, layers, frames, frame notes/tags, animations, anchors, hitboxes, metadata, and JSON patch operations.

## What SpriteWrite Is

- A fixed-grid pixel editor for small game assets.
- A structured sprite data model that can be exported, inspected, tested, and patched.
- A workflow where AI can eventually propose JSON cell edits, and the user can preview, accept, reject, undo, or manually change every edit.
- A first vertical slice for assets like characters, enemies, oozes, icons, UI controls, and generic animated sprites.

## What SpriteWrite Is Not

- It is not an AI image generator.
- It does not ask a model to regenerate a sprite sheet as an opaque raster image.
- It does not depend on cloud APIs, auth, a database, a backend, Cuddler, or OllamaSaddle.
- It does not hide sprite state in magic blobs.

## Why It Exists

SpriteWrite is built around one practical frustration: software and game prototypes often die at the asset stage. Systems, mechanics, tools, and workflows can be built, but production-ready visual assets need a disciplined pipeline. SpriteWrite is that pipeline's first rail: editable grid data with strict patch validation.

## CodexCuddler Doctrine

1. AI is not the product. The rails around AI are the product.
2. Never ask an AI to "make a sprite sheet" as an opaque image.
3. AI may only suggest structured, inspectable edits to grid cells.
4. The user must be able to preview, accept, reject, undo, and manually edit every change.
5. The data model must be boring, explicit, portable, and testable.
6. No magic blobs. No hidden state. No hallucinated PNGs.
7. Prefer a small working vertical slice over a giant half-working architecture.
8. The app should be local-first and friendly to future Ollama, OllamaSaddle, and Cuddler integration.
9. Every feature should help turn chaotic AI output into usable production assets.
10. Build a tool, not a demo.

## Current MVP Features

- Vite, React, TypeScript, plain CSS.
- Default 32x32 ooze starter project.
- Generic blank-project palette for non-ooze assets, with the slime palette limited to the ooze demo template.
- Sparse cell storage where transparent cells are omitted.
- Manual paint and erase tools.
- Browser-local configurable paint/erase shortcut keys.
- Click and drag painting.
- Layer panel with add, delete, reorder, select, rename, visibility, PNG export inclusion, lock/editable, opacity, normal/multiply/screen blend mode controls, and simple art/guide/shadow/highlight presets.
- Frame timeline with add, duplicate, delete, selected-frame metadata, notes/tags, and at-least-one-frame safety.
- Animation selector with add, duplicate, rename, reorder, and delete controls.
- Snapshot undo/redo for painting, accepted patches, and frame/asset operations.
- Animation preview with adjustable FPS and crisp nearest-neighbor rendering.
- Basic previous-frame onion skin.
- Palette editing for adding colors, reordering colors, editing selected-color name/hex, and deleting unused colors.
- Keyboard shortcuts plus a searchable command palette from the editor header or `Ctrl+K`.
- Patch Assistant with Mock provider and experimental Ollama provider.
- Proposed patch JSON preview before apply.
- Proposed patch diff summary with per-operation include/exclude and removal.
- Validation errors for bad patches.
- Export project JSON.
- Import project JSON with strong validation before replacing the current project.
- Home/start screen with New Project, templates, import, and current project entry.
- Templates for blank 32x32, blank 64x64, icon 32x32, UI button 64x24, and the ooze 32x32 demo.
- Project identity with asset type and optional description.
- Export current frame PNG.
- Export current animation as a horizontal spritesheet PNG.
- Export animation metadata JSON matched to the spritesheet layout.
- Export scale control for PNG and metadata outputs.
- Pure spritesheet layout planning for deterministic dimensions and frame regions.
- Pure RGBA export rendering for pixel-level export tests.
- Vitest coverage for pure data and patch functions.

## Current App Flow

1. Start on the SpriteWrite home screen.
2. Choose New Project, New From Template, Import Project JSON, or Open Current Project.
3. Enter the editor with a valid project.
4. Pick the current animation, frame, and layer.
5. Open Commands or press `Ctrl+K` if you are not sure what action to take.
6. Pick paint or erase.
7. Pick a palette color.
8. Paint cells on the grid.
9. Add or duplicate frames.
10. Use onion skin to compare against the previous frame.
11. Preview the animation.
12. Ask the Patch Assistant for a Mock or experimental Ollama patch.
13. Inspect the proposed patch JSON and grid overlay.
14. Exclude or remove unwanted patch operations if needed.
15. Apply or reject the patch.
16. Undo or redo as needed.
17. Export project JSON, PNG frames, PNG spritesheets, or metadata JSON.

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
- `Export Animation Spritesheet PNG` renders the current animation in one horizontal row.
- `Export Animation Metadata JSON` saves the exact spritesheet layout: frame size, sheet size, frame regions, FPS, frame names, notes, tags, anchor, hitbox, scale, margin, and spacing.

PNG exports are generated from SpriteWrite grid data through a tested RGBA buffer, then copied into browser canvas/ImageData for PNG encoding. The canvas is an export target, not the source of truth. Exports use transparent RGBA output, no smoothing, no grid lines, no checkerboard, no onion skin, and no selection or patch-preview overlays. A layer must be both visible and marked for PNG export to appear in exported PNGs. Normal, multiply, and screen blend modes are applied during raster export.

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

## Patch Assistant

The Patch Assistant is the first AI-shaped workflow, but it does not require AI.

- `Mock` is the default provider and returns deterministic local patch operations.
- `Ollama experimental` can call a local Ollama server and expects JSON patch operations only.
- Proposed patches are shown as JSON and previewed on the grid.
- Patches never apply automatically.
- Bad provider output is expected and should be caught by validation.

## Future Ollama Plan

Ollama is the likely first real local AI provider. In SpriteWrite, Ollama should be treated only as a patch proposal provider.

It should receive selected project, frame, layer, palette, current cells, onion context, instruction, and constraints. It should return JSON patch operations only: no image files, no base64, no markdown, no prose as the primary output, and no full regenerated sprite sheet.

The current Ollama provider is intentionally experimental. The editor foundation matters more than provider cleverness.

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
- Patch diff supports summary, per-operation include/exclude, and removal, but not side-by-side preview or operation grouping yet.
- Paint/erase shortcut keys are persisted as browser-local preferences; non-tool shortcuts are fixed.
- No layer folders, silhouette locks, anchor locks, or engine-specific export yet.
- Ollama support is experimental and will fail gracefully if Ollama is not running or returns invalid output.

## Future Notes

Do not implement these until the core editor earns it:

- Real Ollama patch generation improvements.
- Patch diff visualization.
- Palette extraction.
- Silhouette locks.
- Anchor locks.
- Bounding box locks.
- Animation intent layers.
- Godot metadata export.
- Unity metadata export.
- Tilesets.
- Tokens and icons for LoreKeeper.
- Ooze-specific animation templates.
- Cuddler integration.
- OllamaSaddle provider bridge.
