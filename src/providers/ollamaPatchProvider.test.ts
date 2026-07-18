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
    expect(requestBody.prompt).toContain('"recipe":"character_idle"')
    expect(requestBody.prompt).toContain('Keep the same character identity across frames')
    expect(requestBody.prompt).toContain('no width/height')
    expect(requestBody.prompt).toContain('No patch arrays')
  })

  it('expands compact Ollama coin recipes into editable animation frames', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response:
            '{"recipe":"coin_spin","animationName":"Gold Coin","fps":4,"frames":[{"name":"Gold Coin 001","rx":4,"ry":5,"highlightX":-1,"highlightY":-2,"shadowX":1,"shadowY":2},{"name":"Gold Coin 002","rx":2,"ry":5,"highlightX":1,"highlightY":-2,"shadowX":-1,"shadowY":2},{"name":"Gold Coin 003","rx":4,"ry":5,"highlightX":2,"highlightY":-1,"shadowX":-2,"shadowY":1},{"name":"Gold Coin 004","rx":2,"ry":5,"highlightX":-2,"highlightY":1,"shadowX":2,"shadowY":-1}]}',
        }),
      } as Response),
    )

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'qwen3:14b',
    })
    const draft = await provider.requestAnimationDraft({
      project: createBlankProject({
        name: 'Coin',
        width: 32,
        height: 32,
        assetType: 'icon',
      }),
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      instruction: '4 frame rotating gold coin',
      constraints: { selectedColorId: 'accent', maxOperations: 64 },
      frameCount: 4,
    })

    expect(draft.animationName).toBe('Gold Coin')
    expect(draft.frames).toHaveLength(4)
    expect(draft.frames.every((frame) => frame.patch.length >= 8)).toBe(true)
    expect(draft.frames.every((frame) => frame.patch.every((operation) => operation.op === 'set'))).toBe(true)
  })

  it('accepts direct animation draft JSON when a recipe-routed request returns frames', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response:
            '{"animationName":"Coin Spin","fps":8,"frames":[{"name":"Coin Spin 001","durationMs":125,"patch":[{"op":"set","x":14,"y":14,"colorId":"accent"},{"op":"set","x":15,"y":14,"colorId":"white"},{"op":"set","x":16,"y":14,"colorId":"accent"},{"op":"set","x":14,"y":15,"colorId":"accent"},{"op":"set","x":15,"y":15,"colorId":"white"},{"op":"set","x":16,"y":15,"colorId":"accent"},{"op":"set","x":14,"y":16,"colorId":"shadow"},{"op":"set","x":15,"y":16,"colorId":"accent"}]}]}',
        }),
      } as Response),
    )

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'qwen3:14b',
    })
    const draft = await provider.requestAnimationDraft({
      project: createBlankProject({
        name: 'Coin',
        width: 32,
        height: 32,
        assetType: 'icon',
      }),
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      instruction: '4 frame rotating gold coin',
      constraints: { selectedColorId: 'accent', maxOperations: 64 },
      frameCount: 4,
    })

    expect(draft.animationName).toBe('Coin Spin')
    expect(draft.frames).toHaveLength(1)
    expect(draft.frames[0].patch).toHaveLength(8)
  })

  it('expands compact Ollama grass recipes into multiple animation rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response:
            '{"recipe":"grass_wave_tiles","fps":4,"variations":[{"animationName":"Grass A","frames":[{"name":"Grass A 001","wind":-1,"blades":[{"x":0,"baseY":31,"height":4,"lean":-1},{"x":4,"baseY":30,"height":5,"lean":0},{"x":8,"baseY":31,"height":3,"lean":1},{"x":13,"baseY":29,"height":6,"lean":-1},{"x":18,"baseY":30,"height":4,"lean":1},{"x":24,"baseY":31,"height":5,"lean":0},{"x":31,"baseY":30,"height":4,"lean":1}]}]},{"animationName":"Grass B","frames":[{"name":"Grass B 001","wind":1,"blades":[{"x":0,"baseY":30,"height":5,"lean":1},{"x":5,"baseY":31,"height":4,"lean":0},{"x":10,"baseY":29,"height":6,"lean":-1},{"x":16,"baseY":31,"height":3,"lean":1},{"x":22,"baseY":30,"height":5,"lean":0},{"x":27,"baseY":31,"height":4,"lean":-1},{"x":31,"baseY":29,"height":5,"lean":1}]}]}]}',
        }),
      } as Response),
    )

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'qwen3:14b',
    })
    const setDraft = await provider.requestAnimationSetDraft({
      project: createBlankProject({
        name: 'Grass',
        width: 32,
        height: 32,
        assetType: 'tile',
      }),
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      instruction: 'short grass waving in the wind, 3 frames, 2 frame set variations',
      constraints: { selectedColorId: 'accent', maxOperations: 64 },
      frameCount: 3,
      variationCount: 2,
    })

    expect(setDraft.animations.map((animation) => animation.animationName)).toEqual(['Grass A', 'Grass B'])
    expect(setDraft.animations.every((animation) => animation.frames.length === 3)).toBe(true)
    expect(
      setDraft.animations.every((animation) =>
        animation.frames.every((frame) => frame.patch.length >= 8),
      ),
    ).toBe(true)
  })

  it('expands compact Ollama character idle recipes into editable animation frames', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response:
            '{"recipe":"character_idle","animationName":"Hero Idle","fps":4,"frames":[{"name":"Hero Idle 001","bob":0,"capeLean":-1,"headTilt":0,"armPose":0},{"name":"Hero Idle 002","bob":1,"capeLean":0,"headTilt":1,"armPose":1},{"name":"Hero Idle 003","bob":0,"capeLean":1,"headTilt":0,"armPose":0},{"name":"Hero Idle 004","bob":-1,"capeLean":0,"headTilt":-1,"armPose":-1}]}',
        }),
      } as Response),
    )

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'qwen3:14b',
    })
    const draft = await provider.requestAnimationDraft({
      project: createBlankProject({
        name: 'Hero',
        width: 32,
        height: 32,
        assetType: 'character',
      }),
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      instruction: 'hero idle',
      constraints: { selectedColorId: 'accent', maxOperations: 64 },
      frameCount: 4,
    })

    expect(draft.animationName).toBe('Hero Idle')
    expect(draft.frames).toHaveLength(4)
    expect(draft.frames.every((frame) => frame.patch.length >= 20)).toBe(true)
  })

  it('expands compact Ollama tentacle recipes into multiple editable animation rows', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response:
            '{"recipe":"tentacle_creature_variations","fps":4,"variations":[{"animationName":"Tentacle A","bodyRx":5,"bodyRy":4,"eyeCount":1,"tentacles":[{"anchor":"left","length":6,"curl":-1},{"anchor":"right","length":6,"curl":1},{"anchor":"bottom","length":5,"curl":0}]},{"animationName":"Tentacle B","bodyRx":7,"bodyRy":5,"eyeCount":2,"tentacles":[{"anchor":"bottom","length":5,"curl":0},{"anchor":"top","length":7,"curl":2},{"anchor":"left","length":4,"curl":-2}]},{"animationName":"Tentacle C","bodyRx":4,"bodyRy":3,"eyeCount":3,"tentacles":[{"anchor":"right","length":8,"curl":1},{"anchor":"left","length":5,"curl":-1},{"anchor":"bottom","length":6,"curl":0}]}]}',
        }),
      } as Response),
    )

    const provider = new OllamaPatchProvider({
      baseUrl: 'http://localhost:11434/',
      model: 'qwen3:14b',
    })
    const setDraft = await provider.requestAnimationSetDraft({
      project: createBlankProject({
        name: 'Tentacle',
        width: 32,
        height: 32,
        assetType: 'creature',
      }),
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      instruction: 'tentacle monster, 3 variations',
      constraints: { selectedColorId: 'accent', maxOperations: 96 },
      frameCount: 4,
      variationCount: 3,
    })

    expect(setDraft.animations.map((animation) => animation.animationName)).toEqual([
      'Tentacle A',
      'Tentacle B',
      'Tentacle C',
    ])
    expect(setDraft.animations.every((animation) => animation.frames.length === 4)).toBe(true)
    expect(
      setDraft.animations.every((animation) =>
        animation.frames.every((frame) => frame.patch.length >= 20),
      ),
    ).toBe(true)
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

  it(
    'requests a real qwen3:14b grass variation set when local Ollama is available',
    async () => {
      const models = await getAvailableLocalOllamaModels()
      if (!models.includes('qwen3:14b')) {
        console.warn('Skipping live qwen3:14b grass set check; local Ollama/model unavailable.')
        return
      }

      const provider = new OllamaPatchProvider({
        baseUrl: 'http://localhost:11434',
        model: 'qwen3:14b',
        timeoutMs: 120_000,
      })
      const setDraft = await provider.requestAnimationSetDraft({
        project: createBlankProject({
          name: 'Live Ollama Grass Test',
          width: 32,
          height: 32,
          assetType: 'tile',
        }),
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        instruction:
          'User request: short grass waving in the wind, 3 frames, 4 frame set variations that can tile. SpriteWrite interpretation: Draft 4 editable animation variations with 3 frames each from this request.',
        constraints: { selectedColorId: 'accent', maxOperations: 64 },
        frameCount: 3,
        variationCount: 4,
      })

      expect(setDraft.animations).toHaveLength(4)
      expect(setDraft.animations.every((animation) => animation.frames.length === 3)).toBe(true)
      expect(
        setDraft.animations.every((animation) =>
          animation.frames.every((frame) => frame.patch.length >= 8),
        ),
      ).toBe(true)
    },
    135_000,
  )

  it(
    'requests real qwen3:14b character and creature recipe drafts when local Ollama is available',
    async () => {
      const models = await getAvailableLocalOllamaModels()
      if (!models.includes('qwen3:14b')) {
        console.warn('Skipping live qwen3:14b character/creature check; local Ollama/model unavailable.')
        return
      }

      const provider = new OllamaPatchProvider({
        baseUrl: 'http://localhost:11434',
        model: 'qwen3:14b',
        timeoutMs: 120_000,
      })
      const heroDraft = await provider.requestAnimationDraft({
        project: createBlankProject({
          name: 'Live Ollama Hero Test',
          width: 32,
          height: 32,
          assetType: 'character',
        }),
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        instruction: 'hero idle, wearing a cape',
        constraints: { selectedColorId: 'accent', maxOperations: 96 },
        frameCount: 4,
      })
      const tentacleDraft = await provider.requestAnimationSetDraft({
        project: createBlankProject({
          name: 'Live Ollama Tentacle Test',
          width: 32,
          height: 32,
          assetType: 'creature',
        }),
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        instruction: 'tentacle monster, 3 variations',
        constraints: { selectedColorId: 'accent', maxOperations: 96 },
        frameCount: 4,
        variationCount: 3,
      })

      expect(heroDraft.frames).toHaveLength(4)
      expect(heroDraft.frames.every((frame) => frame.patch.length >= 20)).toBe(true)
      expect(tentacleDraft.animations).toHaveLength(3)
      expect(tentacleDraft.animations.every((animation) => animation.frames.length === 4)).toBe(true)
      expect(
        tentacleDraft.animations.every((animation) =>
          animation.frames.every((frame) => frame.patch.length >= 20),
        ),
      ).toBe(true)
    },
    135_000,
  )
})
