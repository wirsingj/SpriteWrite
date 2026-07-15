# AI Patch Doctrine

SpriteWrite may use AI later, but AI is not the product. The rails around AI are the product.

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
- Return markdown as the primary output.
- Return prose instead of patch JSON.
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
- Operation arrays that fail validation.

Bad output should be visible to the user and should not mutate the project.

## Ollama Future Plan

Ollama is the likely first real local provider. It should remain a local patch proposal provider.

The prompt should tell Ollama:

- The sprite is grid data.
- The palette IDs are fixed.
- It may return only JSON patch operations.
- It must not return images, markdown, explanations, or resized canvases.
- It should prefer small readable edits unless explicitly asked for larger changes.

Even if Ollama returns plausible-looking output, SpriteWrite validates it before preview or apply.

## Cuddler And OllamaSaddle Future Seam

Cuddler may eventually orchestrate project context, files, prompts, provider windows, and local tooling.

OllamaSaddle may eventually normalize calls across Ollama and other local/provider systems.

SpriteWrite should not depend on either one. The correct integration direction is for future tools to hand SpriteWrite structured patch requests and receive structured patch results, not to drive it with image prompts.

## Why AI Does Not Return Images

Opaque images are not reviewable as operations. They cannot be safely merged with manual edits, cannot be validated against palette and dimensions, and cannot be cleanly undone at the cell level.

SpriteWrite exists to make assets possible by keeping every change inspectable.
