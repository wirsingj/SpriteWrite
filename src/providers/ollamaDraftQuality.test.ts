import { describe, expect, it, vi } from 'vitest'
import { createBlankProject } from '../domain/spriteData'
import type { OllamaAnimationDraft } from './ollamaPatchProvider'
import type { OllamaPatchProvider } from './ollamaPatchProvider'
import {
  evaluateAnimationDraft,
  OllamaDraftQualityError,
  requestImprovedAnimationDraft,
} from './ollamaDraftQuality'

function createIconProject() {
  return createBlankProject({
    name: 'Quality Probe',
    width: 32,
    height: 32,
    assetType: 'icon',
  })
}

function createCoinDraft(widths: number[] = [8, 3, 8, 3]): OllamaAnimationDraft {
  return {
    animationName: 'Gold Coin',
    fps: 8,
    paletteAdditions: [
      { id: 'coin_gold', name: 'Coin Gold', hex: '#e8a928' },
      { id: 'coin_light', name: 'Coin Highlight', hex: '#fff0a8' },
      { id: 'coin_shadow', name: 'Coin Shadow', hex: '#7a4d10' },
    ],
    frames: widths.map((width, frameIndex) => {
      const startX = Math.floor(16 - width / 2)
      const patch = []
      for (let y = 12; y <= 20; y += 1) {
        for (let x = startX; x < startX + width; x += 1) {
          patch.push({
            op: 'set' as const,
            x,
            y,
            colorId: x === startX + ((frameIndex + 1) % width) ? 'coin_light' : 'coin_gold',
          })
        }
      }

      return {
        name: `Coin ${frameIndex + 1}`,
        durationMs: 125,
        patch,
      }
    }),
  }
}

