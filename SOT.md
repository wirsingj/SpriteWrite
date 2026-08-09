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
- Project templates for blank assets, icon/UI starts, coin spin, grass tile variants, a 3x3 terrain edge/corner/interior tileset, a wall/floor tile strip, prop crate, background band, mountain background, effect burst, a hero sprite sheet demo, and a minimal ooze reference. The start screen surfaces only a compact six-choice quick launcher while the full template list remains in the New Project dropdown.
- Structured `SpriteProject` data model with canvas, palette, animations, frames, flat ordered layers with optional group/folder labels, frame notes/tags, anchors, optional hitboxes, and metadata.
- Sparse layer cell maps where transparent cells are omitted.
- Canvas-first editor shell with a compact header, focused drawing/tool dock, Palette/Layers dock tabs, central pixel canvas, resizable bottom attached atlas/filmstrip, resizable right preview/context inspector, independently resizable preview viewport, and focused AI/export surfaces.
- The visible app chrome now uses a graphite/dark Mac-like visual direction with Apple-blue selection/accent states, styled dark scrollbars, low-contrast transparency stand-ins, and clean canvas grid surfaces. Avoid returning to the previous drab green app-wide theme or harsh checkerboard transparency backgrounds.
- Paint/erase tools, fixed paint/erase keyboard shortcuts that ignore legacy hidden custom mappings, click-drag painting, palette editing, atlas rows with frame click, modifier multi-select, drag reorder, selected-frame duplicate/delete, selected-frame duration/notes/tags editing, center workspace modes for detailed frame editing or full sprite sheet viewing, animation controls, onion skin, preview with optional solid display background, center editor display background, in-app color picker popovers for palette/display colors, and snapshot undo/redo.
- The React UI is no longer a single monolithic `App.tsx` surface. Stable UI pieces now live under `src/components/` for the start screen, command palette, color picker, atlas timeline, full-sheet workspace, mini sprite thumbnail, and provider details; `App.tsx` still coordinates stateful workflows.
- Hero demo gives the app a richer default test fixture: 32x32 character asset, Idle/Jump/Crouch/Sword Stab rows, and 17 total editable frames. The start screen also includes a Hero Demo mini-preview card so you can inspect a sample frame before opening the full sheet. The ooze template remains as a tiny creature comparison reference and must not dominate product language.
- Layer controls include add/delete/reorder/select/rename, visibility, PNG export inclusion, lock/editable state, opacity, normal/multiply/screen blend modes, and simple art/guide/shadow/highlight presets.
- AI Assist exposes the experimental Ollama provider with local model refresh/download controls. A deterministic Mock provider remains in code as an internal/test fixture, but it is no longer visible in the creative UI.
- The visible AI provider defaults to Ollama local. In the real browser app, SpriteWrite performs one startup model refresh automatically so users do not need to manually switch providers and refresh models before trying local Ollama. Vitest skips this browser-startup network work.
- Ollama model refresh uses a real installed-model selector, preserves manual model-name entry for downloads/custom names, derives vision suitability from Ollama `details.families` when top-level capabilities are absent, and reports discovered model names in status text.
- Model-name handling in Ollama flows is normalized for whitespace and casing so launch-time and ad-hoc provider calls stay aligned even when users paste model names with extra spaces or different capitalization.
- Ollama model discovery normalizes installed model names (trim/case-normalized) and de-duplicates duplicates before matching, so refresh and startup selection stay stable when the API list contains repeated names.
- SpriteWrite now pads plain asset prompts before they reach Ollama: small edits route to selected-frame edits, static asset requests route to larger single-frame drafts, and multi-frame/animation requests route to 3-6 frame animation drafts.
- AI Assist now includes prompt context controls for output intent (`Auto`, `Static frame / tile`, `Animated row`) and view angle (`Auto`, `Side-scroller`, `Top-down`, `2.5D / three-quarter`). These context values are injected into SpriteWrite's padded Ollama instructions so static tile/wall/ground/background-style requests can carry game-view assumptions without the user hand-writing prompt boilerplate.
- Ollama broad animation prompts route to a structured draft path with a critique-and-repair loop: editable drafts are requested, validated for patch correctness plus basic intent cues such as frame count, readable cell count, material/color fit, neighboring-frame continuity, rotation motion, and tile/grass anchoring, then retried with SpriteWrite feedback before rejection. Valid drafts are staged with explicit Apply Draft / Reject Draft controls before they mutate the project.
- Numbered animation requests such as "3 animations: monk jumping, kneeling, punching" now route as multi-row animation sets instead of collapsing into one default 4-frame row.
- Ollama broad animation drafts can now include structured `paletteAdditions`. SpriteWrite validates and merges those palette colors before validating frame operations, so a provider can propose appropriate asset colors, such as gold/orange coin colors, without SpriteWrite hard-coding the finished asset art.
- Ollama broad asset prompts still have recipe rails for a few observed qwen-stable structural cases such as short grass tile variations, hero idle/cape, tentacle monster variations, and spinning-object fallback. Ordinary prompts such as rotating gold coin use direct provider-drafted editable frames with optional palette additions first; the compact spinning recipe is a fallback only after direct quality attempts fail.
- Live local `qwen3:14b` probes on 2026-07-18 showed compact recipe prompts returning usable JSON quickly for grass tile variations, hero idle/cape, and tentacle creature variations. Raw all-cell prompts remain more fragile and slower.
- Staged structured Ollama animation drafts expose a compact draft review with rows, frame counts, patch-operation totals, visible swatches for new palette additions, quality-attempt count, FPS where available, and explicit Apply Draft / Reject Draft controls. Provider failures and rejected Ollama drafts still expose an expandable details payload with the padded prompt, model/base URL context, validation errors, and the attempted patch/draft JSON where available; the details disclosure includes a Copy All button for large Ollama/debug payloads.
- Follow-up broad asset drafts are additive by default once the selected row contains art. SpriteWrite may reuse an empty starter row or obey explicit replace/update wording, but requests such as making grass after a generated coin must append rows instead of overwriting the coin row.
- Ollama requests now show attempt number and elapsed time in status/details, and app coverage verifies a second click after a rejected animation draft sends a second provider request.
- Ollama animation-draft prompts now explicitly forbid rectangle-style `width`/`height` operation fields and tiny marker patches after observed `llama3.2:3b` output violated the cell-operation contract.
- Ollama generate calls set `think: false` and temperature 0 after observed `qwen3:14b` output returned `{}` when thinking was left enabled/implicit. Selected-frame patch calls use JSON Schema structured output; animation drafts use lighter JSON mode plus SpriteWrite validation because multi-frame operation-array schemas can stall local qwen.
- `npm run test:ollama` is a deliberate live quality probe that calls local `qwen3:14b` for natural prompts such as a 4-frame rotating golden coin and grass animation variations, then fails loudly with SpriteWrite critique details if the drafts do not match the requested intent. If qwen has stuck work from aborted requests, unloading the model with Ollama `keep_alive: 0` can clear the queue.
- User-facing AI proposals are edits or drafts backed by JSON operations with validation, canvas preview, explicit apply/reject, and compact staged-draft review summaries. Operation-level include/exclude/removal controls were removed from the normal creative surface to reduce UI noise; detailed returned JSON remains available through provider details.
- Project JSON import/export exists.
- A first localhost automation API runs as part of `npm run dev` alongside Vite. It exposes health/template discovery plus a concrete `POST /recipes/ooze-melee-attack` endpoint that writes editable Project JSON, metadata JSON, and full-sheet PNG files for other local Codex/game-development tasks.
- PNG exports and sprite sheet metadata are derived through tested layout/raster export utilities. PNG blob export now uses a deterministic RGBA-to-PNG encoder instead of depending on browser canvas `toBlob`.
- Export supports current-frame PNG, current-animation horizontal strip PNG, full row-per-animation sprite sheet PNG, and full sprite sheet PNG plus metadata JSON. Animation-strip and full-sheet metadata include grid/import hints plus generic importer profiles for one-row strips and row-based animation sheets. The fixed full sheet is not a packed atlas. Layer group labels are metadata only and do not change PNG render order.
- UI resize interactions on right/preview/sheet panels now include pointer-cancel cleanup to avoid stale drag state after interrupted pointer interactions.

