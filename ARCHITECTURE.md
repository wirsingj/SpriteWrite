---
yaiml: 0.2
role: architecture
title: Architecture
purpose: Durable system shape, boundaries, data flow, invariants, and danger zones.
belongs-here: components, boundaries, canonical data model, invariants, current and intended architecture, known violations, retired approaches.
not-here: volatile roadmap, command reference, complete feature history.
durability: stable; update when system shape or invariants change.
budget: About 1500 words; a working target for durable system shape, subject to evidence needs.
read-with: SOT; Maintainer Guide; docs/PRODUCT_VISION.md; docs/APP_FLOW.md; docs/EXPORT_CONTRACT.md; docs/AI_PATCH_DOCTRINE.md.
update-when: core data model, module boundaries, export pipeline, provider architecture, or architectural constraints change.
last-verified: not established; claims not rechecked in this refresh.
agent-guidance: Prefer existing patterns. Keep project data canonical. Do not introduce hidden state, opaque raster sources, or unnecessary infrastructure.
---

# Architecture

## Stack

- Vite application.
- React UI coordinated by `src/App.tsx` with stable editor/start-screen surfaces extracted into `src/components/`.
- Local Node automation API in `api/server.ts` for localhost clients that need SpriteWrite-generated editable assets and exports.
- TypeScript domain and provider code.
- Plain CSS in `src/App.css` and `src/index.css`.
- Vitest tests colocated near source files.

No database, auth, cloud sync, Electron packaging, or external UI framework is part of the current architecture. The only server-side piece is a localhost Node automation API for local tools and Codex clients.

## Source Of Truth

The canonical asset object is `SpriteProject` in `src/domain/spriteTypes.ts`.

Key model concepts:

- Canvas dimensions.
- Fixed palette of `PaletteColor` IDs.
- Optional broad asset type such as character, creature, tile, environment, prop, object, background, effect, UI, icon, or custom.
- Animations with ordered frame IDs.
- Frames with duration, anchor, optional hitbox, and layers. Layers may carry an optional group/folder label, but render and patch order remains the flat layer order.
- Layers with sparse `"x,y": "colorId"` cell maps.
- Transparent cells are omitted from layer cell maps.
- Patch operations are explicit `set` and `clear` cell edits.

Canvas, preview thumbnails, onion skin, checkerboards, grid lines, selection state, and PNG output are derived views.

The model is engine-neutral. OozeTactics and Godot can consume exported artifacts, but neither one defines the internal project format. Asset recipes/templates may provide canvas size, palette, layers, frame counts, timing, anchors, export defaults, and AI guidance, but those values are editable project data rather than locked engine assumptions.

## Module Boundaries

- `src/domain/spriteTypes.ts`: core TypeScript types.
- `src/domain/assetTypes.ts`: shared asset-type labels and options for app/template UI.
- `src/domain/spriteData.ts`: project creation, validation, patch validation/apply, and pure project transformations.
- `src/domain/projectTemplates.ts`: template definitions for new projects.
- `src/domain/oozeMeleeRecipe.ts`: first game-automation recipe for editable ooze melee attack assets.
- `src/domain/rendering.ts`: preview composition from project data.
- `src/domain/exportPlanning.ts`: deterministic sprite sheet layout and metadata planning.
- `src/domain/exportRaster.ts`: pure RGBA export rendering.
- `src/providers/*`: AI patch provider contracts and implementations, including model-discovery normalization and de-duplication before exposing installed models in the UI.
- `src/utils/canvasExport.ts`: browser canvas helpers plus PNG blob export wrappers around the tested RGBA export buffer.
- `src/utils/pngExport.ts`: small deterministic RGBA-to-PNG encoder used by PNG exports.
- `src/utils/download.ts`: browser download helpers.
- `src/components/*`: extracted React UI surfaces such as the start screen, command palette, color picker, atlas timeline, full-sheet workspace, mini sprite thumbnail, and provider-details disclosure.
- `src/App.tsx`: app orchestration, editor state, project mutations, provider workflow, export actions, browser draft state, and composition of extracted UI components.
- `api/server.ts`: localhost-only automation bridge for template/project and recipe-generated asset bundles. It writes explicit Project JSON, metadata JSON, and PNG exports from canonical `SpriteProject` data.

## Data Flow

Manual paint and erase:

```text
UI action -> PixelPatchOperation[] -> validatePatch() -> applyPatch() -> SpriteProject
```

AI Assist selected-frame edit:

```text
instruction + project context -> provider -> PixelPatchOperation[] -> validate -> canvas preview -> apply or reject
```

The UI should present this flow as AI Assist, edits, and drafts. "Patch" remains an internal JSON operation and validation term, not the primary product language.

Prompt intent padding:

```text
plain user request + output/view context -> SpriteWrite prompt intent -> selected-frame edit, single-frame draft, animation draft, or animation-set provider rail
```

