# App Flow

SpriteWrite should feel like a small reliable asset workbench. The user edits a structured sprite project, previews derived views, and exports assets generated from canon.

## Non-Negotiable Data Rule

Project data is the source of truth. Canvas rendering, preview thumbnails, and PNG exports are derived from project data.

No feature should bypass the `SpriteProject` model. No feature should make the canvas, a screenshot, or a generated raster blob authoritative.

## Intended User Flow

1. Start on the SpriteWrite home screen.
2. Create a new project, choose a template, import project JSON, or open the current project.
3. Enter the editor with a valid `SpriteProject`.
4. Use the command palette when the available actions are not obvious.
5. Pick or add an animation, then pick frame and layer.
6. Pick color and tool.
7. Adjust paint/erase shortcut keys if desired.
8. Paint cells manually.
9. Duplicate or add frames.
10. Edit selected-frame name, duration, notes, tags, anchor, and hitbox metadata when needed.
11. Use onion skin for animation continuity.
12. Preview animation.
13. Request a patch suggestion from Mock or a future Ollama provider.
14. Validate patch.
15. Preview proposed patch.
16. Exclude, include, or remove unwanted patch operations if needed.
17. Apply or reject patch.
18. Undo or redo as needed.
19. Add, select, reorder, hide, apply layer presets, change blend mode, exclude from export, or delete layers as needed.
20. Export project JSON.
21. Export PNG frame or spritesheet.
22. Export metadata.

## Current MVP Flow

The app currently starts on a home screen. The user can create blank 32x32, blank 64x64, icon 32x32, UI button 64x24, or ooze 32x32 demo projects. Blank/icon/button projects use a generic palette; the ooze palette is limited to the ooze demo. The demo has one `idle` animation with two frames. The editor can switch animations, add a new blank animation with matching layer structure, duplicate animations, rename animations, reorder animations, and delete non-final animations.

Manual paint and erase operations become patch operations:

```json
[
  { "op": "set", "x": 12, "y": 18, "colorId": "accent" },
  { "op": "clear", "x": 13, "y": 18 }
]
```

The patch assistant follows the same model. Provider output becomes proposed patch JSON, then validation, then preview, then accept or reject.

## View Flow

- The central grid renders the selected frame and layer from project cells.
- Onion skin renders previous-frame pixels faintly behind empty current-frame cells.
- Proposed patch operations render as an overlay until accepted or rejected.
- Proposed patch operations are also summarized as set/clear counts and an operation list.
- Individual proposed patch operations can be excluded, re-included, or removed before applying the active patch.
- The preview panel renders frames from project data at crisp nearest-neighbor scale and uses per-frame duration when present.
- Frame notes and tags are editable project metadata for animation intent and importer/tooling context; they do not render as pixels.
- Exports render project data through canvas only at export time.

## State Flow

- React owns current in-memory `SpriteProject`.
- React owns app mode: home/start or editor.
- Templates create valid projects through `SpriteProjectTemplate`.
- New animations create a valid blank first frame and reuse the project layer structure.
- Deleting an animation removes frames that are not referenced by remaining animations and refuses to delete the final animation.
- Opening or importing a project resets undo/redo history intentionally.
- `applyPatch()` returns a cloned project with validated cell changes.
- Undo and redo store project snapshots.
- Layer changes use cloned project updates. Add/delete/reorder/visibility/export-inclusion/blend-mode operations apply consistently across frames by layer ID.
- Keyboard shortcuts can switch paint/erase, move between frames, undo/redo, and toggle preview playback when focus is not inside a form control. Paint and erase shortcuts can be changed and are stored as browser-local preferences.
- The command palette opens from the editor header or `Ctrl+K`, filters available commands, and can run common editor/export/patch actions.
- Import parses JSON, validates it through `validateProject()`, and replaces the in-memory project only when valid.
- Successful import resets undo/redo history because it is treated as opening a different project.
- Invalid import leaves the current project untouched and displays validation errors.
- Unsaved edits mark the project dirty until Project JSON is exported.
- Replacing the current project warns when editable changes have not been exported.
- The current project is also stored as a browser-local draft for convenience recovery, but Project JSON remains the durable save artifact.
- Export serializes or renders current project data.
- Export Project JSON is the editable save artifact until project library support exists.

## Guardrails

- Keep manual edits and AI/provider edits on the same patch rail.
- Keep patch validation pure and testable.
- Keep provider failures visible and non-fatal.
- Keep exports derived.
- Keep future features narrow until the current flow is stable.
