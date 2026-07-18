---
yaiml: 0.2
role: maintainer
title: Maintainer Guide
purpose: Operating knowledge for setup, checks, diagnostics, and safe maintenance.
belongs-here: commands, environment notes, focused checks, important files, danger files, diagnostics, failure playbooks, unverified procedures.
not-here: product roadmap, durable architecture narrative, complete implementation history.
durability: moderately stable; keep concise and practical.
read-with: SOT; Architecture; README.md; docs/PRODUCT_VISION.md; docs/DEV_LOOP.md; docs/AUDIT_CHECKLIST.md.
update-when: commands, setup, checks, common failures, generated files, or maintenance practices change.
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

Windows convenience launcher:

```text
Run SpriteWrite.bat
```

The launcher starts the local Vite dev server.

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
- `npm run build`
- `npm run typecheck`
- `npm run lint`
- `npm run preview`
- `npm test`

## Focused Checks

- Domain data/model changes: run relevant tests in `src/domain/*.test.ts` plus `npm run typecheck`.
- Export changes: run `src/domain/exportPlanning.test.ts`, `src/domain/exportRaster.test.ts`, `src/utils/canvasExport.test.ts`, plus build/typecheck.
- Provider parsing changes: run `src/providers/ollamaPatchProvider.test.ts`.
- Ollama provider changes: `src/providers/ollamaPatchProvider.test.ts` includes live local `qwen3:14b` integration checks when Ollama is running and that model is installed. Current live checks cover recipe/draft paths for coin, grass variation sets, hero idle/cape, and tentacle creature variations, so the focused provider suite can take longer than ordinary unit tests. If aborted Ollama requests leave qwen busy, unload it with a local `/api/generate` call using `{"model":"qwen3:14b","keep_alive":0}` before rerunning.
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
- `src/App.tsx`: main app UI and interaction state.

## Current Worktree Caution

On 2026-07-01, `git status --short` reported the repository contents as untracked. Treat the tree as intentional human/agent work in progress. Do not run destructive cleanup, reset, checkout, delete, rename, or broad formatting commands unless explicitly asked.

## Agent Instructions Found

`AGENTS.md` exists as a generic YAIML entrypoint for future coding agents. No `CLAUDE.md`, `.cursorrules`, or contribution docs are currently present. Existing useful project docs are `README.md` and files under `docs/`.

## YAIML Maintenance

Phrases such as "update YAIML", "updated YAIML", "check new YAIML", or "run a YAIML update" mean to compare this repository's local YAIML convention scaffolding against a human-provided, workspace-provided, or team-approved YAIML reference, refresh compatible prompts/templates/guidance/agent-instruction pointers, and preserve SpriteWrite-specific SoT, Architecture, Maintainer Guide, risks, commands, human decisions, and supporting project memory.

This is different from updating project memory after ordinary SpriteWrite work. For ordinary work, update only the affected YAIML documents and prune stale current-state information.

## Diagnostics

If the local browser cannot connect to Vite, restart it from the repo root:

```powershell
npm run dev
```

If port `5173` is occupied, identify the listener before stopping anything. Avoid killing unrelated processes blindly.

If imports fail, validate the project JSON shape through `validateProject()` in `src/domain/spriteData.ts` and compare against `SpriteProject` in `src/domain/spriteTypes.ts`.

If exports look wrong, check the pure renderer first:

- `createSpriteSheetLayout()` in `src/domain/exportPlanning.ts`
- `renderFrameToRgbaBuffer()` and `renderAnimationToRgbaBuffer()` in `src/domain/exportRaster.ts`
- canvas wrapper in `src/utils/canvasExport.ts`

## Maintenance Rules

- Keep app changes narrow and tested.
- Preserve the doctrine that project data is canon.
- Do not add backend/database/auth/cloud sync/packaging unless explicitly requested.
- Do not add real Cuddler or OllamaSaddle dependencies.
- Do not store secrets or personal sensitive data in YAIML files.
- Update YAIML when the durable understanding changes, not for every small implementation detail.
