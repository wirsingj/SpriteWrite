import { afterEach, describe, expect, it, vi } from 'vitest'
import { createDefaultProject } from '../domain/spriteData'
import {
  OllamaPatchProvider,
  parseOllamaPatchResponse,
  testOllamaConnection,
} from './ollamaPatchProvider'

afterEach(() => {
  vi.unstubAllGlobals()
})

describe('parseOllamaPatchResponse', () => {
  it('accepts a raw patch array', () => {
    const parsed = parseOllamaPatchResponse('[{"op":"set","x":1,"y":2,"colorId":"accent"}]')

    expect(parsed).toEqual([{ op: 'set', x: 1, y: 2, colorId: 'accent' }])
  })

  it('accepts a patch object wrapper', () => {
    const parsed = parseOllamaPatchResponse('{"patch":[{"op":"clear","x":3,"y":4}]}')

    expect(parsed).toEqual([{ op: 'clear', x: 3, y: 4 }])
  })

  it('extracts a fenced patch array', () => {
    const parsed = parseOllamaPatchResponse('```json\n[{"op":"clear","x":5,"y":6}]\n```')

    expect(parsed).toEqual([{ op: 'clear', x: 5, y: 6 }])
  })

  it('tests Ollama connection with normalized base URL', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ models: [{ name: 'llama3.2' }] }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    await expect(testOllamaConnection('http://localhost:11434/')).resolves.toBe(
      'Connected. Models: llama3.2',
    )
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags')
  })

  it('surfaces Ollama connection failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
      } as Response),
    )

    await expect(testOllamaConnection('http://localhost:11434')).rejects.toThrow(
      'Ollama returned 503 Unavailable',
    )
  })

  it('surfaces Ollama patch request failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 500,
        statusText: 'Bad Model',
      } as Response),
    )

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'missing-model',
    })

    await expect(
      provider.requestPatch({
        project: createDefaultProject(),
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        instruction: 'add a small mark',
        constraints: { selectedColorId: 'slime_mid', maxOperations: 4 },
      }),
    ).rejects.toThrow('Ollama returned 500 Bad Model')
  })

  it('requests JSON patch operations from Ollama and returns the parsed patch', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response: '[{"op":"set","x":1,"y":2,"colorId":"slime_mid"}]',
      }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'llama3.2',
    })
    const patch = await provider.requestPatch({
      project: createDefaultProject(),
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      instruction: 'add a small mark',
      constraints: { selectedColorId: 'slime_mid', maxOperations: 4 },
    })

    expect(patch).toEqual([{ op: 'set', x: 1, y: 2, colorId: 'slime_mid' }])
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      }),
    )

    const requestBody = JSON.parse(fetch.mock.calls[0][1]?.body as string) as {
      model: string
      stream: boolean
      format: string
      prompt: string
    }
    expect(requestBody).toMatchObject({
      model: 'llama3.2',
      stream: false,
      format: 'json',
    })
    expect(requestBody.prompt).toContain('Return JSON only')
    expect(requestBody.prompt).toContain('Palette IDs:')
  })
})
