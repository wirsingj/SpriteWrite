import { createFullSpriteSheetLayout, createSpriteSheetLayout } from './exportPlanning'
import { getAnimation, getColor, getFrame, parseCellKey } from './spriteData'
import type {
  AnimationId,
  FrameId,
  FullSpriteSheetExportOptions,
  LayerBlendMode,
  SpriteProject,
  SpriteSheetExportOptions,
} from './spriteTypes'

export interface RgbaColor {
  r: number
  g: number
  b: number
  a: number
}

export interface RgbaBuffer {
  width: number
  height: number
  data: Uint8ClampedArray
}

export function parseHexColor(hex: string): RgbaColor {
  const normalized = hex.trim()

  if (!/^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(normalized)) {
    throw new Error(`Invalid hex color "${hex}".`)
  }

  const raw = normalized.slice(1)
  if (raw.length === 3 || raw.length === 4) {
    const [r, g, b, a = 'f'] = raw.split('')
    return {
      r: Number.parseInt(`${r}${r}`, 16),
      g: Number.parseInt(`${g}${g}`, 16),
      b: Number.parseInt(`${b}${b}`, 16),
      a: Number.parseInt(`${a}${a}`, 16),
    }
  }

  return {
    r: Number.parseInt(raw.slice(0, 2), 16),
    g: Number.parseInt(raw.slice(2, 4), 16),
    b: Number.parseInt(raw.slice(4, 6), 16),
    a: raw.length === 8 ? Number.parseInt(raw.slice(6, 8), 16) : 255,
  }
}

export function renderFrameToRgbaBuffer(
  project: SpriteProject,
  frameId: FrameId,
  options: { scale?: number } = {},
): RgbaBuffer {
  const scale = resolveScale(options.scale ?? 1)
  const frame = getFrame(project, frameId)
  if (!frame) {
    throw new Error(`Missing frame "${frameId}".`)
  }

  const width = project.canvas.width * scale
  const height = project.canvas.height * scale
  const buffer = createTransparentBuffer(width, height)

  frame.layers
    .filter((layer) => layer.visible && layer.exportable !== false)
    .forEach((layer) => {
      Object.entries(layer.cells).forEach(([key, colorId]) => {
        const color = getColor(project, colorId)
        if (!color || color.isTransparent) {
          return
        }

        const { x, y } = parseCellKey(key)
        const rgba = applyOpacity(parseHexColor(color.hex), layer.opacity)
        writeScaledCell(buffer, x * scale, y * scale, scale, rgba, layer.blendMode ?? 'normal')
      })
    })

  return buffer
}

export function renderAnimationToRgbaBuffer(
  project: SpriteProject,
  animationId: AnimationId,
  options: Partial<Omit<SpriteSheetExportOptions, 'animationId'>> = {},
): RgbaBuffer {
  const layout = createSpriteSheetLayout(project, animationId, options)
  const animation = getAnimation(project, animationId)
  if (!animation) {
    throw new Error(`Missing animation "${animationId}".`)
  }

  const buffer = createTransparentBuffer(layout.sheetWidth, layout.sheetHeight)

  layout.frames.forEach((frameRegion) => {
    const frameBuffer = renderFrameToRgbaBuffer(project, frameRegion.frameId, {
      scale: layout.scale,
    })

    blitBuffer(buffer, frameBuffer, frameRegion.x, frameRegion.y)
  })

  return buffer
}

export function renderFullSpriteSheetToRgbaBuffer(
  project: SpriteProject,
  options: FullSpriteSheetExportOptions = {},
): RgbaBuffer {
  const layout = createFullSpriteSheetLayout(project, options)
  const buffer = createTransparentBuffer(layout.sheetWidth, layout.sheetHeight)

  layout.animations.forEach((animation) => {
    animation.frames.forEach((frameRegion) => {
      const frameBuffer = renderFrameToRgbaBuffer(project, frameRegion.frameId, {
        scale: layout.scale,
      })

      blitBuffer(buffer, frameBuffer, frameRegion.x, frameRegion.y)
    })
  })

  return buffer
}

