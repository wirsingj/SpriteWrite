// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { downloadBlob, downloadTextFile } from './download'

describe('download helpers', () => {
  const originalCreateElement = document.createElement.bind(document)

  afterEach(() => {
    vi.restoreAllMocks()
  })

  function stubBlobUrls() {
    const createObjectUrl = vi.fn((blob: Blob | MediaSource) => {
      void blob
      return 'blob:spritewrite-test'
    })
    const revokeObjectUrl = vi.fn()
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: createObjectUrl,
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: revokeObjectUrl,
    })
    return { createObjectUrl, revokeObjectUrl }
  }

  it('downloads a blob through a temporary anchor and revokes the object URL', () => {
    const click = vi.fn()
    const remove = vi.fn()
    const anchor = document.createElement('a')
    anchor.click = click
    anchor.remove = remove

    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return anchor
      }
      return originalCreateElement(tagName)
    })
    const append = vi.spyOn(document.body, 'append')
    const { createObjectUrl, revokeObjectUrl } = stubBlobUrls()
    const blob = new Blob(['sprite'], { type: 'image/png' })

    downloadBlob('frame.png', blob)

    expect(createObjectUrl).toHaveBeenCalledWith(blob)
    expect(anchor.href).toBe('blob:spritewrite-test')
    expect(anchor.download).toBe('frame.png')
    expect(append).toHaveBeenCalledWith(anchor)
    expect(click).toHaveBeenCalledTimes(1)
    expect(remove).toHaveBeenCalledTimes(1)
    expect(revokeObjectUrl).toHaveBeenCalledWith('blob:spritewrite-test')
  })

  it('creates JSON text downloads with the expected mime type', async () => {
    const { createObjectUrl } = stubBlobUrls()
    let capturedBlob: Blob | MediaSource | undefined
    createObjectUrl.mockImplementation((blob: Blob | MediaSource) => {
      capturedBlob = blob
      return 'blob:json'
    })
    vi.spyOn(document.body, 'append').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      const anchor = originalCreateElement(tagName)
      if (tagName === 'a') {
        anchor.click = vi.fn()
        anchor.remove = vi.fn()
      }
      return anchor
    })

    downloadTextFile('project.spritewrite.json', '{"name":"SpriteWrite"}')

    expect(capturedBlob).toBeInstanceOf(Blob)
    const blob = capturedBlob as Blob
    expect(blob.type).toBe('application/json')
    await expect(blob.text()).resolves.toBe('{"name":"SpriteWrite"}')
  })
})
