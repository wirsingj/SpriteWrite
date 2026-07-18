# AI Patch Doctrine

SpriteWrite may use AI, but AI is not the product. The rails around AI are the product.

Ollama should act as a constrained creative assistant and co-editor, not as an opaque one-click art generator. The goal is to make broad requests like "generate me a sprite sheet" useful by adding structure: known frame dimensions, controlled palette, neighboring frames, fixed animation ordering, stable proportions and silhouette, layers, frame intent, explicit transformation constraints, and deterministic editable output.

## Provider Contract

An AI patch provider implements `AiPatchProvider`:

```ts
requestPatch({
  project,
  animationId,
  frameId,
  layerId,
  instruction,
  constraints,
}) => Promise<PixelPatchOperation[]>
```

The provider receives structured project context and returns patch operations. It must not return an image as the primary output.

## SpriteWrite Prompt Padding

Users should be able to write plain asset requests such as "gold coin" or "a 4-6 frame gold coin spinning animation." SpriteWrite is responsible for interpreting and padding those requests before they reach Ollama or another provider.

The current prompt-intent layer classifies requests into:

- selected-frame patch: small edits such as "add a highlight" or "clean the outline"
- single-frame draft: whole static assets such as "gold coin" or "wall tile"
- animation draft: multi-frame or animation requests such as "a 4-6 frame gold coin spinning animation"

Padded provider instructions include the original user request, the SpriteWrite interpretation, canvas dimensions, allowed palette IDs, frame-count expectations, centering/readability guidance, and the strict JSON-only output contract. This keeps the UX from becoming direct provider chat while preserving editable structured output.

Broad asset requests may use a separate structured animation-draft rail. That rail still returns editable JSON cell operations, not raster output:

```ts
requestAnimationDraft({
  project,
  animationId,
  frameId,
  layerId,
  instruction,
  constraints,
  frameCount,
}) => Promise<{
  animationName?: string
  fps?: number
  frames: Array<{
    name?: string
    durationMs?: number
    patch: PixelPatchOperation[]
  }>
}>
```

Use the selected-frame patch rail for small edits such as "add a highlight" or "fix the outline." Use the single-frame draft rail for static whole assets. Use the animation-draft rail for multi-frame prompts such as "hero wearing a cape, standing animation" or "a 4-6 frame coin spin." Draft frames must be validated before they replace or create animation frames.

Future provider rails may suggest structured palette changes, duplicated-and-modified frames, or explicit layer operations. They should still be validated, previewed, accepted, rejected, undoable, and manually editable.

## Focused AI Operations

Design AI assistance around operations such as:

- Draft a first frame from a structured description.
- Derive a new frame from an existing frame.
- Create an in-between frame.
- Alter pose while preserving identity and palette.
- Create animation follow-through.
- Generate controlled asset variants.
- Clean silhouette noise.
- Simplify or expand a palette.
- Suggest animation structure and frame counts.
- Apply a described patch only to selected cells or layers.
- Evaluate continuity between frames.

## Allowed Patch Operations

```json
{ "op": "set", "x": 12, "y": 18, "colorId": "accent" }
```

```json
{ "op": "clear", "x": 13, "y": 18 }
```

Only `set` and `clear` are currently supported.

## Rejected Behavior

Providers must not:

- Return PNGs, base64 images, or sprite sheets.
- Return generated raster images as the editable source of truth.
- Return markdown as the primary output.
- Return prose instead of patch JSON.
- Return placeholder marks, diagnostic X symbols, labels, arrows, or scattered test pixels as the asset.
- Invent palette colors.
- Resize the canvas.
- Change hidden state.
- Edit missing or hidden layers.
- Bypass validation.
- Apply changes automatically.

## Validation Rules

`validatePatch()` must reject:

- Non-array patches.
- Invalid operation names.
- Missing or malformed coordinates.
- Out-of-bounds coordinates.
- Unknown color IDs.
- Setting transparent instead of using `clear`.
- Extra operation fields such as dimension changes.
- Missing animation, frame, or layer targets.
- Non-editable layer targets.

## Bad Output Handling

Bad model output is expected. The app should survive:

- HTTP failures.
- Empty provider responses.
- Invalid JSON.
- JSON that is not an operation array.
- Common JSON wrapper variants around patch arrays.
- Valid JSON with the wrong object shape.
- Operation arrays that fail validation.
- Animation draft objects with invalid frame counts, invalid frame patches, or obviously scattered cell clusters.

Bad output should be visible to the user and should not mutate the project.

## Ollama Local Provider

Ollama is the first experimental local provider. SpriteWrite may list local Ollama models, pull/download a named model through the local Ollama API, ask the selected model for selected-frame patch JSON or a larger single-frame draft, and ask for a first-pass structured animation draft when the user prompt is clearly a multi-frame or animation request.

Ollama must remain a local patch proposal provider. Model management does not change the output contract.

The prompt should tell Ollama:

- The sprite is grid data.
- The palette IDs are fixed.
- It may return only JSON patch operations.
- It must not return images, markdown, explanations, or resized canvases.
- It should prefer small readable edits unless explicitly asked for larger changes.
- Broad asset/animation prompts should return a 3-6 frame draft object with per-frame patch arrays.

Even if Ollama returns plausible-looking output, SpriteWrite validates it before preview or apply.

Vision-oriented Ollama models may be locally available, but they are often a poor fit for strict JSON patch generation. The UI should warn when a selected model name looks vision-oriented or when Ollama model details expose vision families such as `clip`. SpriteWrite should still fail gracefully rather than blocking a user from experimenting.

## Cuddler And OllamaSaddle Future Seam

Cuddler may eventually orchestrate project context, files, prompts, provider windows, and local tooling.

OllamaSaddle may eventually normalize calls across Ollama and other local/provider systems.

SpriteWrite should not depend on either one. The correct integration direction is for future tools to hand SpriteWrite structured patch requests and receive structured patch results, not to drive it with image prompts.

## Why AI Does Not Return Images

Opaque images are not reviewable as operations. They cannot be safely merged with manual edits, cannot be validated against palette and dimensions, and cannot be cleanly undone at the cell level.

SpriteWrite exists to make assets possible by keeping every change inspectable.
