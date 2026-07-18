# App Flow

SpriteWrite should feel like a focused pixel asset studio. The user edits a structured sprite project, previews derived views, and exports assets generated from canon.

SpriteWrite is product-wide, not project- or engine-specific. OozeTactics can prove the workflow and Godot can consume exports, but the app flow should serve characters, creatures, props, tiles, terrain, backgrounds, effects, icons, UI assets, animation strips, and complete sprite sheets.

## Non-Negotiable Data Rule

Project data is the source of truth. Canvas rendering, preview thumbnails, and PNG exports are derived from project data.

No feature should bypass the `SpriteProject` model. No feature should make the canvas, a screenshot, or a generated raster blob authoritative.

## Intended User Flow

1. Start on the SpriteWrite home screen.
2. Create a new project, choose a template, import project JSON, or open the current project.
3. Enter the editor with a valid `SpriteProject`.
4. Draw manually on the central canvas or open the focused AI Assist surface for a structured edit proposal.
5. Use the bottom atlas/filmstrip to choose an animation row or static frame.
6. Shift-click, ctrl/cmd-click, duplicate, delete, set duration/notes/tags, or drag frames in an atlas row when organizing animation order.
7. Switch the center workspace between detailed frame editing and full sprite sheet view as needed.
8. Pick or add an animation, then pick frame and layer when deeper editing is needed.
9. Pick color and tool.
10. Paint cells manually.
11. Duplicate or add frames.
12. Edit selected-frame name, duration, notes, tags, anchor, and hitbox metadata when needed.
13. Use onion skin for animation continuity.
14. Preview the current frame or animation.
15. Use the default Ollama local provider, optionally refresh/download a local model, or switch to Mock local.
16. Set output/view context when useful: static frame or tile, animated row, side-scroller, top-down, or 2.5D/three-quarter.
17. For static prompts such as "ground tileable set" or "stone wall piece," expect a complete editable frame.
18. For broad animation prompts such as "hero wearing a cape, standing animation," expect 3-6 editable frame drafts in the selected animation row.
19. Validate edit or draft output.
20. Preview proposed selected-frame edits before applying them.
21. Exclude, include, or remove unwanted selected-frame edit operations if needed.
22. Apply or reject edit/draft output.
23. Undo or redo as needed.
24. Add, select, reorder, hide, apply layer presets, change blend mode, exclude from export, or delete layers as needed.
25. Export project JSON.
26. Export current frame PNG, current animation strip PNG, full sprite sheet PNG, or full sprite sheet PNG plus metadata JSON.

## Current MVP Flow

The app currently starts on a home screen. The user can create blank 32x32, blank 64x64, icon 32x32, UI button 64x24, hero 32x32 sprite sheet demo, or ooze 32x32 reference projects. Blank/icon/UI button projects use a neutral palette; the hero demo uses a small character palette; the ooze palette is limited to the ooze reference. The quick demo button opens the hero sprite sheet demo: Idle, Jump, Crouch, and Sword Stab rows with 17 total frames. The editor now uses a canvas-first creative-tool layout: compact app header, left tool/palette/layer dock, large center workspace, bottom atlas/filmstrip, and right preview/context inspector. The primary path is clear: draw on the canvas, inspect sheet rows in the filmstrip, click a row/frame, multi-select, duplicate/delete selected row frames, set selected-frame duration/notes/tags, drag-reorder row frames when needed, switch between frame editing and full sprite sheet view, preview, export. AI Assist is available as a focused collapsed surface that defaults to Ollama local, auto-refreshes local Ollama models on browser startup, can pull/download a named model, asks Ollama for selected-frame edit JSON, routes broad whole-asset prompts to a structured animation draft made of frame operation arrays, and injects explicit output/view context for static tiles, walls, ground pieces, backgrounds, side-scroller assets, top-down assets, and 2.5D/three-quarter assets. The editor can switch animations, add a new blank animation with matching layer structure, duplicate animations, rename animations, reorder animations, and delete non-final animations.

Manual paint and erase operations become patch operations:

```json
[
  { "op": "set", "x": 12, "y": 18, "colorId": "accent" },
  { "op": "clear", "x": 13, "y": 18 }
]
```

AI Assist follows the same validated-edit model. Provider output becomes proposed edit JSON, then validation, then preview, then accept or reject. Whole-animation drafts are stricter: they must validate and pass basic coherence checks before replacing the selected animation row, so invalid model output never half-mutates the project.

