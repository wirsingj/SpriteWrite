import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../domain/spriteData'
import {
  createSpriteWritePromptIntent,
  inferPromptMode,
  inferRequestedFrameCount,
  inferRequestedVariationCount,
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

  it('adds static asset and view-angle context to padded prompts', () => {
    const intent = createSpriteWritePromptIntent('ground tileable set', project, {
      output: 'static',
      viewAngle: 'top-down',
    })

    expect(intent.mode).toBe('frame-draft')
    expect(intent.paddedInstruction).toContain('Output intent: static asset or tile')
    expect(intent.paddedInstruction).toContain('View context: top-down view')
    expect(intent.paddedInstruction).toContain('north/east/south/west edge continuity')
  })

  it('can use UI-provided context to frame terse prompts as animation drafts', () => {
    const intent = createSpriteWritePromptIntent('hero with cape', project, {
      output: 'animated',
      viewAngle: 'side-scroller',
    })

    expect(intent.mode).toBe('animation-draft')
    expect(intent.summary).toContain('editable animation draft')
    expect(intent.paddedInstruction).toContain('Output intent: animated sprite or frame row')
    expect(intent.paddedInstruction).toContain('View context: side-scroller side view')
  })

  it('infers requested frame counts from exact counts and ranges', () => {
    expect(inferRequestedFrameCount('make a 4 frame idle animation')).toBe(4)
    expect(inferRequestedFrameCount('make a 4-6 frame spinning animation')).toBe(6)
    expect(inferRequestedFrameCount('make an 18 frame animation')).toBe(6)
    expect(inferRequestedFrameCount('make a 1 frame animation')).toBe(3)
  })

  it('infers requested variation counts for tile and frame-set prompts', () => {
    expect(inferRequestedVariationCount('short grass, 4 frame set variations')).toBe(4)
    expect(inferRequestedVariationCount('make 3 tile sets')).toBe(3)
    expect(inferRequestedVariationCount('make a 4 frame coin')).toBe(1)
  })

  it('pads multi-variation prompts as animation set drafts', () => {
    const intent = createSpriteWritePromptIntent(
      'short grass waving in the wind, 3 frames, 4 frame set variations that can tile',
      project,
    )

    expect(intent.mode).toBe('animation-draft')
    expect(intent.frameCount).toBe(3)
    expect(intent.variationCount).toBe(4)
    expect(intent.summary).toContain('4 editable animation variations')
  })

  it('routes terse creative animation prompts without explicit frame language', () => {
    const heroIntent = createSpriteWritePromptIntent('hero idle', project)
    const tentacleIntent = createSpriteWritePromptIntent('tentacle monster, 3 variations', project)

    expect(heroIntent.mode).toBe('animation-draft')
    expect(heroIntent.frameCount).toBe(4)
    expect(heroIntent.variationCount).toBe(1)
    expect(tentacleIntent.mode).toBe('animation-draft')
    expect(tentacleIntent.frameCount).toBe(4)
    expect(tentacleIntent.variationCount).toBe(3)
    expect(tentacleIntent.summary).toContain('3 editable animation variations')
  })

  it('keeps terse cleanup requests on the selected-frame patch rail', () => {
    expect(inferPromptMode('fix idle highlight')).toBe('frame-patch')
    expect(inferPromptMode('clean tentacle outline')).toBe('frame-patch')
  })

  it('routes asset prompts without animation words to draft mode', () => {
    expect(inferPromptMode('gold coin')).toBe('frame-draft')
    expect(inferPromptMode('wall tile')).toBe('frame-draft')
    expect(looksLikeAnimationOrWholeAssetRequest('a 4 frame wall tile animation')).toBe(true)
    expect(looksLikeAnimationOrWholeAssetRequest('clean the outline')).toBe(false)
  })
})
