import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../domain/spriteData'
import {
  createSpriteWritePromptIntent,
  inferPromptMode,
  inferRequestedFrameCount,
  looksLikeAnimationOrWholeAssetRequest,
} from './spriteWritePromptIntent'

describe('SpriteWrite prompt intent', () => {
  const project = createBlankProject({
    name: 'Prompt Test',
    width: 32,
    height: 32,
    assetType: 'custom',
  })

  it('pads plain animation requests into structured SpriteWrite animation drafts', () => {
    const intent = createSpriteWritePromptIntent('a 4-6 frame gold coin spinning animation', project)

    expect(intent.mode).toBe('animation-draft')
    expect(intent.frameCount).toBe(6)
    expect(intent.summary).toBe('SpriteWrite framed this as a 6-frame editable animation draft.')
    expect(intent.paddedInstruction).toContain('User request: a 4-6 frame gold coin spinning animation')
    expect(intent.paddedInstruction).toContain('Draft a 6-frame editable animation row')
    expect(intent.paddedInstruction).toContain('Use only these palette IDs:')
    expect(intent.paddedInstruction).toContain('For spinning or rotating assets')
    expect(intent.paddedInstruction).toContain('Return structured editable patch JSON only')
  })

  it('pads small edits as selected-frame patches', () => {
    const intent = createSpriteWritePromptIntent('add a highlight to the coin edge', project)

    expect(intent.mode).toBe('frame-patch')
    expect(intent.frameCount).toBe(1)
    expect(intent.paddedInstruction).toContain('Propose a focused selected-frame edit')
    expect(intent.paddedInstruction).toContain('Edit only the selected frame and selected layer')
  })

  it('pads plain asset requests into single-frame drafts', () => {
    const intent = createSpriteWritePromptIntent('gold coin', project)

    expect(intent.mode).toBe('frame-draft')
    expect(intent.frameCount).toBe(1)
    expect(intent.summary).toBe('SpriteWrite framed this as a single-frame editable asset draft.')
    expect(intent.paddedInstruction).toContain('Draft one full readable editable frame')
    expect(intent.paddedInstruction).toContain('Create a complete readable asset, not a tiny partial edit')
  })

  it('infers requested frame counts from exact counts and ranges', () => {
    expect(inferRequestedFrameCount('make a 4 frame idle animation')).toBe(4)
    expect(inferRequestedFrameCount('make a 4-6 frame spinning animation')).toBe(6)
    expect(inferRequestedFrameCount('make an 18 frame animation')).toBe(6)
    expect(inferRequestedFrameCount('make a 1 frame animation')).toBe(3)
  })

  it('routes asset prompts without animation words to draft mode', () => {
    expect(inferPromptMode('gold coin')).toBe('frame-draft')
    expect(inferPromptMode('wall tile')).toBe('frame-draft')
    expect(looksLikeAnimationOrWholeAssetRequest('a 4 frame wall tile animation')).toBe(true)
    expect(looksLikeAnimationOrWholeAssetRequest('clean the outline')).toBe(false)
  })
})