export function getPixel(buffer: RgbaBuffer, x: number, y: number): RgbaColor {
  const offset = pixelOffset(buffer.width, x, y)
  return {
    r: buffer.data[offset],
    g: buffer.data[offset + 1],
    b: buffer.data[offset + 2],
    a: buffer.data[offset + 3],
  }
}

function createTransparentBuffer(width: number, height: number): RgbaBuffer {
  return {
    width,
    height,
    data: new Uint8ClampedArray(width * height * 4),
  }
}

function writeScaledCell(
  buffer: RgbaBuffer,
  startX: number,
  startY: number,
  scale: number,
  color: RgbaColor,
  blendMode: LayerBlendMode = 'normal',
) {
  for (let y = 0; y < scale; y += 1) {
    for (let x = 0; x < scale; x += 1) {
      blendPixel(buffer, startX + x, startY + y, color, blendMode)
    }
  }
}

function blitBuffer(target: RgbaBuffer, source: RgbaBuffer, targetX: number, targetY: number) {
  for (let y = 0; y < source.height; y += 1) {
    for (let x = 0; x < source.width; x += 1) {
      const color = getPixel(source, x, y)
      if (color.a === 0) {
        continue
      }
      blendPixel(target, targetX + x, targetY + y, color)
    }
  }
}

function blendPixel(
  buffer: RgbaBuffer,
  x: number,
  y: number,
  source: RgbaColor,
  blendMode: LayerBlendMode = 'normal',
) {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height || source.a === 0) {
    return
  }

  const offset = pixelOffset(buffer.width, x, y)
  const destination = {
    r: buffer.data[offset],
    g: buffer.data[offset + 1],
    b: buffer.data[offset + 2],
    a: buffer.data[offset + 3],
  }

  const sourceAlpha = source.a / 255
  const destinationAlpha = destination.a / 255
  const outputAlpha = sourceAlpha + destinationAlpha * (1 - sourceAlpha)

  if (outputAlpha === 0) {
    writePixel(buffer, x, y, { r: 0, g: 0, b: 0, a: 0 })
    return
  }

  const blendedSource = applyBlendMode(source, destination, destinationAlpha > 0 ? blendMode : 'normal')

  writePixel(buffer, x, y, {
    r: Math.round((blendedSource.r * sourceAlpha + destination.r * destinationAlpha * (1 - sourceAlpha)) / outputAlpha),
    g: Math.round((blendedSource.g * sourceAlpha + destination.g * destinationAlpha * (1 - sourceAlpha)) / outputAlpha),
    b: Math.round((blendedSource.b * sourceAlpha + destination.b * destinationAlpha * (1 - sourceAlpha)) / outputAlpha),
    a: Math.round(outputAlpha * 255),
  })
}

function applyBlendMode(source: RgbaColor, destination: RgbaColor, blendMode: LayerBlendMode): RgbaColor {
  if (blendMode === 'multiply') {
    return {
      ...source,
      r: Math.round((source.r * destination.r) / 255),
      g: Math.round((source.g * destination.g) / 255),
      b: Math.round((source.b * destination.b) / 255),
    }
  }

  if (blendMode === 'screen') {
    return {
      ...source,
      r: 255 - Math.round(((255 - source.r) * (255 - destination.r)) / 255),
      g: 255 - Math.round(((255 - source.g) * (255 - destination.g)) / 255),
      b: 255 - Math.round(((255 - source.b) * (255 - destination.b)) / 255),
    }
  }

  return source
}

function writePixel(buffer: RgbaBuffer, x: number, y: number, color: RgbaColor) {
  if (x < 0 || y < 0 || x >= buffer.width || y >= buffer.height) {
    return
  }

  const offset = pixelOffset(buffer.width, x, y)
  buffer.data[offset] = color.r
  buffer.data[offset + 1] = color.g
  buffer.data[offset + 2] = color.b
  buffer.data[offset + 3] = color.a
}

function pixelOffset(width: number, x: number, y: number): number {
  return (y * width + x) * 4
}

function resolveScale(scale: number): number {
  if (!Number.isInteger(scale) || scale < 1 || scale > 16) {
    throw new Error('Export scale must be an integer from 1 to 16.')
  }
  return scale
}

function applyOpacity(color: RgbaColor, opacity: number): RgbaColor {
  return {
    ...color,
    a: Math.round(color.a * opacity),
  }
}
