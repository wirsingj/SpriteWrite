# State Of SpriteWrite

Last updated: 2026-07-18

## What SpriteWrite Is

SpriteWrite is a local-first, AI-assisted pixel asset studio. It is built to help small software and game projects survive the visual asset stage by making static and animated pixel assets editable as explicit project data instead of opaque generated images.

The canonical asset format is a `SpriteProject`: canvas dimensions, palette IDs, animations, frames, layers, anchors, optional hitboxes, export metadata, and validated JSON patch operations.

Declared human direction: SpriteWrite is not an OozeTactics-specific or Godot-specific utility. OozeTactics is the first serious consumer and proving ground, not the product boundary. Godot may become an export profile, but the internal model stays engine-neutral.

SpriteWrite should support animated characters and creatures, static props, tiles and walls, terrain and backgrounds, visual effects, icons and UI assets, animation strips, and complete sprite sheets. Avoid treating "32-bit" or other "N-bit" wording as an internal technical assumption; model concrete properties such as canvas dimensions, cell dimensions, palette constraints, export scale, animation structure, and export profile.

## What SpriteWrite Is Not

SpriteWrite is not an AI image generator. It does not ask a model to produce a finished sprite sheet as the asset source, does not accept base64 image blobs as the asset source, and does not treat canvas rendering as state.

The app has no backend, database, auth, cloud sync, paid provider API, Cuddler dependency, or OllamaSaddle dependency.

## Current Implemented Features

