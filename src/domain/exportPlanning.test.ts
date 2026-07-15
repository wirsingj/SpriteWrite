import { describe, expect, it } from 'vitest'
import {
  createSpriteSheetExportMetadata,
  createSpriteSheetLayout,
  resolveSpriteSheetExportOptions,
} from './exportPlanning'
import { createDefaultProject } from './spriteData'

describe('export planning', () => {
  it('creates the default horizontal layout with the correct frame count', () => {
    const project = createDefaultProject()
    const layout = createSpriteSheetLayout(project, 'idle')

    expect(layout.orientation).toBe('horizontal')
    expect(layout.frameCount).toBe(2)
    expect(layout.frames.map((frame) => frame.frameId)).toEqual(['idle-001', 'idle-002'])
  })

  it('sets horizontal sheet width to frameWidth * frameCount at scale 1', () => {
    const project = createDefaultProject()
    const layout = createSpriteSheetLayout(project, 'idle')

    expect(layout.frameWidth).toBe(32)
    expect(layout.sheetWidth).toBe(64)
  })

  it('sets horizontal sheet height to frameHeight at scale 1', () => {
    const project = createDefaultProject()
    const layout = createSpriteSheetLayout(project, 'idle')

    expect(layout.frameHeight).toBe(32)
    expect(layout.sheetHeight).toBe(32)
  })

  it('doubles frame regions and sheet dimensions at scale 2', () => {
    const project = createDefaultProject()
    const layout = createSpriteSheetLayout(project, 'idle', { scale: 2 })

    expect(layout.frameWidth).toBe(64)
    expect(layout.frameHeight).toBe(64)
    expect(layout.sheetWidth).toBe(128)
    expect(layout.sheetHeight).toBe(64)
    expect(layout.frames[1]).toMatchObject({ x: 64, y: 0, width: 64, height: 64 })
  })

  it('applies margin and spacing to sheet and frame regions', () => {
    const project = createDefaultProject()
    const layout = createSpriteSheetLayout(project, 'idle', { scale: 2, margin: 2, spacing: 3 })

    expect(layout.sheetWidth).toBe(135)
    expect(layout.sheetHeight).toBe(68)
    expect(layout.frames[0]).toMatchObject({ x: 2, y: 2, width: 64, height: 64 })
    expect(layout.frames[1]).toMatchObject({ x: 69, y: 2, width: 64, height: 64 })
  })

  it('creates non-overlapping ordered frame regions', () => {
    const project = createDefaultProject()
    const layout = createSpriteSheetLayout(project, 'idle')
    const [first, second] = layout.frames

    expect(first.index).toBe(0)
    expect(second.index).toBe(1)
    expect(first.x + first.width).toBeLessThanOrEqual(second.x)
  })

  it('creates metadata that matches the layout', () => {
    const project = createDefaultProject()
    const layout = createSpriteSheetLayout(project, 'idle', { margin: 1, spacing: 2 })
    const metadata = createSpriteSheetExportMetadata(project, 'idle', { margin: 1, spacing: 2 })

    expect(metadata).toMatchObject({
      formatName: 'SpriteWrite',
      formatVersion: 1,
      projectName: project.name,
      animationId: layout.animationId,
      frameWidth: layout.frameWidth,
      frameHeight: layout.frameHeight,
      frameCount: layout.frameCount,
      sheetWidth: layout.sheetWidth,
      sheetHeight: layout.sheetHeight,
      orientation: layout.orientation,
      scale: layout.scale,
      margin: layout.margin,
      spacing: layout.spacing,
    })
    expect(metadata.frames).toEqual(layout.frames)
    expect(metadata.layers[0]).toMatchObject({ id: 'base', blendMode: 'normal' })
  })

  it('rejects missing animations', () => {
    const project = createDefaultProject()

    expect(() => createSpriteSheetLayout(project, 'missing')).toThrow('Missing animation')
  })

  it('rejects invalid export options and normalizes valid defaults', () => {
    expect(resolveSpriteSheetExportOptions({ animationId: 'idle' })).toMatchObject({
      orientation: 'horizontal',
      scale: 1,
      margin: 0,
      spacing: 0,
      background: 'transparent',
      includeMetadata: true,
    })

    expect(() => createSpriteSheetLayout(createDefaultProject(), 'idle', { scale: 0 })).toThrow(
      'scale',
    )
    expect(() => createSpriteSheetLayout(createDefaultProject(), 'idle', { margin: -1 })).toThrow(
      'margin',
    )
  })

  it('includes anchor and hitbox metadata when present', () => {
    const project = createDefaultProject()
    const metadata = createSpriteSheetExportMetadata(project, 'idle')

    expect(metadata.anchor).toEqual({ x: 16, y: 24 })
    expect(metadata.hitbox).toEqual({ x: 9, y: 14, width: 15, height: 11 })
    expect(metadata.frames[0].frameName).toBe('Idle 001')
    expect(metadata.frames[0].notes).toBe('Idle squash pose.')
    expect(metadata.frames[0].tags).toEqual(['idle', 'ooze'])
    expect(metadata.frames[0].anchor).toEqual({ x: 16, y: 24 })
    expect(metadata.frames[0].hitbox).toEqual({ x: 9, y: 14, width: 15, height: 11 })
  })
})
