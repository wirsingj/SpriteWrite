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
- [ ] Can add, switch, rename, and delete non-final animations.
- [ ] Animation rename is covered by a UI smoke test.
- [ ] Animation add/duplicate/delete is covered by a UI smoke test.
- [ ] Selected frame is obvious.
- [ ] Onion skin does not mutate data.
- [ ] Keyboard shortcuts do not fire while typing in fields.
- [ ] Keyboard shortcuts ignoring typing fields are covered by a UI smoke test.
- [ ] Paint/erase shortcut key configuration restore/reset behavior is covered by a UI smoke test.
- [ ] Arrow shortcuts move between frames.
- [ ] Arrow frame-navigation shortcuts are covered by a UI smoke test.
- [ ] Command palette opens from the header and `Ctrl+K`.
- [ ] Command palette filtering makes export/frame/layer/patch actions discoverable.
- [ ] Layer add/delete/reorder controls keep frames valid.
- [ ] Layer add/reorder/delete is covered by a UI smoke test.
- [ ] Layer visibility toggles affect preview without mutating cells.
- [ ] Layer visibility preview/no-cell-mutation behavior is covered by a UI smoke test.
- [ ] Layer export toggles exclude visible guide/reference layers from PNG exports.
- [ ] Layer export toggle is covered by a UI smoke test.
- [ ] Layer blend modes are explicit data, exported in metadata, and covered by raster/UI tests.
- [ ] Layer export presets are covered by a UI smoke test.

## App Shell Audit

- [ ] Home/start screen loads.
- [ ] Can create a new blank 32x32 project.
- [ ] Can create a new blank 64x64 project.
- [ ] Blank/icon/button projects use generic palette labels, not slime labels.
- [ ] Can create the ooze demo project.
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

- [ ] Mock patch generates.
- [ ] Patch preview is visible.
- [ ] Side-by-side current/proposed patch preview is visible.
- [ ] Current/proposed patch preview highlights changed cells.
- [ ] Patch diff summary matches proposed JSON.
- [ ] Patch diff shows active operation count, changed-cell count, and affected bounds.
- [ ] Patch diff groups active operations by color/clear.
- [ ] Proposed patch operations can be excluded and re-included before apply.
- [ ] Individual proposed patch operations can be removed before apply.
- [ ] Validation errors are visible.
- [ ] Reject does not mutate project.
- [ ] Apply mutates only expected cells.
- [ ] Undo can revert applied patch.
- [ ] Failed provider calls do not break the app.
- [ ] Ollama connection and patch request failures are covered with stubbed provider tests.
- [ ] Ollama patch request success is covered with stubbed provider tests.

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
- [ ] Spritesheet PNG exports at exact expected dimensions.
- [ ] Spritesheet PNG export button is covered by a UI smoke test.
- [ ] Spritesheet region test exists.
- [ ] Spritesheet exports aligned in one horizontal row.
- [ ] Transparent cells remain transparent.
- [ ] Grid, checkerboard, onion, selection, and patch overlays do not export.
- [ ] Visible non-exportable layers do not export.
- [ ] Frame order matches timeline.
- [ ] Metadata/layout match tests exist.
- [ ] Metadata export button is covered by a UI smoke test.
- [ ] Metadata frame regions match PNG layout.
- [ ] Metadata matches sheet dimensions, frame count, FPS, anchor, and layer info.
- [ ] Canvas PNG export uses the tested RGBA renderer.
- [ ] Canvas wrapper tests verify ImageData copy, smoothing disabled, and PNG blob calls.
- [ ] Exported project JSON re-imports.
- [ ] Exported spritesheet can be imported by common game workflows as a grid/frame sheet.
- [ ] No blurry scaling.
- [ ] Canvas output is derived from project data.

## Product Feel Audit

- [ ] UI is understandable.
- [ ] Grid is crisp.
- [ ] Panels are readable.
- [ ] Main workflow feels like a tool, not a tech demo.
- [ ] AI is not visually or conceptually centered over the asset workflow.

## Documentation Audit

- [ ] `docs/STATE_OF_SPRITEWRITE.md` still matches implementation.
- [ ] `docs/APP_FLOW.md` still matches user flow.
- [ ] `docs/AI_PATCH_DOCTRINE.md` still matches provider behavior.
- [ ] `docs/EXPORT_CONTRACT.md` still matches export behavior.
- [ ] README still gives a useful first impression.
- [ ] Known limitations are honest.
