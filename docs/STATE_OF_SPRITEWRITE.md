# State Of SpriteWrite

Last updated: 2026-06-21

## What SpriteWrite Is

SpriteWrite is a local-first structured pixel asset workbench. It is built to help small software and game projects survive the visual asset stage by making sprite assets editable as explicit project data instead of opaque generated images.

The canonical asset format is a `SpriteProject`: canvas dimensions, palette IDs, animations, frames, layers, anchors, optional hitboxes, export metadata, and validated JSON patch operations.

## What SpriteWrite Is Not

SpriteWrite is not an AI image generator. It does not ask a model to produce a finished sprite sheet, does not accept base64 image blobs as the asset source, and does not treat canvas rendering as state.

The app has no backend, database, auth, cloud sync, paid provider API, Cuddler dependency, or OllamaSaddle dependency.

## Current Implemented Features

- Vite, React, TypeScript, plain CSS, and Vitest.
- A default 32x32 ooze starter project.
- A generic blank-project palette for non-ooze assets, with the slime palette scoped to the ooze demo.
- Sparse layer cell maps where transparent cells are omitted.
- Layer panel with add, delete, reorder, select, rename, visibility, export inclusion, lock/editable, opacity, blend mode controls, and simple layer export presets.
- Data model support for multiple layers.
- Manual paint and erase tools.
- Click and drag painting.
- Frame timeline with add, duplicate, and delete.
- Selected-frame name, duration, notes, tags, anchor, and optional hitbox editing.
- Animation selector with add, duplicate, rename, reorder, and delete actions.
- Safety against deleting the last frame.
- Snapshot undo/redo for paint, erase, accepted patches, and frame operations.
- Animation preview with adjustable FPS.
- Previous-frame onion skin as visual guidance only.
- Keyboard shortcuts for paint, erase, frame navigation, undo, redo, and preview play/pause.
- Configurable paint/erase shortcut keys in the editor, persisted as a browser-local preference.
- Discoverable command palette opened from the editor header or `Ctrl+K`.
- Current-frame layer panel with layer selection, editing controls, visibility toggles, and PNG export inclusion toggles.
- Patch Assistant with Mock provider and experimental Ollama provider.
- Proposed patch JSON preview.
- Side-by-side current/proposed patch preview.
- Highlighted changed-cell markers in current/proposed patch preview.
- Proposed patch diff summary with set/clear counts, active operation count, changed-cell count, affected bounds, operation groups, and operation list.
- Per-operation removal from proposed patches before apply.
- Per-operation include/exclude toggles so only active patch operations preview and apply.
- Patch validation error display.
- Accept/reject patch workflow.
- Project JSON export/import.
- Unsaved editable-change indicator plus browser/project-replacement warnings.
- Browser-local draft autosave for convenience recovery.
- Strong project JSON import validation through `validateProject()`.
- Current frame PNG export.
- Horizontal animation spritesheet PNG export.
- Spritesheet metadata JSON export.
- Export scale, margin, and spacing controls for spritesheet PNG and metadata JSON; scale also applies to frame PNG.
- Pure spritesheet layout planning through `createSpriteSheetLayout()`.
- Pure RGBA export rendering through `renderFrameToRgbaBuffer()` and `renderAnimationToRgbaBuffer()`.
- Start/home screen and editor screen app modes.
- Project templates for blank 32x32, blank 64x64, icon 32x32, UI button 64x24, and the ooze 32x32 demo.
- Project identity fields for optional description and asset type.
- Palette color add, reorder, selected-color name/hex edit, and unused-color delete.

## Current Data Model

The core types live in `src/domain/spriteTypes.ts`.

The project root is `SpriteProject`:

- `id`, `name`, `version`
- optional `description`
- optional `assetType`
- `canvas.width` and `canvas.height`
- `palette: PaletteColor[]`
- `animations: SpriteAnimation[]`
- `frames: SpriteFrame[]`
- `metadata.defaultAnimationId`
- `metadata.defaultLayerId`
- `metadata.createdAt`
- `metadata.updatedAt`
- `metadata.notes`

Frames contain layers, anchor, optional hitbox, and duration. Layers contain `cells`, stored as a sparse map:

```json
{
  "12,18": "accent"
}
```

Transparent cells are omitted. Visible cells are effectively `{ "x": 12, "y": 18, "colorId": "accent" }`.

## Current App Flow

The app starts on a home screen with New Project, New From Template, Import Project JSON, Open Current Project, and a recent-projects placeholder. React state owns the current `SpriteProject`, app mode, selected animation, selected frame, selected layer, selected tool, selected color, preview state, undo/redo stacks, and any proposed patch.

New projects are created from `SpriteProjectTemplate` entries in `src/domain/projectTemplates.ts`. Blank, icon, and button templates use a generic palette; the ooze palette belongs only to the ooze demo template. Successful template creation, valid import, and demo opening replace the current project, reset undo/redo history, and enter the editor screen intentionally.

Manual paint and erase operations are converted to `PixelPatchOperation[]` and applied through `applyPatch()`. Patch proposals from providers are validated and previewed before they can be applied.

