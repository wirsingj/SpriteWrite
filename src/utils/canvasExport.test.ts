// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHeroDemoProject, createDefaultProject } from '../domain/spriteData'
import { exportFramePng, exportFullSpriteSheetPng, rgbaBufferToCanvas } from './canvasExport'

describe('canvas export wrappers', () => {
  const originalCreateElement = document.createElement.bind(document)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('copies an RGBA buffer into a non-smoothed canvas', () => {
    const imageData = { data: new Uint8ClampedArray(16) } as ImageData
    const context = {
      imageSmoothingEnabled: true,
      createImageData: vi.fn(() => imageData),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
    } as unknown as HTMLCanvasElement

    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'canvas') {
        return canvas
      }
      return originalCreateElement(tagName)
    })

    const result = rgbaBufferToCanvas({
      width: 2,
      height: 2,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0]),
    })

    expect(result.width).toBe(2)
    expect(result.height).toBe(2)
    expect(context.imageSmoothingEnabled).toBe(false)
    expect(context.createImageData).toHaveBeenCalledWith(2, 2)
    expect(Array.from(imageData.data)).toEqual([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 0, 0, 0, 0])
    expect(context.putImageData).toHaveBeenCalledWith(imageData, 0, 0)
  })

  it('exports frame PNG blobs through canvas.toBlob as image/png', async () => {
    let createdCanvas: HTMLCanvasElement | undefined
    const context = {
      imageSmoothingEnabled: true,
      createImageData: vi.fn((width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      })),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName !== 'canvas') {
        return originalCreateElement(tagName)
      }

      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => context),
        toBlob: vi.fn((callback: BlobCallback, type?: string) => {
          callback(new Blob(['png'], { type }))
        }),
      } as unknown as HTMLCanvasElement
      createdCanvas = canvas
      return canvas
    })

    const blob = await exportFramePng(createDefaultProject(), 'idle-001', 2)

    expect(createdCanvas?.width).toBe(64)
    expect(createdCanvas?.height).toBe(64)
    expect(createdCanvas?.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
    expect(blob.type).toBe('image/png')
  })

  it('exports full sprite sheet PNG blobs through canvas.toBlob as image/png', async () => {
    let createdCanvas: HTMLCanvasElement | undefined
    const context = {
      imageSmoothingEnabled: true,
      createImageData: vi.fn((width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      })),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D

    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName !== 'canvas') {
        return originalCreateElement(tagName)
      }

      const canvas = {
        width: 0,
        height: 0,
        getContext: vi.fn(() => context),
        toBlob: vi.fn((callback: BlobCallback, type?: string) => {
          callback(new Blob(['png'], { type }))
        }),
      } as unknown as HTMLCanvasElement
      createdCanvas = canvas
      return canvas
    })

    const blob = await exportFullSpriteSheetPng(createHeroDemoProject(), { scale: 1, margin: 0, spacing: 0 })

    expect(createdCanvas?.width).toBe(160)
    expect(createdCanvas?.height).toBe(128)
    expect(createdCanvas?.toBlob).toHaveBeenCalledWith(expect.any(Function), 'image/png')
    expect(blob.type).toBe('image/png')
  })
})