- Vite, React, TypeScript, plain CSS, and Vitest.
- A hero 32x32 sprite sheet demo with Idle, Jump, Crouch, and Sword Stab rows.
- A minimal 32x32 ooze reference template.
- A neutral blank-project palette for non-ooze assets, with slime colors scoped to the ooze reference template.
- Sparse layer cell maps where transparent cells are omitted.
- Layer panel with add, delete, reorder, select, rename, visibility, export inclusion, lock/editable, opacity, blend mode controls, and simple layer export presets.
- Data model support for multiple layers.
- Manual paint and erase tools.
- Click and drag painting.
- Top atlas strip with frame add, duplicate, delete, selection, and sheet order controls.
- Pure frame reorder helper for changing animation frame order without mutating the original project.
- Selected-frame name, duration, notes, tags, anchor, and optional hitbox editing.
- Animation selector with add, duplicate, rename, reorder, and delete actions.
- Safety against deleting the last frame.
- Snapshot undo/redo for paint, erase, accepted patches, and frame operations.
- Animation preview with adjustable FPS.
- Canvas-first editor shell: compact app header, left drawing/tool dock, Palette/Layers dock tabs, large central canvas, bottom attached atlas/filmstrip, and right preview/context inspector.
- Draggable bottom atlas height and right preview/inspector width handles.
- Preview panel can switch from checkerboard transparency view to a display-only solid background color; exports remain transparent according to export settings.
- Focused export menu in the header for Project JSON, current frame PNG, current animation strip PNG, full sprite sheet PNG, full sprite sheet PNG plus metadata JSON, and export-plan settings.
- Collapsed AI Assist surface for Mock/Ollama structured edit proposals against editable grid data.
- SpriteWrite prompt-intent padding converts plain user requests into constrained provider jobs: selected-frame edit, single-frame draft, 3-6 frame animation draft, or multi-row animation variation set.
- Ollama broad animation prompts can request a first-pass structured animation draft made of editable frame operation arrays.
- Ollama recipe prompts can request compact structured parameters for observed stable families: rotating coin, grass tile variation sets, character/hero idle, and tentacle creature variation sets. SpriteWrite expands those recipes into validated editable cell patches; Ollama still does not return opaque raster images.
- Provider status messages can expand into details for Ollama/provider diagnostics, including padded prompt context, model/base URL, validation errors, and attempted edit/draft JSON when available.
- Ollama animation-draft prompts explicitly forbid rectangle-style `width`/`height` operation fields and tiny marker patches; strict validation still rejects bad model output rather than silently accepting it.
- Ollama generate requests use deterministic temperature 0 and `think: false`. Selected-frame edit requests use JSON Schema structured output. Animation drafts use lighter JSON mode plus SpriteWrite validation because strict multi-frame operation-array schemas can stall local qwen models. Empty `{}` animation responses are reported as schema-ignored/thinking-mode output.
- Invalid selected-frame edit proposals no longer draw canvas overlays until validation passes.
- Vision-oriented Ollama model names such as `llava` show a suitability warning because strict JSON patch/draft generation usually works better with text/instruction or code-style models.
- AI Assist defaults to Ollama local. In the real browser app, SpriteWrite auto-refreshes local Ollama models once on startup; manual model refresh remains available.
- Main Ollama controls for base URL, local model refresh, installed-model selection, manual model-name input for custom/download names, model download/pull, and visible request status. Model refresh prefers a non-vision model when Ollama reports capabilities or `details.families` includes vision-oriented markers such as `clip`.
- Atlas overview that shows animation/static rows as a bottom filmstrip attached to the detailed cell editor.
- Atlas row frame controls support click selection, shift-click range selection, ctrl/cmd-click toggle selection, drag reorder within a row, selected-frame duplication, selected-frame deletion while preserving at least one frame, and selected-frame duration/notes/tags editing.
- Center workspace can switch between detailed frame editing and a full sprite sheet view that shows animation rows, transparent trailing cells for short rows, and lets a user click a real frame to return to editing. The view order matches full sprite sheet PNG export.
- Permanent four-step onboarding banner was removed from the editor; current workflow hierarchy is expressed through layout rather than instructional cards.
- Previous-frame onion skin as visual guidance only.
- Keyboard shortcuts for paint, erase, frame navigation, undo, redo, and preview play/pause.
- Discoverable command palette opened from the editor header or `Ctrl+K`.
- Current-frame layer panel with layer selection, editing controls, visibility toggles, and PNG export inclusion toggles.
- AI Assistant with Mock provider and experimental Ollama provider.
- AI Assistant is presented as optional structured edit help so it does not compete with the manual static/animation/export workflow.
- Proposed edit JSON preview.
- Side-by-side current/proposed edit preview.
- Highlighted changed-cell markers in current/proposed edit preview.
- Proposed edit diff summary with set/clear counts, active operation count, changed-cell count, affected bounds, operation groups, and operation list.
- Per-operation removal from proposed edits before apply.
- Per-operation include/exclude toggles so only active edit operations preview and apply.
- Edit validation error display.
- Accept/reject edit workflow.
- Project JSON export/import.
- Unsaved editable-change indicator plus browser/project-replacement warnings.
- Browser-local draft autosave for convenience recovery.
- Strong project JSON import validation through `validateProject()`.
- Current frame PNG export.
- Current animation strip PNG export.
- Full sprite sheet PNG export with one animation per row, one frame per column, max frame count as column count, and transparent padding cells after shorter animations.
- Full sprite sheet metadata JSON export bundled with the full sheet PNG.
- Export scale, margin, and spacing controls for animation strips, full sprite sheets, and metadata JSON; scale also applies to frame PNG.
- Pure animation-strip layout planning through `createSpriteSheetLayout()` and pure full-sheet layout planning through `createFullSpriteSheetLayout()`.
- Pure RGBA export rendering through `renderFrameToRgbaBuffer()` and `renderAnimationToRgbaBuffer()`.
- Start/home screen and editor screen app modes.
- Project templates for blank 32x32, blank 64x64, icon 32x32, UI button 64x24, hero 32x32 sprite sheet demo, and ooze 32x32 reference.
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

Formal new-project asset categories are broad and engine-neutral: character, creature, tile, environment, prop, object, background, effect, UI, icon, and custom. Legacy early-prototype values such as generic, ooze, button, enemy, and parallax remain valid for imported Project JSON, but should not steer new product language.

## Current App Flow

