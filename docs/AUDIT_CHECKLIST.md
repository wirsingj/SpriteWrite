# Audit Checklist

Use this after each Codex pass. The goal is not ceremony; the goal is to keep SpriteWrite from drifting into a fragile demo.

## Build/Test Audit

- [ ] App builds.
- [ ] Tests pass.
- [ ] No type errors.
- [ ] Lint passes or known lint issues are documented.
- [ ] App loads without a console crash.
- [ ] App-shell smoke tests cover start screen and basic template entry.

## Data Integrity Audit

- [ ] Project JSON remains valid.
- [ ] Bad JSON does not crash the app.
- [ ] Invalid project JSON does not replace the current project.
- [ ] Invalid project JSON import is covered by a UI smoke test.
- [ ] Import validation errors are visible.
- [ ] Valid project JSON imports cleanly.
- [ ] Valid project JSON import is covered by a UI smoke test.
- [ ] Exported project JSON re-imports cleanly.
- [ ] Exported project JSON UI re-import is covered by a smoke test.
- [ ] Frame dimensions remain consistent with project canvas.
- [ ] Palette IDs in cells are valid.
- [ ] Transparent cells are represented by omission, not accidental fake colors.
- [ ] Patch validation rejects bad operations.
- [ ] Patch application clones instead of mutating the previous project.
- [ ] Undo/redo does not corrupt the project.
- [ ] Paint undo/redo is covered by a UI smoke test.
- [ ] Redo history clearing after a new edit is covered by a UI smoke test.
- [ ] Accepted patch apply undo is covered by a UI smoke test.
- [ ] Layer visibility, palette edit, animation add, and frame metadata undo are covered by UI smoke tests.

## Editor Audit

- [ ] Paint works.
- [ ] Drag paint works.
- [ ] Eraser works.
- [ ] Palette selection works.
- [ ] Palette color name/hex edits validate and update previews/exports.
- [ ] Palette color name/hex editing is covered by a UI smoke test.
- [ ] Palette colors can be added and unused colors can be deleted safely.
- [ ] Palette colors can be reordered without changing cell color IDs.
- [ ] Palette add/reorder/delete is covered by a UI smoke test.
- [ ] Frame add works.
- [ ] Frame add creates a blank frame and is covered by a UI smoke test.
- [ ] Frame add undo is covered by a UI smoke test.
- [ ] Frame duplicate works.
- [ ] Frame duplicate copies selected frame cell data and is covered by a UI smoke test.
- [ ] Frame duplicate undo is covered by a UI smoke test.
- [ ] Frame delete works.
- [ ] Frame delete undo is covered by a UI smoke test.
- [ ] Frame name, duration, notes, tags, anchor, and hitbox edits stay valid.
- [ ] Frame name, duration, notes, tags, and anchor editing are covered by a UI smoke test.
- [ ] Frame hitbox editing is covered by a UI smoke test.
- [ ] Last frame cannot be deleted.
- [ ] Final frame/default layer/final animation delete-disabled state is covered by a UI smoke test.
- [ ] Atlas rows support modifier multi-select for frames.
- [ ] Atlas row modifier multi-select is covered by a UI smoke test.
- [ ] Atlas rows support drag reorder within an animation row.
- [ ] Atlas row drag reorder is covered by a UI smoke test and exported Project JSON frame-order assertion.
- [ ] Atlas rows support selected-frame duplicate and delete actions.
- [ ] Atlas selected-frame duplicate/delete actions are covered by UI smoke tests and exported Project JSON assertions.
- [ ] Atlas rows support selected-frame duration edits.
- [ ] Atlas selected-frame duration edits are covered by UI smoke tests and exported Project JSON assertions.
- [ ] Atlas rows support selected-frame notes/tags edits.
- [ ] Atlas selected-frame notes/tags edits are covered by UI smoke tests and exported Project JSON assertions.
- [ ] Canvas is the dominant workspace on common desktop viewports.
- [ ] Atlas/frame strip stays attached below the canvas as a filmstrip, not buried in a sidebar.
- [ ] Bottom atlas/frame strip height can be resized on desktop.
- [ ] Right preview/inspector panel width can be resized on desktop.
- [ ] Preview can use a solid background color without changing exported transparency.
- [ ] Center workspace can switch between detailed frame editing and full sprite sheet view.
- [ ] Full sprite sheet view shows animation rows and lets a frame click return to editing.
- [ ] Full sprite sheet workspace switching is covered by a UI smoke test.
- [ ] Can add, switch, rename, and delete non-final animations.
- [ ] Animation rename is covered by a UI smoke test.
- [ ] Animation add/duplicate/delete is covered by a UI smoke test.
- [ ] Selected frame is obvious.
- [ ] Onion skin does not mutate data.
- [ ] Keyboard shortcuts do not fire while typing in fields.
- [ ] Keyboard shortcuts ignoring typing fields are covered by a UI smoke test.
- [ ] Fixed paint/erase shortcuts work and do not fire while typing.
- [ ] Legacy saved custom paint/erase shortcut preferences are ignored while no customization UI exists.
- [ ] Arrow shortcuts move between frames.
- [ ] Arrow frame-navigation shortcuts are covered by a UI smoke test.
- [ ] Command palette opens with `Ctrl+K`.
- [ ] Command palette filtering makes export/frame/layer/patch actions discoverable.
- [ ] Layer add/delete/reorder controls keep frames valid.
- [ ] Layer add/reorder/delete is covered by a UI smoke test.
- [ ] Layer visibility toggles affect preview without mutating cells.
- [ ] Layer visibility preview/no-cell-mutation behavior is covered by a UI smoke test.
- [ ] Layer export toggles exclude visible guide/reference layers from PNG exports.
- [ ] Layer export toggle is covered by a UI smoke test.
- [ ] Layer blend modes are explicit data, exported in metadata, and covered by raster/UI tests.
- [ ] Layer group/folder labels are explicit metadata, exported in metadata, and do not change flat render order.
- [ ] Layer export presets are covered by a UI smoke test.

