import { useRef, type DragEvent, type MouseEvent, type PointerEvent as ReactPointerEvent } from 'react'
import { getAnimation, getFrame } from '../domain/spriteData'
import type { AnimationId, FrameId, SpriteFrame, SpriteProject } from '../domain/spriteTypes'
import { MiniSprite } from './MiniSprite'

type WorkspaceMode = 'frame' | 'sheet'

export function AtlasOverview({
  project,
  selectedAnimationId,
  selectedFrameId,
  selectedFrameIds,
  draggedFrameId,
  onSelectFrame,
  onFrameDragStart,
  onFrameDrop,
  onFrameDragEnd,
  onAddFrame,
  onDuplicateSelectedFrames,
  onDeleteSelectedFrames,
  onSetSelectedDuration,
  onSetSelectedTags,
  onSetSelectedNotes,
  workspaceMode,
  onWorkspaceModeChange,
  onResizeStart,
}: {
  project: SpriteProject
  selectedAnimationId: AnimationId
  selectedFrameId: FrameId
  selectedFrameIds: Set<FrameId>
  draggedFrameId?: FrameId
  onSelectFrame: (
    animationId: AnimationId,
    frameId: FrameId,
    options?: { range?: boolean; toggle?: boolean },
  ) => void
  onFrameDragStart: (animationId: AnimationId, frameId: FrameId) => void
  onFrameDrop: (animationId: AnimationId, targetFrameId: FrameId) => void
  onFrameDragEnd: () => void
  onAddFrame: () => void
  onDuplicateSelectedFrames: () => void
  onDeleteSelectedFrames: () => void
  onSetSelectedDuration: (durationMs: number) => void
  onSetSelectedTags: (tagsInput: string) => void
  onSetSelectedNotes: (notes: string) => void
  workspaceMode: WorkspaceMode
  onWorkspaceModeChange: (mode: WorkspaceMode) => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const durationInputRef = useRef<HTMLInputElement | null>(null)
  const tagsInputRef = useRef<HTMLInputElement | null>(null)
  const notesInputRef = useRef<HTMLTextAreaElement | null>(null)
  const selectedAnimation = getAnimation(project, selectedAnimationId) ?? project.animations[0]
  const selectedFrameIdList = selectedAnimation.frameIds.filter((frameId) => selectedFrameIds.has(frameId))
  const selectedFrameCount = selectedFrameIdList.length || 1
  const selectedFrames = (selectedFrameIdList.length ? selectedFrameIdList : [selectedFrameId])
    .map((frameId) => getFrame(project, frameId))
    .filter((frame): frame is SpriteFrame => Boolean(frame))
  const selectedDurations = Array.from(new Set(selectedFrames.map((frame) => frame.durationMs)))
  const durationInputDefault = selectedDurations.length === 1 ? selectedDurations[0] : selectedFrames[0]?.durationMs ?? 100
  const selectedTagValues = Array.from(new Set(selectedFrames.map((frame) => (frame.tags ?? []).join(', '))))
  const tagsInputDefault = selectedTagValues.length === 1 ? selectedTagValues[0] : ''
  const selectedNoteValues = Array.from(new Set(selectedFrames.map((frame) => frame.notes ?? '')))
  const notesInputDefault = selectedNoteValues.length === 1 ? selectedNoteValues[0] : ''
  const canDeleteSelectedFrames = selectedAnimation.frameIds.length - selectedFrameCount >= 1

  return (
    <section className="atlas-overview" aria-label="Sprite atlas overview">
      <button
        type="button"
        className="panel-resize-handle panel-resize-handle-horizontal"
        aria-label="Resize sprite sheet rows panel"
        title="Drag to resize sprite sheet rows"
        onPointerDown={onResizeStart}
      />
      <div className="atlas-header">
        <div>
          <p className="eyebrow">Atlas</p>
          <h2>Sprite Sheet Rows</h2>
        </div>
        <div className="atlas-actions">
          <p className="status-line">
            {selectedFrameCount} selected. Shift-click selects a range, ctrl/cmd-click toggles, drag reorders.
          </p>
          <div className="segmented workspace-mode-toggle" aria-label="Workspace view">
            <button
              type="button"
              className={workspaceMode === 'frame' ? 'active' : ''}
              onClick={() => onWorkspaceModeChange('frame')}
            >
              Edit Frame
            </button>
            <button
              type="button"
              className={workspaceMode === 'sheet' ? 'active' : ''}
              onClick={() => onWorkspaceModeChange('sheet')}
            >
              Full Sheet
            </button>
          </div>
          <div className="segmented">
            <button type="button" onClick={onAddFrame}>
              Add Frame
            </button>
            <button type="button" onClick={onDuplicateSelectedFrames}>
              Duplicate Frame
            </button>
            <button type="button" onClick={onDeleteSelectedFrames} disabled={!canDeleteSelectedFrames}>
              Delete Frame
            </button>
          </div>
          <details className="atlas-batch-details">
            <summary>Batch Metadata</summary>
            <div className="atlas-batch-metadata">
              <label>
                Duration ms
                <input
                  key={`${selectedAnimationId}-${selectedFrameId}-${selectedFrameCount}-${durationInputDefault}`}
                  ref={durationInputRef}
                  type="number"
                  min="1"
                  defaultValue={durationInputDefault}
                />
              </label>
              <button
                type="button"
                onClick={() => onSetSelectedDuration(Number(durationInputRef.current?.value ?? durationInputDefault))}
              >
                Set Duration
              </button>
              {selectedDurations.length > 1 ? <span>Mixed timing</span> : null}
              <label>
                Tags
                <input
                  key={`${selectedAnimationId}-${selectedFrameId}-${selectedFrameCount}-tags-${tagsInputDefault}`}
                  ref={tagsInputRef}
                  defaultValue={tagsInputDefault}
                  placeholder={selectedTagValues.length > 1 ? 'mixed tags' : 'idle, contact'}
                />
              </label>
              <button
                type="button"
                onClick={() => onSetSelectedTags(tagsInputRef.current?.value ?? tagsInputDefault)}
              >
                Set Tags
              </button>
              {selectedTagValues.length > 1 ? <span>Mixed tags</span> : null}
              <label className="atlas-notes-field">
                Notes
                <textarea
                  key={`${selectedAnimationId}-${selectedFrameId}-${selectedFrameCount}-notes-${notesInputDefault}`}
                  ref={notesInputRef}
                  defaultValue={notesInputDefault}
                  placeholder={selectedNoteValues.length > 1 ? 'mixed notes' : 'Frame note'}
                />
              </label>
              <button
                type="button"
                onClick={() => onSetSelectedNotes(notesInputRef.current?.value ?? notesInputDefault)}
              >
                Set Notes
              </button>
              {selectedNoteValues.length > 1 ? <span>Mixed notes</span> : null}
            </div>
          </details>
        </div>
      </div>

      <div className="atlas-row-list">
        {project.animations.map((animation) => (
          <div
            key={animation.id}
            className={`atlas-row ${selectedAnimationId === animation.id ? 'active' : ''}`}
          >
            <button
              type="button"
              className="atlas-row-label"
              onClick={() => onSelectFrame(animation.id, animation.frameIds[0])}
            >
              <strong>{animation.name}</strong>
              <span>
                {animation.frameIds.length} frame{animation.frameIds.length === 1 ? '' : 's'} / {animation.fps} FPS
              </span>
              <span>
                {animation.frameIds.filter((frameId) => selectedFrameIds.has(frameId)).length || 1} selected
              </span>
            </button>
            <div className="atlas-frame-strip">
              {animation.frameIds.map((frameId, index) => {
                const frame = getFrame(project, frameId)
                const selected = selectedFrameIds.has(frameId)
                const active = selectedFrameId === frameId
                const dragged = draggedFrameId === frameId
                const className = [
                  active ? 'active' : '',
                  selected ? 'selected' : '',
                  dragged ? 'dragging' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button
                    key={frameId}
                    type="button"
                    className={className}
                    draggable
                    aria-pressed={selected}
                    aria-label={`${animation.name} frame ${index + 1}${frame?.name ? `, ${frame.name}` : ''}, ${
                      frame?.durationMs ?? 0
                    }ms`}
                    onClick={(event: MouseEvent<HTMLButtonElement>) => {
                      onSelectFrame(animation.id, frameId, {
                        range: event.shiftKey,
                        toggle: event.ctrlKey || event.metaKey,
                      })
                    }}
                    onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', frameId)
                      onFrameDragStart(animation.id, frameId)
                    }}
                    onDragOver={(event: DragEvent<HTMLButtonElement>) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(event: DragEvent<HTMLButtonElement>) => {
                      event.preventDefault()
                      onFrameDrop(animation.id, frameId)
                    }}
                    onDragEnd={onFrameDragEnd}
                    title={`${animation.name} frame ${index + 1}${frame?.name ? ` (${frame.name})` : ''}, ${
                      frame?.durationMs ?? 0
                    }ms. Drag to reorder.`}
                  >
                    <MiniSprite project={project} frameId={frameId} />
                    <span className="frame-index">{index + 1}</span>
                    <span className="frame-duration">{frame?.durationMs ?? 0}ms</span>
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
