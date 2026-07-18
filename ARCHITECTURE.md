---
yaiml: 0.2
role: architecture
title: Architecture
purpose: Durable system shape, boundaries, data flow, invariants, and danger zones.
belongs-here: components, boundaries, canonical data model, invariants, current and intended architecture, known violations, retired approaches.
not-here: volatile roadmap, command reference, complete feature history.
durability: stable; update when system shape or invariants change.
read-with: SOT; Maintainer Guide; docs/PRODUCT_VISION.md; docs/APP_FLOW.md; docs/EXPORT_CONTRACT.md; docs/AI_PATCH_DOCTRINE.md.
update-when: core data model, module boundaries, export pipeline, provider architecture, or architectural constraints change.
agent-guidance: Prefer existing patterns. Keep project data canonical. Do not introduce hidden state, opaque raster sources, or unnecessary infrastructure.
---

# Architecture

## Stack

- Vite application.
- React UI in `src/App.tsx`.
- TypeScript domain and provider code.
- Plain CSS in `src/App.css` and `src/index.css`.
- Vitest tests colocated near source files.

No backend, database, auth, cloud sync, Electron packaging, or external UI framework is part of the current architecture.

## Source Of Truth

The canonical asset object is `SpriteProject` in `src/domain/spriteTypes.ts`.

Key model concepts:

- Canvas dimensions.
- Fixed palette of `PaletteColor` IDs.
- Optional broad asset type such as character, creature, tile, environment, prop, object, background, effect, UI, icon, or custom.
- Animations with ordered frame IDs.
- Frames with duration, anchor, optional hitbox, and layers.
- Layers with sparse `"x,y": "colorId"` cell maps.
- Transparent cells are omitted from layer cell maps.
- Patch operations are explicit `set` and `clear` cell edits.

Canvas, preview thumbnails, onion skin, checkerboards, grid lines, selection state, and PNG output are derived views.

The model is engine-neutral. OozeTactics and Godot can consume exported artifacts, but neither one defines the internal project format. Asset recipes/templates may provide canvas size, palette, layers, frame counts, timing, anchors, export defaults, and AI guidance, but those values are editable project data rather than locked engine assumptions.

## Module Boundaries

- `src/domain/spriteTypes.ts`: core TypeScript types.
- `src/domain/spriteData.ts`: project creation, validation, patch validation/apply, and pure project transformations.
- `src/domain/projectTemplates.ts`: template definitions for new projects.
- `src/domain/rendering.ts`: preview composition from project data.
- `src/domain/exportPlanning.ts`: deterministic sprite sheet layout and metadata planning.
- `src/domain/exportRaster.ts`: pure RGBA export rendering.
- `src/providers/*`: AI patch provider contracts and implementations.
- `src/utils/canvasExport.ts`: browser canvas/blob wrappers around the tested RGBA export buffer.
- `src/utils/download.ts`: browser download helpers.
- `src/App.tsx`: app shell, editor UI, user interactions, local browser draft state, and command palette.

## Data Flow

Manual paint and erase:

```text
UI action -> PixelPatchOperation[] -> validatePatch() -> applyPatch() -> SpriteProject
```

AI Assist selected-frame edit:

```text
instruction + project context -> provider -> PixelPatchOperation[] -> validate -> preview -> include/exclude/remove -> apply or reject
```

The UI should present this flow as AI Assist, edits, and drafts. "Patch" remains an internal JSON operation and validation term, not the primary product language.

Prompt intent padding:

```text
plain user request -> SpriteWrite prompt intent -> selected-frame patch, single-frame draft, animation draft, or animation-set provider rail
```

SpriteWrite, not the user, is responsible for padding natural requests into constrained provider instructions with canvas dimensions, palette IDs, frame-count expectations, and output-shape rules.

Broad animation draft:

```text
whole-asset instruction + project context -> provider -> frame patch arrays -> validate/coherence check -> replace selected animation row or reject without mutation
```

Recipe-based animation draft:

```text
whole-asset instruction + project context -> provider -> compact recipe parameters -> deterministic SpriteWrite expansion -> frame patch arrays -> validate/coherence check -> replace selected row and append additional rows or reject without mutation
```

Recipe expansion is still structured editing. The provider supplies bounded JSON parameters such as coin radii/highlight positions, grass blades, character idle motion hints, or tentacle creature variation parameters. SpriteWrite derives ordinary `PixelPatchOperation[]` from those parameters and never treats the recipe or any generated canvas as source of truth.

Future AI operations should use the same principle: a provider may suggest editable frame grids, palette changes, duplicated-and-modified frames, or explicit layer operations, but the app must validate and present them for user acceptance before mutation.

PNG export:

```text
SpriteProject -> createSpriteSheetLayout() or createFullSpriteSheetLayout() -> render*ToRgbaBuffer() -> ImageData/canvas -> PNG blob
```

Project save:

```text
SpriteProject -> Project JSON export
```

## Invariants

- Project data is canon.
- Transparent cells are omitted; do not store fake transparent color cells.
- Patch operations cannot resize canvas or introduce unsupported fields.
- Patch validation must reject out-of-bounds cells, unknown colors, malformed operations, missing animations/frames/layers, and locked layer edits.
- Exported PNGs must not contain editor grid, checkerboard, onion skin, selection, or patch-preview overlays.
- Only layers that are both visible and exportable should render into PNG output.
- Export metadata must match the actual sprite sheet layout.
- Animation Strip export is one selected animation in a horizontal row.
- Full Sprite Sheet export is a fixed row/column grid: one animation per row, one frame per column, transparent padding after shorter animations. It is not a Packed Atlas.
- Export profiles should be generic first. Godot, Unity, or custom importer profiles can layer on top of the boring PNG/JSON contract later.
- Provider failures and invalid provider output must not break the app.

## Provider Architecture

`AiPatchProvider` is the seam for selected-frame patch proposal providers. The Mock provider is deterministic and local. The Ollama provider is experimental and may also expose structured animation-draft and animation-set methods. Provider rails return JSON cell operations or compact recipe JSON that SpriteWrite expands into JSON cell operations.

`src/providers/spriteWritePromptIntent.ts` is the small interpretation layer between plain user prompts and provider calls. It currently classifies prompts as selected-frame edits, single-frame drafts, 3-6 frame animation drafts, or multi-variation animation sets, then pads the instruction with SpriteWrite constraints before Ollama sees it. Users should not need to manually write provider-contract prompts.

Current recipe-shaped Ollama rails cover a few observed qwen-stable families: rotating coin, grass wave/tile variation sets, character/hero idle, and tentacle creature variation sets. Direct animation draft JSON remains accepted when a recipe-routed model returns complete frame patch arrays instead.

Future rails may add structured palette or layer operations, but must remain reviewable, reversible, and derived into `SpriteProject` data before export.

Do not import or depend on Cuddler or OllamaSaddle. Future integrations should hand SpriteWrite structured patch requests/results, not image prompts or opaque raster blobs.

## Danger Zones

- Treating canvas, a screenshot, or generated PNG as source of truth.
- Letting provider output mutate project data before validation and user acceptance.
- Adding persistence/cloud/backend infrastructure before the local project/export workflow is stable.
- Changing `SpriteProject` shape without updating validation, templates, exports, metadata, tests, and docs.
- Confusing editor visibility with export inclusion.
- Overwriting uncommitted work; this repo currently appears to be work in progress.
