---
yaiml: 0.2
role: maintainer
title: Maintainer Guide
purpose: Operating knowledge for setup, checks, diagnostics, and safe maintenance.
belongs-here: commands, environment notes, focused checks, important files, danger files, diagnostics, failure playbooks, unverified procedures.
not-here: product roadmap, durable architecture narrative, complete implementation history.
durability: moderately stable; keep concise and practical.
budget: About 1200 words; a working target; keep procedures concise rather than exhaustive.
read-with: SOT; Architecture; README.md; docs/PRODUCT_VISION.md; docs/DEV_LOOP.md; docs/AUDIT_CHECKLIST.md.
update-when: commands, setup, checks, common failures, generated files, or maintenance practices change.
last-verified: not established; claims not rechecked in this refresh.
agent-guidance: Run focused checks for touched areas. Do not reset or discard work. Report uncertainty and exact command results.
---

# Maintainer Guide

## Setup

Install dependencies:

```bash
npm install
```

Run the dev server:

```bash
npm run dev
```

This starts the Vite UI on the requested SpriteWrite port and the localhost automation API by default on `SPRITEWRITE_API_PORT`, or on UI port + 1 when `SPRITEWRITE_API_PORT` is not set. By default that is `5174` when UI is `5173`.

Windows convenience launcher:

```text
Run SpriteWrite.bat
```

Background launch option (no attached terminal):

```text
Run SpriteWrite detached.bat
```

For Bash-first use, you can run:

```bash
npm run dev:bash
```

You can pass a port positionally:

```bash
npm run dev:bash -- 5188
```

The launcher starts the local Vite dev server and SpriteWrite automation API.
The launcher accepts an optional port argument:

```text
Run SpriteWrite.bat 5178
```

The background launcher also accepts a port argument:

```text
Run SpriteWrite detached.bat 5178
```

You can also set a default port in the current shell:

```bash
export SPRITEWRITE_PORT=5178  # Git Bash
npm run dev
```

```bat
set SPRITEWRITE_PORT=5178  # cmd
npm run dev
```

## Standard Checks

Use these before handing off non-trivial changes:

```bash
npm run build
npm test -- --run
npm run lint
npm run typecheck
```

The package scripts are:

