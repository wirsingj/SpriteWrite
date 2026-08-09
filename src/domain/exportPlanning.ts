import { getAnimation, getFrame } from './spriteData'
import type {
  AnimationId,
  FrameExportMetadata,
  FullSpriteSheetExportMetadata,
  FullSpriteSheetExportOptions,
  FullSpriteSheetLayout,
  SpriteProject,
  SpriteSheetExportMetadata,
  SpriteSheetExportOptions,
  SpriteSheetLayout,
  SpriteSheetOrientation,
} from './spriteTypes'

export const SPRITEWRITE_EXPORT_FORMAT_NAME = 'SpriteWrite'
export const SPRITEWRITE_EXPORT_FORMAT_VERSION = 1

export interface ResolvedSpriteSheetExportOptions {
  animationId: AnimationId
  orientation: SpriteSheetOrientation
  scale: number
  margin: number
  spacing: number
  background: 'transparent'
  includeMetadata: boolean
}

export interface ResolvedFullSpriteSheetExportOptions {
  scale: number
  margin: number
  spacing: number
  background: 'transparent'
  includeMetadata: boolean
  imageFilename: string
}

export function resolveSpriteSheetExportOptions(
  options: SpriteSheetExportOptions,
): ResolvedSpriteSheetExportOptions {
  const resolved = {
    animationId: options.animationId,
    orientation: options.orientation ?? 'horizontal',
    scale: options.scale ?? 1,
    margin: options.margin ?? 0,
    spacing: options.spacing ?? 0,
    background: options.background ?? 'transparent',
    includeMetadata: options.includeMetadata ?? true,
  }

  if (!resolved.animationId) {
    throw new Error('Export options require animationId.')
  }

  if (resolved.orientation !== 'horizontal') {
    throw new Error('Only horizontal animation strip export is supported right now.')
  }

  if (resolved.background !== 'transparent') {
    throw new Error('Only transparent export background is supported right now.')
  }

  validateNonNegativeInteger(resolved.margin, 'margin')
  validateNonNegativeInteger(resolved.spacing, 'spacing')

  if (!Number.isInteger(resolved.scale) || resolved.scale < 1 || resolved.scale > 16) {
    throw new Error('Export scale must be an integer from 1 to 16.')
  }

  return resolved
}

export function resolveFullSpriteSheetExportOptions(
  options: FullSpriteSheetExportOptions = {},
): ResolvedFullSpriteSheetExportOptions {
  const resolved = {
    scale: options.scale ?? 1,
    margin: options.margin ?? 0,
    spacing: options.spacing ?? 0,
    background: options.background ?? 'transparent',
    includeMetadata: options.includeMetadata ?? true,
    imageFilename: options.imageFilename ?? 'sprite-sheet.png',
  }

  if (resolved.background !== 'transparent') {
    throw new Error('Only transparent export background is supported right now.')
  }

  if (typeof resolved.imageFilename !== 'string' || resolved.imageFilename.trim() === '') {
    throw new Error('Full sprite sheet export requires an image filename.')
  }

  validateNonNegativeInteger(resolved.margin, 'margin')
  validateNonNegativeInteger(resolved.spacing, 'spacing')

  if (!Number.isInteger(resolved.scale) || resolved.scale < 1 || resolved.scale > 16) {
    throw new Error('Export scale must be an integer from 1 to 16.')
  }

  return {
    ...resolved,
    imageFilename: resolved.imageFilename.trim(),
  }
}