## App Shell Audit

- [ ] Home/start screen loads.
- [ ] Can create a new blank 32x32 project.
- [ ] Can create a new blank 64x64 project.
- [ ] New-project asset categories are broad and engine-neutral: character, creature, tile, environment, prop, object, background, effect, UI, icon, and custom.
- [ ] Blank/icon/UI button projects use neutral palette labels, not slime labels.
- [ ] Can create/open the hero sprite sheet demo with multiple animation rows.
- [ ] Can still create the minimal ooze reference template when needed.
- [ ] Ooze examples remain demo/reference content and do not dominate the product language.
- [ ] Can return home from the editor.
- [ ] Returning home and reopening the current project is covered by a UI smoke test.
- [ ] Can import from home.
- [ ] Invalid import does not corrupt the current project.
- [ ] Export Project JSON is clearly presented as the editable save artifact.
- [ ] Unsaved changes are visible and warn before project replacement/page close.
- [ ] Unsaved page-close and project-replacement cancel behavior is covered by UI smoke tests.
- [ ] Browser draft is described as convenience recovery, not a durable project library.
- [ ] Browser draft restore is covered by a UI smoke test.

## Patch Assistant Audit

- [ ] Mock provider remains an internal/test fixture and is not visible in the creative UI.
- [ ] Patch preview is visible.
- [ ] Side-by-side current/proposed patch preview is visible.
- [ ] Current/proposed patch preview highlights changed cells.
- [ ] Patch diff summary matches proposed JSON.
- [ ] Patch diff shows active operation count, changed-cell count, and affected bounds.
- [ ] Patch diff groups active operations by color/clear.
- [ ] Individual proposed patch operations can be removed before apply.
- [ ] Validation errors are visible.
- [ ] Reject does not mutate project.
- [ ] Apply mutates only expected cells.
- [ ] Undo can revert applied patch.
- [ ] Failed provider calls do not break the app.
- [ ] Main Ask panel can refresh local Ollama models.
- [ ] Main Ask panel shows all refreshed installed Ollama models in a real selector, not only filtered datalist suggestions.
- [ ] Main Ask panel can pull/download a named Ollama model.
- [ ] Main Ask panel `Ask Ollama` shows visible status/errors where the user clicked.
- [ ] Ollama connection and patch request failures are covered with stubbed provider tests.
- [ ] Ollama patch request success is covered with stubbed provider tests.
- [ ] Ollama patch parser accepts common wrapper aliases and explains wrong JSON object shapes.
- [ ] Ollama model refresh/download/main-generate flows are covered with stubbed-fetch tests.
- [ ] Expandable provider details can copy the full details payload.
- [ ] Broad Ollama character/animation prompts route to structured animation-draft JSON, not selected-frame noise.
- [ ] Broad Ollama animation drafts create 3-6 editable frames only after validation/coherence checks pass.
- [ ] Valid structured Ollama drafts stage a compact review summary and do not mutate project data until Apply Draft.
- [ ] Reject Draft clears the staged animation draft and leaves exported Project JSON unchanged.
- [ ] Follow-up broad asset drafts append new rows when the selected row already contains art, unless replacement is explicit.
- [ ] Staged animation drafts show proposed palette additions as visible swatches before Apply Draft.
- [ ] Animation-draft quality rejects abrupt neighboring-frame jumps unless the draft is intentionally distributed.
- [ ] AI assistance remains constrained co-editing: structured patches, frame drafts, palette suggestions, or layer operations, never irreversible raster replacement.
- [ ] Future AI operations preserve fixed dimensions, palette constraints, frame intent, neighboring-frame context, silhouette/identity constraints, and user preview/accept/reject/undo.
- [ ] Invalid selected-frame Ollama patches show errors and do not render proposal overlays on the canvas.
- [ ] Vision-oriented Ollama model names show a suitability warning for strict JSON patch workflows.