Rendering, preview, and PNG export are derived from project data through `composeFramePixels()` and browser canvas utilities. They are not source of truth.

## Current Provider And Patch Assistant State

The provider contract lives in `src/providers/aiPatchProvider.ts`.

Implemented providers:

- `MockPatchProvider`: deterministic local patch generator. Works now.
- `OllamaPatchProvider`: experimental local HTTP provider. It sends a strict prompt to Ollama and expects JSON patch operations only. It may fail if Ollama is unavailable or returns bad JSON.

Patch Assistant state:

- User instruction text.
- Provider selector.
- Mock generation button.
- Ollama generation/test controls.
- JSON preview.
- Current/proposed frame preview derived from project data and the active patch.
- Changed-cell highlights over current/proposed patch preview.
- Diff summary and operation list.
- Changed-cell count and affected bounds summary.
- Operation grouping by color/clear.
- Include/exclude toggles for proposed operations.
- Validation errors.
- Apply and reject buttons.

Patches do not apply automatically.

## Current Export And Import State

Implemented:

- Full project JSON export.
- Strong project JSON import.
- Current frame PNG export.
- Current animation spritesheet PNG export in one horizontal row.
- Spritesheet metadata JSON export.
- Export contract documentation in `docs/EXPORT_CONTRACT.md`.
- Deterministic spritesheet layout planning in `src/domain/exportPlanning.ts`.
- Pixel-level export rendering in `src/domain/exportRaster.ts`.

PNG export uses browser canvas as an output target. Canvas output is derived from a tested RGBA buffer, which is itself derived from structured grid data.

Current PNG export guarantees:

- Transparent canvas background.
- Visible project layers only.
- Visible layers are alpha-composited in layer order, including layer opacity and normal/multiply/screen blend modes.
- No editor grid, checkerboard, onion skin, selection, or patch-preview overlays.
- No smoothing or interpolation.
- At scale 1, one project cell maps to one output pixel.
- At scale N, one project cell maps to an N by N block.
- Horizontal spritesheet frame order matches animation frame order.

Current spritesheet metadata includes `formatName`, `formatVersion`, project identity, animation identity, source frame size, exported frame size, sheet size, orientation, scale, margin, spacing, FPS, anchors, hitboxes, frame names, frame notes, frame tags, layer export status, layer blend modes, and per-frame regions.

Import validation is implemented through the pure `validateProject()` function in `src/domain/spriteData.ts`. Invalid imports do not replace the current project. Validation errors are shown in the UI. Successful imports replace the project and reset undo/redo history intentionally.

SpriteWrite does not manage a persistent project library yet. Export Project JSON is the editable save/share artifact. PNGs and metadata are production artifacts derived from the project.

`validateProject()` checks:

- Top-level project object, id, name, supported version, metadata, and timestamps.
- Canvas width and height as integers from 1 to 256.
- Non-empty palette with unique IDs, valid hex values, and exactly one transparent color.
- Non-empty animations with unique IDs, valid FPS, non-empty frame lists, and valid frame references.
- Non-empty frames with unique IDs, valid duration, anchors inside canvas bounds, optional hitboxes inside canvas bounds, and non-empty layers.
- Layers with unique IDs per frame, boolean visibility/editability, opacity from 0 to 1, normal/multiply/screen blend modes, and valid sparse cell maps.
- Cells with canonical integer `"x,y"` keys, in-bounds coordinates, palette-backed color IDs, and no transparent cell values.

Duplicate cell coordinate policy: canonical cells are a sparse object map, so exact duplicate JSON object keys cannot be detected after `JSON.parse`. SpriteWrite rejects duplicate normalized coordinates caused by non-canonical keys such as `"01,1"` colliding with `"1,1"`, and requires canonical `"x,y"` keys.

## Current Test Coverage

Current Vitest coverage lives in focused domain test files under `src/domain/`, plus app-shell smoke tests under `src/`.

Covered:

