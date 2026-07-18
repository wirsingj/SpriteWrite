import { describe, expect, it } from 'vitest'
import { encodeRgbaBufferToPng, rgbaBufferToPngBlob } from './pngExport'

describe('PNG export encoder', () => {
  it('matches the golden PNG bytes for a 1x1 opaque red pixel', () => {
    const bytes = new Uint8Array(
      encodeRgbaBufferToPng({
        width: 1,
        height: 1,
        data: new Uint8ClampedArray([255, 0, 0, 255]),
      }),
    )

    expect(bytesToBase64(bytes)).toBe(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAEElEQVR4AQEFAPr/AP8AAP8FAAH/+lyI0QAAAABJRU5ErkJggg==',
    )
  })

  it('wraps encoded RGBA buffers in image/png blobs', async () => {
    const blob = rgbaBufferToPngBlob({
      width: 2,
      height: 1,
      data: new Uint8ClampedArray([255, 0, 0, 255, 0, 0, 0, 0]),
    })

    expect(blob.type).toBe('image/png')
    expect(Array.from(new Uint8Array(await blob.arrayBuffer()).subarray(0, 8))).toEqual([
      137,
      80,
      78,
      71,
      13,
      10,
      26,
      10,
    ])
  })
})

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte)
  })
  return btoa(binary)
}
