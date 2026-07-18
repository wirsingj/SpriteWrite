import {
  createFullSpriteSheetExportMetadata,
  createFrameExportMetadata,
  createSpriteSheetExportMetadata,
} from '../domain/exportPlanning'
import {
  renderFullSpriteSheetToRgbaBuffer,
  renderAnimationToRgbaBuffer,
  renderFrameToRgbaBuffer,
  type RgbaBuffer,
} from '../domain/exportRaster'
import { rgbaBufferToPngBlob } from './pngExport'
import type {
  FrameId,
  FullSpriteSheetExportOptions,
  SpriteProject,
  SpriteSheetExportOptions,
} from '../domain/spriteTypes'

export function renderFrameToCanvas(
  project: SpriteProject,
  frameId: FrameId,
  scale = 1,
): HTMLCanvasElement {
  return rgbaBufferToCanvas(renderFrameToRgbaBuffer(project, frameId, { scale }))
}

export function rgbaBufferToCanvas(buffer: RgbaBuffer): HTMLCanvasElement {
  const canvas = document.createElement('canvas')
  canvas.width = buffer.width
  canvas.height = buffer.height
  const context = canvas.getContext('2d')
  if (!context) {
    throw new Error('Could not create canvas context.')
  }

  context.imageSmoothingEnabled = false
  const imageData = context.createImageData(buffer.width, buffer.height)
  imageData.data.set(buffer.data)
  context.putImageData(imageData, 0, 0)
  return canvas
}

export function exportFramePng(project: SpriteProject, frameId: FrameId, scale = 1): Promise<Blob> {
  return Promise.resolve(rgbaBufferToPngBlob(renderFrameToRgbaBuffer(project, frameId, { scale })))
}

export function exportSpritesheetPng(
  project: SpriteProject,
  animationId: string,
  options: Partial<Omit<SpriteSheetExportOptions, 'animationId'>> = {},
): Promise<Blob> {
  return Promise.resolve(rgbaBufferToPngBlob(renderAnimationToRgbaBuffer(project, animationId, options)))
}

export function exportFullSpriteSheetPng(
  project: SpriteProject,
  options: FullSpriteSheetExportOptions = {},
): Promise<Blob> {
  return Promise.resolve(rgbaBufferToPngBlob(renderFullSpriteSheetToRgbaBuffer(project, options)))
}

export function exportSpritesheetMetadata(
  project: SpriteProject,
  animationId: string,
  options: Partial<Omit<SpriteSheetExportOptions, 'animationId'>> = {},
): string {
  return JSON.stringify(createSpriteSheetExportMetadata(project, animationId, options), null, 2)
}

export function exportFullSpriteSheetMetadata(
  project: SpriteProject,
  options: FullSpriteSheetExportOptions = {},
): string {
  return JSON.stringify(createFullSpriteSheetExportMetadata(project, options), null, 2)
}

export function exportFrameMetadata(project: SpriteProject, frameId: FrameId): string {
  return JSON.stringify(createFrameExportMetadata(project, frameId), null, 2)
}
