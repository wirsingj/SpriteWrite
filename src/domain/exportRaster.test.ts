import { describe, expect, it } from 'vitest'
import {
  createFullSpriteSheetExportMetadata,
  createFullSpriteSheetLayout,
  createSpriteSheetExportMetadata,
  createSpriteSheetLayout,
} from './exportPlanning'
import {
  getPixel,
  parseHexColor,
  renderAnimationToRgbaBuffer,
  renderFrameToRgbaBuffer,
  renderFullSpriteSheetToRgbaBuffer,
} from './exportRaster'
import { cellKey, createDefaultProject, createHeroDemoProject, getFrame, validateProject } from './spriteData'

describe('export raster rendering', () => {
  it('parses supported hex palette colors into RGBA', () => {
    expect(parseHexColor('#51b65f')).toEqual({ r: 81, g: 182, b: 95, a: 255 })
    expect(parseHexColor('#00000000')).toEqual({ r: 0, g: 0, b: 0, a: 0 })
    expect(parseHexColor('#0f8c')).toEqual({ r: 0, g: 255, b: 136, a: 204 })
  })

  it('rejects invalid hex colors', () => {
    expect(() => parseHexColor('slime')).toThrow('Invalid hex color')
  })

  it('renders transparent cells with alpha 0', () => {
    const project = createDefaultProject()
    const buffer = renderFrameToRgbaBuffer(project, 'idle-001')

    expect(getPixel(buffer, 0, 0)).toEqual({ r: 0, g: 0, b: 0, a: 0 })
  })

  it('renders painted cells with exact palette RGBA values', () => {
    const project = createDefaultProject()
    const buffer = renderFrameToRgbaBuffer(project, 'idle-001')

    expect(getPixel(buffer, 15, 20)).toEqual({ r: 120, g: 255, b: 228, a: 255 })
  })

  it('renders frame buffer dimensions at exact canvas size for scale 1', () => {
    const project = createDefaultProject()
    const buffer = renderFrameToRgbaBuffer(project, 'idle-001')

    expect(buffer.width).toBe(project.canvas.width)
    expect(buffer.height).toBe(project.canvas.height)
    expect(buffer.data).toHaveLength(project.canvas.width * project.canvas.height * 4)
  })

  it('doubles width and height at scale 2', () => {
    const project = createDefaultProject()
    const buffer = renderFrameToRgbaBuffer(project, 'idle-001', { scale: 2 })

    expect(buffer.width).toBe(64)
    expect(buffer.height).toBe(64)
  })

  it('expands one painted cell into a 2x2 block at scale 2', () => {
    const project = createDefaultProject()
    const buffer = renderFrameToRgbaBuffer(project, 'idle-001', { scale: 2 })
    const expected = { r: 120, g: 255, b: 228, a: 255 }

    expect(getPixel(buffer, 30, 40)).toEqual(expected)
    expect(getPixel(buffer, 31, 40)).toEqual(expected)
    expect(getPixel(buffer, 30, 41)).toEqual(expected)
    expect(getPixel(buffer, 31, 41)).toEqual(expected)
  })

  it('does not include editor-only visuals in transparent areas', () => {
    const project = createDefaultProject()
    const buffer = renderFrameToRgbaBuffer(project, 'idle-001')

    expect(getPixel(buffer, 0, 0).a).toBe(0)
    expect(getPixel(buffer, 31, 31).a).toBe(0)
  })

  it('does not export hidden layers', () => {
    const project = createDefaultProject()
    const frame = getFrame(project, 'idle-001')!
    frame.layers.push({
      id: 'hidden',
      name: 'Hidden',
      visible: false,
      exportable: true,
      editable: true,
      opacity: 1,
      blendMode: 'normal',
      cells: { [cellKey(0, 0)]: 'core' },
    })

    const buffer = renderFrameToRgbaBuffer(project, 'idle-001')

    expect(getPixel(buffer, 0, 0).a).toBe(0)
  })

  it('does not export layers marked non-exportable even when visible', () => {
    const project = createDefaultProject()
    const frame = getFrame(project, 'idle-001')!
    frame.layers.push({
      id: 'guide',
      name: 'Guide',
      visible: true,
      exportable: false,
      editable: true,
      opacity: 1,
      blendMode: 'normal',
      cells: { [cellKey(0, 0)]: 'core' },
    })

    const buffer = renderFrameToRgbaBuffer(project, 'idle-001')
    const metadata = createSpriteSheetExportMetadata(project, 'idle')

    expect(getPixel(buffer, 0, 0).a).toBe(0)
    expect(metadata.layers.find((layer) => layer.id === 'guide')).toMatchObject({
      exportable: false,
      includedInExport: false,
    })
  })

  it('composites visible layers deterministically in layer order', () => {
    const project = createDefaultProject()
    const frame = getFrame(project, 'idle-001')!
    frame.layers.push({
      id: 'top',
      name: 'Top',
      visible: true,
      exportable: true,
      editable: true,
      opacity: 1,
      blendMode: 'normal',
      cells: { [cellKey(15, 20)]: 'slime_highlight' },
    })

    const buffer = renderFrameToRgbaBuffer(project, 'idle-001')

    expect(getPixel(buffer, 15, 20)).toEqual({ r: 214, g: 255, b: 147, a: 255 })
  })

  it('alpha-composites layer opacity over lower visible pixels', () => {
    const project = createDefaultProject()
    const frame = getFrame(project, 'idle-001')!
    frame.layers.push({
      id: 'glow',
      name: 'Glow',
      visible: true,
      exportable: true,
      editable: true,
      opacity: 0.5,
      blendMode: 'normal',
      cells: { [cellKey(15, 20)]: 'slime_highlight' },
    })

    const buffer = renderFrameToRgbaBuffer(project, 'idle-001')

    expect(getPixel(buffer, 15, 20)).toEqual({ r: 167, g: 255, b: 187, a: 255 })
  })

  it('applies layer blend modes before alpha compositing', () => {
    const project = createDefaultProject()
    const frame = getFrame(project, 'idle-001')!
    frame.layers.push({
      id: 'multiply-highlight',
      name: 'Multiply Highlight',
      visible: true,
      exportable: true,
      editable: true,
      opacity: 1,
      blendMode: 'multiply',
      cells: { [cellKey(15, 20)]: 'slime_highlight' },
    })

    const buffer = renderFrameToRgbaBuffer(project, 'idle-001')

    expect(getPixel(buffer, 15, 20)).toEqual({ r: 101, g: 255, b: 131, a: 255 })
  })

  it('renders animation strip dimensions from createSpriteSheetLayout', () => {
    const project = createDefaultProject()
    const layout = createSpriteSheetLayout(project, 'idle', { scale: 2, margin: 2, spacing: 3 })
    const buffer = renderAnimationToRgbaBuffer(project, 'idle', { scale: 2, margin: 2, spacing: 3 })

    expect(buffer.width).toBe(layout.sheetWidth)
    expect(buffer.height).toBe(layout.sheetHeight)
  })

  it('places each frame in the exact metadata frame region', () => {
    const project = createDefaultProject()
    const metadata = createSpriteSheetExportMetadata(project, 'idle')
    const buffer = renderAnimationToRgbaBuffer(project, 'idle')
    const first = metadata.frames[0]
    const second = metadata.frames[1]

    expect(getPixel(buffer, first.x + 15, first.y + 20)).toEqual({
      r: 120,
      g: 255,
      b: 228,
      a: 255,
    })
    expect(getPixel(buffer, second.x + 15, second.y + 19)).toEqual({
      r: 120,
      g: 255,
      b: 228,
      a: 255,
    })
  })

  it('keeps margins and spacing transparent', () => {
    const project = createDefaultProject()
    const buffer = renderAnimationToRgbaBuffer(project, 'idle', { margin: 2, spacing: 3 })

    expect(getPixel(buffer, 0, 0).a).toBe(0)
    expect(getPixel(buffer, 33, 20).a).toBe(0)
  })

  it('preserves animation frame order in animation strip regions', () => {
    const project = createDefaultProject()
    const layout = createSpriteSheetLayout(project, 'idle')
    const buffer = renderAnimationToRgbaBuffer(project, 'idle')
    const firstRegion = layout.frames[0]
    const secondRegion = layout.frames[1]

    expect(getPixel(buffer, firstRegion.x + 8, firstRegion.y + 20)).toEqual({
      r: 23,
      g: 32,
      b: 22,
      a: 255,
    })
    expect(getPixel(buffer, secondRegion.x + 8, secondRegion.y + 20).a).toBe(0)
  })

  it('keeps transparent cells alpha 0 across the animation strip', () => {
    const project = createDefaultProject()
    const buffer = renderAnimationToRgbaBuffer(project, 'idle')

    expect(getPixel(buffer, 0, 0).a).toBe(0)
    expect(getPixel(buffer, 63, 31).a).toBe(0)
  })

  it('validates exported project JSON and metadata still matches layout', () => {
    const project = createDefaultProject()
    const projectRoundtrip = validateProject(JSON.parse(JSON.stringify(project)) as unknown)
    const layout = createSpriteSheetLayout(project, 'idle')
    const metadata = createSpriteSheetExportMetadata(project, 'idle')

    expect(projectRoundtrip.valid).toBe(true)
    expect(metadata.frames).toEqual(layout.frames)
    expect(metadata.sheetWidth).toBe(layout.sheetWidth)
    expect(metadata.sheetHeight).toBe(layout.sheetHeight)
  })

  it('renders the full sprite sheet dimensions from the combined grid layout', () => {
    const project = createHeroDemoProject()
    const layout = createFullSpriteSheetLayout(project, { scale: 2, margin: 2, spacing: 3 })
    const buffer = renderFullSpriteSheetToRgbaBuffer(project, { scale: 2, margin: 2, spacing: 3 })

    expect(buffer.width).toBe(layout.sheetWidth)
    expect(buffer.height).toBe(layout.sheetHeight)
  })

  it('places full sprite sheet frames in their metadata row and column regions', () => {
    const project = createHeroDemoProject()
    const metadata = createFullSpriteSheetExportMetadata(project, { margin: 1, spacing: 2 })
    const buffer = renderFullSpriteSheetToRgbaBuffer(project, { margin: 1, spacing: 2 })
    const idleFirst = metadata.animations[0].frames[0]
    const swordLast = metadata.animations[3].frames[4]

    expect(getPixel(buffer, idleFirst.x + 16, idleFirst.y + 14).a).toBeGreaterThan(0)
    expect(getPixel(buffer, swordLast.x + 18, swordLast.y + 14).a).toBeGreaterThan(0)
  })

  it('leaves full sprite sheet padding cells transparent for shorter animation rows', () => {
    const project = createHeroDemoProject()
    const layout = createFullSpriteSheetLayout(project, { margin: 2, spacing: 1 })
    const buffer = renderFullSpriteSheetToRgbaBuffer(project, { margin: 2, spacing: 1 })
    const emptyIdleColumnX = layout.margin + 4 * (layout.frameWidth + layout.spacing) + 16
    const idleRowY = layout.margin + 16
    const emptyCrouchColumnX = layout.margin + 3 * (layout.frameWidth + layout.spacing) + 16
    const crouchRowY = layout.margin + 2 * (layout.frameHeight + layout.spacing) + 16

    expect(getPixel(buffer, emptyIdleColumnX, idleRowY).a).toBe(0)
    expect(getPixel(buffer, emptyCrouchColumnX, crouchRowY).a).toBe(0)
  })
})
