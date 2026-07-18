import { describe, expect, it } from 'vitest'
import {
  applyPatch,
  addLayerToProject,
  addAnimationToProject,
  addPaletteColorToProject,
  cellKey,
  createBlankProject,
  createDefaultProject,
  deleteAnimationFromProject,
  deleteLayerFromProject,
  deletePaletteColorFromProject,
  duplicateAnimationInProject,
  getFrame,
  getLayer,
  moveAnimationInProject,
  moveFrameInAnimation,
  moveLayerInProject,
  movePaletteColorInProject,
  setFrameHitboxInProject,
  setLayerVisibilityInProject,
  updateLayerPropertiesInProject,
  updateAnimationPropertiesInProject,
  updateFramePropertiesInProject,
  updateFramesPropertiesInProject,
  updatePaletteColorInProject,
  validateProject,
  validatePatch,
} from './spriteData'
import type { PixelPatchOperation, SpriteAssetType } from './spriteTypes'

describe('sprite data model', () => {
  it('validates the default project for import', () => {
    const project = createDefaultProject()
    const result = validateProject(project)

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.value).toEqual(project)
      expect(result.value).not.toBe(project)
    }
  })

  it('validates broad formal asset categories', () => {
    const assetTypes: SpriteAssetType[] = [
      'character',
      'creature',
      'tile',
      'environment',
      'prop',
      'object',
      'background',
      'effect',
      'ui',
      'icon',
      'custom',
    ]

    assetTypes.forEach((assetType) => {
      const project = createBlankProject({
        name: `${assetType} draft`,
        width: 32,
        height: 32,
        assetType,
      })

      expect(validateProject(project).valid).toBe(true)
    })
  })

  it('rejects non-object project input', () => {
    const result = validateProject(null)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('Project must be an object')
  })

  it('rejects missing canvas', () => {
    const project = createDefaultProject() as unknown as Record<string, unknown>
    delete project.canvas

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('Project canvas is required')
  })

  it('rejects invalid canvas dimensions', () => {
    const project = createDefaultProject()
    project.canvas.width = 0
    project.canvas.height = 257

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('Canvas width')
    expect(result.errors.join('\n')).toContain('Canvas height')
  })

  it('rejects an empty palette', () => {
    const project = createDefaultProject()
    project.palette = []

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('Palette must be a non-empty array')
  })

  it('rejects duplicate palette IDs', () => {
    const project = createDefaultProject()
    project.palette.push({ ...project.palette[1] })

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('duplicated')
  })

  it('rejects unknown cell color IDs', () => {
    const project = createDefaultProject()
    const layer = getLayer(getFrame(project, 'idle-001')!, 'base')!
    layer.cells[cellKey(1, 1)] = 'missing_color'

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('unknown colorId')
  })

  it('rejects out-of-bounds imported cells', () => {
    const project = createDefaultProject()
    const layer = getLayer(getFrame(project, 'idle-001')!, 'base')!
    layer.cells[cellKey(32, 1)] = 'slime_mid'

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('out of canvas bounds')
  })

  it('rejects invalid imported frame tags', () => {
    const project = createDefaultProject()
    getFrame(project, 'idle-001')!.tags = ['idle', '']

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('tags[1] must be a non-empty string')
  })

  it('rejects non-integer imported cell coordinates', () => {
    const project = createDefaultProject()
    const layer = getLayer(getFrame(project, 'idle-001')!, 'base')!
    layer.cells['1.5,2'] = 'slime_mid'

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('integer "x,y"')
  })

  it('rejects missing animations', () => {
    const project = createDefaultProject()
    project.animations = []

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('Animations must be a non-empty array')
  })

  it('rejects animations with no frames', () => {
    const project = createDefaultProject()
    project.animations[0].frameIds = []

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('frameIds must be a non-empty array')
  })

  it('rejects frames with missing layers', () => {
    const project = createDefaultProject()
    getFrame(project, 'idle-001')!.layers = []

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('layers must be a non-empty array')
  })

  it('rejects duplicate layer IDs within a frame', () => {
    const project = createDefaultProject()
    const frame = getFrame(project, 'idle-001')!
    frame.layers.push({ ...frame.layers[0], cells: {} })

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('duplicated within the frame')
  })

  it('rejects duplicate normalized cell coordinates', () => {
    const project = createDefaultProject()
    const layer = getLayer(getFrame(project, 'idle-001')!, 'base')!
    layer.cells[cellKey(1, 1)] = 'slime_mid'
    layer.cells['01,1'] = 'slime_light'

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('duplicate cell coordinate')
  })

  it('rejects invalid anchors', () => {
    const project = createDefaultProject()
    getFrame(project, 'idle-001')!.anchor = { x: 99, y: 1 }

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('anchor must be within canvas bounds')
  })

  it('rejects invalid hitboxes', () => {
    const project = createDefaultProject()
    getFrame(project, 'idle-001')!.hitbox = { x: 30, y: 30, width: 4, height: 4 }

    const result = validateProject(project)

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('hitbox must be within canvas bounds')
  })

  it('validates exported project JSON after parse', () => {
    const project = createDefaultProject()
    const parsed = JSON.parse(JSON.stringify(project)) as unknown

    const result = validateProject(parsed)

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(result.value).toEqual(project)
    }
  })

  it('creates a default 32x32 ooze project with idle frames and a base layer', () => {
    const project = createDefaultProject()
    const animation = project.animations.find((item) => item.id === 'idle')
    const frame = getFrame(project, 'idle-001')
    const layer = frame ? getLayer(frame, 'base') : undefined

    expect(project.canvas).toEqual({ width: 32, height: 32 })
    expect(project.palette.map((color) => color.id)).toContain('slime_mid')
    expect(animation?.frameIds).toHaveLength(2)
    expect(layer?.editable).toBe(true)
    expect(Object.keys(layer?.cells ?? {}).length).toBeGreaterThan(0)
  })

  it('validates accepted set and clear operations', () => {
    const project = createDefaultProject()
    const patch: PixelPatchOperation[] = [
      { op: 'set', x: 2, y: 3, colorId: 'slime_mid' },
      { op: 'clear', x: 3, y: 3 },
    ]

    expect(validatePatch(project, 'idle', 'idle-001', 'base', patch)).toEqual({
      valid: true,
      errors: [],
    })
  })

  it('rejects out-of-bounds coordinates', () => {
    const project = createDefaultProject()
    const result = validatePatch(project, 'idle', 'idle-001', 'base', [
      { op: 'set', x: 32, y: 0, colorId: 'slime_mid' },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('out-of-bounds')
  })

  it('rejects unknown color IDs', () => {
    const project = createDefaultProject()
    const result = validatePatch(project, 'idle', 'idle-001', 'base', [
      { op: 'set', x: 1, y: 1, colorId: 'invented_blue' },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('unknown colorId')
  })

  it('rejects missing animation targets', () => {
    const project = createDefaultProject()
    const result = validatePatch(project, 'missing-animation', 'idle-001', 'base', [
      { op: 'set', x: 1, y: 1, colorId: 'slime_mid' },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('Missing animation')
  })

  it('rejects missing frame targets', () => {
    const project = createDefaultProject()
    const result = validatePatch(project, 'idle', 'missing-frame', 'base', [
      { op: 'set', x: 1, y: 1, colorId: 'slime_mid' },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('Missing frame')
  })

  it('rejects missing layer targets', () => {
    const project = createDefaultProject()
    const result = validatePatch(project, 'idle', 'idle-001', 'missing-layer', [
      { op: 'set', x: 1, y: 1, colorId: 'slime_mid' },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('Missing layer')
  })

  it('rejects edits against locked layers', () => {
    const project = createDefaultProject()
    project.frames[0].layers[0].editable = false

    const result = validatePatch(project, 'idle', 'idle-001', 'base', [
      { op: 'set', x: 1, y: 1, colorId: 'slime_mid' },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('not editable')
  })
  it('sets and clears cells through applyPatch without mutating the original project', () => {
    const project = createDefaultProject()
    const setPatch: PixelPatchOperation[] = [{ op: 'set', x: 4, y: 5, colorId: 'core' }]
    const afterSet = applyPatch(project, 'idle', 'idle-001', 'base', setPatch)
    const afterClear = applyPatch(afterSet, 'idle', 'idle-001', 'base', [{ op: 'clear', x: 4, y: 5 }])

    const originalLayer = getLayer(getFrame(project, 'idle-001')!, 'base')!
    const setLayer = getLayer(getFrame(afterSet, 'idle-001')!, 'base')!
    const clearedLayer = getLayer(getFrame(afterClear, 'idle-001')!, 'base')!

    expect(originalLayer.cells[cellKey(4, 5)]).toBeUndefined()
    expect(setLayer.cells[cellKey(4, 5)]).toBe('core')
    expect(clearedLayer.cells[cellKey(4, 5)]).toBeUndefined()
  })

  it('adds an empty layer to every frame without mutating the original project', () => {
    const project = createDefaultProject()
    const nextProject = addLayerToProject(project, { id: 'highlight', name: 'Highlight' })

    expect(project.frames.every((frame) => frame.layers.every((layer) => layer.id !== 'highlight'))).toBe(true)
    expect(nextProject.frames.every((frame) => getLayer(frame, 'highlight')?.name === 'Highlight')).toBe(true)
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('prevents deleting the default layer', () => {
    const project = addLayerToProject(createDefaultProject(), { id: 'detail', name: 'Detail' })

    expect(() => deleteLayerFromProject(project, 'base')).toThrow('default layer')
  })

  it('deletes non-default layers from every frame', () => {
    const project = addLayerToProject(createDefaultProject(), { id: 'detail', name: 'Detail' })
    const nextProject = deleteLayerFromProject(project, 'detail')

    expect(nextProject.frames.every((frame) => !getLayer(frame, 'detail'))).toBe(true)
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('moves layers consistently across frames', () => {
    const project = addLayerToProject(createDefaultProject(), { id: 'detail', name: 'Detail' })
    const nextProject = moveLayerInProject(project, 'detail', -1)

    expect(nextProject.frames.every((frame) => frame.layers[0].id === 'detail')).toBe(true)
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('sets layer visibility consistently across frames', () => {
    const project = addLayerToProject(createDefaultProject(), { id: 'detail', name: 'Detail' })
    const nextProject = setLayerVisibilityInProject(project, 'detail', false)

    expect(nextProject.frames.every((frame) => getLayer(frame, 'detail')?.visible === false)).toBe(true)
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('updates layer name, group, lock state, export state, opacity, and blend mode across frames', () => {
    const project = addLayerToProject(createDefaultProject(), { id: 'detail', name: 'Detail' })
    const nextProject = updateLayerPropertiesInProject(project, 'detail', {
      name: 'Glow',
      group: 'Effects',
      editable: false,
      exportable: false,
      opacity: 0.5,
      blendMode: 'screen',
    })

    expect(
      nextProject.frames.every((frame) => {
        const layer = getLayer(frame, 'detail')
        return (
          layer?.name === 'Glow' &&
          layer.group === 'Effects' &&
          layer.editable === false &&
          layer.exportable === false &&
          layer.opacity === 0.5 &&
          layer.blendMode === 'screen'
        )
      }),
    ).toBe(true)
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('normalizes older project layers without exportable or blendMode', () => {
    const project = createDefaultProject()
    const layer = getLayer(getFrame(project, 'idle-001')!, 'base') as {
      exportable?: boolean
      blendMode?: string
    }
    delete layer.exportable
    delete layer.blendMode

    const result = validateProject(project)

    expect(result.valid).toBe(true)
    if (result.valid) {
      expect(getLayer(getFrame(result.value, 'idle-001')!, 'base')?.exportable).toBe(true)
      expect(getLayer(getFrame(result.value, 'idle-001')!, 'base')?.blendMode).toBe('normal')
    }
  })

  it('rejects invalid layer property updates', () => {
    const project = addLayerToProject(createDefaultProject(), { id: 'detail', name: 'Detail' })

    expect(() => updateLayerPropertiesInProject(project, 'detail', { name: '   ' })).toThrow(
      'Layer name',
    )
    expect(() => updateLayerPropertiesInProject(project, 'detail', { opacity: 2 })).toThrow(
      'Layer opacity',
    )
    expect(() =>
      updateLayerPropertiesInProject(project, 'detail', { blendMode: 'overlay' as never }),
    ).toThrow('Layer blendMode')
  })

  it('updates palette color name and hex without mutating the original project', () => {
    const project = createDefaultProject()
    const nextProject = updatePaletteColorInProject(project, 'slime_mid', {
      name: 'Body Mid',
      hex: '#448855',
    })

    expect(project.palette.find((color) => color.id === 'slime_mid')?.name).toBe('Slime Mid')
    expect(nextProject.palette.find((color) => color.id === 'slime_mid')).toMatchObject({
      name: 'Body Mid',
      hex: '#448855',
    })
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('rejects invalid palette color edits', () => {
    const project = createDefaultProject()

    expect(() => updatePaletteColorInProject(project, 'missing', { name: 'Missing' })).toThrow(
      'Missing palette color',
    )
    expect(() => updatePaletteColorInProject(project, 'slime_mid', { name: '   ' })).toThrow(
      'Palette color name',
    )
    expect(() => updatePaletteColorInProject(project, 'slime_mid', { hex: 'green' })).toThrow(
      'Palette color hex',
    )
    expect(() => updatePaletteColorInProject(project, 'transparent', { hex: '#ffffff' })).toThrow(
      'Transparent palette color',
    )
  })

  it('adds and deletes an unused palette color', () => {
    const project = createDefaultProject()
    const withColor = addPaletteColorToProject(project, {
      id: 'spark',
      name: 'Spark',
      hex: '#ffcc00',
    })
    const withoutColor = deletePaletteColorFromProject(withColor, 'spark')

    expect(project.palette.some((color) => color.id === 'spark')).toBe(false)
    expect(withColor.palette.find((color) => color.id === 'spark')).toMatchObject({
      name: 'Spark',
      hex: '#ffcc00',
    })
    expect(withoutColor.palette.some((color) => color.id === 'spark')).toBe(false)
    expect(validateProject(withoutColor).valid).toBe(true)
  })

  it('prevents deleting transparent or used palette colors', () => {
    const project = createDefaultProject()

    expect(() => deletePaletteColorFromProject(project, 'transparent')).toThrow('transparent')
    expect(() => deletePaletteColorFromProject(project, 'slime_mid')).toThrow('cells use it')
  })

  it('moves palette colors without changing cell color IDs', () => {
    const project = createDefaultProject()
    const nextProject = movePaletteColorInProject(project, 'slime_mid', -1)

    expect(nextProject.palette.map((color) => color.id).slice(0, 4)).toEqual([
      'transparent',
      'outline',
      'slime_mid',
      'slime_dark',
    ])
    expect(getLayer(getFrame(nextProject, 'idle-001')!, 'base')!.cells[cellKey(15, 20)]).toBe('core')
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('adds a blank animation with matching layer structure', () => {
    const project = addLayerToProject(createDefaultProject(), { id: 'detail', name: 'Detail' })
    const nextProject = addAnimationToProject(project, { id: 'move', name: 'Move', fps: 8 })
    const animation = nextProject.animations.find((item) => item.id === 'move')
    const frame = animation ? getFrame(nextProject, animation.frameIds[0]) : undefined

    expect(animation).toMatchObject({ id: 'move', name: 'Move', fps: 8 })
    expect(frame?.layers.map((layer) => layer.id)).toEqual(['base', 'detail'])
    expect(frame?.layers.every((layer) => Object.keys(layer.cells).length === 0)).toBe(true)
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('rejects invalid animation creation', () => {
    const project = createDefaultProject()

    expect(() => addAnimationToProject(project, { id: 'idle' })).toThrow('already exists')
    expect(() => addAnimationToProject(project, { id: 'move', fps: 0 })).toThrow('Animation FPS')
  })

  it('updates animation name and fps', () => {
    const project = addAnimationToProject(createDefaultProject(), { id: 'move', name: 'Move' })
    const nextProject = updateAnimationPropertiesInProject(project, 'move', {
      name: 'Slide',
      fps: 12,
    })

    expect(nextProject.animations.find((animation) => animation.id === 'move')).toMatchObject({
      name: 'Slide',
      fps: 12,
    })
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('deletes an animation and its unshared frames', () => {
    const project = addAnimationToProject(createDefaultProject(), { id: 'move', name: 'Move' })
    const nextProject = deleteAnimationFromProject(project, 'move')

    expect(nextProject.animations.some((animation) => animation.id === 'move')).toBe(false)
    expect(nextProject.frames.some((frame) => frame.id === 'move-001')).toBe(false)
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('prevents deleting the last animation', () => {
    expect(() => deleteAnimationFromProject(createDefaultProject(), 'idle')).toThrow('last animation')
  })

  it('duplicates an animation with cloned frame IDs and cell data', () => {
    const project = createDefaultProject()
    const nextProject = duplicateAnimationInProject(project, 'idle', { id: 'idle-copy', name: 'Idle Copy' })
    const animation = nextProject.animations.find((item) => item.id === 'idle-copy')

    expect(animation?.frameIds).toEqual(['idle-copy-001', 'idle-copy-002'])
    expect(getFrame(nextProject, 'idle-copy-001')?.layers[0].cells).toEqual(
      getFrame(project, 'idle-001')?.layers[0].cells,
    )
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('moves animations in the animation list', () => {
    const project = addAnimationToProject(createDefaultProject(), { id: 'move', name: 'Move' })
    const nextProject = moveAnimationInProject(project, 'move', -1)

    expect(nextProject.animations.map((animation) => animation.id)).toEqual(['move', 'idle'])
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('moves frames inside an animation without mutating the original project', () => {
    const project = createDefaultProject()
    const nextProject = moveFrameInAnimation(project, 'idle', 'idle-002', 0)
    const movedFirstProject = moveFrameInAnimation(project, 'idle', 'idle-001', 1)

    expect(project.animations[0].frameIds).toEqual(['idle-001', 'idle-002'])
    expect(nextProject.animations[0].frameIds).toEqual(['idle-002', 'idle-001'])
    expect(movedFirstProject.animations[0].frameIds).toEqual(['idle-002', 'idle-001'])
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('rejects invalid frame reorder targets', () => {
    const project = createDefaultProject()

    expect(() => moveFrameInAnimation(project, 'missing', 'idle-001', 0)).toThrow('Missing animation')
    expect(() => moveFrameInAnimation(project, 'idle', 'missing-frame', 0)).toThrow('does not contain frame')
    expect(() => moveFrameInAnimation(project, 'idle', 'idle-001', 1.5)).toThrow('target index')
  })

  it('updates frame name, duration, notes, tags, and anchor', () => {
    const project = createDefaultProject()
    const nextProject = updateFramePropertiesInProject(project, 'idle-001', {
      name: 'Idle Squash',
      durationMs: 120,
      notes: 'Hold the readable squash silhouette.',
      tags: ['idle', 'squash'],
      anchor: { x: 10, y: 20 },
    })

    expect(getFrame(nextProject, 'idle-001')).toMatchObject({
      name: 'Idle Squash',
      durationMs: 120,
      notes: 'Hold the readable squash silhouette.',
      tags: ['idle', 'squash'],
      anchor: { x: 10, y: 20 },
    })
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('updates metadata across multiple frames without mutating the original project', () => {
    const project = createDefaultProject()
    const nextProject = updateFramesPropertiesInProject(project, ['idle-001', 'idle-002'], {
      durationMs: 333,
      notes: 'Shared timing note.',
      tags: ['hold', 'timing'],
    })

    expect(getFrame(project, 'idle-001')?.durationMs).not.toBe(333)
    expect(getFrame(project, 'idle-002')?.durationMs).not.toBe(333)
    expect(getFrame(nextProject, 'idle-001')).toMatchObject({
      durationMs: 333,
      notes: 'Shared timing note.',
      tags: ['hold', 'timing'],
    })
    expect(getFrame(nextProject, 'idle-002')).toMatchObject({
      durationMs: 333,
      notes: 'Shared timing note.',
      tags: ['hold', 'timing'],
    })
    expect(validateProject(nextProject).valid).toBe(true)
  })

  it('rejects invalid frame property updates', () => {
    const project = createDefaultProject()

    expect(() => updateFramePropertiesInProject(project, 'missing', { name: 'Missing' })).toThrow(
      'Missing frame',
    )
    expect(() => updateFramePropertiesInProject(project, 'idle-001', { name: '' })).toThrow(
      'Frame name',
    )
    expect(() => updateFramePropertiesInProject(project, 'idle-001', { durationMs: 0 })).toThrow(
      'Frame durationMs',
    )
    expect(() =>
      updateFramePropertiesInProject(project, 'idle-001', { anchor: { x: 32, y: 0 } }),
    ).toThrow('Frame anchor')
    expect(() =>
      updateFramePropertiesInProject(project, 'idle-001', { tags: ['idle', 'Idle'] }),
    ).toThrow('Frame tags')
  })

  it('sets and clears frame hitbox metadata', () => {
    const project = createDefaultProject()
    const withHitbox = setFrameHitboxInProject(project, 'idle-001', {
      x: 1,
      y: 2,
      width: 10,
      height: 12,
    })
    const withoutHitbox = setFrameHitboxInProject(withHitbox, 'idle-001', undefined)

    expect(getFrame(withHitbox, 'idle-001')?.hitbox).toEqual({ x: 1, y: 2, width: 10, height: 12 })
    expect(getFrame(withoutHitbox, 'idle-001')?.hitbox).toBeUndefined()
    expect(validateProject(withoutHitbox).valid).toBe(true)
  })

  it('rejects invalid frame hitbox metadata', () => {
    const project = createDefaultProject()

    expect(() =>
      setFrameHitboxInProject(project, 'idle-001', { x: 30, y: 30, width: 10, height: 10 }),
    ).toThrow('Frame hitbox')
  })

  it('rejects patch operations that try to change dimensions or carry extra fields', () => {
    const project = createDefaultProject()
    const result = validatePatch(project, 'idle', 'idle-001', 'base', [
      { op: 'set', x: 1, y: 1, colorId: 'slime_mid', width: 64 },
    ])

    expect(result.valid).toBe(false)
    expect(result.errors.join('\n')).toContain('unsupported field "width"')
    expect(project.canvas).toEqual({ width: 32, height: 32 })
  })

})
