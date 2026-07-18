// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createBlankProject } from './domain/spriteData'

describe('App shell', () => {
  const originalCreateElement = document.createElement.bind(document)
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    vi.restoreAllMocks()
    container.remove()
  })

  it('renders the start screen with project templates', () => {
    act(() => {
      root.render(<App />)
    })

    expect(container.textContent).toContain('SpriteWrite')
    expect(container.textContent).toContain('Draw static or animated pixel assets')
    expect(container.textContent).toContain('Blank 64x64')
    expect(container.textContent).toContain('Hero 32x32 Sprite Sheet Demo')
    expect(container.textContent).toContain('Ooze 32x32 Demo')
  })

  it('creates a blank 64x64 project and enters the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Blank 64x64')
    clickButton('New Project')

    expect(container.textContent).toContain('64x64 cells')
    expect(container.textContent).toContain('Ask / Start')
    expect(container.textContent).toContain('Sprite Sheet Rows')
    expect(container.textContent).toContain('Export Plan')
    expect(container.textContent).toContain('Production outputs')
    expect(container.textContent).toContain('Preview')
    expect(container.textContent).toContain('Frame Details')
    expect(container.textContent).toContain('Top strip controls sheet order')
    expect(container.textContent).toContain('Optional structured edit proposals')
  })

  it('selects frames from the atlas overview before detailed editing', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')

    const atlasFrames = container.querySelectorAll<HTMLButtonElement>('.atlas-frame-strip button')
    expect(atlasFrames).toHaveLength(2)

    act(() => {
      atlasFrames[1].click()
    })

    expect(getRequiredElement('.atlas-frame-strip button.active span').textContent).toBe('2')
  })

  it('switches between frame editing and the full sprite sheet workspace', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')
    clickButton('Full Sheet')

    expect(container.textContent).toContain('Full Sprite Sheet View')
    expect(container.querySelectorAll('.sheet-row-strip button')).toHaveLength(2)

    const sheetFrames = container.querySelectorAll<HTMLButtonElement>('.sheet-row-strip button')
    act(() => {
      sheetFrames[1].click()
    })

    expect(container.textContent).not.toContain('Full Sprite Sheet View')
    expect(getRequiredElement('.pixel-grid')).toBeTruthy()
    expect(getRequiredElement('.atlas-frame-strip button.active span').textContent).toBe('2')
  })

  it('multi-selects atlas frames with modifier clicks', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')
    clickButton('Add Frame')

    let atlasFrames = Array.from(container.querySelectorAll<HTMLButtonElement>('.atlas-frame-strip button'))
    expect(atlasFrames).toHaveLength(3)
    expect(atlasFrames.filter((button) => button.classList.contains('selected'))).toHaveLength(1)

    act(() => {
      atlasFrames[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    })

    atlasFrames = Array.from(container.querySelectorAll<HTMLButtonElement>('.atlas-frame-strip button'))
    expect(atlasFrames.filter((button) => button.classList.contains('selected'))).toHaveLength(2)

    act(() => {
      atlasFrames[0].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    })

    atlasFrames = Array.from(container.querySelectorAll<HTMLButtonElement>('.atlas-frame-strip button'))
    expect(atlasFrames.slice(0, 2).every((button) => button.classList.contains('selected'))).toBe(true)
    expect(atlasFrames[2].classList.contains('selected')).toBe(false)
  })

  it('duplicates selected atlas frames as a batch', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')

    let atlasFrames = Array.from(container.querySelectorAll<HTMLButtonElement>('.atlas-frame-strip button'))
    act(() => {
      atlasFrames[0].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    })

    clickButton('Duplicate Selected')

    expect(container.textContent).toContain('Duplicated 2 selected frames.')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; frameIds: string[] }>
      frames: Array<{ id: string; name: string }>
    }
    const idleFrameIds = exported.animations.find((animation) => animation.id === 'idle')?.frameIds ?? []

    expect(idleFrameIds).toHaveLength(4)
    expect(idleFrameIds.slice(0, 2)).toEqual(['idle-001', expect.any(String)])
    expect(exported.frames.filter((frame) => frame.name.endsWith('Copy'))).toHaveLength(2)

    atlasFrames = Array.from(container.querySelectorAll<HTMLButtonElement>('.atlas-frame-strip button'))
    expect(atlasFrames.filter((button) => button.classList.contains('selected'))).toHaveLength(2)
  })

  it('deletes selected atlas frames without emptying the row', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')
    clickButton('Add Frame')

    const atlasFrames = Array.from(container.querySelectorAll<HTMLButtonElement>('.atlas-frame-strip button'))
    act(() => {
      atlasFrames[1].dispatchEvent(new MouseEvent('click', { bubbles: true, ctrlKey: true }))
    })

    clickButton('Delete Selected')

    expect(container.textContent).toContain('Deleted 2 selected frames.')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; frameIds: string[] }>
    }
    const idleFrameIds = exported.animations.find((animation) => animation.id === 'idle')?.frameIds ?? []

    expect(idleFrameIds).toEqual(['idle-001'])
    expect(getButtonWithin('.atlas-actions', 'Delete Selected').disabled).toBe(true)
  })

  it('sets duration across selected atlas frames', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')

    const atlasFrames = Array.from(container.querySelectorAll<HTMLButtonElement>('.atlas-frame-strip button'))
    act(() => {
      atlasFrames[0].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    })

    const durationInput = getRequiredElement('.atlas-batch-metadata').querySelector<HTMLInputElement>('input')
    if (!durationInput) {
      throw new Error('Missing atlas batch duration input.')
    }
    setInputValue(durationInput, '417')
    clickButtonWithin('.atlas-batch-metadata', 'Set Duration')

    expect(container.textContent).toContain('Set duration to 417ms on 2 selected frames.')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; frameIds: string[] }>
      frames: Array<{ id: string; durationMs: number }>
    }
    const idleFrameIds = exported.animations.find((animation) => animation.id === 'idle')?.frameIds ?? []
    const idleFrames = exported.frames.filter((frame) => idleFrameIds.includes(frame.id))

    expect(idleFrames).toHaveLength(2)
    expect(idleFrames.every((frame) => frame.durationMs === 417)).toBe(true)
  })

  it('sets tags and notes across selected atlas frames', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')

    const atlasFrames = Array.from(container.querySelectorAll<HTMLButtonElement>('.atlas-frame-strip button'))
    act(() => {
      atlasFrames[0].dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }))
    })

    const metadataPanel = getRequiredElement('.atlas-batch-metadata')
    const inputs = metadataPanel.querySelectorAll<HTMLInputElement>('input')
    const notesInput = metadataPanel.querySelector<HTMLTextAreaElement>('textarea')
    if (!inputs[1] || !notesInput) {
      throw new Error('Missing atlas batch tags or notes input.')
    }

    setInputValue(inputs[1], 'anticipation, contact')
    clickButtonWithin('.atlas-batch-metadata', 'Set Tags')
    setTextAreaValue(notesInput, 'Shared atlas timing note.')
    clickButtonWithin('.atlas-batch-metadata', 'Set Notes')

    expect(container.textContent).toContain('Set notes on 2 selected frames.')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; frameIds: string[] }>
      frames: Array<{ id: string; notes?: string; tags?: string[] }>
    }
    const idleFrameIds = exported.animations.find((animation) => animation.id === 'idle')?.frameIds ?? []
    const idleFrames = exported.frames.filter((frame) => idleFrameIds.includes(frame.id))

    expect(idleFrames).toHaveLength(2)
    expect(idleFrames.every((frame) => frame.notes === 'Shared atlas timing note.')).toBe(true)
    expect(idleFrames.every((frame) => frame.tags?.join(',') === 'anticipation,contact')).toBe(true)
  })

  it('refreshes local Ollama models from the main ask panel', async () => {
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        models: [
          { name: 'llava:7b', details: { family: 'llama', families: ['llama', 'clip'], parameter_size: '7B' } },
          { name: 'qwen3:14b', details: { family: 'qwen3', families: ['qwen3'], parameter_size: '14.8B' } },
          { name: 'mistral-nemo:latest', details: { family: 'llama', families: ['llama'], parameter_size: '12.2B' } },
          { name: 'llama3.2:3b', details: { family: 'llama', families: ['llama'], parameter_size: '3.2B' } },
        ],
      }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    setSelectValue(getRequiredElement('.atlas-request-panel select') as HTMLSelectElement, 'ollama')
    await clickButtonAsync('Refresh Models')

    const settingsInputs = getRequiredElement('.atlas-request-panel .ollama-settings').querySelectorAll('input')
    const installedModelSelect = getRequiredElement('.atlas-request-panel .ollama-settings').querySelector(
      'select',
    ) as HTMLSelectElement | null

    expect(settingsInputs[1].value).toBe('qwen3:14b')
    expect(installedModelSelect?.options).toHaveLength(5)
    expect(Array.from(installedModelSelect?.options ?? []).map((option) => option.value)).toEqual([
      '',
      'llava:7b',
      'qwen3:14b',
      'mistral-nemo:latest',
      'llama3.2:3b',
    ])
    expect(container.textContent).toContain('Found 4 local Ollama models: llava:7b, qwen3:14b')
    expect(fetch).toHaveBeenCalledWith('http://localhost:11434/api/tags')
  })

  it('warns when a vision-oriented Ollama model is selected for structured edits', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    setSelectValue(getRequiredElement('.atlas-request-panel select') as HTMLSelectElement, 'ollama')
    const settingsInputs = getRequiredElement('.atlas-request-panel .ollama-settings').querySelectorAll('input')
    setInputValue(settingsInputs[1], 'llava:7b')

    expect(container.textContent).toContain('Vision-oriented Ollama models often follow strict JSON poorly')
  })

  it('downloads an Ollama model from the main ask panel', async () => {
    const fetch = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ status: 'success' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ models: [{ name: 'phi4-mini' }] }),
      } as Response)
    vi.stubGlobal('fetch', fetch)

    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    setSelectValue(getRequiredElement('.atlas-request-panel select') as HTMLSelectElement, 'ollama')
    const settingsInputs = getRequiredElement('.atlas-request-panel .ollama-settings').querySelectorAll('input')
    setInputValue(settingsInputs[1], 'phi4-mini')

    await clickButtonAsync('Download Model')

    expect(container.textContent).toContain('Downloaded phi4-mini. Ready for structured edit requests.')
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/pull',
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ name: 'phi4-mini', stream: false }),
      }),
    )
  })

  it('asks Ollama from the main ask panel and shows a proposed edit message', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '[{"op":"set","x":1,"y":2,"colorId":"ink"}]',
        }),
      } as Response),
    )

    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    await clickButtonAsync('Ask Ollama')

    expect(container.textContent).toContain('Ollama proposed 1 change. Review before applying.')
    expect(container.textContent).toContain('1/1 enabled')
  })

  it('asks Ollama for a broad character animation draft and creates editable frames', async () => {
    const makeHeroPatch = (offsetX: number, capeOffset: number) => [
      { op: 'set', x: 15 + offsetX, y: 12, colorId: 'ink' },
      { op: 'set', x: 14 + offsetX, y: 13, colorId: 'ink' },
      { op: 'set', x: 15 + offsetX, y: 13, colorId: 'light_gray' },
      { op: 'set', x: 16 + offsetX, y: 13, colorId: 'ink' },
      { op: 'set', x: 15 + offsetX, y: 14, colorId: 'charcoal' },
      { op: 'set', x: 14 + offsetX, y: 15, colorId: 'charcoal' },
      { op: 'set', x: 15 + offsetX, y: 15, colorId: 'accent' },
      { op: 'set', x: 16 + offsetX, y: 15, colorId: 'charcoal' },
      { op: 'set', x: 13 + offsetX - capeOffset, y: 15, colorId: 'shadow' },
      { op: 'set', x: 13 + offsetX - capeOffset, y: 16, colorId: 'shadow' },
      { op: 'set', x: 14 + offsetX, y: 16, colorId: 'charcoal' },
      { op: 'set', x: 16 + offsetX, y: 16, colorId: 'charcoal' },
      { op: 'set', x: 14 + offsetX, y: 17, colorId: 'ink' },
      { op: 'set', x: 16 + offsetX, y: 17, colorId: 'ink' },
    ]
    const draft = {
      animationName: 'Hero Idle',
      fps: 4,
      frames: [0, 1, 0, -1].map((offset, index) => ({
        name: `Hero Idle ${index + 1}`,
        durationMs: 250,
        patch: makeHeroPatch(offset, index % 2),
      })),
    }
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: JSON.stringify(draft) }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    const requestInput = getRequiredElement('.atlas-request-panel textarea') as HTMLTextAreaElement
    setTextAreaValue(requestInput, 'Hero wearing a cape. Standing animation')

    await clickButtonAsync('Ask Ollama')

    expect(container.textContent).toContain('Ollama drafted 4 editable frames for "Hero Idle".')
    expect(fetch).toHaveBeenCalledWith(
      'http://localhost:11434/api/generate',
      expect.objectContaining({ method: 'POST' }),
    )

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; name: string; frameIds: string[] }>
      frames: Array<{ id: string; tags?: string[]; layers: Array<{ cells: Record<string, string> }> }>
    }
    const idle = exported.animations.find((animation) => animation.id === 'idle')
    expect(idle).toMatchObject({ name: 'Hero Idle' })
    expect(idle?.frameIds).toHaveLength(4)
    const idleFrames = exported.frames.filter((frame) => idle?.frameIds.includes(frame.id))
    expect(idleFrames).toHaveLength(4)
    expect(idleFrames.every((frame) => Object.keys(frame.layers[0].cells).length >= 8)).toBe(true)
    expect(idleFrames.every((frame) => frame.tags?.includes('ollama-draft'))).toBe(true)
  })

  it('pads plain animation prompts before asking Ollama for draft frames', async () => {
    const makeCoinPatch = (frameIndex: number) => {
      const left = frameIndex % 3 === 1 ? 15 : 14
      const right = frameIndex % 3 === 1 ? 16 : 17
      return [
        { op: 'set', x: left, y: 14, colorId: 'ink' },
        { op: 'set', x: left + 1, y: 14, colorId: 'accent' },
        { op: 'set', x: right, y: 14, colorId: 'ink' },
        { op: 'set', x: left, y: 15, colorId: 'accent' },
        { op: 'set', x: left + 1, y: 15, colorId: 'white' },
        { op: 'set', x: right, y: 15, colorId: 'accent' },
        { op: 'set', x: left, y: 16, colorId: 'ink' },
        { op: 'set', x: left + 1, y: 16, colorId: 'shadow' },
        { op: 'set', x: right, y: 16, colorId: 'ink' },
      ]
    }
    const draft = {
      animationName: 'Coin Spin',
      fps: 8,
      frames: Array.from({ length: 6 }, (_, index) => ({
        name: `Coin Spin ${index + 1}`,
        durationMs: 125,
        patch: makeCoinPatch(index),
      })),
    }
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: JSON.stringify(draft) }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    const requestInput = getRequiredElement('.atlas-request-panel textarea') as HTMLTextAreaElement
    setTextAreaValue(requestInput, 'a 4-6 frame gold coin spinning animation')

    await clickButtonAsync('Ask Ollama')

    const requestBody = JSON.parse(fetch.mock.calls[0][1]?.body as string) as { prompt: string }
    expect(requestBody.prompt).toContain('Return exactly 6 frames.')
    expect(requestBody.prompt).toContain('User request: a 4-6 frame gold coin spinning animation')
    expect(requestBody.prompt).toContain('SpriteWrite interpretation: Draft a 6-frame editable animation row')
    expect(requestBody.prompt).toContain('For spinning or rotating assets')
    expect(container.textContent).toContain('Ollama drafted 6 editable frames for "Coin Spin".')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; name: string; frameIds: string[] }>
    }
    const idle = exported.animations.find((animation) => animation.id === 'idle')
    expect(idle).toMatchObject({ name: 'Coin Spin' })
    expect(idle?.frameIds).toHaveLength(6)
  })

  it('applies Ollama grass variation recipes as multiple editable animation rows', async () => {
    const recipe = {
      recipe: 'grass_wave_tiles',
      fps: 4,
      variations: ['A', 'B', 'C', 'D'].map((label, index) => ({
        animationName: `Grass ${label}`,
        frames: [
          {
            name: `Grass ${label} 001`,
            wind: index % 2 ? 1 : -1,
            blades: [
              { x: 0, baseY: 31, height: 4 + (index % 2), lean: -1 },
              { x: 6, baseY: 30, height: 5, lean: 0 },
              { x: 13, baseY: 31, height: 3 + (index % 3), lean: 1 },
              { x: 20, baseY: 29, height: 6, lean: -1 },
              { x: 27, baseY: 31, height: 4, lean: 0 },
              { x: 31, baseY: 30, height: 5, lean: 1 },
            ],
          },
        ],
      })),
    }
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: JSON.stringify(recipe) }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    const requestInput = getRequiredElement('.atlas-request-panel textarea') as HTMLTextAreaElement
    setTextAreaValue(
      requestInput,
      'short grass waving in the wind, 3 frames, 4 frame set variations that can tile',
    )

    await clickButtonAsync('Ask Ollama')

    expect(container.textContent).toContain('Ollama drafted 4 animation rows with 12 editable frames.')
    expect(container.textContent).toContain('Full Sprite Sheet View')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ name: string; frameIds: string[] }>
    }
    const grassAnimations = exported.animations.filter((animation) => animation.name.startsWith('Grass '))
    expect(grassAnimations.map((animation) => animation.name)).toEqual([
      'Grass A',
      'Grass B',
      'Grass C',
      'Grass D',
    ])
    expect(grassAnimations.every((animation) => animation.frameIds.length === 3)).toBe(true)
  })

  it('applies Ollama tentacle variation recipes as connected editable animation rows', async () => {
    const recipe = {
      recipe: 'tentacle_creature_variations',
      fps: 4,
      variations: [
        {
          animationName: 'Tentacle A',
          bodyRx: 5,
          bodyRy: 4,
          eyeCount: 1,
          tentacles: [
            { anchor: 'left', length: 6, curl: -1 },
            { anchor: 'right', length: 6, curl: 1 },
            { anchor: 'bottom', length: 5, curl: 0 },
          ],
        },
        {
          animationName: 'Tentacle B',
          bodyRx: 6,
          bodyRy: 5,
          eyeCount: 2,
          tentacles: [
            { anchor: 'left', length: 4, curl: -2 },
            { anchor: 'right', length: 7, curl: 2 },
            { anchor: 'bottom', length: 6, curl: 0 },
          ],
        },
        {
          animationName: 'Tentacle C',
          bodyRx: 4,
          bodyRy: 3,
          eyeCount: 3,
          tentacles: [
            { anchor: 'left', length: 5, curl: -1 },
            { anchor: 'right', length: 8, curl: 1 },
            { anchor: 'bottom', length: 6, curl: 0 },
          ],
        },
      ],
    }
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: JSON.stringify(recipe) }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    const requestInput = getRequiredElement('.atlas-request-panel textarea') as HTMLTextAreaElement
    setTextAreaValue(requestInput, 'tentacle monster, 3 variations')

    await clickButtonAsync('Ask Ollama')

    expect(container.textContent).toContain('Ollama drafted 3 animation rows with 12 editable frames.')
    expect(container.textContent).toContain('Full Sprite Sheet View')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ name: string; frameIds: string[] }>
    }
    const tentacleAnimations = exported.animations.filter((animation) =>
      animation.name.startsWith('Tentacle '),
    )
    expect(tentacleAnimations.map((animation) => animation.name)).toEqual([
      'Tentacle A',
      'Tentacle B',
      'Tentacle C',
    ])
    expect(tentacleAnimations.every((animation) => animation.frameIds.length === 4)).toBe(true)
  })

  it('hides invalid Ollama selected-frame patch overlays until validation passes', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          response: '[{"op":"set","x":1,"y":2,"colorId":"missing_color"}]',
        }),
      } as Response),
    )

    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    await clickButtonAsync('Ask Ollama')

    expect(container.textContent).toContain('validation found issues')
    expect(container.textContent).toContain('Show provider details')
    expect(container.querySelector('.provider-details pre')?.textContent).toContain('missing_color')
    expect(container.querySelector('.provider-details pre')?.textContent).toContain('"validationErrors"')
    expect(container.querySelectorAll('.pixel-cell.has-proposal')).toHaveLength(0)
  })

  it('shows provider details when Ollama animation drafts fail validation', async () => {
    const draft = {
      animationName: 'Broken Coin Spin',
      fps: 8,
      frames: Array.from({ length: 6 }, (_, index) => ({
        name: `Broken Coin ${index + 1}`,
        durationMs: 125,
        patch: [{ op: 'set', x: 12 + index, y: 14, colorId: 'missing_color' }],
      })),
    }
    const fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ response: JSON.stringify(draft) }),
    } as Response)
    vi.stubGlobal('fetch', fetch)

    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    const requestInput = getRequiredElement('.atlas-request-panel textarea') as HTMLTextAreaElement
    setTextAreaValue(requestInput, 'a 4-6 frame gold coin spinning animation')

    await clickButtonAsync('Ask Ollama')

    expect(fetch).toHaveBeenCalledTimes(1)
    expect(container.textContent).toContain('Ollama animation draft rejected.')
    expect(container.textContent).toContain('Frame 1:')
    expect(container.textContent).toContain('missing_color')
    expect(container.textContent).toContain('Show provider details')
    const details = container.querySelector('.provider-details pre')?.textContent ?? ''
    expect(details).toContain('"userInstruction": "a 4-6 frame gold coin spinning animation"')
    expect(details).toContain('"validationErrors"')
    expect(details).toContain('missing_color')
    expect(details).toContain('"draft"')

    await clickButtonAsync('Ask Ollama')

    expect(fetch).toHaveBeenCalledTimes(2)
    expect(container.textContent).toContain('Attempt 2 completed')
    expect(container.querySelector('.provider-details pre')?.textContent).toContain('"attempt": 2')
  })

  it('reorders frames by dragging within an atlas row', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')

    const atlasFrames = Array.from(container.querySelectorAll<HTMLButtonElement>('.atlas-frame-strip button'))
    expect(atlasFrames).toHaveLength(2)

    dispatchDragEvent(atlasFrames[0], 'dragstart')
    dispatchDragEvent(atlasFrames[1], 'drop')

    expect(container.textContent).toContain('Frame order updated.')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; frameIds: string[] }>
    }
    const idleFrameIds = exported.animations.find((animation) => animation.id === 'idle')?.frameIds ?? []

    expect(idleFrameIds).toHaveLength(2)
    expect(idleFrameIds[1]).toBe('idle-001')
  })

  it('returns home and reopens the current editable project', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    expect(container.textContent).toContain('AI Assistant')

    clickButton('Home')

    expect(container.textContent).toContain('Browser Draft')
    expect(container.textContent).toContain('This is a convenience, not a project library.')
    expect(container.textContent).toContain('Project JSON is the editable source artifact.')

    clickButton('Open Current Project')

    expect(container.textContent).toContain('AI Assistant')
    expect(container.textContent).toContain('Saved as Project JSON')
  })

  it('warns before page unload when editable work is unsaved', () => {
    act(() => {
      root.render(<App />)
    })

    const cleanUnload = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(cleanUnload)).toBe(true)

    clickButton('New Project')

    const dirtyUnload = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(dirtyUnload)).toBe(false)
  })

  it('does not replace a dirty project when the user cancels the warning', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')
    clickButton('Home')
    clickButton('Blank 64x64')

    vi.spyOn(window, 'confirm').mockReturnValue(false)
    clickButton('New Project')

    expect(container.textContent).toContain('New From Template')
    clickButton('Open Current Project')
    expect(container.textContent).toContain('32x32 cells')
    expect(getPixelCellByTitle('0,0 ink')).toBeTruthy()
  })

  it('restores the last valid browser draft on a fresh app load', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Blank 64x64')
    clickButton('New Project')

    act(() => {
      root.unmount()
    })
    root = createRoot(container)
    act(() => {
      root.render(<App />)
    })

    clickButton('Open Current Project')

    expect(container.textContent).toContain('64x64 cells')
    expect(container.textContent).toContain('Saved as Project JSON')
  })

  it('opens the hero sprite sheet demo with multiple animation rows', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Open Hero Demo')

    expect(container.textContent).toContain('Hero Sprite Demo')
    expect(container.textContent).toContain('Frames: 4')
    expect(container.textContent).toContain('Jump')
    expect(container.textContent).toContain('Crouch')
    expect(container.textContent).toContain('Sword Stab')
  })

  it('pads shorter animation rows in the full sprite sheet workspace', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Open Hero Demo')
    clickButton('Full Sheet')

    expect(container.textContent).toContain('Full Sprite Sheet View')
    expect(container.querySelectorAll('.sheet-row')).toHaveLength(4)
    expect(container.querySelectorAll('.sheet-row-strip button')).toHaveLength(17)
    expect(container.querySelectorAll('.sheet-frame-placeholder')).toHaveLength(3)
  })

  it('lets the preview use a solid background color without changing exports', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const previewBox = getRequiredElement('.preview-box') as HTMLDivElement
    const backgroundToggle = Array.from(container.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'))
      .find((input) => input.parentElement?.textContent?.includes('Solid preview background'))
    const colorInput = container.querySelector<HTMLInputElement>('.preview-background-controls input[type="color"]')

    if (!backgroundToggle || !colorInput) {
      throw new Error('Missing preview background controls.')
    }

    act(() => {
      backgroundToggle.click()
    })
    setInputValue(colorInput, '#334455')

    expect(previewBox.classList.contains('solid-preview-background')).toBe(true)
    expect(previewBox.getAttribute('style')).toContain('--preview-background-color: #334455')
    expect(container.textContent).toContain('Export Plan')
  })

  it('switches paint and erase tools with keyboard shortcuts', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }))
    })
    expect(container.textContent).toContain('Eraser')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }))
    })
    expect(container.textContent).toContain('Ink')
  })

  it('does not show the old shortcut settings panel in the drawing dock', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    expect(container.querySelector('.shortcut-settings')).toBeNull()
    expect(container.textContent).not.toContain('Reset Shortcuts')
  })

  it('defaults the AI provider to local Ollama', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const providerSelect = Array.from(container.querySelectorAll<HTMLSelectElement>('select')).find((select) =>
      Array.from(select.options).some((option) => option.value === 'ollama'),
    )

    expect(providerSelect?.value).toBe('ollama')
    expect(container.textContent).toContain('Ollama local')
  })

  it('does not run editor shortcuts while typing in fields', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    expect(getRequiredElement('.palette-selected strong').textContent).toBe('Ink')

    const colorNameInput = getRequiredElement('.palette-inspector').querySelector<HTMLInputElement>('input')
    if (!colorNameInput) {
      throw new Error('Missing palette color name input.')
    }

    act(() => {
      colorNameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }))
    })

    expect(getRequiredElement('.palette-selected strong').textContent).toBe('Ink')
  })

  it('moves between frames with arrow keyboard shortcuts', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')

    expect(getRequiredElement('.atlas-frame-strip button.active span').textContent).toBe('2')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    })
    expect(getRequiredElement('.atlas-frame-strip button.active span').textContent).toBe('1')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })
    expect(getRequiredElement('.atlas-frame-strip button.active span').textContent).toBe('2')
  })

  it('opens and filters the command palette', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    })
    expect(container.textContent).toContain('Find editor actions')

    const commandSearch = container.querySelector<HTMLInputElement>('.command-palette input')
    if (!commandSearch) {
      throw new Error('Missing command palette search input.')
    }

    setInputValue(commandSearch, 'metadata')

    expect(container.textContent).toContain('Export Full Sprite Sheet PNG + Metadata JSON')
    expect(container.textContent).not.toContain('Add layer')
  })

  it('runs editor actions from the command palette', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    })

    const commandSearch = container.querySelector<HTMLInputElement>('.command-palette input')
    if (!commandSearch) {
      throw new Error('Missing command palette search input.')
    }

    setInputValue(commandSearch, 'add layer')

    act(() => {
      commandSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    expect(container.textContent).toContain('Layer 2')
    expect(container.textContent).not.toContain('Find editor actions')
  })

  it('adds, duplicates, and deletes frames from the frame controls', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    expect(container.textContent).toContain('Frames: 1')

    clickButton('Add Frame')
    expect(container.textContent).toContain('Frames: 2')

    clickButton('Duplicate Frame')
    expect(container.textContent).toContain('Frames: 3')

    clickButton('Delete Frame')
    expect(container.textContent).toContain('Frames: 2')
  })

  it('adds a blank frame after the selected frame', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')
    clickButton('Add Frame')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; frameIds: string[] }>
      frames: Array<{ id: string; layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    const idleFrameIds = exported.animations.find((animation) => animation.id === 'idle')?.frameIds ?? []
    const addedFrame = exported.frames.find((frame) => frame.id === idleFrameIds[1])

    expect(idleFrameIds).toHaveLength(2)
    expect(addedFrame?.layers[0].cells).toEqual({})
  })

  it('duplicates the selected frame with its cell data', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')
    clickButton('Duplicate Frame')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; frameIds: string[] }>
      frames: Array<{ id: string; layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    const idleFrameIds = exported.animations.find((animation) => animation.id === 'idle')?.frameIds ?? []
    const duplicatedFrame = exported.frames.find((frame) => frame.id === idleFrameIds[1])

    expect(idleFrameIds).toHaveLength(2)
    expect(duplicatedFrame?.layers[0].cells['0,0']).toBe('ink')
  })

  it('keeps final/default delete controls disabled', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    expect(getButtonWithin('.frame-actions', 'Delete Frame').disabled).toBe(true)
    expect(getButtonWithin('.animation-controls', 'Delete').disabled).toBe(true)
    expect(getButtonWithin('.layer-actions', 'Delete').disabled).toBe(true)
  })

  it('undoes and redoes a painted cell from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    paintCellByTitle('0,0')
    expect(getPixelCellByTitle('0,0 ink')).toBeTruthy()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })
    expect(getPixelCellByTitle('0,0')).toBeTruthy()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))
    })
    expect(getPixelCellByTitle('0,0 ink')).toBeTruthy()
  })

  it('clears redo history after a new edit following undo', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    paintCellByTitle('0,0')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })
    paintCellByTitle('1,0')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))
    })

    expect(getPixelCellByTitle('0,0')).toBeTruthy()
    expect(getPixelCellByTitle('1,0 ink')).toBeTruthy()
  })

  it('undoes an accepted patch apply from the editor', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    await clickButtonAsync('Generate Mock Edit')
    clickButton('Apply Edit')

    const afterApply = setupDownloadCapture()
    clickButton('Export Project JSON')
    const appliedProject = JSON.parse((await afterApply.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    expect(Object.keys(appliedProject.frames[0].layers[0].cells)).toHaveLength(5)

    vi.restoreAllMocks()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })

    const afterUndo = setupDownloadCapture()
    clickButton('Export Project JSON')
    const undoneProject = JSON.parse((await afterUndo.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    expect(Object.keys(undoneProject.frames[0].layers[0].cells)).toHaveLength(0)
  })

  it('rejects a proposed edit without mutating the project', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    await clickButtonAsync('Generate Mock Edit')
    expect(container.textContent).toContain('5/5 enabled')

    clickButton('Reject Edit')

    const afterReject = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exportedProject = JSON.parse((await afterReject.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    expect(Object.keys(exportedProject.frames[0].layers[0].cells)).toHaveLength(0)
    expect(container.textContent).toContain('Edit rejected.')
  })
  it('undoes frame add operations from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')
    expect(container.textContent).toContain('Frames: 2')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })

    expect(container.textContent).toContain('Frames: 1')
  })

  it('undoes frame duplicate operations from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Duplicate Frame')
    expect(container.textContent).toContain('Frames: 2')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })

    expect(container.textContent).toContain('Frames: 1')
  })

  it('undoes frame delete operations from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')
    expect(container.textContent).toContain('Frames: 2')

    clickButton('Delete Frame')
    expect(container.textContent).toContain('Frames: 1')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })

    expect(container.textContent).toContain('Frames: 2')
  })

  it('undoes layer visibility changes from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')
    expect(getRequiredElement('.preview-box').querySelectorAll('.mini-pixel')).toHaveLength(1)

    clickButtonWithin('.layer-list', 'Hide')
    expect(getRequiredElement('.preview-box').querySelectorAll('.mini-pixel')).toHaveLength(0)

    undoWithKeyboard()
    expect(getRequiredElement('.preview-box').querySelectorAll('.mini-pixel')).toHaveLength(1)
    expect(container.textContent).toContain('Visible | Editable | Exports | 1 cells')
  })

  it('undoes palette color edits from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const paletteInputs = getRequiredElement('.palette-inspector').querySelectorAll('input')
    setInputValue(paletteInputs[0], 'Line Art')
    setInputValue(paletteInputs[1], '#112233')
    clickButtonWithin('.palette-inspector', 'Save')
    expect(container.textContent).toContain('Line Art')

    undoWithKeyboard()

    expect(getRequiredElement('.palette-selected strong').textContent).toBe('Ink')
    expect(container.textContent).not.toContain('Line Art')
  })

  it('undoes animation add operations from the editor', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButtonWithin('.animation-controls', 'Add Animation')
    expect(container.textContent).toContain('Animation 2')

    undoWithKeyboard()

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ name: string }>
    }
    expect(exported.animations.map((animation) => animation.name)).toEqual(['Idle'])
    expect(container.textContent).not.toContain('Animation 2')
  })

  it('undoes frame metadata edits from the editor', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const frameInputs = getRequiredElement('.frame-inspector').querySelectorAll('input')
    const frameNotes = getRequiredElement('.frame-inspector').querySelector('textarea')
    if (!frameNotes) {
      throw new Error('Missing frame notes field.')
    }

    setInputValue(frameInputs[0], 'Contact')
    setTextAreaValue(frameNotes, 'Impact frame.')
    setInputValue(frameInputs[4], 'attack, contact')
    clickButtonWithin('.frame-inspector', 'Save')

    const afterSave = setupDownloadCapture()
    clickButton('Export Project JSON')
    const savedProject = JSON.parse((await afterSave.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ id: string; name: string; notes?: string; tags?: string[] }>
    }
    expect(savedProject.frames.find((candidate) => candidate.id === 'idle-001')).toMatchObject({
      name: 'Contact',
      notes: 'Impact frame.',
      tags: ['attack', 'contact'],
    })

    vi.restoreAllMocks()
    undoWithKeyboard()

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ id: string; name: string; notes?: string; tags?: string[] }>
    }
    const frame = exported.frames.find((candidate) => candidate.id === 'idle-001')
    expect(frame).toMatchObject({ name: 'Frame 001', notes: '', tags: [] })
  })

  it('toggles layer PNG export inclusion from the layer inspector', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    runCommandFromPalette('add layer')

    expect(container.textContent).toContain('Layer 2')
    expect(container.textContent).toContain('Exports | 0 cells')

    const exportToggle = getCheckboxByLabel('Include in PNG export')
    act(() => {
      exportToggle.click()
    })

    expect(container.textContent).toContain('No export | 0 cells')
  })

  it('edits the selected layer blend mode from the layer inspector', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const blendModeSelect = getRequiredElement('.layer-inspector').querySelector<HTMLSelectElement>('select')
    if (!blendModeSelect) {
      throw new Error('Missing layer blend mode select.')
    }
    setSelectValue(blendModeSelect, 'screen')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; blendMode?: string }> }>
    }

    expect(exported.frames[0].layers[0]).toMatchObject({ id: 'base', blendMode: 'screen' })
  })

  it('applies layer export presets from the layer inspector', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButtonWithin('.layer-presets', 'Shadow')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; exportable: boolean; opacity: number; blendMode?: string }> }>
    }

    expect(exported.frames[0].layers[0]).toMatchObject({
      id: 'base',
      exportable: true,
      opacity: 0.55,
      blendMode: 'multiply',
    })
    expect(container.textContent).toContain('Applied Shadow layer preset.')
  })

  it('hides a layer from preview without deleting its cells', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')

    expect(getRequiredElement('.preview-box').querySelectorAll('.mini-pixel')).toHaveLength(1)

    clickButtonWithin('.layer-list', 'Hide')

    expect(getRequiredElement('.preview-box').querySelectorAll('.mini-pixel')).toHaveLength(0)
    expect(getPixelCellByTitle('0,0 ink')).toBeTruthy()

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ visible: boolean; cells: Record<string, string> }> }>
    }

    expect(exported.frames[0].layers[0].visible).toBe(false)
    expect(exported.frames[0].layers[0].cells['0,0']).toBe('ink')
  })

  it('adds, reorders, and deletes layers from the layer panel', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    clickButtonWithin('.layer-actions', 'Add')
    clickButtonWithin('.layer-actions', 'Add')
    clickButtonWithin('.layer-actions', 'Up')

    const afterMove = setupDownloadCapture()
    clickButton('Export Project JSON')
    const movedProject = JSON.parse((await afterMove.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ id: string; layers: Array<{ name: string }> }>
    }
    expect(movedProject.frames[0].layers.map((layer) => layer.name)).toEqual([
      'Base',
      'Layer 3',
      'Layer 2',
    ])

    vi.restoreAllMocks()
    clickButtonWithin('.layer-actions', 'Delete')

    const afterDelete = setupDownloadCapture()
    clickButton('Export Project JSON')
    const deletedProject = JSON.parse((await afterDelete.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ id: string; layers: Array<{ name: string }> }>
    }
    expect(deletedProject.frames[0].layers.map((layer) => layer.name)).toEqual(['Base', 'Layer 2'])
  })

  it('edits the selected palette color name and hex from the palette inspector', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const paletteInputs = getRequiredElement('.palette-inspector').querySelectorAll('input')
    setInputValue(paletteInputs[0], 'Line Art')
    setInputValue(paletteInputs[1], '#112233')
    clickButtonWithin('.palette-inspector', 'Save')

    expect(container.textContent).toContain('Line Art')
    expect(container.textContent).toContain('Updated palette color "ink".')
  })

  it('adds, reorders, and deletes an unused palette color from the palette inspector', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    clickButtonWithin('.palette-inspector', 'Add Color')
    expect(container.textContent).toContain('Color 8')

    clickButtonWithin('.palette-inspector', 'Up')

    const afterMove = setupDownloadCapture()
    clickButton('Export Project JSON')
    const movedProject = JSON.parse((await afterMove.capturedBlob.current?.text()) ?? '{}') as {
      palette: Array<{ name: string }>
    }
    expect(movedProject.palette.map((color) => color.name).slice(-2)).toEqual(['Color 8', 'Shadow'])

    vi.restoreAllMocks()
    clickButtonWithin('.palette-inspector', 'Delete Color')

    const afterDelete = setupDownloadCapture()
    clickButton('Export Project JSON')
    const deletedProject = JSON.parse((await afterDelete.capturedBlob.current?.text()) ?? '{}') as {
      palette: Array<{ name: string }>
    }
    expect(deletedProject.palette.map((color) => color.name)).not.toContain('Color 8')
  })

  it('renames the selected animation from the animation inspector', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const animationNameInput = getRequiredElement('.animation-inspector').querySelector('input')
    if (!animationNameInput) {
      throw new Error('Missing animation name input.')
    }

    setInputValue(animationNameInput, 'Walk')
    clickButtonWithin('.animation-inspector', 'Save')

    expect(container.textContent).toContain('Walk')
  })

  it('adds, duplicates, and deletes animations from the animation controls', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    clickButtonWithin('.animation-controls', 'Add Animation')
    expect(container.textContent).toContain('Animation 2')

    clickButtonWithin('.animation-controls', 'Duplicate')
    expect(container.textContent).toContain('Animation 2 Copy')

    clickButtonWithin('.animation-controls', 'Delete')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ name: string }>
    }

    expect(exported.animations.map((animation) => animation.name)).toEqual(['Idle', 'Animation 2'])
  })

  it('edits frame metadata and preserves it in exported project JSON', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const frameInputs = getRequiredElement('.frame-inspector').querySelectorAll('input')
    const frameNotes = getRequiredElement('.frame-inspector').querySelector('textarea')
    if (!frameNotes) {
      throw new Error('Missing frame notes field.')
    }
    setInputValue(frameInputs[0], 'Contact')
    clickButtonWithin('.frame-inspector', 'Save')
    setInputValue(frameInputs[1], '333')
    setInputValue(frameInputs[2], '3')
    setInputValue(frameInputs[3], '4')
    setTextAreaValue(frameNotes, 'Impact frame for the first readable hit.')
    setInputValue(frameInputs[4], 'attack, contact')
    clickButtonWithin('.frame-inspector', 'Save')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')

    const text = await capturedBlob.current?.text()
    const exported = JSON.parse(text ?? '{}') as {
      frames: Array<{
        id: string
        name: string
        durationMs: number
        notes?: string
        tags?: string[]
        anchor: { x: number; y: number }
      }>
    }
    const frame = exported.frames.find((candidate) => candidate.id === 'idle-001')

    expect(frame).toMatchObject({
      name: 'Contact',
      durationMs: 333,
      notes: 'Impact frame for the first readable hit.',
      tags: ['attack', 'contact'],
      anchor: { x: 3, y: 4 },
    })
  })

  it('edits frame hitbox metadata and preserves it in exported project JSON', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const hitboxToggle = getCheckboxByLabel('Hitbox metadata')
    act(() => {
      hitboxToggle.click()
    })

    const numberInputs = getRequiredElement('.frame-inspector').querySelectorAll<HTMLInputElement>(
      'input[type="number"]',
    )
    setInputValue(numberInputs[3], '2')
    setInputValue(numberInputs[4], '3')
    setInputValue(numberInputs[5], '10')
    setInputValue(numberInputs[6], '11')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ id: string; hitbox?: { x: number; y: number; width: number; height: number } }>
    }
    const frame = exported.frames.find((candidate) => candidate.id === 'idle-001')

    expect(frame?.hitbox).toEqual({ x: 2, y: 3, width: 10, height: 11 })
  })

  it('imports a valid project JSON file and enters the editor', async () => {
    act(() => {
      root.render(<App />)
    })

    const project = createBlankProject({
      name: 'Imported Button',
      width: 64,
      height: 24,
      assetType: 'ui',
    })

    await importProjectFile(new File([JSON.stringify(project)], 'button.spritewrite.json', {
      type: 'application/json',
    }))

    expect(container.textContent).toContain('Imported Button')
    expect(container.textContent).toContain('64x24 cells')
    expect(container.textContent).toContain('Saved as Project JSON')
  })

  it('rejects invalid project JSON without replacing the current project', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Blank 64x64')
    clickButton('New Project')

    await importProjectFile(new File(['{"name":"Broken"}'], 'broken.spritewrite.json', {
      type: 'application/json',
    }))

    expect(container.textContent).toContain('64x64 cells')
    expect(container.textContent).toContain('Project id must be a non-empty string.')
    expect(container.textContent).toContain('Import rejected.')
  })

  it('exports project JSON from the editor and clears the dirty indicator', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    expect(container.textContent).toContain('Unsaved changes')

    const { anchor, capturedBlob } = setupDownloadCapture()

    clickButton('Export Project JSON')

    expect(anchor.download).toBe('untitled-sprite.spritewrite.json')
    expect(container.textContent).toContain('Saved as Project JSON')

    const text = await capturedBlob.current?.text()
    expect(text).toContain('"name": "Untitled Sprite"')
    expect(text).toContain('"canvas"')
  })

  it('re-imports exported project JSON through the UI', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exportedText = await capturedBlob.current?.text()
    if (!exportedText) {
      throw new Error('Missing exported project JSON.')
    }

    vi.restoreAllMocks()
    await importProjectFile(new File([exportedText], 'roundtrip.spritewrite.json', {
      type: 'application/json',
    }))

    expect(container.textContent).toContain('Saved as Project JSON')
    expect(getPixelCellByTitle('0,0 ink')).toBeTruthy()
  })

  it('exports full sprite sheet PNG plus metadata JSON from the editor', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Open Hero Demo')
    const { anchor, canvas, capturedBlob } = setupPngDownloadCapture()

    await clickButtonAsync('Export Full Sprite Sheet PNG + Metadata JSON')
    await act(async () => {
      await Promise.resolve()
      await Promise.resolve()
    })

    expect(canvas.width).toBe(160)
    expect(canvas.height).toBe(128)
    expect(anchor.download).toBe('hero-sprite-demo-sprite-sheet@1x.metadata.json')
    const text = await capturedBlob.current?.text()
    expect(text).toContain('"formatName": "SpriteWrite"')
    expect(text).toContain('"imageFilename": "hero-sprite-demo-sprite-sheet@1x.png"')
    expect(text).toContain('"rowCount": 4')
    expect(text).toContain('"columnCount": 5')
    expect(text).toContain('"animationName": "Sword Stab"')
    expect(text).toContain('"frameId": "sword-stab-005"')
  })

  it('exports current frame PNG from the editor through a crisp canvas path', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    const { anchor, canvas, context, capturedBlob } = setupPngDownloadCapture()

    await clickButtonAsync('Export Current Frame PNG')

    expect(anchor.download).toBe('idle-001@1x.png')
    expect(canvas.width).toBe(32)
    expect(canvas.height).toBe(32)
    expect(context.imageSmoothingEnabled).toBe(false)
    expect(context.putImageData).toHaveBeenCalled()
    expect(capturedBlob.current?.type).toBe('image/png')
  })

  it('exports current animation strip PNG from the editor through a crisp canvas path', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    const { anchor, canvas, context, capturedBlob } = setupPngDownloadCapture()

    await clickButtonAsync('Export Current Animation Strip PNG')

    expect(anchor.download).toBe('idle-animation-strip@1x.png')
    expect(canvas.width).toBe(32)
    expect(canvas.height).toBe(32)
    expect(context.imageSmoothingEnabled).toBe(false)
    expect(context.putImageData).toHaveBeenCalled()
    expect(capturedBlob.current?.type).toBe('image/png')
  })

  it('exports full sprite sheet PNG from the editor through a crisp canvas path', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Open Hero Demo')
    const { anchor, canvas, context, capturedBlob } = setupPngDownloadCapture()

    await clickButtonAsync('Export Full Sprite Sheet PNG')

    expect(anchor.download).toBe('hero-sprite-demo-sprite-sheet@1x.png')
    expect(canvas.width).toBe(160)
    expect(canvas.height).toBe(128)
    expect(context.imageSmoothingEnabled).toBe(false)
    expect(context.putImageData).toHaveBeenCalled()
    expect(capturedBlob.current?.type).toBe('image/png')
  })

  it('can exclude a proposed edit operation before apply', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    await clickButtonAsync('Generate Mock Edit')

    expect(container.textContent).toContain('5/5 enabled')
    expect(container.textContent).toContain('Current frame')
    expect(container.textContent).toContain('Proposed edit')
    expect(container.textContent).toContain('Cells 5')
    expect(container.textContent).toContain('Bounds')
    expect(container.textContent).toContain('ink 5')
    expect(container.querySelectorAll('.mini-highlight')).toHaveLength(10)

    clickButton('Exclude')

    expect(container.textContent).toContain('4/5 enabled')
    expect(container.textContent).toContain('Cells 4')
    expect(container.textContent).toContain('ink 4')
    expect(container.textContent).toContain('1 operation(s) excluded from apply.')
    expect(container.querySelectorAll('.mini-highlight')).toHaveLength(8)
  })

  it('can remove a proposed edit operation before apply', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    await clickButtonAsync('Generate Mock Edit')

    clickButton('Remove')

    expect(container.textContent).toContain('4/4 enabled')
    expect(container.textContent).toContain('Cells 4')
    expect(container.querySelectorAll('.mini-highlight')).toHaveLength(8)

    clickButton('Apply Edit')

    const afterApply = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exportedProject = JSON.parse((await afterApply.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    expect(Object.keys(exportedProject.frames[0].layers[0].cells)).toHaveLength(4)
  })

  it('does not apply a patch when every proposed operation is excluded', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    await clickButtonAsync('Generate Mock Edit')

    for (let index = 0; index < 5; index += 1) {
      clickButton('Exclude')
    }

    expect(container.textContent).toContain('0/5 enabled')
    const applyButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent?.trim() === 'Apply Edit',
    )
    expect(applyButton?.disabled).toBe(true)

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    })
    const commandSearch = container.querySelector<HTMLInputElement>('.command-palette input')
    if (!commandSearch) {
      throw new Error('Missing command palette search input.')
    }

    setInputValue(commandSearch, 'apply proposed edit')
    const commandButton = Array.from(container.querySelectorAll<HTMLButtonElement>('.command-item')).find(
      (button) => button.textContent?.includes('Apply proposed edit'),
    )
    expect(commandButton?.disabled).toBe(true)

    act(() => {
      commandSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    const afterAttempt = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exportedProject = JSON.parse((await afterAttempt.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    expect(Object.keys(exportedProject.frames[0].layers[0].cells)).toHaveLength(0)
  })
  it('clears stale proposed edits after a provider failure', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 503,
        statusText: 'Unavailable',
      } as Response),
    )

    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    await clickButtonAsync('Generate Mock Edit')
    expect(container.textContent).toContain('5/5 enabled')

    const providerSelect = Array.from(container.querySelectorAll('select')).find((select) =>
      Array.from(select.options).some((option) => option.value === 'ollama'),
    )
    if (!providerSelect) {
      throw new Error('Missing provider selector.')
    }

    act(() => {
      providerSelect.value = 'ollama'
      providerSelect.dispatchEvent(new Event('change', { bubbles: true }))
    })

    await clickButtonAsync('Generate With Ollama')

    expect(container.textContent).toContain('Ollama returned 503 Unavailable')
    expect(container.textContent).not.toContain('5/5 enabled')

    clickButton('Apply Edit')

    const afterFailure = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exportedProject = JSON.parse((await afterFailure.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    expect(Object.keys(exportedProject.frames[0].layers[0].cells)).toHaveLength(0)
  })
  function setInputValue(input: HTMLInputElement, value: string) {
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function setTextAreaValue(textarea: HTMLTextAreaElement, value: string) {
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      valueSetter?.call(textarea, value)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function setSelectValue(select: HTMLSelectElement, value: string) {
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
      valueSetter?.call(select, value)
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  function undoWithKeyboard() {
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })
  }

  function runCommandFromPalette(query: string) {
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    })

    const commandSearch = container.querySelector<HTMLInputElement>('.command-palette input')
    if (!commandSearch) {
      throw new Error('Missing command palette search input.')
    }

    setInputValue(commandSearch, query)

    act(() => {
      commandSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
  }

  function getCheckboxByLabel(label: string): HTMLInputElement {
    const labelElement = Array.from(container.querySelectorAll('label')).find((candidate) =>
      candidate.textContent?.includes(label),
    )
    const input = labelElement?.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (!input) {
      throw new Error(`Missing checkbox "${label}".`)
    }
    return input
  }

  function getRequiredElement(selector: string): HTMLElement {
    const element = container.querySelector<HTMLElement>(selector)
    if (!element) {
      throw new Error(`Missing element "${selector}".`)
    }
    return element
  }

  function clickButtonWithin(selector: string, label: string) {
    const button = getButtonWithin(selector, label)

    act(() => {
      button.click()
    })
  }

  function getButtonWithin(selector: string, label: string): HTMLButtonElement {
    const button = Array.from(getRequiredElement(selector).querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(label),
    )
    if (!button) {
      throw new Error(`Missing button "${label}" inside "${selector}".`)
    }

    return button
  }

  function getPixelCellByTitle(title: string): HTMLButtonElement | null {
    return container.querySelector<HTMLButtonElement>(`.pixel-cell[title="${title}"]`)
  }

  function paintCellByTitle(title: string) {
    const cell = getPixelCellByTitle(title)
    if (!cell) {
      throw new Error(`Missing pixel cell "${title}".`)
    }

    act(() => {
      cell.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
      window.dispatchEvent(new Event('pointerup', { bubbles: true }))
    })
  }

  function dispatchDragEvent(element: HTMLElement, type: 'dragstart' | 'drop' | 'dragend') {
    const event = new Event(type, { bubbles: true, cancelable: true })
    Object.defineProperty(event, 'dataTransfer', {
      value: {
        effectAllowed: '',
        dropEffect: '',
        setData: vi.fn(),
        getData: vi.fn(),
      },
    })

    act(() => {
      element.dispatchEvent(event)
    })
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(label),
    )
    if (!button) {
      throw new Error(`Missing button "${label}".`)
    }

    act(() => {
      button.click()
    })
  }

  async function clickButtonAsync(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(label),
    )
    if (!button) {
      throw new Error(`Missing button "${label}".`)
    }

    await act(async () => {
      button.click()
      await Promise.resolve()
    })
  }

  async function importProjectFile(file: File) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) {
      throw new Error('Missing project import input.')
    }

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  function setupDownloadCapture() {
    const anchor = originalCreateElement('a')
    anchor.click = vi.fn()
    anchor.remove = vi.fn()
    const capturedBlob: { current?: Blob } = {}

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: Blob | MediaSource) => {
        if (blob instanceof Blob) {
          capturedBlob.current = blob
        }
        return 'blob:app-export'
      }),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    vi.spyOn(document.body, 'append').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return anchor
      }
      return originalCreateElement(tagName)
    })

    return { anchor, capturedBlob }
  }

  function setupPngDownloadCapture() {
    const anchor = originalCreateElement('a')
    anchor.click = vi.fn()
    anchor.remove = vi.fn()
    const capturedBlob: { current?: Blob } = {}
    const context = {
      imageSmoothingEnabled: true,
      createImageData: vi.fn((width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      })),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback, type?: string) => {
        const blob = new Blob(['png'], { type })
        capturedBlob.current = blob
        callback(blob)
      }),
    } as unknown as HTMLCanvasElement

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: Blob | MediaSource) => {
        if (blob instanceof Blob) {
          capturedBlob.current = blob
        }
        return 'blob:frame-png'
      }),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    vi.spyOn(document.body, 'append').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return anchor
      }
      if (tagName === 'canvas') {
        return canvas
      }
      return originalCreateElement(tagName)
    })

    return { anchor, canvas, context, capturedBlob }
  }
})