The app starts on a home screen with New Project, New From Template, Import Project JSON, Open Current Project, and a recent-projects placeholder. The editor now uses a professional creative-tool hierarchy: compact app header, left drawing dock, central canvas, bottom frame/animation filmstrip, and right preview/context inspector. The center workspace can show either the detailed cell editor for one frame or a full sprite sheet view for pulling back across rows. The primary static-or-animated asset loop is: draw or request an edit, paint on the canvas, inspect sheet rows in the bottom filmstrip, click a row/frame, optionally multi-select, duplicate/delete selected frames, batch-edit selected frame duration/notes/tags, drag-reorder frames within an atlas row, switch between full-sheet and frame-edit views, preview, export. React state owns the current `SpriteProject`, app mode, workspace mode, selected dock tab, selected inspector tab, selected animation, selected frame, selected atlas-frame selection, selected layer, selected tool, selected color, preview state, undo/redo stacks, and any proposed patch.

New projects are created from `SpriteProjectTemplate` entries in `src/domain/projectTemplates.ts`. Blank, icon, and UI button templates use a neutral palette; the hero demo uses a character palette and four animation rows; the ooze palette belongs only to the ooze reference template. Successful template creation, valid import, and demo opening replace the current project, reset undo/redo history, and enter the editor screen intentionally.

Manual paint and erase operations are converted to `PixelPatchOperation[]` and applied through `applyPatch()`. User-facing edit proposals from providers are validated and previewed before they can be applied.

Rendering, preview, and PNG export are derived from project data through `composeFramePixels()` and browser canvas utilities. They are not source of truth.

## Current Provider And AI Assist State

The provider contract lives in `src/providers/aiPatchProvider.ts`.

Implemented providers:

- `MockPatchProvider`: deterministic local patch generator. Works now.
- `OllamaPatchProvider`: experimental local HTTP provider. It can request selected-frame edit JSON or a structured animation draft object with frame operation arrays. It may fail if Ollama is unavailable or returns bad JSON.

AI Assist state:

- User instruction text.
- Provider selector.
- Main Ask panel model controls for startup auto-refresh of `/api/tags`, manual refresh, pulling/downloading a model through `/api/pull`, and asking `/api/generate`.
- Plain prompts are padded by SpriteWrite before provider calls. Small edit prompts route to selected-frame edit JSON; static whole-asset prompts such as "gold coin" route to a larger single-frame draft budget; multi-frame or animation prompts route to animation-draft JSON or a recipe rail when a stable recipe family is known.
- Broad prompts such as "hero idle" or a character idle animation route to structured animation drafting instead of selected-frame edit JSON.
- Multi-variation prompts such as "short grass waving, 3 frames, 4 variations" or "tentacle monster, 3 variations" can return multiple animation rows. SpriteWrite replaces the selected row with the first returned animation and appends additional returned rows after validation.
- Animation drafts are validated frame-by-frame and rejected before mutation if cells are invalid, out of bounds, use unknown colors, or look too scattered.
- Vision-oriented Ollama models are not blocked, but the UI warns that they may be a poor fit for strict JSON editing. When model capabilities or Ollama details are available, refresh avoids auto-selecting a vision model if a non-vision model is available.
- Selected-frame Ollama edit parsing accepts raw arrays, `patch`, `operations`, `ops`, `patchOperations`, `patch_operations`, and single-operation objects. Wrong JSON shapes now produce more specific status errors instead of vague provider-contract messages.
- Mock generation button.
- Ollama generation/test controls.
- JSON preview.
- Current/proposed frame preview derived from project data and the active edit.
- Changed-cell highlights over current/proposed edit preview.
- Diff summary and operation list.
- Changed-cell count and affected bounds summary.
- Operation grouping by color/clear.
- Include/exclude toggles for proposed operations.
- Validation errors.
- Apply and reject buttons.

Edits and drafts do not apply automatically.

Intended AI assistance should expand through focused reviewable operations rather than opaque image generation: first-frame drafts from structured descriptions, derived frames, in-betweens, pose changes that preserve identity and palette, follow-through, controlled variants, silhouette cleanup, palette suggestions, animation structure/frame-count suggestions, selected-cell or selected-layer edits, and frame-continuity evaluation.

## Current Export And Import State

Implemented:

- Full project JSON export.
- Strong project JSON import.
- Current frame PNG export.
- Current animation strip PNG export in one horizontal row.
- Full sprite sheet PNG export as a fixed row-per-animation grid.
- Full sprite sheet metadata JSON bundled with the full sheet PNG.
- Export contract documentation in `docs/EXPORT_CONTRACT.md`.
- Deterministic sprite sheet layout planning in `src/domain/exportPlanning.ts`.
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
- Animation strip frame order matches selected animation frame order.
- Full sprite sheet row order matches project animation order; column order matches each animation's frame order; short-row padding remains transparent.

