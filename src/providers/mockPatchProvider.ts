import { cellKey, getFrame, getLayer } from '../domain/spriteData'
import type { AiPatchProvider, AiPatchRequest } from './aiPatchProvider'
import type { PixelPatchOperation } from '../domain/spriteTypes'

export class MockPatchProvider implements AiPatchProvider {
  id = 'mock'
  label = 'Mock'

  async requestPatch(request: AiPatchRequest): Promise<PixelPatchOperation[]> {
    const frame = getFrame(request.project, request.frameId)
    const layer = frame ? getLayer(frame, request.layerId) : undefined
    const width = request.project.canvas.width
    const height = request.project.canvas.height
    const occupied = layer ? Object.keys(layer.cells).map((key) => key.split(',').map(Number)) : []
    const averageX = occupied.length
      ? Math.round(occupied.reduce((sum, [x]) => sum + x, 0) / occupied.length)
      : Math.floor(width / 2)
    const averageY = occupied.length
      ? Math.round(occupied.reduce((sum, [, y]) => sum + y, 0) / occupied.length)
      : Math.floor(height / 2)

    const instructionHash = Array.from(request.instruction).reduce(
      (sum, char) => sum + char.charCodeAt(0),
      0,
    )
    const direction = instructionHash % 2 === 0 ? 1 : -1
    const originX = clamp(averageX + direction * 4, 2, width - 3)
    const originY = clamp(averageY + (instructionHash % 3) - 1, 2, height - 3)

    const shape = [
      [0, -1],
      [-1, 0],
      [0, 0],
      [1, 0],
      [0, 1],
    ]

    return shape
      .map(([dx, dy]) => ({
        op: 'set' as const,
        x: originX + dx,
        y: originY + dy,
        colorId: request.constraints.selectedColorId,
      }))
      .filter((operation) => !layer?.cells[cellKey(operation.x, operation.y)])
  }
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}