## Current Test State

The repository contains Vitest tests for domain data functions, templates, export planning, export raster rendering, PNG encoding, provider parsing, canvas export wrappers, and app-shell smoke workflows.

Known project commands from `package.json`:

- `npm run build`
- `npm test`
- `npm run lint`
- `npm run typecheck`

Latest verified run on 2026-07-26: `npm run build`, `npm test -- --run`, `npm run lint`, and `npm run typecheck` passed after adding the localhost automation API and ooze melee attack recipe. The non-live Vitest suite currently has 13 test files and 236 tests. A combined-launcher smoke verified `npm run dev` can start the Vite UI and SpriteWrite API together on temporary ports, and an API smoke verified `POST /recipes/ooze-melee-attack` writes Project JSON, metadata JSON, and a valid PNG. Live local `qwen3:14b` quality probes remain available through `npm run test:ollama`.

## Current Risks And Uncertainty

- `git status --short` on 2026-07-01 reported the repository contents as untracked. Treat the whole tree as intentional work in progress unless the human says otherwise.
- `docs/STATE_OF_SPRITEWRITE.md` is detailed and useful, but future agents should verify it against source before relying on every implementation claim.
- Real browser-level download/export flows are still partially unresolved: the in-app browser can verify Project JSON export state, but it still does not expose blob download events and did not surface PNG export status through the automation backend during the 2026-07-18 audit. Non-browser coverage now exercises Project JSON import/export UI behavior, full sprite sheet metadata export UI behavior, current-frame/current-animation/full-sheet PNG export UI behavior, browser download helpers, deterministic PNG encoder golden bytes, and PNG binary smoke checks.
- In-app browser smoke on 2026-07-18 verified the start screen, terrain template visibility, Hero demo editor load, 32x32 grid cell count, visible export controls, full-sheet row view, and no captured console errors through the local Vite dev server. Browser automation still does not provide durable blob-anchor download-event coverage, so real download-event coverage remains unresolved.
- Ollama integration is experimental and must fail gracefully. It can list local models, pull/download a named model through local Ollama, ask the selected model for structured selected-frame patch JSON or a larger single-frame draft, request first-pass structured animation drafts, and use recipe-shaped provider calls for some common frame-set requests. SpriteWrite should keep padding plain user prompts into constrained provider requests so users do not have to talk in Ollama contract language. The selected-frame parser accepts common wrappers such as `patch`, `operations`, `ops`, `patchOperations`, `patch_operations`, and a single operation object; wrong JSON shapes surface actionable errors. Do not center product work on provider cleverness, and do not let Ollama return opaque raster output.
- AI Assist should remain visibly optional in the UX; the primary product path is draw static or animated grid assets, preview them, export current-frame PNGs, current-animation strip PNGs, full sprite sheet PNGs plus metadata, and save editable Project JSON.
- The UX should be canvas-first, not dashboard-first: the central pixel canvas and bottom filmstrip are the main workflow; palette/layers are compact; preview/properties are contextual; AI and export are important but secondary focused surfaces. The visual language should stay sleek graphite/blue rather than SpriteWrite inheriting the green theme used in other apps.
- Browser inspection at a temporary 1440x900 viewport verified the refactored editor fits without page scroll: compact header, visible side docks, central canvas, and bottom filmstrip. Full-sheet view also fits.
- No database, auth, cloud sync, Electron packaging, Cuddler dependency, or OllamaSaddle dependency should be added without explicit human direction. The current local Node automation API is intentionally localhost-only and file/export oriented.
- Recent projects/project-library persistence is not durable; Project JSON export is the editable save artifact.
- The current project model now distinguishes broad formal asset categories such as character, creature, tile, environment, prop, object, background, effect, UI, icon, and custom. Legacy early-prototype values such as generic, ooze, button, enemy, and parallax remain valid for imported Project JSON but should not drive new product language.

