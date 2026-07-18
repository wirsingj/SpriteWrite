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

  it('exports frame PNG blobs as valid image/png bytes', async () => {
    const blob = await exportFramePng(createDefaultProject(), 'idle-001', 2)

    expect(blob.type).toBe('image/png')
    await expectPngBlob(blob, {
      width: 64,
      height: 64,
      pixels: [{ x: 30, y: 40, rgba: [120, 255, 228, 255] }],
    })
  })

  it('exports full sprite sheet PNG blobs as valid image/png bytes', async () => {
    const blob = await exportFullSpriteSheetPng(createHeroDemoProject(), { scale: 1, margin: 0, spacing: 0 })

    expect(blob.type).toBe('image/png')
    await expectPngBlob(blob, {
      width: 160,
      height: 128,
      pixels: [{ x: 16, y: 14, rgba: [63, 123, 216, 255] }],
    })
  })
})

type ExpectedPng = {
  width: number
  height: number
  pixels: Array<{
    x: number
    y: number
    rgba: [number, number, number, number]
  }>
}

async function expectPngBlob(blob: Blob, expected: ExpectedPng) {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  expect(Array.from(bytes.subarray(0, 8))).toEqual([137, 80, 78, 71, 13, 10, 26, 10])

  const decoded = decodePngSmoke(bytes)
  expect(decoded.width).toBe(expected.width)
  expect(decoded.height).toBe(expected.height)

  expected.pixels.forEach((pixel) => {
    const offset = (pixel.y * decoded.width + pixel.x) * 4
    expect(Array.from(decoded.data.subarray(offset, offset + 4))).toEqual(pixel.rgba)
  })
}

function decodePngSmoke(bytes: Uint8Array): { width: number; height: number; data: Uint8Array } {
  let offset = 8
  let width = 0
  let height = 0
  const idatChunks: Uint8Array[] = []
  let sawIend = false

  while (offset < bytes.length) {
    const length = readUint32(bytes, offset)
    const type = decodeAscii(bytes.subarray(offset + 4, offset + 8))
    const data = bytes.subarray(offset + 8, offset + 8 + length)

    if (type === 'IHDR') {
      width = readUint32(data, 0)
      height = readUint32(data, 4)
      expect(data[8]).toBe(8)
      expect(data[9]).toBe(6)
    } else if (type === 'IDAT') {
      idatChunks.push(data)
    } else if (type === 'IEND') {
      sawIend = true
      break
    }

    offset += length + 12
  }

  expect(sawIend).toBe(true)

  const inflated = inflateStoredZlibStream(concatBytes(idatChunks))
  const pixelData = new Uint8Array(width * height * 4)
  const scanlineLength = width * 4 + 1

  for (let y = 0; y < height; y += 1) {
    const rawOffset = y * scanlineLength
    expect(inflated[rawOffset]).toBe(0)
    pixelData.set(inflated.subarray(rawOffset + 1, rawOffset + scanlineLength), y * width * 4)
  }

  return { width, height, data: pixelData }
}

function concatBytes(chunks: Uint8Array[]): Uint8Array {
  const length = chunks.reduce((sum, chunk) => sum + chunk.length, 0)
  const bytes = new Uint8Array(length)
  let offset = 0

  chunks.forEach((chunk) => {
    bytes.set(chunk, offset)
    offset += chunk.length
  })

  return bytes
}

function readUint32(bytes: Uint8Array, offset: number): number {
  return new DataView(bytes.buffer, bytes.byteOffset + offset, 4).getUint32(0)
}

function writeUint32(bytes: Uint8Array, offset: number, value: number) {
  new DataView(bytes.buffer, bytes.byteOffset + offset, 4).setUint32(0, value)
}

function decodeAscii(bytes: Uint8Array): string {
  return new TextDecoder().decode(bytes)
}

function inflateStoredZlibStream(bytes: Uint8Array): Uint8Array {
  let offset = 2
  const chunks: Uint8Array[] = []
  let isFinal = false

  while (!isFinal && offset < bytes.length - 4) {
    const header = bytes[offset]
    isFinal = (header & 1) === 1
    expect((header >>> 1) & 0b11).toBe(0)
    offset += 1

    const length = bytes[offset] | (bytes[offset + 1] << 8)
    const inverseLength = bytes[offset + 2] | (bytes[offset + 3] << 8)
    expect((length ^ inverseLength) & 0xffff).toBe(0xffff)
    offset += 4

    chunks.push(bytes.subarray(offset, offset + length))
    offset += length
  }

  const inflated = concatBytes(chunks)
  expect(Array.from(bytes.subarray(offset, offset + 4))).toEqual(Array.from(createAdler32Bytes(inflated)))
  return inflated
}

function createAdler32Bytes(bytes: Uint8Array): Uint8Array {
  const mod = 65521
  let a = 1
  let b = 0

  for (const byte of bytes) {
    a = (a + byte) % mod
    b = (b + a) % mod
  }

  const checksum = ((b << 16) | a) >>> 0
  const result = new Uint8Array(4)
  writeUint32(result, 0, checksum)
  return result
}
