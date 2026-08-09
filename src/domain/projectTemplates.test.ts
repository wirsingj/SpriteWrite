import { describe, expect, it } from 'vitest'
import { createSpriteSheetExportMetadata } from './exportPlanning'
import { getProjectTemplate, SPRITE_PROJECT_TEMPLATES } from './projectTemplates'
import { validateProject } from './spriteData'

describe('project templates', () => {
  it('creates valid projects from every template', () => {
    SPRITE_PROJECT_TEMPLATES.forEach((template) => {
      const project = template.createProject({ name: template.name })
      const validation = validateProject(project)
      expect(validation.errors).toEqual([])
      expect(validation.valid).toBe(true)
    })
  })

  it('uses formal asset categories for new templates', () => {
    const legacyPrototypeTypes = new Set(['generic', 'ooze', 'button', 'enemy', 'parallax'])

    SPRITE_PROJECT_TEMPLATES.forEach((template) => {
      expect(legacyPrototypeTypes.has(template.assetType)).toBe(false)
    })
  })

  it('creates a valid blank 32x32 project', () => {
    const project = getProjectTemplate('blank-32').createProject({ name: 'Icon Draft' })

    expect(project.name).toBe('Icon Draft')
    expect(project.canvas).toEqual({ width: 32, height: 32 })
    expect(project.frames[0].layers[0].cells).toEqual({})
    expect(validateProject(project).valid).toBe(true)
  })

  it('creates a valid blank 64x64 project', () => {
    const project = getProjectTemplate('blank-64').createProject({ name: 'Enemy Draft' })

    expect(project.canvas).toEqual({ width: 64, height: 64 })
    expect(project.frames[0].layers[0].cells).toEqual({})
    expect(validateProject(project).valid).toBe(true)
  })

  it('uses a neutral non-ooze palette for blank templates', () => {
    const project = getProjectTemplate('blank-32').createProject({ name: 'Custom Draft' })
    const paletteIds = project.palette.map((color) => color.id)
    const paletteNames = project.palette.map((color) => color.name).join(' ')

    expect(project.assetType).toBe('custom')
    expect(paletteIds).toContain('ink')
    expect(paletteIds).toContain('accent')
    expect(paletteIds).not.toContain('slime_mid')
    expect(paletteNames).not.toMatch(/slime/i)
  })

  it('creates icon and UI button templates with neutral identities', () => {
    const icon = getProjectTemplate('icon-32').createProject({ name: 'Save Icon' })
    const button = getProjectTemplate('button-64x24').createProject({ name: 'Start Button' })

    expect(icon.assetType).toBe('icon')
    expect(icon.canvas).toEqual({ width: 32, height: 32 })
    expect(button.assetType).toBe('ui')
    expect(button.canvas).toEqual({ width: 64, height: 24 })
    expect(icon.palette.map((color) => color.id)).not.toContain('slime_mid')
    expect(button.palette.map((color) => color.id)).not.toContain('slime_mid')
  })

  it('creates coin and mountain quick-start templates', () => {
    const coin = getProjectTemplate('coin-32').createProject({ name: 'Coin' })
    const mountain = getProjectTemplate('mountain-64x32').createProject({ name: 'Mountain' })

    expect(coin.assetType).toBe('object')
    expect(coin.animations[0]).toMatchObject({ id: 'spin', fps: 10 })
    expect(coin.frames).toHaveLength(4)
    expect(coin.palette.find((color) => color.id === 'accent')?.name).toBe('Gold')
    expect(Object.keys(coin.frames[0].layers[0].cells).length).toBeGreaterThan(80)

    expect(mountain.assetType).toBe('background')
    expect(mountain.canvas).toEqual({ width: 64, height: 32 })
    expect(mountain.frames[0].tags).toContain('mountain')
    expect(Object.keys(mountain.frames[0].layers[0].cells).length).toBeGreaterThan(400)
  })

  it('creates broader starter recipes for tiles, props, backgrounds, and effects', () => {
    const tile = getProjectTemplate('tile-grass-32').createProject({ name: 'Grass Tiles' })
    const terrain = getProjectTemplate('terrain-tileset-32').createProject({ name: 'Terrain Set' })
    const wallFloor = getProjectTemplate('wall-floor-tiles-32').createProject({ name: 'Wall Floors' })
    const prop = getProjectTemplate('prop-crate-32').createProject({ name: 'Crate' })
    const background = getProjectTemplate('background-band-64x32').createProject({ name: 'Horizon' })
    const effect = getProjectTemplate('effect-burst-32').createProject({ name: 'Burst' })

    expect(tile.assetType).toBe('tile')
    expect(tile.animations[0]).toMatchObject({ id: 'variants', name: 'Variants' })
    expect(tile.frames).toHaveLength(4)
    expect(Object.keys(tile.frames[0].layers[0].cells).length).toBeGreaterThan(80)

    expect(terrain.assetType).toBe('tile')
    expect(terrain.animations[0]).toMatchObject({ id: 'tileset', name: 'Tileset', fps: 1 })
    expect(terrain.frames.map((frame) => frame.name)).toEqual([
      'North West Corner',
      'North Edge',
      'North East Corner',
      'West Edge',
      'Interior',
      'East Edge',
      'South West Corner',
      'South Edge',
      'South East Corner',
    ])
    expect(terrain.frames).toHaveLength(9)
    expect(terrain.frames[4].tags).toContain('interior')
    expect(terrain.frames[0].tags).toContain('edge')
    expect(Object.keys(terrain.frames[4].layers[0].cells).length).toBe(1024)
    expect(Object.keys(terrain.frames[0].layers[0].cells).length).toBeLessThan(1024)

    expect(wallFloor.assetType).toBe('tile')
    expect(wallFloor.animations[0]).toMatchObject({ id: 'tiles', name: 'Tiles', fps: 1 })
    expect(wallFloor.frames.map((frame) => frame.name)).toEqual([
      'Floor Interior',
      'Floor Edge',
      'Wall Face',
      'Wall Top',
      'Wall Corner',
      'Stair Step',
    ])
    expect(wallFloor.frames).toHaveLength(6)
    expect(wallFloor.frames.every((frame) => frame.tags?.includes('wall'))).toBe(true)
    expect(wallFloor.frames.every((frame) => frame.tags?.includes('floor'))).toBe(true)
    expect(Object.keys(wallFloor.frames[0].layers[0].cells).length).toBeGreaterThan(700)
    expect(Object.keys(wallFloor.frames[5].layers[0].cells).length).toBeLessThan(700)

    expect(prop.assetType).toBe('prop')
    expect(prop.canvas).toEqual({ width: 32, height: 32 })
    expect(prop.frames[0].tags).toContain('object')
    expect(Object.keys(prop.frames[0].layers[0].cells).length).toBeGreaterThan(80)

    expect(background.assetType).toBe('background')
    expect(background.canvas).toEqual({ width: 64, height: 32 })
    expect(background.frames[0].tags).toContain('parallax')

    expect(effect.assetType).toBe('effect')
    expect(effect.animations[0]).toMatchObject({ id: 'burst', fps: 12 })
    expect(effect.frames).toHaveLength(4)
    expect(effect.frames.every((frame) => frame.tags?.includes('burst'))).toBe(true)
  })

  it('creates an ooze demo with animation and frame data', () => {
    const project = getProjectTemplate('ooze-32-demo').createProject({ name: 'Ooze Friend' })

    expect(project.assetType).toBe('creature')
    expect(project.animations[0].frameIds).toHaveLength(2)
    expect(Object.keys(project.frames[0].layers[0].cells).length).toBeGreaterThan(0)
    expect(project.palette.map((color) => color.id)).toContain('slime_mid')
    expect(validateProject(project).valid).toBe(true)
  })

  it('creates a hero sprite sheet demo with several animation rows and frames', () => {
    const project = getProjectTemplate('hero-32-demo').createProject({ name: 'Hero Test' })

    expect(project.name).toBe('Hero Test')
    expect(project.assetType).toBe('character')
    expect(project.canvas).toEqual({ width: 32, height: 32 })
    expect(project.animations.map((animation) => animation.name)).toEqual([
      'Idle',
      'Jump',
      'Crouch',
      'Sword Stab',
    ])
    expect(project.animations.map((animation) => animation.frameIds.length)).toEqual([4, 5, 3, 5])
    expect(project.frames).toHaveLength(17)
    expect(Object.keys(project.frames[0].layers[0].cells).length).toBeGreaterThan(30)
    expect(project.palette.map((color) => color.id)).toContain('cape')
    expect(project.palette.map((color) => color.id)).toContain('steel')
    expect(validateProject(project).valid).toBe(true)
  })

  it('includes project identity in export metadata', () => {
    const project = getProjectTemplate('blank-32').createProject({
      name: 'Button Draft',
      assetType: 'ui',
    })
    project.description = 'A test button asset.'

    const metadata = createSpriteSheetExportMetadata(project, 'idle')

    expect(metadata.projectName).toBe('Button Draft')
    expect(metadata.projectDescription).toBe('A test button asset.')
    expect(metadata.assetType).toBe('ui')
  })
})
