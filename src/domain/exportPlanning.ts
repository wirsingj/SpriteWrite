import { getAnimation, getFrame } from './spriteData'
import type {
  AnimationId,
  FrameExportMetadata,
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
    throw new Error('Only horizontal spritesheet export is supported right now.')
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
