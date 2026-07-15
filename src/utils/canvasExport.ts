import {
  createFrameExportMetadata,
  createSpriteSheetExportMetadata,
} from '../domain/exportPlanning'
import {
  renderAnimationToRgbaBuffer,
  renderFrameToRgbaBuffer,
  type RgbaBuffer,
} from '../domain/exportRaster'
import type { FrameId, SpriteProject, SpriteSheetExportOptions } from '../domain/spriteTypes'

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
  return canvasToBlob(renderFrameToCanvas(project, frameId, scale))
}

export function exportSpritesheetPng(
  project: SpriteProject,
  animationId: string,
  options: Partial<Omit<SpriteSheetExportOptions, 'animationId'>> = {},
): Promise<Blob> {
  return canvasToBlob(rgbaBufferToCanvas(renderAnimationToRgbaBuffer(project, animationId, options)))
}

export function exportSpritesheetMetadata(
  project: SpriteProject,
  animationId: string,
  options: Partial<Omit<SpriteSheetExportOptions, 'animationId'>> = {},
): string {
  return JSON.stringify(createSpriteSheetExportMetadata(project, animationId, options), null, 2)
}

export function exportFrameMetadata(project: SpriteProject, frameId: FrameId): string {
  return JSON.stringify(createFrameExportMetadata(project, frameId), null, 2)
}

function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (blob) {
        resolve(blob)
      } else {
        reject(new Error('Could not export canvas as PNG.'))
      }
    }, 'image/png')
  })
}
