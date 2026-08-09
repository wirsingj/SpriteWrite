import { describe, expect, it } from 'vitest'
import { createFullSpriteSheetExportMetadata } from './exportPlanning'
import { renderFullSpriteSheetToRgbaBuffer } from './exportRaster'
import { createOozeMeleeAttackProject } from './oozeMeleeRecipe'
import { validateProject } from './spriteData'

describe('ooze melee recipe', () => {
  it('creates a valid editable melee attack sprite sheet', () => {
    const project = createOozeMeleeAttackProject('Ooze Swipe')

    expect(validateProject(project).valid).toBe(true)
    expect(project.assetType).toBe('creature')
    expect(project.animations).toEqual([
      {
        id: 'melee_attack',
        name: 'Melee Attack',
        fps: 10,
        frameIds: ['ooze-melee-windup', 'ooze-melee-lunge', 'ooze-melee-contact', 'ooze-melee-recover'],
      },
    ])
    expect(project.frames).toHaveLength(4)
    expect(project.frames[2].name).toBe('Contact')
    expect(project.frames[2].hitbox).toEqual({ x: 10, y: 14, width: 22, height: 11 })
    expect(Object.keys(project.frames[2].layers[0].cells).some((key) => Number(key.split(',')[0]) >= 30)).toBe(true)
  })

  it('exports a full sheet buffer and matching metadata', () => {
    const project = createOozeMeleeAttackProject()
    const options = { scale: 2, margin: 1, spacing: 1, imageFilename: 'ooze-melee.png' }
    const metadata = createFullSpriteSheetExportMetadata(project, options)
    const buffer = renderFullSpriteSheetToRgbaBuffer(project, options)

    expect(buffer.width).toBe(metadata.sheetWidth)
    expect(buffer.height).toBe(metadata.sheetHeight)
    expect(metadata.animations[0].frames).toHaveLength(4)
    expect(metadata.importProfile.animationClips[0]).toMatchObject({
      animationName: 'Melee Attack',
      fps: 10,
      frameCount: 4,
    })
  })
})