export function createSpriteSheetLayout(
  project: SpriteProject,
  animationId: AnimationId,
  options: Partial<Omit<SpriteSheetExportOptions, 'animationId'>> = {},
): SpriteSheetLayout {
  const resolved = resolveSpriteSheetExportOptions({ ...options, animationId })
  const animation = getAnimation(project, animationId)

  if (!animation) {
    throw new Error(`Missing animation "${animationId}".`)
  }

  if (animation.frameIds.length === 0) {
    throw new Error(`Animation "${animationId}" has no frames.`)
  }

  const sourceFrameWidth = project.canvas.width
  const sourceFrameHeight = project.canvas.height
  const frameWidth = sourceFrameWidth * resolved.scale
  const frameHeight = sourceFrameHeight * resolved.scale
  const frameCount = animation.frameIds.length
  const sheetWidth = resolved.margin * 2 + frameWidth * frameCount + resolved.spacing * (frameCount - 1)
  const sheetHeight = resolved.margin * 2 + frameHeight

  const frames = animation.frameIds.map((frameId, index) => {
    const frame = getFrame(project, frameId)
    if (!frame) {
      throw new Error(`Animation "${animationId}" references missing frame "${frameId}".`)
    }

    return {
      frameId,
      frameName: frame.name,
      index,
      x: resolved.margin + index * (frameWidth + resolved.spacing),
      y: resolved.margin,
      width: frameWidth,
      height: frameHeight,
      durationMs: frame.durationMs,
      notes: frame.notes,
      tags: frame.tags,
      anchor: frame.anchor,
      hitbox: frame.hitbox,
    }
  })

  const firstFrame = frames[0]
  const firstProjectFrame = getFrame(project, animation.frameIds[0])
  const layers =
    firstProjectFrame?.layers.map((layer, index) => ({
      id: layer.id,
      name: layer.name,
      group: layer.group,
      index,
      visible: layer.visible,
      exportable: layer.exportable !== false,
      includedInExport: layer.visible && layer.exportable !== false,
      opacity: layer.opacity,
      blendMode: layer.blendMode ?? 'normal',
    })) ?? []

  return {
    animationId: animation.id,
    animationName: animation.name,
    orientation: resolved.orientation,
    scale: resolved.scale,
    margin: resolved.margin,
    spacing: resolved.spacing,
    background: resolved.background,
    sourceFrameWidth,
    sourceFrameHeight,
    frameWidth,
    frameHeight,
    frameCount,
    sheetWidth,
    sheetHeight,
    fps: animation.fps,
    anchor: firstFrame.anchor,
    hitbox: firstFrame.hitbox,
    layers,
    frames,
    grid: {
      columns: frameCount,
      rows: 1,
      originX: resolved.margin,
      originY: resolved.margin,
      cellWidth: frameWidth,
      cellHeight: frameHeight,
      margin: resolved.margin,
      spacing: resolved.spacing,
    },
    importHints: {
      alpha: 'straight',
      transparentBackground: true,
      premultipliedAlpha: false,
      smoothing: false,
      frameRegionUnit: 'pixels',
      frameRegionBasis: 'top-left',
    },
    importProfile: {
      kind: 'grid-animation-strip',
      description:
        'Slice the image as a one-row fixed grid, then create one animation clip from the declared frame count.',
      slice: {
        originX: resolved.margin,
        originY: resolved.margin,
        cellWidth: frameWidth,
        cellHeight: frameHeight,
        spacing: resolved.spacing,
        columns: frameCount,
        rows: 1,
      },
      animationClips: [
        {
          animationId: animation.id,
          animationName: animation.name,
          rowIndex: 0,
          startColumn: 0,
          frameCount,
          fps: animation.fps,
          loop: true,
        },
      ],
    },
  }
}