- `npm run dev`
- `npm run dev:vite`
- `npm run api`
- `npm run dev:bash` (Bash-first launch script)
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run preview`
- `npm test`

## Focused Checks

- Domain data/model changes: run relevant tests in `src/domain/*.test.ts` plus `npm run typecheck`.
- Export changes: run `src/domain/exportPlanning.test.ts`, `src/domain/exportRaster.test.ts`, `src/utils/canvasExport.test.ts`, plus build/typecheck.
- Provider parsing changes: run `src/providers/ollamaPatchProvider.test.ts`.
- Ollama provider changes: run `src/providers/ollamaPatchProvider.test.ts` and `src/providers/ollamaDraftQuality.test.ts`. Live local `qwen3:14b` quality probes are registered separately under `npm run test:ollama`; they cover direct coin drafts, grass variation sets, hero idle/cape, and tentacle creature variations when Ollama and the model are available. If aborted Ollama requests leave qwen busy, unload it with a local `/api/generate` call using `{"model":"qwen3:14b","keep_alive":0}` before rerunning.
- App-shell/UI behavior changes: run `src/App.test.tsx` plus lint/typecheck.
- Documentation-only YAIML changes do not require app checks, but still inspect `git status --short`.

## Important Files

- `README.md`: user-facing overview, run instructions, export/save concepts.
- `docs/STATE_OF_SPRITEWRITE.md`: detailed current project state and active roadmap.
- `docs/PRODUCT_VISION.md`: durable product scope, asset categories, AI assistance model, recipe direction, and export direction.
- `docs/APP_FLOW.md`: intended user and state flow.
- `docs/AI_PATCH_DOCTRINE.md`: provider and patch boundaries.
- `docs/EXPORT_CONTRACT.md`: export promises.
- `docs/AUDIT_CHECKLIST.md`: manual audit checklist.
- `docs/DEV_LOOP.md`: development loop guidance.
- `src/domain/spriteTypes.ts`: central model contracts.
- `src/domain/spriteData.ts`: validation and pure project operations.
- `src/domain/exportPlanning.ts`: layout and metadata.
- `src/domain/exportRaster.ts`: pure pixel export renderer.
- `src/App.tsx`: app orchestration, state, provider workflow, and project mutations.
- `src/components/`: extracted UI surfaces for start screen, command palette, color picker, atlas timeline, full-sheet workspace, mini sprite thumbnail, and provider details.
- `src/domain/assetTypes.ts`: shared asset-type labels/options used by project/start UI.

## Current Worktree Caution

On 2026-07-01, `git status --short` reported the repository contents as untracked. Treat the tree as intentional human/agent work in progress. Do not run destructive cleanup, reset, checkout, delete, rename, or broad formatting commands unless explicitly asked.

## Agent Instructions Found

`AGENTS.md` exists as a generic YAIML entrypoint for future coding agents. No `CLAUDE.md`, `.cursorrules`, or contribution docs are currently present. Existing useful project docs are `README.md` and files under `docs/`.

## YAIML Maintenance

Provide the YAIML reference from the human prompt, workspace context, or a team-approved source at run time. Do not commit machine-specific reference paths, local drive names, user profile paths, `file://` URIs, localhost URLs, private workspace URLs, secrets, private transcripts, or raw sensitive logs into versioned project memory.

Phrases such as "update YAIML", "updated YAIML", "check new YAIML", "refresh YAIML", or "run a YAIML update" mean convention refresh, not an ordinary project-memory rewrite. For this repository, compare local YAIML scaffolding against the provided reference and update only compatible prompts, templates, discovery hints, agent-instruction pointers, or YAIML-maintenance guidance. Preserve project memory and the existing discovery layout unless a human explicitly authorizes a layout migration.

Phrases such as "clean up YAIML", "compress YAIML", "compact project memory", "prune project memory", or "prune SoT" mean to remove stale or repetitive memory while preserving current truth, evidence, human direction, decisions, unresolved conflicts, and uncertainty. Do not pad documents to meet budgets or delete necessary governed knowledge just to reduce word count.

This repository does not need local YAIML prompt or template copies unless it already keeps them for a concrete workflow. Do not add `prompts/` or `templates/` just because the reference has them. Preserve project-specific SoT, Architecture, Maintainer Guide, risks, commands, naming, and supporting documents unless the reference changes how future agents should maintain YAIML here.

## Diagnostics

If the local browser cannot connect to Vite, restart it from the repo root:

```bash
npm run dev:bash
```

If the configured default port is occupied, identify the listener before stopping anything. Avoid killing unrelated processes blindly.

If imports fail, validate the project JSON shape through `validateProject()` in `src/domain/spriteData.ts` and compare against `SpriteProject` in `src/domain/spriteTypes.ts`.

If exports look wrong, check the pure renderer first:

- `createSpriteSheetLayout()` in `src/domain/exportPlanning.ts`
- `renderFrameToRgbaBuffer()` and `renderAnimationToRgbaBuffer()` in `src/domain/exportRaster.ts`
- canvas wrapper in `src/utils/canvasExport.ts`

If you get repeated overlay errors or suspect stale dev sessions, run:

```text
Stop SpriteWrite.bat
```

To stop only one port:

```text
Stop SpriteWrite.bat 5173
```

Use this flow for reliable startup recovery:

1. `Stop SpriteWrite.bat` (or `Stop SpriteWrite.bat <port>`)
2. `Run SpriteWrite.bat <port>` (or `Run SpriteWrite detached.bat <port>` if you want no attached terminal)
3. Refresh browser (hard refresh only if Vite cache clearly stale).

## Maintenance Rules

- Keep app changes narrow and tested.
- Preserve the doctrine that project data is canon.
- Do not add database/auth/cloud sync/packaging unless explicitly requested. Keep the local automation API bound to localhost.
- Do not add real Cuddler or OllamaSaddle dependencies.
- Do not store secrets or personal sensitive data in YAIML files.
- Update YAIML when the durable understanding changes, not for every small implementation detail.
