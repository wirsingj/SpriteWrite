---
yaiml: 0.2
role: architecture
title: Architecture
purpose: Durable system shape, boundaries, data flow, invariants, and danger zones.
belongs-here: components, boundaries, canonical data model, invariants, current and intended architecture, known violations, retired approaches.
not-here: volatile roadmap, command reference, complete feature history.
durability: stable; update when system shape or invariants change.
read-with: SOT; Maintainer Guide; docs/APP_FLOW.md; docs/EXPORT_CONTRACT.md; docs/AI_PATCH_DOCTRINE.md.
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
- Animations with ordered frame IDs.
- Frames with duration, anchor, optional hitbox, and layers.
- Layers with sparse `"x,y": "colorId"` cell maps.
- Transparent cells are omitted from layer cell maps.
- Patch operations are explicit `set` and `clear` cell edits.

Canvas, preview thumbnails, onion skin, checkerboards, grid lines, selection state, and PNG output are derived views.

## Module Boundaries

- `src/domain/spriteTypes.ts`: core TypeScript types.
- `src/domain/spriteData.ts`: project creation, validation, patch validation/apply, and pure project transformations.
- `src/domain/projectTemplates.ts`: template definitions for new projects.
- `src/domain/rendering.ts`: preview composition from project data.
- `src/domain/exportPlanning.ts`: deterministic spritesheet layout and metadata planning.
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

Patch Assistant:

```text
instruction + project context -> provider -> PixelPatchOperation[] -> validate -> preview -> include/exclude/remove -> apply or reject
```

PNG export:

```text
SpriteProject -> createSpriteSheetLayout() -> render*ToRgbaBuffer() -> ImageData/canvas -> PNG blob
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
- Export metadata must match the actual spritesheet layout.
- Provider failures and invalid provider output must not break the app.

## Provider Architecture

`AiPatchProvider` is the seam for patch proposal providers. The Mock provider is deterministic and local. The Ollama provider is experimental and should return JSON patch operations only.

Do not import or depend on Cuddler or OllamaSaddle. Future integrations should hand SpriteWrite structured patch requests/results, not image prompts or opaque raster blobs.

## Danger Zones

- Treating canvas, a screenshot, or generated PNG as source of truth.
- Letting provider output mutate project data before validation and user acceptance.
- Adding persistence/cloud/backend infrastructure before the local project/export workflow is stable.
- Changing `SpriteProject` shape without updating validation, templates, exports, metadata, tests, and docs.
- Confusing editor visibility with export inclusion.
- Overwriting uncommitted work; this repo currently appears to be work in progress.

