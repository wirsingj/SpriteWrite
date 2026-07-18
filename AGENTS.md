# Instructions For Agents

Use YAIML as SpriteWrite project memory, not as a replacement for task-specific instructions.

Before meaningful work:

1. Read `yaiml.yml`.
2. Read the stable header of each declared YAIML document before its body.
3. Read the core YAIML documents declared in `yaiml.yml`: SoT for current state and priorities, Architecture for durable system shape, and Maintainer Guide for commands and diagnostics.
4. Load supporting project documents only when the current task touches their domain.
5. Verify task-relevant YAIML claims against repository reality before relying on them.

Read `docs/PRODUCT_VISION.md` for work that touches product scope, UX hierarchy, AI assistance, asset recipes, templates, exports, or engine-consumer positioning.

After material changes, update only the affected YAIML documents and prune stale current-state information. Do not turn YAIML into a work log.

Treat phrases such as "update YAIML", "updated YAIML", "check new YAIML", or "run a YAIML update" as convention-refresh requests: compare local YAIML scaffolding against a human-provided, workspace-provided, or team-approved YAIML reference, refresh compatible prompts/templates/guidance/agent pointers, and preserve SpriteWrite-specific project memory.