Future AI operations should stay focused and reviewable: draft a first frame, derive a new frame from an existing frame, create an in-between, alter pose while preserving identity and palette, create follow-through, generate controlled variants, clean silhouette noise, suggest palette or animation structure, patch selected cells/layers, or evaluate continuity between frames.

## View Flow

- The center workspace renders either the selected-frame grid editor or a full sprite sheet view.
- The central grid renders the selected frame and layer from project cells.
- Onion skin renders previous-frame pixels faintly behind empty current-frame cells.
- Valid proposed selected-frame edit operations render as an overlay until accepted or rejected.
- Invalid selected-frame edit operations show errors and do not render overlays on the canvas.
- Proposed edit operations are also summarized as set/clear counts and an operation list.
- Individual proposed edit operations can be excluded, re-included, or removed before applying the active edit.
- The atlas overview renders each animation as a bottom filmstrip row attached to the canvas. Frames can be clicked, shift-selected, ctrl/cmd-toggled, duplicated, deleted, batch-timed, batch-tagged, batch-noted, and drag-reordered within their row.
- The full sprite sheet view renders every animation row in the center workspace using the same row/column order as full sprite sheet PNG export; clicking a real frame returns to detailed frame editing, and shorter rows show transparent trailing cells.
- The bottom atlas panel height and right preview/inspector panel width can be resized on desktop.
- The preview panel renders frames from project data at crisp nearest-neighbor scale, uses per-frame duration when present, and can show transparency against either a checkerboard or display-only solid background color.
- Frame notes and tags are editable project metadata for animation intent and importer/tooling context; they do not render as pixels.
- AI Assist is visually optional; manual drawing, static/animation preview, and exports remain the primary workflow.
- Exports render project data through canvas only at export time.

## State Flow

- React owns current in-memory `SpriteProject`.
- React owns app mode: home/start or editor.
- React owns workspace mode: detailed frame editor or full sprite sheet view.
- React owns AI Assist output/view context as prompt padding state, not as a permanent project constraint.
- React owns compact UI tabs for the left dock and right contextual inspector.
- Templates create valid projects through `SpriteProjectTemplate`.
- New animations create a valid blank first frame and reuse the project layer structure.
- Deleting an animation removes frames that are not referenced by remaining animations and refuses to delete the final animation.
- Atlas drag reorder updates the animation's `frameIds` order through a cloned project operation, preserving frame data and undo history.
- Atlas selected-frame duplicate/delete updates cloned project data and refuses to empty the row.
- Atlas selected-frame duration/notes/tags edits update cloned frame metadata and remain part of exported Project JSON and full sprite sheet metadata.
- Opening or importing a project resets undo/redo history intentionally.
- `applyPatch()` returns a cloned project with validated cell changes.
- Undo and redo store project snapshots.
- Layer changes use cloned project updates. Add/delete/reorder/visibility/export-inclusion/blend-mode operations apply consistently across frames by layer ID.
- Keyboard shortcuts can switch paint/erase, move between frames, undo/redo, and toggle preview playback when focus is not inside a form control. Shortcut customization is not currently exposed in the editor.
- The command palette opens from the editor header or `Ctrl+K`, filters available commands, and can run common editor/export/patch actions.
- Import parses JSON, validates it through `validateProject()`, and replaces the in-memory project only when valid.
- Successful import resets undo/redo history because it is treated as opening a different project.
- Invalid import leaves the current project untouched and displays validation errors.
- Unsaved edits mark the project dirty until Project JSON is exported.
- Replacing the current project warns when editable changes have not been exported.
- The current project is also stored as a browser-local draft for convenience recovery, but Project JSON remains the durable save artifact.
- Export serializes or renders current project data. Animation strip export uses the selected animation as one horizontal row; full sprite sheet export uses every animation as a fixed row-and-column grid.
- Export Project JSON is the editable save artifact until project library support exists.

## Guardrails

- Keep manual edits and AI/provider edits on the same patch rail.
- Keep patch validation pure and testable.
- Keep provider failures visible and non-fatal.
- Keep Ollama local and structured: model list/download is okay, opaque image generation is not.
- Keep exports derived.
- Keep future features narrow until the current flow is stable.
