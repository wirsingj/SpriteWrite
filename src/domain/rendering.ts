import {
  cellKey,
  getColor,
  getFrame,
  getLayer,
  parseCellKey,
} from './spriteData'
import type { FrameId, LayerBlendMode, LayerId, SpriteProject } from './spriteTypes'

export function composeFramePixels(
  project: SpriteProject,
  frameId: FrameId,
  layerId?: LayerId,
): Array<{ x: number; y: number; hex: string; colorId: string; opacity: number; blendMode: LayerBlendMode }> {
  const frame = getFrame(project, frameId)
  if (!frame) {
    return []
  }

  const layers = layerId ? frame.layers.filter((layer) => layer.id === layerId) : frame.layers

  return layers
    .filter((layer) => layer.visible)
    .flatMap((layer) =>
      Object.entries(layer.cells).flatMap(([key, colorId]) => {
        const color = getColor(project, colorId)
        if (!color || color.isTransparent) {
          return []
        }

        return [
          {
            ...parseCellKey(key),
            colorId,
            hex: color.hex,
            opacity: layer.opacity,
            blendMode: layer.blendMode ?? 'normal',
          },
        ]
      }),
    )
}

export function getLayerColorId(
  project: SpriteProject,
  frameId: FrameId,
  layerId: LayerId,
  x: number,
  y: number,
): string | undefined {
  const frame = getFrame(project, frameId)
  const layer = frame ? getLayer(frame, layerId) : undefined
  return layer?.cells[cellKey(x, y)]
}