- `createDefaultProject()`
- valid `set` and `clear` patches
- out-of-bounds rejection
- unknown color ID rejection
- missing animation rejection
- missing frame rejection
- missing layer rejection
- `validateProject()` import validation
- invalid project shape rejection
- project template creation
- blank 32x32 and blank 64x64 template dimensions
- generic non-ooze palettes on blank/icon/button templates
- ooze demo template animation/frame data
- template projects passing `validateProject()`
- asset identity appearing in export metadata
- invalid palette, animation, frame, layer, cell, anchor, and hitbox rejection
- invalid frame tags rejection
- exported project JSON roundtrip validation
- `createSpriteSheetLayout()` export planning
- spritesheet dimensions, frame regions, scale, margin, spacing, metadata, anchors, and hitboxes
- RGBA color parsing
- frame buffer dimensions
- transparent cell alpha 0
- exact painted-cell RGBA values
- scale 2 cell expansion
- hidden layer exclusion
- deterministic visible-layer compositing
- alpha compositing for semi-transparent layer opacity
- multiply/screen layer blend mode raster compositing
- non-exportable visible layer exclusion from PNG output
- palette color editing validation
- spritesheet region pixels, margins, spacing, frame order, and metadata/layout agreement
- canvas export wrapper copying RGBA buffers into ImageData with smoothing disabled
- canvas `toBlob` PNG export wrapper behavior
- `applyPatch()` set/clear behavior
- original project immutability during patch apply
- rejection of extra fields such as dimension changes
- export metadata generation
- browser download helper behavior for text and blob exports
- app shell start screen rendering
- app shell home/current-project return flow smoke test
- unsaved page-unload warning smoke test
- dirty-project replacement cancel smoke test
- browser draft restore smoke test
- blank 64x64 project creation from the UI
- ooze demo entry from the UI
- valid Project JSON import from the UI
- invalid Project JSON import rejection without replacing the current project
- Project JSON export UI smoke test with dirty-indicator reset
- exported Project JSON UI re-import smoke test
- animation metadata JSON export UI smoke test
- current frame PNG export UI smoke test through the canvas wrapper
- animation spritesheet PNG export UI smoke test through the canvas wrapper
- paint/erase keyboard shortcut smoke test
- configurable paint/erase shortcut restore/reset smoke test
- shortcut typing-field guard smoke test
- arrow frame-navigation shortcut smoke test
- command palette open/filter smoke test
- command palette action execution smoke test
- frame add/duplicate/delete UI smoke test
- frame add blank-data UI smoke test
- frame duplicate copies cell-data UI smoke test
- final frame/default layer/final animation delete-disabled UI smoke test
- paint undo/redo UI smoke test
- redo-history-cleared-after-new-edit UI smoke test
- accepted patch apply undo UI smoke test
- frame add undo UI smoke test
- frame duplicate undo UI smoke test
- frame delete undo UI smoke test
- layer visibility undo UI smoke test
- palette color edit undo UI smoke test
- animation add undo UI smoke test
- frame metadata undo UI smoke test
- layer PNG export inclusion toggle UI smoke test
- layer blend mode edit UI smoke test
- layer export preset UI smoke test
- layer visibility preview/no-cell-mutation UI smoke test
- layer add/reorder/delete UI smoke test
- palette color edit UI smoke test
- palette color add/reorder/delete UI smoke test
- animation rename UI smoke test
- animation add/duplicate/delete UI smoke test
- frame name/duration/notes/tags/anchor edit/export UI smoke test
- frame hitbox metadata edit/export UI smoke test
- selective patch-operation exclude smoke test
- patch changed-cell/bounds summary smoke coverage
- patch operation grouping smoke coverage
- patch current/proposed preview smoke coverage
- patch preview changed-cell highlight smoke coverage
- Ollama connection success/failure tests with stubbed fetch
- Ollama patch request failure test with stubbed fetch
- Ollama patch request success test with stubbed fetch and prompt/body assertions

Not covered yet:

- Real browser/export download flows.
- In-app browser smoke has verified app load, generic project creation, editor grid count, and visible export controls, but blob-anchor download events were not observable through that automation surface.
- Deeper React UI workflows beyond current shell/import/editor smoke tests.
- Undo/redo edge cases beyond current paint, accepted-patch, redo-clearing, frame add/duplicate/delete, layer visibility, palette color edit, animation add, and frame metadata coverage.
- Frame edge cases beyond the current add-blank and duplicate-cell-data smoke tests.
- higher-level animation templates and intent presets

## Known Limitations

- The UI has a functional layer panel with per-layer PNG export inclusion, normal/multiply/screen blend modes, and simple art/guide/shadow/highlight presets, but no layer folders yet.
- Recent projects and project library persistence are placeholders only; browser draft autosave exists but is not a durable library.
- Unsaved-change warnings exist for page unload and project replacement, but there is no managed file library yet.
- Undo/redo is snapshot-based.
- Import duplicate-key detection is limited by JSON parsing; normalized coordinate duplicates are rejected.
- Patch diff summary supports per-operation removal, include/exclude toggles, changed-cell count, affected bounds, operation grouping, side-by-side current/proposed preview, and changed-cell highlight overlays.
- No project schema migration system.
- Palette editing supports add, reorder, selected color name/hex updates, and unused-color delete, but not palette extraction yet.
- Multi-animation UI supports add, switch, duplicate, rename, reorder, and delete; animation-specific templates remain future work.
- Paint/erase shortcut keys are configurable and persisted as browser-local preferences; frame navigation, preview, undo/redo, and command palette shortcuts are fixed.
- The command palette is discoverable and searchable, but it does not yet support user-defined shortcuts or command grouping.
- No Godot or Unity metadata export.
- No PNG binary/golden tests yet; pixel-level buffer tests cover the export source before PNG encoding, and jsdom tests cover the canvas wrapper.
- Export UI exposes scale, margin, and spacing for horizontal spritesheets.
- Ollama integration is experimental and not the center of the product.

## Next Best Development Steps

1. Add PNG binary smoke tests or real browser-level export/download checks.
2. Expand the layer panel with layer folders while preserving the patch pipeline.
3. Expand shortcut configuration beyond paint/erase if the workflow needs it.