Current full sprite sheet metadata includes `formatName`, `formatVersion`, image filename, project identity, source frame size, exported frame size, sheet size, row/column counts, orientation, scale, margin, spacing, animation ordering, row indices, frame counts, FPS, loop behavior, frame names, columns, per-frame x/y/width/height, durations, anchors, tags, hitboxes when present, and a boring grid/import hint block for engine/custom importer workflows.

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
- locked layer patch rejection
- `validateProject()` import validation
- invalid project shape rejection
- project template creation
- blank 32x32 and blank 64x64 template dimensions
- neutral non-ooze palettes on blank/icon/UI button templates
- hero sprite sheet demo template with Idle, Jump, Crouch, and Sword Stab rows
- ooze reference template animation/frame data
- template projects passing `validateProject()`
- asset identity appearing in export metadata
- invalid palette, animation, frame, layer, cell, anchor, and hitbox rejection
- invalid frame tags rejection
- exported project JSON roundtrip validation
- `createSpriteSheetLayout()` export planning
- animation-strip dimensions, frame regions, scale, margin, spacing, metadata, anchors, and hitboxes
- full sprite sheet dimensions, row/column frame regions, transparent padding, scale, margin, spacing, metadata coordinates, deterministic ordering, anchors, tags, and hitboxes
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
- animation-strip region pixels, margins, spacing, frame order, and metadata/layout agreement
- full sprite sheet region pixels, transparent short-row padding, and metadata/layout agreement
- canvas export wrapper copying RGBA buffers into ImageData with smoothing disabled
- canvas `toBlob` PNG export wrapper behavior
- `applyPatch()` set/clear behavior
- original project immutability during patch apply
- rejection of extra fields such as dimension changes
- export metadata generation
- browser download helper behavior for text and blob exports
- app shell start screen rendering
- start/editor purpose copy for the static and animated pixel asset workflow
- canvas-first editor layout smoke coverage through app tests and browser inspection
- atlas overview row/frame selection smoke coverage
- atlas overview modifier multi-select smoke coverage
- atlas overview drag reorder smoke coverage with exported Project JSON frame-order assertion
- atlas overview selected-frame duplicate/delete smoke coverage with exported Project JSON assertions
- atlas overview selected-frame duration edit smoke coverage with exported Project JSON assertions
- atlas overview selected-frame notes/tags edit smoke coverage with exported Project JSON assertions
- full sprite sheet workspace toggle smoke coverage
- app shell home/current-project return flow smoke test
- unsaved page-unload warning smoke test
- dirty-project replacement cancel smoke test
- browser draft restore smoke test
- blank 64x64 project creation from the UI
- hero sprite sheet demo entry from the UI
- valid Project JSON import from the UI
- invalid Project JSON import rejection without replacing the current project
- Project JSON export UI smoke test with dirty-indicator reset
- exported Project JSON UI re-import smoke test
- full sprite sheet metadata JSON export UI smoke test
- current frame PNG export UI smoke test through the canvas wrapper
- current animation strip PNG export UI smoke test through the canvas wrapper
- full sprite sheet PNG export UI smoke test through the canvas wrapper
- full sprite sheet PNG plus metadata JSON export UI smoke test
- paint/erase keyboard shortcut smoke test
- old shortcut settings panel absence smoke test
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
- proposed patch-operation removal before apply smoke test
- all-excluded proposed patch apply guard smoke test
- provider-failure stale proposal clearing smoke test
- patch changed-cell/bounds summary smoke coverage
- patch operation grouping smoke coverage
- patch current/proposed preview smoke coverage
- patch preview changed-cell highlight smoke coverage
- Ollama local model list/download tests with stubbed fetch, including Ollama `details.families` vision capability derivation
- main Ask panel Ollama refresh/download/generate smoke coverage
- Ollama connection success/failure tests with stubbed fetch
- Ollama patch request failure test with stubbed fetch
- Ollama patch request success test with stubbed fetch and prompt/body assertions
- SpriteWrite prompt-intent tests for animation prompt padding, single-frame draft padding, selected-frame edit routing, and frame-count inference
- Ollama selected-frame response-shape tests for common patch wrapper aliases and animation-draft/wrong-shape errors
- Ollama request-body tests for JSON Schema selected-frame patch calls, JSON-mode animation draft calls, `think: false`, and empty-object animation draft errors
- live Ollama integration coverage that calls local `qwen3:14b` when Ollama and that model are available; current live checks cover coin, grass variation sets, hero idle/cape, and tentacle creature variations
- Ollama animation-draft parsing/provider tests with stubbed fetch
- Ollama recipe expansion tests for rotating coin, grass variation sets, character idle, and tentacle creature variation sets
- prompt-intent tests for terse creative requests such as "hero idle" and "tentacle monster, 3 variations"
- app smoke test for broad Ollama character animation draft creating editable frames
- app smoke test proving a plain "4-6 frame gold coin spinning animation" request is padded into a 6-frame animation draft before Ollama sees it
- app smoke test proving a grass variation recipe creates multiple editable animation rows and switches to the full sprite sheet view
- app smoke test proving a tentacle variation recipe creates connected editable animation rows and switches to the full sprite sheet view
- app smoke tests for expandable provider details on invalid selected-frame edits and rejected animation drafts
- app smoke test proving invalid selected-frame Ollama edits do not render canvas proposal overlays
- app smoke test proving the AI provider defaults to local Ollama
- app smoke test for warning when a vision-oriented Ollama model is selected

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
- Edit diff summary supports per-operation removal, include/exclude toggles, changed-cell count, affected bounds, operation grouping, side-by-side current/proposed preview, and changed-cell highlight overlays.
- No project schema migration system.
- Palette editing supports add, reorder, selected color name/hex updates, and unused-color delete, but not palette extraction yet.
- Multi-animation UI supports add, switch, duplicate, rename, reorder, and delete; animation-specific templates remain future work.
- Atlas rows support first-pass frame selection, drag reorder, selected-frame duplicate/delete actions, selected-frame duration/notes/tags editing, and a full-sheet pullback view, but row-level affordances still need more polish.
- The refactored editor is calmer and more canvas-first, but tool icons, contextual inspector depth, and timeline interaction polish remain first-class UX work.
- Keyboard shortcuts are fixed for paint, erase, frame navigation, preview, undo/redo, and command palette.
- The command palette is discoverable and searchable, but it does not yet support user-defined shortcuts or command grouping.
- No engine-specific Godot or Unity export profiles yet; the current source format and metadata remain engine-neutral.
- No PNG binary/golden tests yet; pixel-level buffer tests cover the export source before PNG encoding, and jsdom tests cover the canvas wrapper.
- Export UI exposes scale, margin, and spacing for current animation strips and full sprite sheets.
- Static assets are currently represented as one-frame frame sequences inside the same project model, then exported through Current Frame PNG or one-frame sheet/metadata if needed.
- Ollama integration is experimental and not the center of the product. SpriteWrite now defaults the visible provider to Ollama local, auto-refreshes local models on real browser startup, and pads plain prompts into selected-frame edit, single-frame draft, or animation-draft requests. Draft quality depends heavily on local model capability and strict validation may reject rough model output. Small models may return too-sparse marker edits or unsupported rectangle fields despite the prompt. Qwen-style thinking models may return `{}` unless `think: false` is set, and aborted long requests can leave Ollama busy until the model finishes or is unloaded. Vision-oriented models such as `llava` are especially risky for strict JSON output.

## Next Best Development Steps

1. Improve creative-tool affordances: clearer tool icons, tighter filmstrip interactions, better contextual inspector grouping, and stronger structured draft flows for Mock/Ollama.
2. Add asset recipes beyond hero/ooze: tiles, props, backgrounds, effects, and UI/icon assets with editable defaults.
3. Add PNG binary smoke tests or real browser-level export/download checks.
4. Expand the layer panel with layer folders while preserving the patch pipeline.
5. Revisit shortcut customization only if the workflow clearly needs it; the old persistent shortcut settings panel was removed from the left dock because it cluttered normal drawing.
