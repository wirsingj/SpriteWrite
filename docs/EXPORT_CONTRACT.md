# Export Contract

Export is a product contract in SpriteWrite. The editor only matters if exported assets are clean, predictable, pixel-accurate, transparent where expected, and usable in game/software workflows without strange manual cleanup.

## Source Of Truth

Exports are derived from `SpriteProject` data:

- canvas dimensions
- palette IDs and colors
- sparse layer cells
- visible and exportable layers
- frames
- animation frame order
- anchors
- optional hitboxes
- frame names, notes, and tags
- metadata

Canvas rendering, editor grid lines, checkerboard backgrounds, selection outlines, onion skin overlays, and patch-preview overlays are views. They are never canon and must never be exported as sprite pixels.

## PNG Promises

- PNG exports use RGBA transparency.
- Transparent cells export as transparent pixels.
- Pixel art stays crisp.
- No smoothing or interpolation.
- At scale 1, each project cell maps to exactly one output pixel.
- At scale N, each project cell maps to exactly N by N output pixels.
- Visible layers are alpha-composited in layer order.
- A layer must be both visible and exportable to render into PNG output.
- Visible non-exportable layers are editor guidance only and must not appear in PNG output.
- Layer opacity affects exported RGBA pixels.
- Normal, multiply, and screen layer blend modes affect exported RGBA pixels.
- Frame dimensions are deterministic.
- Grid lines are not exported.
- Checkerboard backgrounds are not exported.
- Onion skin is not exported.
- Selection or patch-preview outlines are not exported.

## Tested Pixel Renderer

SpriteWrite exports now flow through a pure RGBA renderer before canvas/PNG output:

```text
SpriteProject -> export layout -> RGBA buffer -> canvas/ImageData -> PNG
```

The pure renderer returns:

```ts
{
  width: number
  height: number
  data: Uint8ClampedArray
}
```

`data` is RGBA ordered. This buffer is the tested export pixel source. Canvas export is a thin wrapper that copies the buffer into `ImageData` and asks the browser for a PNG blob.

The renderer tests cover transparent alpha, exact palette RGBA values, scale mapping, hidden layer exclusion, non-exportable layer exclusion, deterministic visible-layer order, alpha compositing for layer opacity, multiply/screen blend behavior, spritesheet frame regions, transparent margins/spacing, frame order, and metadata/layout agreement. Canvas wrapper tests cover ImageData copy behavior, disabled smoothing, and `image/png` blob export calls.

## Current Frame PNG

For current-frame PNG export:

- Width = `project.canvas.width * scale`.
- Height = `project.canvas.height * scale`.
- Scale is user-selectable in the UI from 1 to 16.
- Background is transparent.
- Only project cell data from visible exportable layers is rendered.
- Visible layer pixels are alpha-composited in layer order.
- At scale N, each cell expands to an N by N block of identical RGBA pixels.

## Horizontal Spritesheet PNG

For current-animation horizontal spritesheet export:

- Frame order matches `animation.frameIds`.
- `orientation = "horizontal"`.
- `scale` defaults to `1`.
- Scale is user-selectable in the UI from 1 to 16.
- `margin` defaults to `0`.
- `spacing` defaults to `0`.
- Margin and spacing are user-selectable non-negative integers in the UI.
- `frameWidth = project.canvas.width * scale`.
- `frameHeight = project.canvas.height * scale`.
- `sheetWidth = margin * 2 + frameWidth * frameCount + spacing * (frameCount - 1)`.
- `sheetHeight = margin * 2 + frameHeight`.

No trimming, cropping, packing, or reordering happens in the MVP export.

Margins and spacing remain transparent unless a future explicit background option changes that contract.

## Metadata JSON

Exported spritesheet metadata is plain JSON and should be usable by game engines or custom importers.

Metadata includes:

- `formatName: "SpriteWrite"`
- `formatVersion`
- `projectId`
- `projectName`
- `animationId`
- `animationName`
- `sourceFrameWidth`
- `sourceFrameHeight`
- `frameWidth`
- `frameHeight`
- `frameCount`
- `sheetWidth`
- `sheetHeight`
- `orientation`
- `scale`
- `margin`
- `spacing`
- `fps`
- `layers[]` with layer id, name, index, visibility, exportability, export inclusion, opacity, and blend mode
- top-level `anchor`
- top-level `hitbox` when present
- `frames[]` with `frameId`, `frameName`, `index`, `x`, `y`, `width`, `height`, `durationMs`, optional `notes`, optional `tags`, `anchor`, and optional `hitbox`

Metadata must match the actual PNG layout.

## Current Supported Outputs

- Project JSON.
- Current frame PNG.
- Current animation horizontal spritesheet PNG.
- Current animation metadata JSON.

## Future Output Directions

SpriteWrite should eventually support:

- vertical spritesheets
- grid spritesheets
- individual frame PNG batches
- atlas-style JSON
- Godot-friendly metadata
- Unity-friendly metadata
- custom importer metadata
- tiles or tile-like sheets
- UI/icon/menu asset exports
- background and parallax layer exports

These should extend the export contract instead of bypassing it.

## Non-Goals

- No proprietary engine-only export as the only format.
- No hidden binary project format.
- No AI-generated raster output.
- No blurry scaled export.
- No surprise trimming or cropping unless explicitly requested later.
- No export from screen DOM state.
