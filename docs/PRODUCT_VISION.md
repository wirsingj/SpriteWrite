---
yaiml: 0.2
role: product-vision
title: Product Vision
purpose: Durable SpriteWrite product scope, AI-assistance model, asset categories, recipe direction, and export direction.
belongs-here: product boundaries, asset scope, AI assistance principles, recipe model, export positioning, declared human intent.
not-here: volatile implementation state, command reference, detailed test inventory, complete feature history.
durability: stable; update when the product center or product boundaries change.
read-with: SOT; Architecture; docs/STATE_OF_SPRITEWRITE.md; docs/APP_FLOW.md; docs/AI_PATCH_DOCTRINE.md; docs/EXPORT_CONTRACT.md.
update-when: product scope, AI principles, asset categories, recipe strategy, or export positioning changes.
agent-guidance: Preserve broad product scope. Do not narrow SpriteWrite to one game, engine, model, or demo asset. Mark implementation gaps separately.
---

# Product Vision

SpriteWrite is a local-first, AI-assisted pixel asset studio for producing editable game and creative assets.

It is not an OozeTactics-specific utility, and it is not a Godot-specific exporter. OozeTactics is the first serious consumer and proving ground. Godot may become an important export profile. Neither one defines the product boundary.

## Asset Scope

SpriteWrite should support assets such as:

- animated characters and creatures
- static props and objects
- tiles, walls, terrain, and environment pieces
- backgrounds and parallax-ready layers
- visual effects
- icons and UI assets
- animation strips
- complete sprite sheets

Ooze-related examples are welcome as demo content or future recipes, but they must not dominate the product language.

## Resolution And Style

SpriteWrite should support multiple pixel-art resolutions and visual styles. Avoid treating phrases like "32-bit" or "N-bit" as technically literal product assumptions.

Represent concrete asset properties instead:

- canvas dimensions
- cell dimensions
- palette constraints
- export scale
- layer structure
- animation rows and frame order
- anchors and hitboxes
- export profile
- frame timing and loop behavior

## Core Principle

SpriteWrite should solve the failure of raw requests such as "generate me a sprite sheet."

The application must give AI generation enough structure to produce usable and editable results:

- known frame dimensions
- controlled palette
- existing neighboring frames
- fixed animation ordering
- stable character proportions and silhouette
- layers
- frame intent
- explicit transformation constraints
- deterministic editable output

Ollama should act as a constrained creative assistant and co-editor, not as an opaque one-click art generator.

## AI Assistance

AI assistance should be designed around focused operations:

- draft a first frame from a structured description
- derive a new frame from an existing frame
- create an in-between frame
- alter pose while preserving identity and palette
- create animation follow-through
- generate controlled asset variants
- clean silhouette noise
- simplify or expand a palette
- suggest animation structure and frame counts
- apply a described patch only to selected cells or layers
- evaluate continuity between frames

Prefer structured, reviewable results: editable pixel grids, palette changes, frame patches, duplicated-and-modified frames, or explicit layer operations.

AI output must never become an irreversible replacement. The user must be able to preview, accept, reject, undo, and manually edit every result.

## Asset Recipes

The project model should remain engine-neutral. Asset recipes or templates may provide defaults, but all defaults must stay editable.

A recipe can define:

- canvas and frame dimensions
- palette
- layers
- expected animations or variants
- default frame counts
- timing and loop behavior
- anchor defaults
- export defaults
- AI guidance and continuity constraints

Useful general starter recipes should come before narrow game-specific recipes.

Preferred broad categories:

- Character / Creature
- Tile / Environment
- Prop / Object
- Background
- Effect
- UI / Icon
- Custom

## Export Direction

The internal project format must not depend on a specific engine.

Generic exports come first:

- Current Frame PNG
- Current Animation Strip PNG
- Full Sprite Sheet PNG
- Full Sprite Sheet PNG + Metadata JSON
- Project JSON

Engine-friendly metadata should remain boring JSON. Godot, Unity, and custom importer profiles can be added later as export profiles, not as assumptions baked into the core model.