SpriteWrite, not the user, is responsible for padding natural requests into constrained provider instructions with canvas dimensions, palette IDs, frame-count expectations, output-shape rules, and optional view assumptions. Current UI-owned prompt context can bias a request toward a static frame/tile, animated row, side-scroller side view, top-down view, or 2.5D/three-quarter view. This is prompt state, not a permanent project or export constraint.

Broad animation draft:

```text
whole-asset instruction + project context -> provider -> frame patch arrays -> validate/coherence check -> reuse empty selected row or append new row -> stage for apply/reject
```

Recipe-based animation draft:

```text
whole-asset instruction + project context -> provider -> compact recipe parameters -> deterministic SpriteWrite expansion -> frame patch arrays -> validate/coherence check -> reuse empty selected row or append new rows -> stage for apply/reject
```

Recipe expansion is still structured editing. The provider supplies bounded JSON parameters such as grass blades, character idle motion hints, or tentacle creature variation parameters. SpriteWrite derives ordinary `PixelPatchOperation[]` from those parameters and never treats the recipe or any generated canvas as source of truth.

Direct animation drafts may include `paletteAdditions`. SpriteWrite validates and merges those colors before validating frame operations. This lets the provider intuit asset-specific palettes while keeping palette state explicit in `SpriteProject`.

Broad asset drafts are additive once a selected animation row contains art. SpriteWrite may reuse the selected row as a blank starter slot, or replace it when the instruction clearly asks to replace/update the current row, but follow-up asset requests such as creating grass after a coin should append new animation rows instead of overwriting existing generated assets.

Future AI operations should use the same principle: a provider may suggest editable frame grids, palette changes, duplicated-and-modified frames, or explicit layer operations, but the app must validate and present them for user acceptance before mutation.

PNG export:

```text
SpriteProject -> createSpriteSheetLayout() or createFullSpriteSheetLayout() -> render*ToRgbaBuffer() -> PNG encoder -> PNG blob
```

Project save:

```text
SpriteProject -> Project JSON export
```

Local automation API recipe export:

```text
game/Codex client -> localhost SpriteWrite API -> SpriteProject recipe -> validation -> PNG/metadata/project files
```

## Invariants

- Project data is canon.
- Transparent cells are omitted; do not store fake transparent color cells.
- Patch operations cannot resize canvas or introduce unsupported fields.
- Patch validation must reject out-of-bounds cells, unknown colors, malformed operations, missing animations/frames/layers, and locked layer edits.
- Exported PNGs must not contain editor grid, checkerboard, onion skin, selection, or patch-preview overlays.
- Only layers that are both visible and exportable should render into PNG output.
- Export metadata must match the actual sprite sheet layout, including flat layer order and optional layer group labels.
- Animation Strip export is one selected animation in a horizontal row.
- Full Sprite Sheet export is a fixed row/column grid: one animation per row, one frame per column, transparent padding after shorter animations. It is not a Packed Atlas.
- Export profiles should be generic first. Godot, Unity, or custom importer profiles can layer on top of the boring PNG/JSON contract later.
- Provider failures and invalid provider output must not break the app.

## Provider Architecture

`AiPatchProvider` is the seam for selected-frame patch proposal providers. The Mock provider is deterministic and local, but currently retained as an internal/test fixture rather than a visible creative provider. The Ollama provider is experimental and may also expose structured animation-draft and animation-set methods. Provider rails return JSON cell operations or compact recipe JSON that SpriteWrite expands into JSON cell operations.

`src/providers/spriteWritePromptIntent.ts` is the small interpretation layer between plain user prompts and provider calls. It currently classifies prompts as selected-frame edits, single-frame drafts, 3-6 frame animation drafts, or multi-variation animation sets, then pads the instruction with SpriteWrite constraints before Ollama sees it. Users should not need to manually write provider-contract prompts.

Current recipe-shaped Ollama rails cover a few observed qwen-stable structural families: grass wave/tile variation sets, character/hero idle, tentacle creature variation sets, and a generic spinning-object fallback for compact rotating icon/object drafts when direct draft attempts fail. Asset-specific requests such as rotating gold coins should use direct animation draft JSON with optional palette additions first rather than starting from SpriteWrite-owned art generators.

Future rails may add structured palette or layer operations, but must remain reviewable, reversible, and derived into `SpriteProject` data before export.

Do not import or depend on Cuddler or OllamaSaddle. Future integrations should hand SpriteWrite structured patch requests/results, not image prompts or opaque raster blobs.

## Danger Zones

- Treating canvas, a screenshot, or generated PNG as source of truth.
- Letting provider output mutate project data before validation and user acceptance.
- Adding persistence/cloud/backend infrastructure before the local project/export workflow is stable.
- Changing `SpriteProject` shape without updating validation, templates, exports, metadata, tests, and docs.
- Confusing editor visibility with export inclusion.
- Overwriting uncommitted work; this repo currently appears to be work in progress.