describe('Ollama draft quality checks', () => {
  it('accepts a gold coin draft with gold palette additions and rotating silhouettes', () => {
    const project = createIconProject()
    const errors = evaluateAnimationDraft(createCoinDraft(), {
      project,
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      userInstruction: 'golden coin rotating. 4 frames.',
      requestedFrameCount: 4,
    })

    expect(errors).toEqual([])
  })

  it('rejects a green non-rotating blob for a gold coin prompt', () => {
    const project = createIconProject()
    const draft: OllamaAnimationDraft = {
      animationName: 'Gold Coin',
      fps: 4,
      frames: Array.from({ length: 4 }, (_, frameIndex) => ({
        name: `Coin ${frameIndex + 1}`,
        durationMs: 250,
        patch: [
          { op: 'set', x: 14, y: 14, colorId: 'accent' },
          { op: 'set', x: 15, y: 14, colorId: 'accent' },
          { op: 'set', x: 16, y: 14, colorId: 'accent' },
          { op: 'set', x: 14, y: 15, colorId: 'accent' },
          { op: 'set', x: 15, y: 15, colorId: 'accent' },
          { op: 'set', x: 16, y: 15, colorId: 'accent' },
          { op: 'set', x: 14, y: 16, colorId: 'accent' },
          { op: 'set', x: 15, y: 16, colorId: 'accent' },
          { op: 'set', x: 16, y: 16, colorId: 'accent' },
          { op: 'set', x: 15, y: 17, colorId: 'accent' },
        ],
      })),
    }

    const errors = evaluateAnimationDraft(draft, {
      project,
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      userInstruction: 'golden coin rotating. 4 frames.',
      requestedFrameCount: 4,
    })

    expect(errors).toEqual(
      expect.arrayContaining([
        expect.stringContaining('gold/yellow/orange'),
        expect.stringContaining('too many returned frames are identical'),
        expect.stringContaining('rotation read'),
      ]),
    )
  })

  it('rejects animation drafts where neighboring frames jump across the canvas', () => {
    const project = createIconProject()
    const makeBlock = (originX: number, originY: number) => {
      const patch = []
      for (let y = originY; y < originY + 5; y += 1) {
        for (let x = originX; x < originX + 5; x += 1) {
          patch.push({ op: 'set' as const, x, y, colorId: 'accent' })
        }
      }
      return patch
    }
    const draft: OllamaAnimationDraft = {
      animationName: 'Teleporting Blob',
      fps: 6,
      frames: [
        { name: 'Blob 1', durationMs: 160, patch: makeBlock(4, 12) },
        { name: 'Blob 2', durationMs: 160, patch: makeBlock(24, 12) },
        { name: 'Blob 3', durationMs: 160, patch: makeBlock(5, 12) },
      ],
    }

    const strictErrors = evaluateAnimationDraft(draft, {
      project,
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      userInstruction: 'simple creature idle animation. 3 frames.',
      requestedFrameCount: 3,
    })
    const distributedErrors = evaluateAnimationDraft(draft, {
      project,
      animationId: 'idle',
      frameId: 'idle-001',
      layerId: 'base',
      userInstruction: 'distributed tile sparkle animation. 3 frames.',
      requestedFrameCount: 3,
      allowDistributed: true,
    })

    expect(strictErrors).toContain(
      'Frame 2 jumps too far from the previous frame; keep animation motion continuous.',
    )
    expect(distributedErrors).not.toContain(
      'Frame 2 jumps too far from the previous frame; keep animation motion continuous.',
    )
  })

  it('retries with SpriteWrite quality feedback before failing or accepting', async () => {
    const project = createIconProject()
    const weakDraft: OllamaAnimationDraft = {
      animationName: 'Weak Coin',
      fps: 4,
      frames: Array.from({ length: 4 }, (_, frameIndex) => ({
        name: `Weak ${frameIndex + 1}`,
        durationMs: 250,
        patch: [{ op: 'set', x: 16, y: 16, colorId: 'accent' }],
      })),
    }
    const goodDraft = createCoinDraft()
    const requestAnimationDraft = vi.fn().mockResolvedValueOnce(weakDraft).mockResolvedValueOnce(goodDraft)
    const provider = { requestAnimationDraft } as unknown as OllamaPatchProvider

    const result = await requestImprovedAnimationDraft(
      provider,
      {
        project,
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        instruction: 'golden coin rotating. 4 frames.',
        constraints: { selectedColorId: 'accent', maxOperations: 64 },
        frameCount: 4,
      },
      {
        project,
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        userInstruction: 'golden coin rotating. 4 frames.',
        requestedFrameCount: 4,
      },
    )

    expect(result.draft).toBe(goodDraft)
    expect(result.attempts).toHaveLength(2)
    expect(requestAnimationDraft).toHaveBeenCalledTimes(2)
    expect(requestAnimationDraft.mock.calls[1][0].instruction).toContain('SpriteWrite quality review rejected')
    expect(requestAnimationDraft.mock.calls[1][0].instruction).toContain('Fix these issues')
  })

  it('uses a compact recipe fallback after direct coin drafts fail quality checks', async () => {
    const project = createIconProject()
    const weakDraft: OllamaAnimationDraft = {
      animationName: 'Weak Coin',
      fps: 4,
      frames: Array.from({ length: 4 }, (_, frameIndex) => ({
        name: `Weak ${frameIndex + 1}`,
        durationMs: 250,
        patch: [{ op: 'set', x: 16, y: 16, colorId: 'accent' }],
      })),
    }
    const fallbackDraft = createCoinDraft()
    const requestAnimationDraft = vi.fn().mockResolvedValue(weakDraft)
    const requestAnimationSetDraft = vi.fn().mockResolvedValue({ animations: [fallbackDraft] })
    const provider = { requestAnimationDraft, requestAnimationSetDraft } as unknown as OllamaPatchProvider

    const result = await requestImprovedAnimationDraft(
      provider,
      {
        project,
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        instruction: 'golden coin rotating. 4 frames.',
        constraints: { selectedColorId: 'accent', maxOperations: 64 },
        frameCount: 4,
      },
      {
        project,
        animationId: 'idle',
        frameId: 'idle-001',
        layerId: 'base',
        userInstruction: 'golden coin rotating. 4 frames.',
        requestedFrameCount: 4,
      },
      { maxAttempts: 2 },
    )

    expect(result.draft).toBe(fallbackDraft)
    expect(result.attempts).toHaveLength(3)
    expect(requestAnimationDraft).toHaveBeenCalledTimes(2)
    expect(requestAnimationSetDraft).toHaveBeenCalledTimes(1)
    expect(requestAnimationSetDraft.mock.calls[0][0].instruction).toContain('recipe fallback')
  })

  it('throws quality details when all improvement attempts fail', async () => {
    const project = createIconProject()
    const provider = {
      requestAnimationDraft: vi.fn().mockResolvedValue({
        animationName: 'Weak Coin',
        fps: 4,
        frames: Array.from({ length: 4 }, (_, frameIndex) => ({
          name: `Weak ${frameIndex + 1}`,
          durationMs: 250,
          patch: [{ op: 'set', x: 16, y: 16, colorId: 'accent' }],
        })),
      }),
    } as unknown as OllamaPatchProvider

    await expect(
      requestImprovedAnimationDraft(
        provider,
        {
          project,
          animationId: 'idle',
          frameId: 'idle-001',
          layerId: 'base',
          instruction: 'golden coin rotating. 4 frames.',
          constraints: { selectedColorId: 'accent', maxOperations: 64 },
          frameCount: 4,
        },
        {
          project,
          animationId: 'idle',
          frameId: 'idle-001',
          layerId: 'base',
          userInstruction: 'golden coin rotating. 4 frames.',
          requestedFrameCount: 4,
        },
        { maxAttempts: 2 },
      ),
    ).rejects.toBeInstanceOf(OllamaDraftQualityError)
  })
})
