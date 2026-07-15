# Development Loop

Future SpriteWrite passes should be narrow, auditable, and grounded in the current app.

## Working Loop

1. Read `docs/STATE_OF_SPRITEWRITE.md`.
2. Read `docs/APP_FLOW.md`.
3. Read `docs/AUDIT_CHECKLIST.md`.
4. Inspect the current code.
5. Make one focused improvement.
6. Run tests and build.
7. Update docs if behavior changed.
8. Summarize exactly what changed.
9. List the next recommended prompt.

## Warning

Do not add broad new feature clusters without first stabilizing the existing flow.

SpriteWrite should grow like a tool: one reliable workflow at a time. If a feature bypasses the project data model, makes AI the center, or turns canvas output into source of truth, it does not belong yet.

## Default Checks

Run these before handing work back:

```bash
npm run typecheck
npm test
npm run lint
npm run build
```

If a command is missing, either document that or add the smallest useful script. Do not introduce heavyweight tooling just to look complete.

## Change Discipline

- Prefer pure functions for data model changes.
- Keep React components focused on interaction and rendering.
- Route manual edits and provider edits through validated patches.
- Keep imports and exports derived from explicit project JSON.
- Add tests when changing patch validation, patch application, metadata, or project shape.
- Update `STATE_OF_SPRITEWRITE.md` when behavior changes.