export function createFullSpriteSheetLayout(
  project: SpriteProject,
  options: FullSpriteSheetExportOptions = {},
): FullSpriteSheetLayout {
  const resolved = resolveFullSpriteSheetExportOptions(options)

  if (!project.animations.length) {
    throw new Error('Full sprite sheet export requires at least one animation.')
  }

  const sourceFrameWidth = project.canvas.width
  const sourceFrameHeight = project.canvas.height
  const frameWidth = sourceFrameWidth * resolved.scale
  const frameHeight = sourceFrameHeight * resolved.scale
  const rowCount = project.animations.length
  const columnCount = Math.max(...project.animations.map((animation) => animation.frameIds.length))

  if (columnCount <= 0) {
    throw new Error('Full sprite sheet export requires at least one frame.')
  }

  const sheetWidth = resolved.margin * 2 + frameWidth * columnCount + resolved.spacing * Math.max(0, columnCount - 1)
  const sheetHeight = resolved.margin * 2 + frameHeight * rowCount + resolved.spacing * Math.max(0, rowCount - 1)

  const animations = project.animations.map((animation, rowIndex) => {
    if (!animation.frameIds.length) {
      throw new Error(`Animation "${animation.id}" has no frames.`)
    }

    const frames = animation.frameIds.map((frameId, columnIndex) => {
      const frame = getFrame(project, frameId)
      if (!frame) {
        throw new Error(`Animation "${animation.id}" references missing frame "${frameId}".`)
      }

      return {
        animationId: animation.id,
        animationName: animation.name,
        frameId,
        frameName: frame.name,
        index: columnIndex,
        rowIndex,
        columnIndex,
        x: resolved.margin + columnIndex * (frameWidth + resolved.spacing),
        y: resolved.margin + rowIndex * (frameHeight + resolved.spacing),
        width: frameWidth,
        height: frameHeight,
        durationMs: frame.durationMs,
        notes: frame.notes,
        tags: frame.tags,
        anchor: frame.anchor,
        hitbox: frame.hitbox,
      }
    })

    return {
      animationId: animation.id,
      animationName: animation.name,
      rowIndex,
      frameCount: animation.frameIds.length,
      fps: animation.fps,
      loop: true,
      frames,
    }
  })

  return {
    imageFilename: resolved.imageFilename,
    orientation: 'rows',
    scale: resolved.scale,
    margin: resolved.margin,
    spacing: resolved.spacing,
    background: resolved.background,
    sourceFrameWidth,
    sourceFrameHeight,
    frameWidth,
    frameHeight,
    sheetWidth,
    sheetHeight,
    rowCount,
    columnCount,
    animations,
    frames: animations.flatMap((animation) => animation.frames),
    grid: {
      columns: columnCount,
      rows: rowCount,
      originX: resolved.margin,
      originY: resolved.margin,
      cellWidth: frameWidth,
      cellHeight: frameHeight,
      margin: resolved.margin,
      spacing: resolved.spacing,
    },
    importHints: {
      alpha: 'straight',
      transparentBackground: true,
      premultipliedAlpha: false,
      smoothing: false,
      frameRegionUnit: 'pixels',
      frameRegionBasis: 'top-left',
    },
    importProfile: {
      kind: 'grid-animation-rows',
      description:
        'Slice the image as a fixed grid, then create one animation clip per row using the declared frame count.',
      slice: {
        originX: resolved.margin,
        originY: resolved.margin,
        cellWidth: frameWidth,
        cellHeight: frameHeight,
        spacing: resolved.spacing,
        columns: columnCount,
        rows: rowCount,
      },
      animationClips: animations.map((animation) => ({
        animationId: animation.animationId,
        animationName: animation.animationName,
        rowIndex: animation.rowIndex,
        startColumn: 0,
        frameCount: animation.frameCount,
        fps: animation.fps,
        loop: true,
      })),
    },
  }
}

export function createSpriteSheetExportMetadata(
  project: SpriteProject,
  animationId: AnimationId,
  options: Partial<Omit<SpriteSheetExportOptions, 'animationId'>> = {},
): SpriteSheetExportMetadata {
  return {
    formatName: SPRITEWRITE_EXPORT_FORMAT_NAME,
    formatVersion: SPRITEWRITE_EXPORT_FORMAT_VERSION,
    projectId: project.id,
    projectName: project.name,
    projectDescription: project.description,
    assetType: project.assetType,
    generatedAt: new Date().toISOString(),
    ...createSpriteSheetLayout(project, animationId, options),
  }
}

export function createFullSpriteSheetExportMetadata(
  project: SpriteProject,
  options: FullSpriteSheetExportOptions = {},
): FullSpriteSheetExportMetadata {
  return {
    formatName: SPRITEWRITE_EXPORT_FORMAT_NAME,
    formatVersion: SPRITEWRITE_EXPORT_FORMAT_VERSION,
    projectId: project.id,
    projectName: project.name,
    projectDescription: project.description,
    assetType: project.assetType,
    generatedAt: new Date().toISOString(),
    ...createFullSpriteSheetLayout(project, options),
  }
}

export function createFrameExportMetadata(
  project: SpriteProject,
  frameId: string,
  scale = 1,
): FrameExportMetadata {
  if (!Number.isInteger(scale) || scale < 1 || scale > 16) {
    throw new Error('Export scale must be an integer from 1 to 16.')
  }

  const frame = getFrame(project, frameId)
  if (!frame) {
    throw new Error(`Missing frame "${frameId}".`)
  }

  return {
    formatName: SPRITEWRITE_EXPORT_FORMAT_NAME,
    formatVersion: SPRITEWRITE_EXPORT_FORMAT_VERSION,
    projectId: project.id,
    projectName: project.name,
    projectDescription: project.description,
    assetType: project.assetType,
    frameId,
    frameWidth: project.canvas.width * scale,
    frameHeight: project.canvas.height * scale,
    sourceFrameWidth: project.canvas.width,
    sourceFrameHeight: project.canvas.height,
    scale,
    background: 'transparent',
    anchor: frame.anchor,
    hitbox: frame.hitbox,
    generatedAt: new Date().toISOString(),
  }
}

function validateNonNegativeInteger(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Export ${label} must be a non-negative integer.`)
  }
}