## Export Audit

- [ ] Project JSON exports.
- [ ] Project JSON imports.
- [ ] Download helper tests cover text and blob export mechanics.
- [ ] Current frame PNG exports at exact canvas dimensions.
- [ ] Current frame PNG export button is covered by a UI smoke test.
- [ ] Current frame PNG exports crisp.
- [ ] Transparent cell alpha test exists.
- [ ] Painted cell RGBA test exists.
- [ ] Scale mapping test exists.
- [ ] Current animation strip PNG exports at exact expected dimensions.
- [ ] Current animation strip PNG export button is covered by a UI smoke test.
- [ ] Animation strip region test exists.
- [ ] Animation strip exports aligned in one horizontal row.
- [ ] Full sprite sheet PNG exports one animation per row and one frame per column.
- [ ] Full sprite sheet dimensions use max animation frame count and animation row count.
- [ ] Full sprite sheet respects scale, margin, and spacing.
- [ ] Full sprite sheet leaves short-row padding cells transparent.
- [ ] Full sprite sheet PNG export button is covered by a UI smoke test.
- [ ] Full sprite sheet PNG plus metadata JSON export is covered by a UI smoke test.
- [ ] Full Sprite Sheet View visually matches full sprite sheet row/column export ordering.
- [ ] Transparent cells remain transparent.
- [ ] Grid, checkerboard, onion, selection, and patch overlays do not export.
- [ ] Visible non-exportable layers do not export.
- [ ] Animation strip frame order matches the bottom atlas filmstrip.
- [ ] Full sprite sheet row order matches visible animation order.
- [ ] Full sprite sheet column order matches visible timeline order.
- [ ] Metadata/layout match tests exist.
- [ ] Full sprite sheet metadata frame regions match PNG layout.
- [ ] Metadata includes image filename, sheet dimensions, cell size, rows, columns, scale, margin, spacing, animation ordering, row index, frame column, FPS, loop behavior, duration, anchor, tags, and hitbox when present.
- [ ] Full sprite sheet metadata includes a generic grid-animation-row import profile with slice settings and one clip per animation row.
- [ ] Canvas PNG export uses the tested RGBA renderer.
- [ ] PNG blob export uses the tested RGBA renderer and deterministic PNG encoder.
- [ ] Canvas wrapper tests verify ImageData copy and smoothing disabled.
- [ ] PNG encoder tests verify golden bytes and PNG blob wrapping.
- [ ] Exported project JSON re-imports.
- [ ] Exported full sprite sheet can be imported by common game workflows as a grid/frame sheet.
- [ ] "Sprite Sheet" means fixed row/column output; "Packed Atlas" is not used unless arbitrary rectangle packing exists.
- [ ] No blurry scaling.
- [ ] Canvas output is derived from project data.

## Product Feel Audit

- [ ] SpriteWrite is described as a local-first, AI-assisted pixel asset studio, not an OozeTactics-specific or Godot-specific utility.
- [ ] Product language covers animated characters/creatures, static props, tiles/walls/terrain, backgrounds, effects, icons, UI assets, animation strips, and complete sprite sheets.
- [ ] Docs and UI avoid treating "N-bit" wording as a technical model assumption; concrete dimensions, palette constraints, scale, animation structure, and export profiles are used instead.
- [ ] UI is understandable.
- [ ] Grid is crisp.
- [ ] Panels are readable.
- [ ] Main workflow feels like a tool, not a tech demo.
- [ ] Normal drawing does not expose every advanced metadata/export/provider control at equal weight.
- [ ] Palette/layers and frame/animation properties are compact/contextual.
- [ ] AI is not visually or conceptually centered over the asset workflow.

## Documentation Audit

- [ ] `docs/STATE_OF_SPRITEWRITE.md` still matches implementation.
- [ ] `docs/APP_FLOW.md` still matches user flow.
- [ ] `docs/AI_PATCH_DOCTRINE.md` still matches provider behavior.
- [ ] `docs/EXPORT_CONTRACT.md` still matches export behavior.
- [ ] README still gives a useful first impression.
- [ ] Known limitations are honest.
