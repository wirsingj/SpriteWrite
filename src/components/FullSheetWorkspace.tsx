import type { AnimationId, FrameId, SpriteProject } from '../domain/spriteTypes'
import { MiniSprite } from './MiniSprite'

export function FullSheetWorkspace({
  project,
  selectedAnimationId,
  selectedFrameId,
  selectedFrameIds,
  onSelectFrame,
}: {
  project: SpriteProject
  selectedAnimationId: AnimationId
  selectedFrameId: FrameId
  selectedFrameIds: Set<FrameId>
  onSelectFrame: (animationId: AnimationId, frameId: FrameId) => void
}) {
  const columnCount = Math.max(...project.animations.map((animation) => animation.frameIds.length))

  return (
    <section className="sheet-workspace" aria-label="Full sprite sheet view">
      <div className="stage-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Full Sprite Sheet View</h2>
          <p>
            {project.animations.length} row{project.animations.length === 1 ? '' : 's'} /{' '}
            {project.canvas.width}x{project.canvas.height} cells per frame. Click any frame to edit it.
          </p>
        </div>
      </div>

      <div className="sheet-row-list">
        {project.animations.map((animation) => (
          <div
            key={animation.id}
            className={`sheet-row ${selectedAnimationId === animation.id ? 'active' : ''}`}
          >
            <div className="sheet-row-heading">
              <strong>{animation.name}</strong>
              <span>
                {animation.frameIds.length} frame{animation.frameIds.length === 1 ? '' : 's'} / {animation.fps} FPS
              </span>
            </div>
            <div className="sheet-row-strip">
              {Array.from({ length: columnCount }).map((_, index) => {
                const frameId = animation.frameIds[index]
                if (!frameId) {
                  return (
                    <div
                      key={`${animation.id}-empty-${index}`}
                      className="sheet-frame-placeholder"
                      aria-label={`${animation.name} empty sprite sheet cell ${index + 1}`}
                    >
                      <span>{index + 1}</span>
                    </div>
                  )
                }

                const active = selectedFrameId === frameId
                const selected = selectedFrameIds.has(frameId)

                return (
                  <button
                    key={frameId}
                    type="button"
                    className={`${active ? 'active' : ''} ${selected ? 'selected' : ''}`.trim()}
                    onClick={() => onSelectFrame(animation.id, frameId)}
                    title={`Edit ${animation.name} frame ${index + 1}`}
                  >
                    <MiniSprite project={project} frameId={frameId} />
                    <span>{index + 1}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}
