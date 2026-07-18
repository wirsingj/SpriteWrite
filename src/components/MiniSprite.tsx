import { cellKey } from '../domain/spriteData'
import { composeFramePixels } from '../domain/rendering'
import type { FrameId, PixelPatchOperation, SpriteProject } from '../domain/spriteTypes'

export function MiniSprite({
  project,
  frameId,
  highlightedOperations = [],
  className,
}: {
  project: SpriteProject
  frameId: FrameId
  highlightedOperations?: PixelPatchOperation[]
  className?: string
}) {
  const pixels = composeFramePixels(project, frameId)
  const highlightedCells = Array.from(
    highlightedOperations
      .reduce((cells, operation) => {
        cells.set(cellKey(operation.x, operation.y), operation)
        return cells
      }, new Map<string, PixelPatchOperation>())
      .values(),
  )

  return (
    <div
      className={className ? `mini-sprite ${className}` : 'mini-sprite'}
      style={{
        gridTemplateColumns: `repeat(${project.canvas.width}, 1fr)`,
        gridTemplateRows: `repeat(${project.canvas.height}, 1fr)`,
      }}
    >
      {pixels.map((pixel) => (
        <span
          key={`${pixel.x},${pixel.y},${pixel.colorId}`}
          className="mini-pixel"
          style={{
            gridColumn: pixel.x + 1,
            gridRow: pixel.y + 1,
            background: pixel.hex,
            opacity: pixel.opacity,
            mixBlendMode: pixel.blendMode,
          }}
        />
      ))}
      {highlightedCells.map((operation) => (
        <span
          key={`highlight-${operation.x}-${operation.y}`}
          className={`mini-highlight mini-highlight-${operation.op}`}
          title={
            operation.op === 'set'
              ? `Proposed set ${operation.x},${operation.y} to ${operation.colorId}`
              : `Proposed clear ${operation.x},${operation.y}`
          }
          style={{
            gridColumn: operation.x + 1,
            gridRow: operation.y + 1,
          }}
        />
      ))}
    </div>
  )
}
