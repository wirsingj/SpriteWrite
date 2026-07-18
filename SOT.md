---
yaiml: 0.2
role: sot
title: SOT
purpose: Current engineering state and direction for the project.
belongs-here: goals, current capabilities, declared direction, active risks, priorities, divergence, uncertainty, useful recent lessons.
not-here: durable architecture, command reference, complete history.
durability: volatile; synthesize and prune aggressively.
read-with: Architecture; Maintainer Guide; docs/PRODUCT_VISION.md; docs/STATE_OF_SPRITEWRITE.md.
update-when: direction, verified reality, risks, priorities, or useful engineering lessons change.
agent-guidance: Verify implementation claims. Preserve human intent. Mark uncertainty. Surface conflicts. Prune stale detail.
---

# SOT

## YAIML Note

YAIML is ordinary version-controlled project memory. It is not a package, runtime, schema, parser target, hosted memory service, database, SDK, or required CLI.

## Project Identity

SpriteWrite is a local-first, AI-assisted pixel asset studio. Its source of truth is explicit sprite project data, not a PNG, canvas screenshot, or opaque generated image.

Declared human reason for the project: visual production assets, including animated characters and creatures, static props, tiles, walls, terrain, backgrounds, effects, icons, UI assets, animation strips, and complete sprite sheets, have repeatedly blocked otherwise viable software and game projects. SpriteWrite should make those assets possible by turning pixel asset authoring into editable grid data with exportable artifacts.

Declared product boundary: SpriteWrite must not be defined as an OozeTactics-specific or Godot-specific utility. OozeTactics is the first serious consumer and proving ground, not the boundary of the product. Godot can be a future export profile, not a core dependency or assumption.

## Doctrine

- AI is not the product; the rails around AI are the product.
- Do not ask a model to create an opaque spritesheet image.
- AI/provider output should propose structured, inspectable results such as cell patch operations, editable frame drafts, palette suggestions, duplicated-and-modified frames, or explicit layer operations.
- The user must be able to preview, accept, reject, undo, and manually edit changes.
- Sprite project data should remain boring, explicit, portable, and testable.
- PNG/canvas output is derived from project data and is not source of truth.
- Avoid treating "N-bit" language as a technical model assumption; represent concrete canvas dimensions, cell dimensions, palette constraints, scale, animation structure, and export profiles instead.

## Verified Current Capabilities

Verified from repository docs and source inspection on 2026-07-01:

- Vite, React, TypeScript, plain CSS, and Vitest app.
- Home/start screen plus editor screen.
- Project templates for blank assets, a hero sprite sheet demo, and a minimal ooze reference.
- Structured `SpriteProject` data model with canvas, palette, animations, frames, layers, frame notes/tags, anchors, optional hitboxes, and metadata.
- Sparse layer cell maps where transparent cells are omitted.
- Canvas-first editor shell with a compact header, focused drawing/tool dock, Palette/Layers dock tabs, central pixel canvas, resizable bottom attached atlas/filmstrip, resizable right preview/context inspector, and focused AI/export surfaces.
- Paint/erase tools, browser-local configurable paint/erase shortcut keys, click-drag painting, palette editing, atlas rows with frame click, modifier multi-select, drag reorder, selected-frame duplicate/delete, selected-frame duration/notes/tags editing, center workspace modes for detailed frame editing or full sprite sheet viewing, animation controls, onion skin, preview with optional solid display background, and snapshot undo/redo.
- Hero demo gives the app a richer default test fixture: 32x32 character asset, Idle/Jump/Crouch/Sword Stab rows, and 17 total editable frames. The ooze template remains as a tiny creature comparison reference and must not dominate product language.
- Layer controls include add/delete/reorder/select/rename, visibility, PNG export inclusion, lock/editable state, opacity, normal/multiply/screen blend modes, and simple art/guide/shadow/highlight presets.
- Patch Assistant has a deterministic Mock provider and an experimental Ollama provider with local model refresh/download controls.
- Ollama model refresh uses a real installed-model selector, preserves manual model-name entry for downloads/custom names, derives vision suitability from Ollama `details.families` when top-level capabilities are absent, and reports discovered model names in status text.
- SpriteWrite now pads plain asset prompts before they reach Ollama: small edits route to selected-frame patches, static asset requests route to larger single-frame drafts, and multi-frame/animation requests route to 3-6 frame animation drafts.
- Ollama broad animation prompts route to a first-pass structured animation-draft path: editable frame patches are requested, validated, checked for basic coherence, and committed only if valid.
- Ollama broad asset prompts now have a recipe rail for observed qwen-stable cases. Prompts such as rotating gold coin, short grass tile variations, hero idle/cape, and tentacle monster variations can ask Ollama for compact recipe parameters; SpriteWrite deterministically expands those parameters into editable cell patches and animation rows.
- Live local `qwen3:14b` probes on 2026-07-18 showed compact recipe prompts returning usable JSON quickly for 4-frame rotating gold coin, 4 grass tile variations, hero idle/cape, and 3 tentacle creature variations. Raw all-cell prompts remain more fragile and slower.
- Provider failures and rejected Ollama drafts now expose an expandable details payload with the padded prompt, model/base URL context, validation errors, and the attempted patch/draft JSON where available.
- Ollama requests now show attempt number and elapsed time in status/details, and app coverage verifies a second click after a rejected animation draft sends a second provider request.
- Ollama animation-draft prompts now explicitly forbid rectangle-style `width`/`height` operation fields and tiny marker patches after observed `llama3.2:3b` output violated the cell-operation contract.
- Ollama generate calls set `think: false` and temperature 0 after observed `qwen3:14b` output returned `{}` when thinking was left enabled/implicit. Selected-frame patch calls use JSON Schema structured output; animation drafts use lighter JSON mode plus SpriteWrite validation because multi-frame operation-array schemas can stall local qwen.
- `npm test -- --run src/providers/ollamaPatchProvider.test.ts` now includes live integration checks that call local `qwen3:14b` when Ollama is running and that model is installed. Current live checks cover coin, grass variation sets, hero idle/cape, and tentacle creature variations. If qwen has stuck work from aborted requests, unloading the model with Ollama `keep_alive: 0` can clear the queue.
- Patch proposals are JSON operations with validation, preview, include/exclude toggles, removal, apply, and reject.
- Project JSON import/export exists.
- PNG exports and sprite sheet metadata are derived through tested layout/raster/canvas export utilities.
- Export supports current-frame PNG, current-animation horizontal strip PNG, full row-per-animation sprite sheet PNG, and full sprite sheet PNG plus metadata JSON. The fixed full sheet is not a packed atlas.

