# Export Contract

Export is a product contract in SpriteWrite. The editor only matters if exported assets are clean, predictable, pixel-accurate, transparent where expected, and usable in game/software workflows without strange manual cleanup.

The export model is engine-neutral. SpriteWrite should produce boring PNG and JSON artifacts first. Godot, Unity, or custom importer outputs can become export profiles later, but no engine should define the internal project format.

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
- Optional layer group/folder labels are metadata only; they do not affect render order or inclusion.
- Layer opacity affects exported RGBA pixels.
- Normal, multiply, and screen layer blend modes affect exported RGBA pixels.
- Frame dimensions are deterministic.
- Grid lines are not exported.
- Checkerboard backgrounds are not exported.
- Onion skin is not exported.
- Selection or patch-preview outlines are not exported.

## Tested Pixel Renderer

SpriteWrite exports now flow through a pure RGBA renderer before PNG output:

```text
SpriteProject -> export layout -> RGBA buffer -> PNG encoder -> PNG blob
```

The pure renderer returns:

```ts
{
  width: number
  height: number
  data: Uint8ClampedArray
}
```

`data` is RGBA ordered. This buffer is the tested export pixel source. PNG export uses a small deterministic encoder from RGBA rows to RGBA PNG bytes, then wraps those bytes in an `image/png` blob. Canvas helpers remain available for browser display and ImageData copy checks, but PNG export does not depend on browser `canvas.toBlob`.

The renderer tests cover transparent alpha, exact palette RGBA values, scale mapping, hidden layer exclusion, non-exportable layer exclusion, deterministic visible-layer order, alpha compositing for layer opacity, multiply/screen blend behavior, animation-strip regions, full sprite-sheet row/column regions, transparent margins/spacing, transparent padding cells, frame order, and metadata/layout agreement. PNG encoder tests cover golden bytes and `image/png` blob wrapping; export wrapper tests decode PNG blobs for current-frame and full-sheet smoke checks.

## Current Frame PNG

For current-frame PNG export:

- Width = `project.canvas.width * scale`.
- Height = `project.canvas.height * scale`.
- Scale is user-selectable in the UI from 1 to 16.
- Background is transparent.
- Only project cell data from visible exportable layers is rendered.
- Visible layer pixels are alpha-composited in layer order.
- Layer group/folder labels do not change pixel output.
- At scale N, each cell expands to an N by N block of identical RGBA pixels.

Current-frame PNG is the primary static-asset export path for icons, buttons, backgrounds, props, and one-frame sprites.

## Animation Strip PNG

For current-animation strip export:

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

No trimming, cropping, packing, or reordering happens in animation-strip export.

Margins and spacing remain transparent unless a future explicit background option changes that contract.

A one-frame animation is valid. It can be used as a one-frame sheet/metadata export when a downstream importer expects sheet-style data even for static assets.

Animation-strip metadata includes a generic `grid-animation-strip` import profile with one-row slice settings and a single clip for the exported animation.

## Full Sprite Sheet PNG

For full project sprite-sheet export:

- The output is a fixed row-and-column grid.
- One animation exports per row.
- One frame exports per column.
- Row order matches `project.animations`.
- Frame order within each row matches each animation's `frameIds`.
- `rowCount = project.animations.length`.
- `columnCount = max(animation.frameIds.length)`.
- `frameWidth = project.canvas.width * scale`.
- `frameHeight = project.canvas.height * scale`.
- `sheetWidth = margin * 2 + frameWidth * columnCount + spacing * (columnCount - 1)`.
- `sheetHeight = margin * 2 + frameHeight * rowCount + spacing * (rowCount - 1)`.
- Shorter animation rows leave transparent cells after their final frame.
- Margins, spacing, and padded cells remain transparent.
- The editor's Full Sprite Sheet View should visually match this row/column order.

This is a Sprite Sheet, not a Packed Atlas. Use "Packed Atlas" only for a future export that implements arbitrary rectangle packing.

## Full Sprite Sheet Metadata JSON

Exported full sprite-sheet metadata is plain JSON and should be usable by game engines or custom importers.

Metadata includes:

- `formatName: "SpriteWrite"`
- `formatVersion`
- `imageFilename`
- `projectId`
- `projectName`
- `sourceFrameWidth`
- `sourceFrameHeight`
- `frameWidth`
- `frameHeight`
- `sheetWidth`
- `sheetHeight`
- `orientation: "rows"`
- `rowCount`
- `columnCount`
- `scale`
- `margin`
- `spacing`
- `grid` with columns, rows, origin, cell size, margin, and spacing for boring grid import.
- `importHints` with straight alpha, transparent background, no premultiplied alpha, no smoothing, pixel frame-region units, and top-left region basis.
- `importProfile` with a generic `grid-animation-rows` profile: slice origin, cell size, spacing, row/column counts, and one animation clip per row. Current-animation strip metadata uses the sibling `grid-animation-strip` profile with one row and one clip.
- `animations[]` with animation id, animation name, row index, frame count, FPS, loop behavior, and frame regions.
- top-level `frames[]` flattened in deterministic row-major order.
- each frame region includes animation id/name, frame id/name, row index, column index, x, y, width, height, duration, optional notes, tags, anchor, and hitbox when present.

Metadata must match the actual PNG layout.

For engine importers, the boring default is:

- Slice from `grid.originX`, `grid.originY`.
- Use `grid.cellWidth` and `grid.cellHeight` as the frame size.
- Use `grid.spacing` between frames.
- Or read `importProfile.slice` and `importProfile.animationClips[]` directly when the importer wants a single generic recipe for row-based animation clips.
- Read `frames[]` when an importer wants explicit per-frame rectangles.
- Treat all rectangle coordinates and dimensions as output PNG pixels, not source-grid cells.
- Disable filtering/smoothing in the engine importer for pixel art.

## Current Supported Outputs

- Project JSON.
- Current frame PNG.
- Current animation strip PNG.
- Full sprite sheet PNG.
- Full sprite sheet PNG plus matching metadata JSON.

## Future Output Directions

SpriteWrite should eventually support:

- vertical sprite sheets
- individual frame PNG batches
- packed atlas PNG/JSON with arbitrary rectangle packing
- engine export profiles, including Godot and Unity
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