## Visible Divergence To Watch

The export direction is "visible and exportable layers render to PNG." If older wording says "visible layers only," prefer the current source in `src/domain/exportRaster.ts` and `docs/EXPORT_CONTRACT.md`.

## Immediate Priorities

Use `docs/STATE_OF_SPRITEWRITE.md` as the detailed active roadmap. Current next-step themes include:

1. Continue polishing the canvas-first creative workflow: drawing-tool affordances, timeline labels, frame-inspector grouping, and staged-draft review summaries now have first-pass coverage; keep AI/export from crowding normal drawing.
2. Shape AI assistance around focused asset operations: improve prompt-intent padding, first-frame draft, derived frame, in-between, pose change with identity/palette preservation, follow-through, variants, silhouette cleanup, deeper palette suggestions, animation structure, selected-cell/layer patches, and richer continuity evaluation.
3. Expand static asset and tile/wall/floor/background generation beyond first starter recipes: first terrain edge/corner/interior and wall/floor strips exist, while more prop/background/effect variants and view-aware recipe rails need product design and validation.
4. Make recipe-based Ollama drafts more inspectable before commit: current valid drafts are staged with compact review summaries and apply/reject controls, but recipe choice, retry strategy, partial row acceptance, visual pre-apply preview, and recipe/debug visibility still need product design.
5. Real browser/export download checks remain needed where the automation backend can observe blob downloads; PNG golden regression coverage now exists for the encoder.
6. Layer improvements beyond folder labels, such as deeper grouping/bulk controls, remain future work.
7. Keyboard shortcut customization remains intentionally absent; fixed visible P/E shortcuts now ignore stale legacy saved mappings so the UI hints and actual keys stay aligned.

## Open Questions

- What is the right first durable project-library/save flow beyond browser draft and Project JSON export?
- How strict should the Ollama animation-draft validator become before it blocks too many useful rough drafts?
- Which engine-specific export profile should come first after the current boring generic JSON/import profile: Godot, Unity, or a custom importer preset?