## Current Test State

The repository contains Vitest tests for domain data functions, templates, export planning, export raster rendering, provider parsing, canvas export wrappers, and app-shell smoke workflows.

Known project commands from `package.json`:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run typecheck`

Latest verified run on 2026-07-18: `npm run build`, `npm test -- --run`, `npm run lint`, and `npm run typecheck` passed after adding recipe-shaped Ollama draft rails. The full test suite includes live local `qwen3:14b` integration checks when available. The test suite has 9 test files and 211 tests.

## Current Risks And Uncertainty

- `git status --short` on 2026-07-01 reported the repository contents as untracked. Treat the whole tree as intentional work in progress unless the human says otherwise.
- `docs/STATE_OF_SPRITEWRITE.md` is detailed and useful, but future agents should verify it against source before relying on every implementation claim.
- Real browser-level download/export flows and binary PNG checks are still listed as incomplete, but jsdom coverage now exercises Project JSON import, Project JSON export UI behavior, full sprite sheet metadata export UI behavior, current-frame PNG export UI behavior, current-animation strip PNG export UI behavior, full sprite sheet PNG export UI behavior, and browser download helpers.
- In-app browser smoke on 2026-07-04 verified the start screen, generic New Project flow, editor load, 32x32 grid cell count, and visible export controls through the local Vite dev server. Browser automation did not observe blob-anchor download events, so real download-event coverage remains unresolved.
- Ollama integration is experimental and must fail gracefully. It can list local models, pull/download a named model through local Ollama, ask the selected model for structured selected-frame patch JSON or a larger single-frame draft, request first-pass structured animation drafts, and use recipe-shaped provider calls for some common frame-set requests. SpriteWrite should keep padding plain user prompts into constrained provider requests so users do not have to talk in Ollama contract language. The selected-frame parser accepts common wrappers such as `patch`, `operations`, `ops`, `patchOperations`, `patch_operations`, and a single operation object; wrong JSON shapes surface actionable errors. Do not center product work on provider cleverness, and do not let Ollama return opaque raster output.
- Patch Assistant should remain visibly optional in the UX; the primary product path is draw static or animated grid assets, preview them, export current-frame PNGs, current-animation strip PNGs, full sprite sheet PNGs plus metadata, and save editable Project JSON.
- The UX should be canvas-first, not dashboard-first: the central pixel canvas and bottom filmstrip are the main workflow; palette/layers are compact; preview/properties are contextual; AI and export are important but secondary focused surfaces.
- Browser inspection at a temporary 1440x900 viewport verified the refactored editor fits without page scroll: compact header, visible side docks, central canvas, and bottom filmstrip. Full-sheet view also fits.
- No backend, database, auth, cloud sync, Electron packaging, Cuddler dependency, or OllamaSaddle dependency should be added without explicit human direction.
- Recent projects/project-library persistence is not durable; Project JSON export is the editable save artifact.
- The current project model now distinguishes broad formal asset categories such as character, creature, tile, environment, prop, object, background, effect, UI, icon, and custom. Legacy early-prototype values such as generic, ooze, button, enemy, and parallax remain valid for imported Project JSON but should not drive new product language.

## Visible Divergence To Watch

The export direction is "visible and exportable layers render to PNG." If older wording says "visible layers only," prefer the current source in `src/domain/exportRaster.ts` and `docs/EXPORT_CONTRACT.md`.

## Immediate Priorities

Use `docs/STATE_OF_SPRITEWRITE.md` as the detailed active roadmap. Current next-step themes include:

1. Continue polishing the canvas-first creative workflow: improve icon/tool affordances, refine timeline controls, and keep AI/export from crowding normal drawing.
2. Shape AI assistance around focused asset operations: improve prompt-intent padding, first-frame draft, derived frame, in-between, pose change with identity/palette preservation, follow-through, variants, silhouette cleanup, palette suggestions, animation structure, selected-cell/layer patches, and continuity evaluation.
3. Make recipe-based Ollama drafts more inspectable in the UI before acceptance; current recipe expansion commits accepted animation drafts through validation, but recipe choice, retry strategy, partial row acceptance, and recipe/debug visibility need product design.
4. Real browser/export download checks or PNG binary smoke tests.
5. Layer improvements such as folders.
6. Expanded shortcut configuration beyond paint/erase if the workflow needs it.

## Open Questions

- What is the right first durable project-library/save flow beyond browser draft and Project JSON export?
- How strict should the Ollama animation-draft validator become before it blocks too many useful rough drafts?
- Which generic export profile should come first after the current boring JSON: Godot, Unity, or a custom importer preset?
