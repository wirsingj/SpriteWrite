---
yaiml: 0.2
role: sot
title: SOT
purpose: Current engineering state and direction for the project.
belongs-here: goals, current capabilities, declared direction, active risks, priorities, divergence, uncertainty, useful recent lessons.
not-here: durable architecture, command reference, complete history.
durability: volatile; synthesize and prune aggressively.
read-with: Architecture; Maintainer Guide; docs/STATE_OF_SPRITEWRITE.md.
update-when: direction, verified reality, risks, priorities, or useful engineering lessons change.
agent-guidance: Verify implementation claims. Preserve human intent. Mark uncertainty. Surface conflicts. Prune stale detail.
---

# SOT

## YAIML Note

YAIML is ordinary version-controlled project memory. It is not a package, runtime, schema, parser target, hosted memory service, database, SDK, or required CLI.

## Project Identity

SpriteWrite is a local-first structured pixel asset workbench. Its source of truth is explicit sprite project data, not a PNG, canvas screenshot, or opaque generated image.

Declared human reason for the project: visual production assets, especially pixel spritesheets and small animated assets, have repeatedly blocked otherwise viable software and game projects. SpriteWrite should make those assets possible by turning sprite authoring into editable grid data with exportable artifacts.

## Doctrine

- AI is not the product; the rails around AI are the product.
- Do not ask a model to create an opaque spritesheet image.
- AI/provider output may only propose structured, inspectable cell patch operations.
- The user must be able to preview, accept, reject, undo, and manually edit changes.
- Sprite project data should remain boring, explicit, portable, and testable.
- PNG/canvas output is derived from project data and is not source of truth.

## Verified Current Capabilities

Verified from repository docs and source inspection on 2026-07-01:

- Vite, React, TypeScript, plain CSS, and Vitest app.
- Home/start screen plus editor screen.
- Project templates for blank assets and an ooze demo.
- Structured `SpriteProject` data model with canvas, palette, animations, frames, layers, frame notes/tags, anchors, optional hitboxes, and metadata.
- Sparse layer cell maps where transparent cells are omitted.
- Paint/erase tools, browser-local configurable paint/erase shortcut keys, click-drag painting, palette editing, frame timeline, animation controls, onion skin, animation preview, and snapshot undo/redo.
- Layer controls include add/delete/reorder/select/rename, visibility, PNG export inclusion, lock/editable state, opacity, normal/multiply/screen blend modes, and simple art/guide/shadow/highlight presets.
- Patch Assistant has a deterministic Mock provider and an experimental Ollama provider.
- Patch proposals are JSON operations with validation, preview, include/exclude toggles, removal, apply, and reject.
- Project JSON import/export exists.
- PNG exports and spritesheet metadata are derived through tested layout/raster/canvas export utilities.
- Export supports current-frame PNG, horizontal animation spritesheet PNG, and animation metadata JSON.

## Current Test State

The repository contains Vitest tests for domain data functions, templates, export planning, export raster rendering, provider parsing, canvas export wrappers, and app-shell smoke workflows.

Known project commands from `package.json`:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run typecheck`

These were not run during YAIML initialization because this pass only created project-memory documents.

## Current Risks And Uncertainty

- `git status --short` on 2026-07-01 reported the repository contents as untracked. Treat the whole tree as intentional work in progress unless the human says otherwise.
- `docs/STATE_OF_SPRITEWRITE.md` is detailed and useful, but future agents should verify it against source before relying on every implementation claim.
- Real browser-level download/export flows and binary PNG checks are still listed as incomplete, but jsdom coverage now exercises Project JSON import, Project JSON export UI behavior, metadata export UI behavior, frame/spritesheet PNG export UI behavior, and browser download helpers.
- In-app browser smoke on 2026-07-04 verified the start screen, generic New Project flow, editor load, 32x32 grid cell count, and visible export controls through the local Vite dev server. Browser automation did not observe blob-anchor download events, so real download-event coverage remains unresolved.
- Ollama integration is experimental and must fail gracefully. Do not center product work on provider cleverness.
- No backend, database, auth, cloud sync, Electron packaging, Cuddler dependency, or OllamaSaddle dependency should be added without explicit human direction.
- Recent projects/project-library persistence is not durable; Project JSON export is the editable save artifact.

## Visible Divergence To Watch

The export direction is "visible and exportable layers render to PNG." If older wording says "visible layers only," prefer the current source in `src/domain/exportRaster.ts` and `docs/EXPORT_CONTRACT.md`.

## Immediate Priorities

Use `docs/STATE_OF_SPRITEWRITE.md` as the detailed active roadmap. Current next-step themes include:

1. Real browser/export download checks or PNG binary smoke tests.
2. Layer improvements such as folders.
3. Expanded shortcut configuration beyond paint/erase if the workflow needs it.

## Open Questions

- What is the right first durable project-library/save flow beyond browser draft and Project JSON export?
- How much Ollama work is useful before the editor/export foundation feels good enough?
- Which engine metadata path should come first: Godot, Unity, or custom importer JSON?
