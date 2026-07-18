import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBlankProject, createDefaultProject } from '../domain/spriteData'
import {
  listOllamaModels,
  OllamaPatchProvider,
  parseOllamaAnimationDraftResponse,
  parseOllamaPatchResponse,
  pullOllamaModel,
  testOllamaConnection,
} from './ollamaPatchProvider'

afterEach(() => {
  vi.unstubAllGlobals()
})

async function getAvailableLocalOllamaModels(): Promise<string[]> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), 3000)

  try {
    const response = await fetch('http://localhost:11434/api/tags', { signal: controller.signal })
    if (!response.ok) {
      return []
    }
    const payload = (await response.json()) as { models?: Array<{ name?: unknown }> }
    return (payload.models ?? [])
      .map((model) => model.name)
      .filter((name): name is string => typeof name === 'string')
  } catch {
    return []
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

describe('parseOllamaPatchResponse', () => {
  it('accepts a raw patch array', () => {
    const parsed = parseOllamaPatchResponse('[{"op":"set","x":1,"y":2,"colorId":"accent"}]')

    expect(parsed).toEqual([{ op: 'set', x: 1, y: 2, colorId: 'accent' }])
  })

  it('accepts a patch object wrapper', () => {
    const parsed = parseOllamaPatchResponse('{"patch":[{"op":"clear","x":3,"y":4}]}')

    expect(parsed).toEqual([{ op: 'clear', x: 3, y: 4 }])
  })

  it('accepts common operation wrapper aliases and single operation objects', () => {
    expect(parseOllamaPatchResponse('{"ops":[{"op":"clear","x":3,"y":4}]}')).toEqual([
      { op: 'clear', x: 3, y: 4 },
    ])
    expect(
      parseOllamaPatchResponse('{"patchOperations":[{"op":"set","x":1,"y":2,"colorId":"ink"}]}'),
    ).toEqual([{ op: 'set', x: 1, y: 2, colorId: 'ink' }])
    expect(parseOllamaPatchResponse('{"op":"clear","x":5,"y":6}')).toEqual([
      { op: 'clear', x: 5, y: 6 },
    ])
  })

  it('accepts an animation draft object', () => {
    const parsed = parseOllamaAnimationDraftResponse(
      '{"animationName":"Idle","fps":4,"frames":[{"name":"Idle 001","durationMs":250,"patch":[{"op":"set","x":1,"y":2,"colorId":"ink"}]}]}',
    )

    expect(parsed).toEqual({
      animationName: 'Idle',
      fps: 4,
      frames: [
        {
          name: 'Idle 001',
          durationMs: 250,
          patch: [{ op: 'set', x: 1, y: 2, colorId: 'ink' }],
        },
      ],
    })
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

  it('lists local Ollama models', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: 'llama3.2:latest',
            modified_at: '2026-07-17T00:00:00Z',
            size: 123,
            capabilities: ['completion'],
          },
          { name: '' },
        ],
      }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    await expect(listOllamaModels('http://localhost:11434/')).resolves.toEqual([
      {
        name: 'llama3.2:latest',
        modifiedAt: '2026-07-17T00:00:00Z',
        size: 123,
        capabilities: ['completion'],
        family: undefined,
        families: [],
        parameterSize: undefined,
      },
    ])
  })

  it('derives vision capability from Ollama model details', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          {
            name: 'llava:7b',
            details: {
              family: 'llama',
              families: ['llama', 'clip'],
              parameter_size: '7B',
            },
          },
          {
            name: 'qwen3:14b',
            details: {
              family: 'qwen3',
              families: ['qwen3'],
              parameter_size: '14.8B',
            },
          },
        ],
      }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    await expect(listOllamaModels('http://localhost:11434')).resolves.toEqual([
      {
        name: 'llava:7b',
        modifiedAt: undefined,
        size: undefined,
        capabilities: ['vision', 'completion'],
        family: 'llama',
        families: ['llama', 'clip'],
        parameterSize: '7B',
      },
      {
        name: 'qwen3:14b',
        modifiedAt: undefined,
        size: undefined,
        capabilities: ['completion'],
        family: 'qwen3',
        families: ['qwen3'],
        parameterSize: '14.8B',
      },
    ])
  })

  it('pulls an Ollama model without streaming', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'success' }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    await expect(pullOllamaModel('http://localhost:11434/', ' llama3.2 ')).resolves.toBe(
      'Downloaded llama3.2.',
    )
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/pull',
      expect.objectContaining({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'llama3.2', stream: false }),
      }),
    )
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
      think: boolean
      format: Record<string, unknown>
      options: { temperature: number }
      prompt: string
    }
    expect(requestBody).toMatchObject({
      model: 'llama3.2',
      stream: false,
      think: false,
      options: { temperature: 0 },
    })
    expect(requestBody.format).toMatchObject({
      type: 'object',
      required: ['patch'],
    })
    expect(JSON.stringify(requestBody.format)).toContain('"maxItems":4')
    expect(requestBody.prompt).toContain('Return JSON only')
    expect(requestBody.prompt).toContain('Return exactly { "patch": [...] }')
    expect(requestBody.prompt).toContain('Palette IDs:')
  })

  it('explains when selected-frame patch requests receive animation draft JSON', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '{"frames":[{"patch":[{"op":"set","x":1,"y":2,"colorId":"ink"}]}]}',
        }),
      } as Response),
    )

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'llama3.2',
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
    ).rejects.toThrow('animation draft object')
  })

  it('requests structured animation draft frames from Ollama', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        response:
          '{"animationName":"Idle","fps":4,"frames":[{"name":"Idle 001","durationMs":250,"patch":[{"op":"set","x":10,"y":12,"colorId":"ink"}]}]}',
      }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'llama3.2',
    })
    const draft = await provider.requestAnimationDraft({
      project: createDefaultProject(),
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      instruction: 'Hero wearing a cape. Standing animation.',
      constraints: { selectedColorId: 'slime_mid', maxOperations: 128 },
      frameCount: 4,
    })

    expect(draft.frames).toHaveLength(1)
    const requestBody = JSON.parse(fetch.mock.calls[0][1]?.body as string) as {
      model: string
      stream: boolean
      think: boolean
      format: string
      options: { temperature: number }
      prompt: string
    }
    expect(requestBody).toMatchObject({
      model: 'llama3.2',
      stream: false,
      think: false,
      format: 'json',
      options: { temperature: 0 },
    })
    expect(requestBody.prompt).toContain('Return exactly 4 frames.')
    expect(requestBody.prompt).toContain('Each frame patch must draw the full visible frame')
    expect(requestBody.prompt).toContain('images')
    expect(requestBody.prompt).toContain('Do not include width, height')
    expect(requestBody.prompt).toContain('Use 8 to')
  })

  it('includes raw Ollama response text when animation draft parsing fails', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: '{"note":"not frame JSON"}' }),
      } as Response),
    )

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'llama3.2',
    })

    await expect(
      provider.requestAnimationDraft({
        project: createDefaultProject(),
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        instruction: 'make a coin spin',
        constraints: { selectedColorId: 'slime_mid', maxOperations: 128 },
        frameCount: 4,
      }),
    ).rejects.toThrow('Raw Ollama response')
  })

  it('explains empty animation draft objects from schema-ignoring models', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ response: '{}' }),
      } as Response),
    )

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'qwen3:14b',
    })

    await expect(
      provider.requestAnimationDraft({
        project: createDefaultProject(),
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        instruction: 'rotating gold coin. 4 frames',
        constraints: { selectedColorId: 'slime_mid', maxOperations: 128 },
        frameCount: 4,
      }),
    ).rejects.toThrow('empty JSON object')
  })

  it(
    'requests a real qwen3:14b animation draft when local Ollama is available',
    async () => {
      const models = await getAvailableLocalOllamaModels()
      if (!models.includes('qwen3:14b')) {
        console.warn('Skipping live qwen3:14b integration check; local Ollama/model unavailable.')
        return
      }

      const provider = new OllamaPatchProvider({
        baseUrl: 'http://localhost:11434',
        model: 'qwen3:14b',
        timeoutMs: 120_000,
      })
      const draft = await provider.requestAnimationDraft({
        project: createBlankProject({
          name: 'Live Ollama Coin Test',
          width: 32,
          height: 32,
          assetType: 'icon',
        }),
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        instruction: 'User request: gold coin rotating. 3 frames. SpriteWrite interpretation: Draft a 3-frame editable animation row from this request.',
        constraints: { selectedColorId: 'accent', maxOperations: 32 },
        frameCount: 3,
      })

      expect(draft.frames).toHaveLength(3)
      expect(draft.frames.every((frame) => frame.patch.length >= 8)).toBe(true)
      expect(draft.frames.every((frame) => frame.patch.every((operation) => operation.op === 'set'))).toBe(
        true,
      )
    },
    135_000,
  )
})
