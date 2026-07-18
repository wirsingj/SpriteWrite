import { describe, expect, it } from 'vitest'
import {
  createFullSpriteSheetExportMetadata,
  createFullSpriteSheetLayout,
  createSpriteSheetExportMetadata,
  createSpriteSheetLayout,
  resolveFullSpriteSheetExportOptions,
  resolveSpriteSheetExportOptions,
} from './exportPlanning'
import { createDefaultProject, createHeroDemoProject } from './spriteData'

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
    project.frames.forEach((frame) => {
      frame.layers[0].group = 'Art'
    })
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
    expect(metadata.layers[0]).toMatchObject({ id: 'base', group: 'Art', blendMode: 'normal' })
    expect(metadata.grid).toEqual({
      columns: layout.frameCount,
      rows: 1,
      originX: layout.margin,
      originY: layout.margin,
      cellWidth: layout.frameWidth,
      cellHeight: layout.frameHeight,
      margin: layout.margin,
      spacing: layout.spacing,
    })
    expect(metadata.importHints).toEqual({
      alpha: 'straight',
      transparentBackground: true,
      premultipliedAlpha: false,
      smoothing: false,
      frameRegionUnit: 'pixels',
      frameRegionBasis: 'top-left',
    })
  })

  it('describes one-frame static assets as an exact one-cell import grid', () => {
    const project = createDefaultProject()
    const idle = project.animations.find((animation) => animation.id === 'idle')
    if (!idle) {
      throw new Error('Missing idle animation.')
    }
    idle.frameIds = ['idle-001']

    const metadata = createSpriteSheetExportMetadata(project, 'idle', {
      scale: 3,
      margin: 4,
      spacing: 5,
    })

    expect(metadata.frameCount).toBe(1)
    expect(metadata.sheetWidth).toBe(104)
    expect(metadata.sheetHeight).toBe(104)
    expect(metadata.grid).toMatchObject({
      columns: 1,
      rows: 1,
      originX: 4,
      originY: 4,
      cellWidth: 96,
      cellHeight: 96,
      margin: 4,
      spacing: 5,
    })
    expect(metadata.frames).toEqual([
      expect.objectContaining({
        frameId: 'idle-001',
        index: 0,
        x: 4,
        y: 4,
        width: 96,
        height: 96,
      }),
    ])
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

  it('creates a full sprite sheet grid with one animation per row and max frames as columns', () => {
    const project = createHeroDemoProject()
    const layout = createFullSpriteSheetLayout(project)

    expect(layout.orientation).toBe('rows')
    expect(layout.rowCount).toBe(4)
    expect(layout.columnCount).toBe(5)
    expect(layout.frameWidth).toBe(32)
    expect(layout.frameHeight).toBe(32)
    expect(layout.sheetWidth).toBe(160)
    expect(layout.sheetHeight).toBe(128)
    expect(layout.animations.map((animation) => animation.animationName)).toEqual([
      'Idle',
      'Jump',
      'Crouch',
      'Sword Stab',
    ])
    expect(layout.animations.map((animation) => animation.frameCount)).toEqual([4, 5, 3, 5])
  })

  it('respects full sprite sheet scale, margins, and spacing', () => {
    const project = createHeroDemoProject()
    const layout = createFullSpriteSheetLayout(project, {
      scale: 2,
      margin: 3,
      spacing: 5,
      imageFilename: 'hero-sheet.png',
    })

    expect(layout.imageFilename).toBe('hero-sheet.png')
    expect(layout.frameWidth).toBe(64)
    expect(layout.frameHeight).toBe(64)
    expect(layout.sheetWidth).toBe(3 * 2 + 64 * 5 + 5 * 4)
    expect(layout.sheetHeight).toBe(3 * 2 + 64 * 4 + 5 * 3)
    expect(layout.animations[1].frames[2]).toMatchObject({
      animationId: 'jump',
      rowIndex: 1,
      columnIndex: 2,
      x: 3 + 2 * (64 + 5),
      y: 3 + 1 * (64 + 5),
      width: 64,
      height: 64,
    })
  })

  it('creates full sprite sheet metadata that matches layout and frame ordering', () => {
    const project = createHeroDemoProject()
    const layout = createFullSpriteSheetLayout(project, {
      margin: 1,
      spacing: 2,
      imageFilename: 'hero-full-sheet.png',
    })
    const metadata = createFullSpriteSheetExportMetadata(project, {
      margin: 1,
      spacing: 2,
      imageFilename: 'hero-full-sheet.png',
    })

    expect(metadata).toMatchObject({
      formatName: 'SpriteWrite',
      formatVersion: 1,
      imageFilename: 'hero-full-sheet.png',
      projectName: project.name,
      sheetWidth: layout.sheetWidth,
      sheetHeight: layout.sheetHeight,
      rowCount: 4,
      columnCount: 5,
      scale: 1,
      margin: 1,
      spacing: 2,
    })
    expect(metadata.grid).toMatchObject({
      columns: 5,
      rows: 4,
      originX: 1,
      originY: 1,
      cellWidth: 32,
      cellHeight: 32,
    })
    expect(metadata.animations[0]).toMatchObject({
      animationId: 'idle',
      animationName: 'Idle',
      rowIndex: 0,
      frameCount: 4,
      fps: 6,
      loop: true,
    })
    expect(metadata.animations[3].frames[4]).toMatchObject({
      animationId: 'sword_stab',
      frameId: 'sword-stab-005',
      frameName: 'Sword Stab 005',
      rowIndex: 3,
      columnIndex: 4,
      x: 1 + 4 * (32 + 2),
      y: 1 + 3 * (32 + 2),
      width: 32,
      height: 32,
      durationMs: 140,
      tags: ['attack', 'sword', 'recovery', 'hero'],
      anchor: { x: 16, y: 25 },
      hitbox: { x: 10, y: 7, width: 17, height: 19 },
    })
    expect(metadata.frames.map((frame) => `${frame.animationId}:${frame.frameId}`)).toEqual(
      project.animations.flatMap((animation) =>
        animation.frameIds.map((frameId) => `${animation.id}:${frameId}`),
      ),
    )
  })

  it('rejects invalid full sprite sheet export options', () => {
    expect(resolveFullSpriteSheetExportOptions()).toMatchObject({
      scale: 1,
      margin: 0,
      spacing: 0,
      background: 'transparent',
      includeMetadata: true,
      imageFilename: 'sprite-sheet.png',
    })
    expect(() => createFullSpriteSheetLayout(createHeroDemoProject(), { scale: 0 })).toThrow('scale')
    expect(() => createFullSpriteSheetLayout(createHeroDemoProject(), { spacing: -1 })).toThrow(
      'spacing',
    )
    expect(() => createFullSpriteSheetLayout(createHeroDemoProject(), { imageFilename: '' })).toThrow(
      'image filename',
    )
  })
})
