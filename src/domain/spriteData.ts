import type {
  AnimationId,
  ColorId,
  FrameId,
  LayerId,
  Hitbox,
  LayerBlendMode,
  PixelCell,
  PixelPatchOperation,
  PaletteColor,
  SpriteAnimation,
  SpriteFrame,
  SpriteLayer,
  SpriteProject,
  SpriteAssetType,
  ValidationResult,
} from './spriteTypes'

export const TRANSPARENT_COLOR_ID = 'transparent'
export const SUPPORTED_PROJECT_VERSION = 1
export const MAX_CANVAS_SIZE = 256

const DEFAULT_TIMESTAMP = '2026-06-19T00:00:00.000Z'
const ASSET_TYPES = new Set<SpriteAssetType>([
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
  'enemy',
  'ooze',
  'button',
  'parallax',
  'generic',
])
const LAYER_BLEND_MODES = new Set<LayerBlendMode>(['normal', 'multiply', 'screen'])

export function cellKey(x: number, y: number): string {
  return `${x},${y}`
}

export function parseCellKey(key: string): { x: number; y: number } {
  const [x, y] = key.split(',').map(Number)
  return { x, y }
}

export function layerCellsToPixels(layer: SpriteLayer): PixelCell[] {
  return Object.entries(layer.cells).map(([key, colorId]) => ({
    ...parseCellKey(key),
    colorId,
  }))
}

export function getFrame(project: SpriteProject, frameId: FrameId): SpriteFrame | undefined {
  return project.frames.find((frame) => frame.id === frameId)
}

export function getLayer(frame: SpriteFrame, layerId: LayerId): SpriteLayer | undefined {
  return frame.layers.find((layer) => layer.id === layerId)
}

export function getAnimation(project: SpriteProject, animationId: AnimationId) {
  return project.animations.find((animation) => animation.id === animationId)
}

export function getColor(project: SpriteProject, colorId: ColorId) {
  return project.palette.find((color) => color.id === colorId)
}

export function cloneProject(project: SpriteProject): SpriteProject {
  return structuredClone(project)
}

export function validateProject(input: unknown): ValidationResult<SpriteProject> {
  const errors: string[] = []

  if (!isRecord(input)) {
    return {
      valid: false,
      errors: ['Project must be an object.'],
    }
  }

  const project = input
  validateNonEmptyString(project.id, 'Project id', errors)
  validateNonEmptyString(project.name, 'Project name', errors)

  if (project.description !== undefined && typeof project.description !== 'string') {
    errors.push('Project description must be a string when present.')
  }

  if (
    project.assetType !== undefined &&
    (typeof project.assetType !== 'string' || !ASSET_TYPES.has(project.assetType as SpriteAssetType))
  ) {
    errors.push('Project assetType must be a supported asset type when present.')
  }

  if (project.version !== SUPPORTED_PROJECT_VERSION) {
    errors.push(`Project version must be ${SUPPORTED_PROJECT_VERSION}.`)
  }

  const canvas = isRecord(project.canvas) ? project.canvas : undefined
  if (!canvas) {
    errors.push('Project canvas is required.')
  }

  const width = canvas?.width
  const height = canvas?.height
  validateCanvasDimension(width, 'Canvas width', errors)
  validateCanvasDimension(height, 'Canvas height', errors)

  const paletteIds = validatePalette(project.palette, errors)
  const frameIds = validateFrames(project.frames, width, height, paletteIds, errors)
  validateAnimations(project.animations, frameIds, errors)
  validateMetadata(project.metadata, project.animations, project.frames, errors)

  if (errors.length) {
    return {
      valid: false,
      errors,
    }
  }

  const value = cloneProject(project as unknown as SpriteProject)
  value.frames.forEach((frame) => {
    frame.notes = frame.notes ?? ''
    frame.tags = frame.tags ?? []
    frame.layers.forEach((layer) => {
      layer.exportable = layer.exportable ?? true
      layer.blendMode = layer.blendMode ?? 'normal'
    })
  })

  return {
    valid: true,
    value,
    errors: [],
  }
}

function validatePalette(input: unknown, errors: string[]): Set<string> {
  const paletteIds = new Set<string>()
  let transparentCount = 0

  if (!Array.isArray(input) || input.length === 0) {
    errors.push('Palette must be a non-empty array.')
    return paletteIds
  }

  input.forEach((color, index) => {
    const path = `Palette color ${index}`
    if (!isRecord(color)) {
      errors.push(`${path} must be an object.`)
      return
    }

    if (!validateNonEmptyString(color.id, `${path} id`, errors)) {
      return
    }

    const id = color.id
    if (paletteIds.has(id)) {
      errors.push(`Palette color id "${id}" is duplicated.`)
    }
    paletteIds.add(id)

    validateNonEmptyString(color.name, `${path} name`, errors)

    if (typeof color.hex !== 'string' || !isValidHexColor(color.hex)) {
      errors.push(`${path} hex must be a valid hex color.`)
    }

    if ('isTransparent' in color && typeof color.isTransparent !== 'boolean') {
      errors.push(`${path} isTransparent must be a boolean when present.`)
    }

    if (id === TRANSPARENT_COLOR_ID) {
      transparentCount += 1
      if (color.isTransparent !== true) {
        errors.push(`Palette color "${TRANSPARENT_COLOR_ID}" must have isTransparent: true.`)
      }
    } else if (color.isTransparent === true) {
      errors.push(`Only "${TRANSPARENT_COLOR_ID}" may be marked transparent.`)
    }
  })

  if (transparentCount !== 1) {
    errors.push(`Palette must contain exactly one "${TRANSPARENT_COLOR_ID}" color.`)
  }

  return paletteIds
}

function validateFrames(
  input: unknown,
  width: unknown,
  height: unknown,
  paletteIds: Set<string>,
  errors: string[],
): Set<string> {
  const frameIds = new Set<string>()
  const hasValidCanvas = isValidCanvasDimension(width) && isValidCanvasDimension(height)

  if (!Array.isArray(input) || input.length === 0) {
    errors.push('Frames must be a non-empty array.')
    return frameIds
  }

  input.forEach((frame, frameIndex) => {
    const path = `Frame ${frameIndex}`
    if (!isRecord(frame)) {
      errors.push(`${path} must be an object.`)
      return
    }

    if (validateNonEmptyString(frame.id, `${path} id`, errors)) {
      if (frameIds.has(frame.id)) {
        errors.push(`${path} id "${frame.id}" is duplicated.`)
      }
      frameIds.add(frame.id)
    }

    validateNonEmptyString(frame.name, `${path} name`, errors)

    if (frame.notes !== undefined && typeof frame.notes !== 'string') {
      errors.push(`${path} notes must be a string when present.`)
    }

    validateFrameTags(frame.tags, path, errors)

    if (!Number.isInteger(frame.durationMs) || typeof frame.durationMs !== 'number' || frame.durationMs <= 0) {
      errors.push(`${path} durationMs must be a positive integer.`)
    }

    validateAnchor(frame.anchor, path, width, height, hasValidCanvas, errors)
    validateHitbox(frame.hitbox, path, width, height, hasValidCanvas, errors)
    validateLayers(frame.layers, path, width, height, hasValidCanvas, paletteIds, errors)
  })

  return frameIds
}

function validateFrameTags(input: unknown, framePath: string, errors: string[]) {
  if (input === undefined) {
    return
  }

  if (!Array.isArray(input)) {
    errors.push(`${framePath} tags must be an array of strings when present.`)
    return
  }

  const normalizedTags = new Set<string>()
  input.forEach((tag, index) => {
    if (typeof tag !== 'string' || tag.trim() === '') {
      errors.push(`${framePath} tags[${index}] must be a non-empty string.`)
      return
    }

    const normalizedTag = tag.trim().toLowerCase()
    if (normalizedTags.has(normalizedTag)) {
      errors.push(`${framePath} tag "${tag.trim()}" is duplicated.`)
    }
    normalizedTags.add(normalizedTag)
  })
}

function validateLayers(
  input: unknown,
  framePath: string,
  width: unknown,
  height: unknown,
  hasValidCanvas: boolean,
  paletteIds: Set<string>,
  errors: string[],
) {
  if (!Array.isArray(input) || input.length === 0) {
    errors.push(`${framePath} layers must be a non-empty array.`)
    return
  }

  const layerIds = new Set<string>()

  input.forEach((layer, layerIndex) => {
    const path = `${framePath} layer ${layerIndex}`
    if (!isRecord(layer)) {
      errors.push(`${path} must be an object.`)
      return
    }

    if (validateNonEmptyString(layer.id, `${path} id`, errors)) {
      if (layerIds.has(layer.id)) {
        errors.push(`${path} id "${layer.id}" is duplicated within the frame.`)
      }
      layerIds.add(layer.id)
    }

    validateNonEmptyString(layer.name, `${path} name`, errors)

    if (typeof layer.visible !== 'boolean') {
      errors.push(`${path} visible must be a boolean.`)
    }

    if ('exportable' in layer && typeof layer.exportable !== 'boolean') {
      errors.push(`${path} exportable must be a boolean when present.`)
    }

    if (typeof layer.editable !== 'boolean') {
      errors.push(`${path} editable must be a boolean.`)
    }

    if (typeof layer.opacity !== 'number' || layer.opacity < 0 || layer.opacity > 1) {
      errors.push(`${path} opacity must be a number from 0 to 1.`)
    }

    if (
      'blendMode' in layer &&
      (typeof layer.blendMode !== 'string' || !LAYER_BLEND_MODES.has(layer.blendMode as LayerBlendMode))
    ) {
      errors.push(`${path} blendMode must be one of normal, multiply, or screen when present.`)
    }

    validateLayerCells(layer.cells, path, width, height, hasValidCanvas, paletteIds, errors)
  })
}

function validateLayerCells(
  input: unknown,
  layerPath: string,
  width: unknown,
  height: unknown,
  hasValidCanvas: boolean,
  paletteIds: Set<string>,
  errors: string[],
) {
  if (!isRecord(input)) {
    errors.push(`${layerPath} cells must be a coordinate map object.`)
    return
  }

  const coordinates = new Set<string>()

  Object.entries(input).forEach(([key, colorId]) => {
    const coordinate = parseCellCoordinate(key)
    if (!coordinate) {
      errors.push(`${layerPath} cell key "${key}" must use integer "x,y" coordinates.`)
      return
    }

    const normalizedKey = cellKey(coordinate.x, coordinate.y)
    if (normalizedKey !== key) {
      errors.push(`${layerPath} cell key "${key}" is not canonical; use "${normalizedKey}".`)
    }

    if (coordinates.has(normalizedKey)) {
      errors.push(`${layerPath} has duplicate cell coordinate "${normalizedKey}".`)
    }
    coordinates.add(normalizedKey)

    if (
      hasValidCanvas &&
      (coordinate.x < 0 ||
        coordinate.y < 0 ||
        coordinate.x >= (width as number) ||
        coordinate.y >= (height as number))
    ) {
      errors.push(`${layerPath} cell "${key}" is out of canvas bounds.`)
    }

    if (typeof colorId !== 'string') {
      errors.push(`${layerPath} cell "${key}" colorId must be a string.`)
    } else if (!paletteIds.has(colorId)) {
      errors.push(`${layerPath} cell "${key}" uses unknown colorId "${colorId}".`)
    } else if (colorId === TRANSPARENT_COLOR_ID) {
      errors.push(`${layerPath} cell "${key}" cannot use transparent; omit the cell instead.`)
    }
  })
}

function validateAnimations(input: unknown, frameIds: Set<string>, errors: string[]) {
  if (!Array.isArray(input) || input.length === 0) {
    errors.push('Animations must be a non-empty array.')
    return
  }

  const animationIds = new Set<string>()

  input.forEach((animation, index) => {
    const path = `Animation ${index}`
    if (!isRecord(animation)) {
      errors.push(`${path} must be an object.`)
      return
    }

    if (validateNonEmptyString(animation.id, `${path} id`, errors)) {
      if (animationIds.has(animation.id)) {
        errors.push(`${path} id "${animation.id}" is duplicated.`)
      }
      animationIds.add(animation.id)
    }

    validateNonEmptyString(animation.name, `${path} name`, errors)

    if (!Number.isInteger(animation.fps) || typeof animation.fps !== 'number' || animation.fps < 1 || animation.fps > 60) {
      errors.push(`${path} fps must be an integer from 1 to 60.`)
    }

    if (!Array.isArray(animation.frameIds) || animation.frameIds.length === 0) {
      errors.push(`${path} frameIds must be a non-empty array.`)
      return
    }

    const localFrameIds = new Set<string>()
    animation.frameIds.forEach((frameId, frameIndex) => {
      if (!validateNonEmptyString(frameId, `${path} frameIds[${frameIndex}]`, errors)) {
        return
      }
      if (localFrameIds.has(frameId)) {
        errors.push(`${path} frameId "${frameId}" is duplicated within the animation.`)
      }
      localFrameIds.add(frameId)
      if (!frameIds.has(frameId)) {
        errors.push(`${path} references missing frame "${frameId}".`)
      }
    })
  })
}

function validateMetadata(
  input: unknown,
  animationsInput: unknown,
  framesInput: unknown,
  errors: string[],
) {
  if (!isRecord(input)) {
    errors.push('Project metadata is required.')
    return
  }

  validateNonEmptyString(input.defaultAnimationId, 'Metadata defaultAnimationId', errors)
  validateNonEmptyString(input.defaultLayerId, 'Metadata defaultLayerId', errors)
  validateNonEmptyString(input.createdAt, 'Metadata createdAt', errors)
  validateNonEmptyString(input.updatedAt, 'Metadata updatedAt', errors)

  if (typeof input.createdAt === 'string' && Number.isNaN(Date.parse(input.createdAt))) {
    errors.push('Metadata createdAt must be a valid date string.')
  }

  if (typeof input.updatedAt === 'string' && Number.isNaN(Date.parse(input.updatedAt))) {
    errors.push('Metadata updatedAt must be a valid date string.')
  }

  if (typeof input.notes !== 'string') {
    errors.push('Metadata notes must be a string.')
  }

  if (Array.isArray(animationsInput) && typeof input.defaultAnimationId === 'string') {
    const animationExists = animationsInput.some(
      (animation) => isRecord(animation) && animation.id === input.defaultAnimationId,
    )
    if (!animationExists) {
      errors.push(`Metadata defaultAnimationId "${input.defaultAnimationId}" is missing.`)
    }
  }

  if (Array.isArray(framesInput) && typeof input.defaultLayerId === 'string') {
    const layerExists = framesInput.every(
      (frame) =>
        isRecord(frame) &&
        Array.isArray(frame.layers) &&
        frame.layers.some((layer) => isRecord(layer) && layer.id === input.defaultLayerId),
    )
    if (!layerExists) {
      errors.push(`Metadata defaultLayerId "${input.defaultLayerId}" must exist on every frame.`)
    }
  }
}

function validateAnchor(
  input: unknown,
  framePath: string,
  width: unknown,
  height: unknown,
  hasValidCanvas: boolean,
  errors: string[],
) {
  if (!isRecord(input)) {
    errors.push(`${framePath} anchor is required.`)
    return
  }

  if (!Number.isInteger(input.x) || typeof input.x !== 'number') {
    errors.push(`${framePath} anchor x must be an integer.`)
  }

  if (!Number.isInteger(input.y) || typeof input.y !== 'number') {
    errors.push(`${framePath} anchor y must be an integer.`)
  }

  if (
    hasValidCanvas &&
    typeof input.x === 'number' &&
    typeof input.y === 'number' &&
    (input.x < 0 || input.y < 0 || input.x >= (width as number) || input.y >= (height as number))
  ) {
    errors.push(`${framePath} anchor must be within canvas bounds.`)
  }
}

function validateHitbox(
  input: unknown,
  framePath: string,
  width: unknown,
  height: unknown,
  hasValidCanvas: boolean,
  errors: string[],
) {
  if (input === undefined) {
    return
  }

  if (!isRecord(input)) {
    errors.push(`${framePath} hitbox must be an object when present.`)
    return
  }

  ;(['x', 'y', 'width', 'height'] as const).forEach((key) => {
    if (!Number.isInteger(input[key]) || typeof input[key] !== 'number') {
      errors.push(`${framePath} hitbox ${key} must be an integer.`)
    }
  })

  if (
    typeof input.width === 'number' &&
    typeof input.height === 'number' &&
    (input.width <= 0 || input.height <= 0)
  ) {
    errors.push(`${framePath} hitbox width and height must be positive.`)
  }

  if (
    hasValidCanvas &&
    typeof input.x === 'number' &&
    typeof input.y === 'number' &&
    typeof input.width === 'number' &&
    typeof input.height === 'number' &&
    (input.x < 0 ||
      input.y < 0 ||
      input.width <= 0 ||
      input.height <= 0 ||
      input.x + input.width > (width as number) ||
      input.y + input.height > (height as number))
  ) {
    errors.push(`${framePath} hitbox must be within canvas bounds.`)
  }
}

function validateCanvasDimension(value: unknown, label: string, errors: string[]) {
  if (!isValidCanvasDimension(value)) {
    errors.push(`${label} must be an integer from 1 to ${MAX_CANVAS_SIZE}.`)
  }
}

function isValidCanvasDimension(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= MAX_CANVAS_SIZE
  )
}

function validateNonEmptyString(value: unknown, label: string, errors: string[]): value is string {
  if (typeof value !== 'string' || value.trim() === '') {
    errors.push(`${label} must be a non-empty string.`)
    return false
  }
  return true
}

function isValidHexColor(value: string): boolean {
  return /^#(?:[0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

function parseCellCoordinate(key: string): { x: number; y: number } | undefined {
  if (!/^-?\d+,-?\d+$/.test(key)) {
    return undefined
  }

  const [x, y] = key.split(',').map(Number)
  if (!Number.isInteger(x) || !Number.isInteger(y)) {
    return undefined
  }

  return { x, y }
}

function makeBaseLayer(cells: Record<string, ColorId> = {}): SpriteLayer {
  return {
    id: 'base',
    name: 'Base',
    visible: true,
    exportable: true,
    editable: true,
    opacity: 1,
    blendMode: 'normal',
    cells,
  }
}

function makeEmptyLayer(id: LayerId, name: string): SpriteLayer {
  return {
    id,
    name,
    visible: true,
    exportable: true,
    editable: true,
    opacity: 1,
    blendMode: 'normal',
    cells: {},
  }
}

function projectHasLayerId(project: SpriteProject, layerId: LayerId): boolean {
  return project.frames.some((frame) => frame.layers.some((layer) => layer.id === layerId))
}

function projectHasAnimationId(project: SpriteProject, animationId: AnimationId): boolean {
  return project.animations.some((animation) => animation.id === animationId)
}

function projectHasFrameId(project: SpriteProject, frameId: FrameId): boolean {
  return project.frames.some((frame) => frame.id === frameId)
}

function touchProject(project: SpriteProject): SpriteProject {
  project.metadata.updatedAt = new Date().toISOString()
  return project
}

export function addLayerToProject(
  project: SpriteProject,
  options: { id?: LayerId; name?: string } = {},
): SpriteProject {
  const nextProject = cloneProject(project)
  const layerNumber = (nextProject.frames[0]?.layers.length ?? 0) + 1
  const layerId = options.id?.trim() || `layer-${Date.now()}`
  const layerName = options.name?.trim() || `Layer ${layerNumber}`

  if (projectHasLayerId(nextProject, layerId)) {
    throw new Error(`Layer "${layerId}" already exists.`)
  }

  nextProject.frames.forEach((frame) => {
    frame.layers.push(makeEmptyLayer(layerId, layerName))
  })

  return touchProject(nextProject)
}

export function deleteLayerFromProject(project: SpriteProject, layerId: LayerId): SpriteProject {
  if (layerId === project.metadata.defaultLayerId) {
    throw new Error('Cannot delete the default layer.')
  }

  if (project.frames.some((frame) => frame.layers.length <= 1)) {
    throw new Error('Cannot delete the last layer.')
  }

  if (project.frames.some((frame) => !frame.layers.some((layer) => layer.id === layerId))) {
    throw new Error(`Layer "${layerId}" must exist on every frame to delete it.`)
  }

  const nextProject = cloneProject(project)
  nextProject.frames.forEach((frame) => {
    frame.layers = frame.layers.filter((layer) => layer.id !== layerId)
  })

  return touchProject(nextProject)
}

export function moveLayerInProject(
  project: SpriteProject,
  layerId: LayerId,
  direction: -1 | 1,
): SpriteProject {
  if (project.frames.some((frame) => !frame.layers.some((layer) => layer.id === layerId))) {
    throw new Error(`Layer "${layerId}" must exist on every frame to move it.`)
  }

  const firstFrameIndex = project.frames[0]?.layers.findIndex((layer) => layer.id === layerId) ?? -1
  const targetIndex = firstFrameIndex + direction
  if (firstFrameIndex < 0 || targetIndex < 0 || targetIndex >= (project.frames[0]?.layers.length ?? 0)) {
    return cloneProject(project)
  }

  const nextProject = cloneProject(project)
  nextProject.frames.forEach((frame) => {
    const index = frame.layers.findIndex((layer) => layer.id === layerId)
    const [layer] = frame.layers.splice(index, 1)
    frame.layers.splice(index + direction, 0, layer)
  })

  return touchProject(nextProject)
}

export function setLayerVisibilityInProject(
  project: SpriteProject,
  layerId: LayerId,
  visible: boolean,
): SpriteProject {
  if (project.frames.some((frame) => !frame.layers.some((layer) => layer.id === layerId))) {
    throw new Error(`Layer "${layerId}" must exist on every frame to set visibility.`)
  }

  const nextProject = cloneProject(project)
  nextProject.frames.forEach((frame) => {
    const layer = getLayer(frame, layerId)
    if (layer) {
      layer.visible = visible
    }
  })

  return touchProject(nextProject)
}

export function updateLayerPropertiesInProject(
  project: SpriteProject,
  layerId: LayerId,
  properties: Partial<Pick<SpriteLayer, 'name' | 'visible' | 'exportable' | 'editable' | 'opacity' | 'blendMode'>>,
): SpriteProject {
  if (project.frames.some((frame) => !frame.layers.some((layer) => layer.id === layerId))) {
    throw new Error(`Layer "${layerId}" must exist on every frame to update it.`)
  }

  if (properties.name !== undefined && properties.name.trim() === '') {
    throw new Error('Layer name must not be empty.')
  }

  if (
    properties.opacity !== undefined &&
    (!Number.isFinite(properties.opacity) || properties.opacity < 0 || properties.opacity > 1)
  ) {
    throw new Error('Layer opacity must be a number from 0 to 1.')
  }

  if (properties.blendMode !== undefined && !LAYER_BLEND_MODES.has(properties.blendMode)) {
    throw new Error('Layer blendMode must be one of normal, multiply, or screen.')
  }

  const nextProject = cloneProject(project)
  nextProject.frames.forEach((frame) => {
    const layer = getLayer(frame, layerId)
    if (!layer) {
      return
    }

    if (properties.name !== undefined) {
      layer.name = properties.name.trim()
    }
    if (properties.visible !== undefined) {
      layer.visible = properties.visible
    }
    if (properties.exportable !== undefined) {
      layer.exportable = properties.exportable
    }
    if (properties.editable !== undefined) {
      layer.editable = properties.editable
    }
    if (properties.opacity !== undefined) {
      layer.opacity = properties.opacity
    }
    if (properties.blendMode !== undefined) {
      layer.blendMode = properties.blendMode
    }
  })

  return touchProject(nextProject)
}

export function updatePaletteColorInProject(
  project: SpriteProject,
  colorId: ColorId,
  properties: Partial<Pick<PaletteColor, 'name' | 'hex'>>,
): SpriteProject {
  const color = getColor(project, colorId)
  if (!color) {
    throw new Error(`Missing palette color "${colorId}".`)
  }

  if (properties.name !== undefined && properties.name.trim() === '') {
    throw new Error('Palette color name must not be empty.')
  }

  if (properties.hex !== undefined && !isValidHexColor(properties.hex)) {
    throw new Error('Palette color hex must be a valid hex color.')
  }

  if (color.isTransparent && properties.hex !== undefined && properties.hex !== '#00000000') {
    throw new Error('Transparent palette color must keep #00000000.')
  }

  const nextProject = cloneProject(project)
  const nextColor = getColor(nextProject, colorId)
  if (!nextColor) {
    throw new Error(`Palette color "${colorId}" disappeared during update.`)
  }

  if (properties.name !== undefined) {
    nextColor.name = properties.name.trim()
  }
  if (properties.hex !== undefined) {
    nextColor.hex = properties.hex
  }

  return touchProject(nextProject)
}

export function addPaletteColorToProject(
  project: SpriteProject,
  options: { id?: ColorId; name?: string; hex?: string } = {},
): SpriteProject {
  const colorNumber = project.palette.length
  const colorId = options.id?.trim() || `color-${Date.now()}`
  const colorName = options.name?.trim() || `Color ${colorNumber}`
  const hex = options.hex?.trim() || '#ffffff'

  if (colorId === TRANSPARENT_COLOR_ID) {
    throw new Error(`Palette color id "${TRANSPARENT_COLOR_ID}" is reserved.`)
  }

  if (getColor(project, colorId)) {
    throw new Error(`Palette color "${colorId}" already exists.`)
  }

  if (colorName === '') {
    throw new Error('Palette color name must not be empty.')
  }

  if (!isValidHexColor(hex)) {
    throw new Error('Palette color hex must be a valid hex color.')
  }

  const nextProject = cloneProject(project)
  nextProject.palette.push({ id: colorId, name: colorName, hex })

  return touchProject(nextProject)
}

export function deletePaletteColorFromProject(project: SpriteProject, colorId: ColorId): SpriteProject {
  const color = getColor(project, colorId)
  if (!color) {
    throw new Error(`Missing palette color "${colorId}".`)
  }

  if (color.isTransparent || colorId === TRANSPARENT_COLOR_ID) {
    throw new Error('Cannot delete the transparent palette color.')
  }

  const isUsed = project.frames.some((frame) =>
    frame.layers.some((layer) => Object.values(layer.cells).includes(colorId)),
  )
  if (isUsed) {
    throw new Error(`Cannot delete palette color "${colorId}" while cells use it.`)
  }

  const nextProject = cloneProject(project)
  nextProject.palette = nextProject.palette.filter((item) => item.id !== colorId)

  return touchProject(nextProject)
}

export function movePaletteColorInProject(
  project: SpriteProject,
  colorId: ColorId,
  direction: -1 | 1,
): SpriteProject {
  const index = project.palette.findIndex((color) => color.id === colorId)
  const targetIndex = index + direction
  if (index < 0) {
    throw new Error(`Missing palette color "${colorId}".`)
  }

  if (targetIndex < 0 || targetIndex >= project.palette.length) {
    return cloneProject(project)
  }

  const nextProject = cloneProject(project)
  const [color] = nextProject.palette.splice(index, 1)
  nextProject.palette.splice(targetIndex, 0, color)

  return touchProject(nextProject)
}

export function addAnimationToProject(
  project: SpriteProject,
  options: { id?: AnimationId; name?: string; fps?: number } = {},
): SpriteProject {
  const nextProject = cloneProject(project)
  const animationNumber = nextProject.animations.length + 1
  const animationId = options.id?.trim() || `animation-${Date.now()}`
  const frameId = `${animationId}-001`
  const animationName = options.name?.trim() || `Animation ${animationNumber}`
  const fps = options.fps ?? nextProject.animations[0]?.fps ?? 4

  if (projectHasAnimationId(nextProject, animationId)) {
    throw new Error(`Animation "${animationId}" already exists.`)
  }

  if (projectHasFrameId(nextProject, frameId)) {
    throw new Error(`Frame "${frameId}" already exists.`)
  }

  if (!Number.isInteger(fps) || fps < 1 || fps > 60) {
    throw new Error('Animation FPS must be an integer from 1 to 60.')
  }

  const sourceFrame = nextProject.frames[0]
  const frame: SpriteFrame = {
    id: frameId,
    name: `${animationName} 001`,
    durationMs: sourceFrame?.durationMs ?? 250,
    notes: '',
    tags: [],
    layers:
      sourceFrame?.layers.map((layer) => ({
        ...layer,
        cells: {},
      })) ?? [makeBaseLayer()],
    anchor: {
      x: Math.floor(nextProject.canvas.width / 2),
      y: nextProject.canvas.height - 1,
    },
  }

  nextProject.frames.push(frame)
  nextProject.animations.push({
    id: animationId,
    name: animationName,
    fps,
    frameIds: [frameId],
  })

  return touchProject(nextProject)
}

export function updateAnimationPropertiesInProject(
  project: SpriteProject,
  animationId: AnimationId,
  properties: Partial<Pick<SpriteAnimation, 'name' | 'fps'>>,
): SpriteProject {
  const animation = getAnimation(project, animationId)
  if (!animation) {
    throw new Error(`Missing animation "${animationId}".`)
  }

  if (properties.name !== undefined && properties.name.trim() === '') {
    throw new Error('Animation name must not be empty.')
  }

  if (
    properties.fps !== undefined &&
    (!Number.isInteger(properties.fps) || properties.fps < 1 || properties.fps > 60)
  ) {
    throw new Error('Animation FPS must be an integer from 1 to 60.')
  }

  const nextProject = cloneProject(project)
  const nextAnimation = getAnimation(nextProject, animationId)
  if (!nextAnimation) {
    throw new Error(`Animation "${animationId}" disappeared during update.`)
  }

  if (properties.name !== undefined) {
    nextAnimation.name = properties.name.trim()
  }
  if (properties.fps !== undefined) {
    nextAnimation.fps = properties.fps
  }

  return touchProject(nextProject)
}

export function deleteAnimationFromProject(project: SpriteProject, animationId: AnimationId): SpriteProject {
  const animation = getAnimation(project, animationId)
  if (!animation) {
    throw new Error(`Missing animation "${animationId}".`)
  }

  if (project.animations.length <= 1) {
    throw new Error('Cannot delete the last animation.')
  }

  const nextProject = cloneProject(project)
  nextProject.animations = nextProject.animations.filter((item) => item.id !== animationId)

  const remainingFrameIds = new Set(nextProject.animations.flatMap((item) => item.frameIds))
  nextProject.frames = nextProject.frames.filter((frame) => remainingFrameIds.has(frame.id))

  if (nextProject.metadata.defaultAnimationId === animationId) {
    nextProject.metadata.defaultAnimationId = nextProject.animations[0].id
  }

  return touchProject(nextProject)
}

export function duplicateAnimationInProject(
  project: SpriteProject,
  animationId: AnimationId,
  options: { id?: AnimationId; name?: string } = {},
): SpriteProject {
  const animation = getAnimation(project, animationId)
  if (!animation) {
    throw new Error(`Missing animation "${animationId}".`)
  }

  const nextProject = cloneProject(project)
  const duplicateId = options.id?.trim() || `${animation.id}-copy-${Date.now()}`
  const duplicateName = options.name?.trim() || `${animation.name} Copy`

  if (projectHasAnimationId(nextProject, duplicateId)) {
    throw new Error(`Animation "${duplicateId}" already exists.`)
  }

  const frameIdMap = new Map<FrameId, FrameId>()
  const duplicateFrames = animation.frameIds.map((frameId, index) => {
    const sourceFrame = getFrame(nextProject, frameId)
    if (!sourceFrame) {
      throw new Error(`Animation "${animationId}" references missing frame "${frameId}".`)
    }

    const nextFrameId = `${duplicateId}-${String(index + 1).padStart(3, '0')}`
    if (projectHasFrameId(nextProject, nextFrameId)) {
      throw new Error(`Frame "${nextFrameId}" already exists.`)
    }
    frameIdMap.set(frameId, nextFrameId)

    return {
      ...structuredClone(sourceFrame),
      id: nextFrameId,
      name: `${duplicateName} ${String(index + 1).padStart(3, '0')}`,
    }
  })

  nextProject.frames.push(...duplicateFrames)
  nextProject.animations.push({
    ...structuredClone(animation),
    id: duplicateId,
    name: duplicateName,
    frameIds: animation.frameIds.map((frameId) => frameIdMap.get(frameId) ?? frameId),
  })

  return touchProject(nextProject)
}

export function moveAnimationInProject(
  project: SpriteProject,
  animationId: AnimationId,
  direction: -1 | 1,
): SpriteProject {
  const index = project.animations.findIndex((animation) => animation.id === animationId)
  const targetIndex = index + direction
  if (index < 0) {
    throw new Error(`Missing animation "${animationId}".`)
  }

  if (targetIndex < 0 || targetIndex >= project.animations.length) {
    return cloneProject(project)
  }

  const nextProject = cloneProject(project)
  const [animation] = nextProject.animations.splice(index, 1)
  nextProject.animations.splice(targetIndex, 0, animation)

  return touchProject(nextProject)
}

export function moveFrameInAnimation(
  project: SpriteProject,
  animationId: AnimationId,
  frameId: FrameId,
  targetIndex: number,
): SpriteProject {
  const animation = getAnimation(project, animationId)
  if (!animation) {
    throw new Error(`Missing animation "${animationId}".`)
  }

  const sourceIndex = animation.frameIds.indexOf(frameId)
  if (sourceIndex < 0) {
    throw new Error(`Animation "${animationId}" does not contain frame "${frameId}".`)
  }

  if (!Number.isInteger(targetIndex)) {
    throw new Error('Frame target index must be an integer.')
  }

  const clampedTargetIndex = Math.max(0, Math.min(animation.frameIds.length - 1, targetIndex))
  if (sourceIndex === clampedTargetIndex) {
    return cloneProject(project)
  }

  const nextProject = cloneProject(project)
  const nextAnimation = getAnimation(nextProject, animationId)
  if (!nextAnimation) {
    throw new Error(`Animation "${animationId}" disappeared during frame reorder.`)
  }

  const [movedFrameId] = nextAnimation.frameIds.splice(sourceIndex, 1)
  const insertionIndex = Math.min(clampedTargetIndex, nextAnimation.frameIds.length)
  nextAnimation.frameIds.splice(insertionIndex, 0, movedFrameId)

  return touchProject(nextProject)
}

export function updateFramePropertiesInProject(
  project: SpriteProject,
  frameId: FrameId,
  properties: Partial<Pick<SpriteFrame, 'name' | 'durationMs' | 'notes' | 'tags' | 'anchor' | 'hitbox'>>,
): SpriteProject {
  const frame = getFrame(project, frameId)
  if (!frame) {
    throw new Error(`Missing frame "${frameId}".`)
  }

  if (properties.name !== undefined && properties.name.trim() === '') {
    throw new Error('Frame name must not be empty.')
  }

  if (
    properties.durationMs !== undefined &&
    (!Number.isInteger(properties.durationMs) || properties.durationMs <= 0)
  ) {
    throw new Error('Frame durationMs must be a positive integer.')
  }

  if (properties.notes !== undefined && typeof properties.notes !== 'string') {
    throw new Error('Frame notes must be a string.')
  }

  if (properties.tags !== undefined) {
    const normalizedTags = new Set<string>()
    properties.tags.forEach((tag) => {
      if (typeof tag !== 'string' || tag.trim() === '') {
        throw new Error('Frame tags must be non-empty strings.')
      }

      const normalizedTag = tag.trim().toLowerCase()
      if (normalizedTags.has(normalizedTag)) {
        throw new Error('Frame tags must be unique.')
      }
      normalizedTags.add(normalizedTag)
    })
  }

  if (properties.anchor !== undefined) {
    const { x, y } = properties.anchor
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      x < 0 ||
      y < 0 ||
      x >= project.canvas.width ||
      y >= project.canvas.height
    ) {
      throw new Error('Frame anchor must use integer coordinates within canvas bounds.')
    }
  }

  if (properties.hitbox !== undefined) {
    const { x, y, width, height } = properties.hitbox
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      x < 0 ||
      y < 0 ||
      x + width > project.canvas.width ||
      y + height > project.canvas.height
    ) {
      throw new Error('Frame hitbox must use positive integer dimensions within canvas bounds.')
    }
  }

  const nextProject = cloneProject(project)
  const nextFrame = getFrame(nextProject, frameId)
  if (!nextFrame) {
    throw new Error(`Frame "${frameId}" disappeared during update.`)
  }

  if (properties.name !== undefined) {
    nextFrame.name = properties.name.trim()
  }
  if (properties.durationMs !== undefined) {
    nextFrame.durationMs = properties.durationMs
  }
  if (properties.notes !== undefined) {
    nextFrame.notes = properties.notes
  }
  if (properties.tags !== undefined) {
    nextFrame.tags = properties.tags.map((tag) => tag.trim())
  }
  if (properties.anchor !== undefined) {
    nextFrame.anchor = properties.anchor
  }
  if (properties.hitbox !== undefined) {
    nextFrame.hitbox = properties.hitbox
  }

  return touchProject(nextProject)
}

export function updateFramesPropertiesInProject(
  project: SpriteProject,
  frameIds: FrameId[],
  properties: Partial<Pick<SpriteFrame, 'durationMs' | 'notes' | 'tags'>>,
): SpriteProject {
  if (!frameIds.length) {
    throw new Error('At least one frame is required for a batch frame update.')
  }

  const uniqueFrameIds = Array.from(new Set(frameIds))
  return uniqueFrameIds.reduce(
    (nextProject, frameId) => updateFramePropertiesInProject(nextProject, frameId, properties),
    project,
  )
}

export function setFrameHitboxInProject(
  project: SpriteProject,
  frameId: FrameId,
  hitbox: Hitbox | undefined,
): SpriteProject {
  const frame = getFrame(project, frameId)
  if (!frame) {
    throw new Error(`Missing frame "${frameId}".`)
  }

  if (hitbox !== undefined) {
    const { x, y, width, height } = hitbox
    if (
      !Number.isInteger(x) ||
      !Number.isInteger(y) ||
      !Number.isInteger(width) ||
      !Number.isInteger(height) ||
      width <= 0 ||
      height <= 0 ||
      x < 0 ||
      y < 0 ||
      x + width > project.canvas.width ||
      y + height > project.canvas.height
    ) {
      throw new Error('Frame hitbox must use positive integer dimensions within canvas bounds.')
    }
  }

  const nextProject = cloneProject(project)
  const nextFrame = getFrame(nextProject, frameId)
  if (!nextFrame) {
    throw new Error(`Frame "${frameId}" disappeared during hitbox update.`)
  }

  if (hitbox) {
    nextFrame.hitbox = hitbox
  } else {
    delete nextFrame.hitbox
  }

  return touchProject(nextProject)
}

function makeGenericPalette(): PaletteColor[] {
  return [
    { id: TRANSPARENT_COLOR_ID, name: 'Transparent', hex: '#00000000', isTransparent: true },
    { id: 'ink', name: 'Ink', hex: '#101418' },
    { id: 'charcoal', name: 'Charcoal', hex: '#263238' },
    { id: 'mid_gray', name: 'Mid Gray', hex: '#60707a' },
    { id: 'light_gray', name: 'Light Gray', hex: '#b9c7c9' },
    { id: 'white', name: 'White', hex: '#f5fff8' },
    { id: 'accent', name: 'Accent', hex: '#8de06f' },
    { id: 'shadow', name: 'Shadow', hex: '#172016' },
  ]
}

function makeOozePalette(): PaletteColor[] {
  return [
    { id: TRANSPARENT_COLOR_ID, name: 'Transparent', hex: '#00000000', isTransparent: true },
    { id: 'outline', name: 'Outline', hex: '#172016' },
    { id: 'slime_dark', name: 'Slime Dark', hex: '#2f6f3e' },
    { id: 'slime_mid', name: 'Slime Mid', hex: '#51b65f' },
    { id: 'slime_light', name: 'Slime Light', hex: '#8de06f' },
    { id: 'slime_highlight', name: 'Slime Highlight', hex: '#d6ff93' },
    { id: 'core', name: 'Core', hex: '#78ffe4' },
    { id: 'shadow', name: 'Shadow', hex: '#1b3022' },
  ]
}

function makeHeroPalette(): PaletteColor[] {
  return [
    { id: TRANSPARENT_COLOR_ID, name: 'Transparent', hex: '#00000000', isTransparent: true },
    { id: 'ink', name: 'Ink', hex: '#121417' },
    { id: 'charcoal', name: 'Charcoal', hex: '#29313a' },
    { id: 'steel', name: 'Steel', hex: '#b8c7d4' },
    { id: 'steel_light', name: 'Steel Light', hex: '#f0f8ff' },
    { id: 'skin', name: 'Skin', hex: '#f0b983' },
    { id: 'tunic', name: 'Tunic Blue', hex: '#3f7bd8' },
    { id: 'tunic_light', name: 'Tunic Light', hex: '#78a8ff' },
    { id: 'cape', name: 'Cape Red', hex: '#b8323f' },
    { id: 'cape_dark', name: 'Cape Dark', hex: '#6f1d2b' },
    { id: 'gold', name: 'Gold', hex: '#f2c14e' },
    { id: 'shadow', name: 'Shadow', hex: '#172016' },
  ]
}

function makeOozeCells(offsetY = 0): Record<string, ColorId> {
  const cells: Record<string, ColorId> = {}
  const set = (x: number, y: number, colorId: ColorId) => {
    cells[cellKey(x, y + offsetY)] = colorId
  }

  for (let y = 16; y <= 22; y += 1) {
    for (let x = 10; x <= 21; x += 1) {
      const centerX = 15.5
      const centerY = 19
      const dx = (x - centerX) / 6.2
      const dy = (y - centerY) / 4.2
      if (dx * dx + dy * dy <= 1) {
        set(x, y, y < 18 ? 'slime_light' : 'slime_mid')
      }
    }
  }

  const outlineCells = [
    [12, 14],
    [13, 14],
    [18, 14],
    [19, 14],
    [10, 15],
    [11, 15],
    [20, 15],
    [21, 15],
    [8, 17],
    [9, 17],
    [22, 17],
    [23, 17],
    [8, 20],
    [23, 20],
    [10, 23],
    [11, 23],
    [12, 24],
    [13, 24],
    [18, 24],
    [19, 24],
    [20, 23],
    [21, 23],
  ]
  outlineCells.forEach(([x, y]) => set(x, y, 'outline'))

  ;[
    [12, 15],
    [13, 15],
    [18, 15],
    [19, 15],
    [9, 18],
    [10, 16],
    [21, 16],
    [22, 18],
    [9, 19],
    [22, 19],
    [10, 22],
    [21, 22],
    [12, 23],
    [13, 23],
    [18, 23],
    [19, 23],
  ].forEach(([x, y]) => set(x, y, 'slime_dark'))

  ;[
    [13, 17],
    [14, 17],
    [15, 16],
    [18, 18],
    [19, 18],
  ].forEach(([x, y]) => set(x, y, 'slime_highlight'))

  ;[
    [15, 20],
    [16, 20],
    [15, 21],
    [16, 21],
  ].forEach(([x, y]) => set(x, y, 'core'))

  for (let x = 10; x <= 21; x += 1) {
    if (x > 11 && x < 20) {
      set(x, 25, 'shadow')
    }
  }

  return cells
}

interface HeroPoseOptions {
  dx?: number
  dy?: number
  crouch?: number
  capeShift?: number
  swordReach?: number
  swordY?: number
  legTuck?: boolean
  armBack?: boolean
}

function makeHeroCells({
  dx = 0,
  dy = 0,
  crouch = 0,
  capeShift = 0,
  swordReach = 0,
  swordY = 14,
  legTuck = false,
  armBack = false,
}: HeroPoseOptions = {}): Record<string, ColorId> {
  const cells: Record<string, ColorId> = {}
  const set = (x: number, y: number, colorId: ColorId) => {
    if (x >= 0 && x < 32 && y >= 0 && y < 32) {
      cells[cellKey(x, y)] = colorId
    }
  }
  const rect = (x: number, y: number, width: number, height: number, colorId: ColorId) => {
    for (let row = 0; row < height; row += 1) {
      for (let column = 0; column < width; column += 1) {
        set(x + column + dx, y + row + dy, colorId)
      }
    }
  }

  const bodyTop = 12 + crouch
  const bodyHeight = 6 - Math.min(crouch, 2)
  const legTop = bodyTop + bodyHeight
  const footY = legTuck ? legTop + 3 : 24

  for (let x = 10; x <= 22; x += 1) {
    if (x >= 12 && x <= 20) {
      set(x + dx, 26, 'shadow')
    }
  }

  rect(11 - capeShift, bodyTop, 4, 9 - Math.min(crouch, 2), 'cape_dark')
  rect(12 - capeShift, bodyTop + 1, 4, 8 - Math.min(crouch, 2), 'cape')
  set(10 - capeShift + dx, bodyTop + 6 + dy, 'cape_dark')
  set(11 - capeShift + dx, bodyTop + 7 + dy, 'cape_dark')

  rect(14, 7 + crouch, 5, 1, 'ink')
  rect(13, 8 + crouch, 7, 1, 'ink')
  rect(13, 9 + crouch, 1, 3, 'ink')
  rect(19, 9 + crouch, 1, 3, 'ink')
  rect(14, 11 + crouch, 5, 1, 'ink')
  rect(14, 9 + crouch, 5, 2, 'skin')
  set(15 + dx, 10 + crouch + dy, 'ink')
  set(18 + dx, 10 + crouch + dy, 'ink')
  set(16 + dx, 11 + crouch + dy, 'skin')

  rect(13, bodyTop, 7, 1, 'ink')
  rect(13, bodyTop + 1, 1, bodyHeight, 'ink')
  rect(19, bodyTop + 1, 1, bodyHeight, 'ink')
  rect(14, bodyTop + bodyHeight, 5, 1, 'ink')
  rect(14, bodyTop + 1, 5, bodyHeight - 1, 'tunic')
  rect(15, bodyTop + 1, 3, 1, 'tunic_light')
  rect(16, bodyTop + 3, 2, 1, 'gold')

  if (armBack) {
    rect(11, bodyTop + 2, 3, 1, 'charcoal')
    rect(10, bodyTop + 3, 2, 1, 'skin')
  } else {
    rect(11, bodyTop + 2, 3, 1, 'charcoal')
    set(10 + dx, bodyTop + 3 + dy, 'skin')
  }

  const swordStart = 20
  rect(19, swordY, 2, 2, 'gold')
  rect(20, swordY + 1, Math.max(2, swordReach + 2), 1, 'steel')
  if (swordReach > 1) {
    rect(22, swordY, swordReach, 1, 'steel_light')
    set(22 + swordReach + dx, swordY + 1 + dy, 'steel_light')
  }
  set(swordStart + swordReach + 2 + dx, swordY + 1 + dy, 'ink')

  if (legTuck) {
    rect(14, legTop, 2, 4, 'charcoal')
    rect(17, legTop, 2, 3, 'charcoal')
    rect(13, legTop + 3, 3, 1, 'ink')
    rect(18, legTop + 2, 3, 1, 'ink')
  } else if (crouch > 0) {
    rect(13, legTop, 3, 4, 'charcoal')
    rect(17, legTop, 3, 4, 'charcoal')
    rect(12, footY, 4, 1, 'ink')
    rect(18, footY, 4, 1, 'ink')
  } else {
    rect(14, legTop, 2, 6, 'charcoal')
    rect(17, legTop, 2, 6, 'charcoal')
    rect(13, footY, 3, 1, 'ink')
    rect(17, footY, 4, 1, 'ink')
  }

  return cells
}

export function createBlankProject({
  name,
  width,
  height,
  assetType = 'custom',
  description,
}: {
  name: string
  width: number
  height: number
  assetType?: SpriteAssetType
  description?: string
}): SpriteProject {
  const timestamp = new Date().toISOString()
  const normalizedWidth = normalizeProjectDimension(width)
  const normalizedHeight = normalizeProjectDimension(height)
  const frame: SpriteFrame = {
    id: 'idle-001',
    name: 'Frame 001',
    durationMs: 250,
    notes: '',
    tags: [],
    layers: [makeBaseLayer()],
    anchor: { x: Math.floor(normalizedWidth / 2), y: normalizedHeight - 1 },
  }

  return {
    id: `spritewrite-${Date.now()}`,
    name: name.trim() || 'Untitled Sprite',
    description,
    assetType,
    version: SUPPORTED_PROJECT_VERSION,
    canvas: {
      width: normalizedWidth,
      height: normalizedHeight,
    },
    palette: makeGenericPalette(),
    animations: [
      {
        id: 'idle',
        name: 'Idle',
        fps: 4,
        frameIds: [frame.id],
      },
    ],
    frames: [frame],
    metadata: {
      defaultAnimationId: 'idle',
      defaultLayerId: 'base',
      createdAt: timestamp,
      updatedAt: timestamp,
      notes:
        'Transparent pixels are omitted from layer cell maps. A visible cell is stored as "x,y": "colorId".',
    },
  }
}

function normalizeProjectDimension(value: number): number {
  if (!Number.isFinite(value)) {
    return 32
  }

  return Math.max(1, Math.min(MAX_CANVAS_SIZE, Math.round(value)))
}

export function createOozeDemoProject(name = 'Ooze Sprite Starter'): SpriteProject {
  const frameOne: SpriteFrame = {
    id: 'idle-001',
    name: 'Idle 001',
    durationMs: 250,
    notes: 'Idle squash pose.',
    tags: ['idle', 'ooze'],
    layers: [makeBaseLayer(makeOozeCells(0))],
    anchor: { x: 16, y: 24 },
    hitbox: { x: 9, y: 14, width: 15, height: 11 },
  }

  const frameTwo: SpriteFrame = {
    id: 'idle-002',
    name: 'Idle 002',
    durationMs: 250,
    notes: 'Idle stretch pose.',
    tags: ['idle', 'ooze'],
    layers: [makeBaseLayer(makeOozeCells(-1))],
    anchor: { x: 16, y: 24 },
    hitbox: { x: 9, y: 13, width: 15, height: 11 },
  }

  return {
    id: 'spritewrite-ooze-default',
    name,
    description: 'A small 32x32 ooze demo asset for testing SpriteWrite workflows.',
    assetType: 'creature',
    version: 1,
    canvas: {
      width: 32,
      height: 32,
    },
    palette: makeOozePalette(),
    animations: [
      {
        id: 'idle',
        name: 'Idle',
        fps: 4,
        frameIds: ['idle-001', 'idle-002'],
      },
    ],
    frames: [frameOne, frameTwo],
    metadata: {
      defaultAnimationId: 'idle',
      defaultLayerId: 'base',
      createdAt: DEFAULT_TIMESTAMP,
      updatedAt: DEFAULT_TIMESTAMP,
      notes:
        'Transparent pixels are omitted from layer cell maps. A visible cell is stored as "x,y": "colorId".',
    },
  }
}

export function createHeroDemoProject(name = 'Hero Sprite Demo'): SpriteProject {
  const frameSpecs: Array<{
    id: FrameId
    animationId: AnimationId
    name: string
    durationMs: number
    notes: string
    tags: string[]
    pose: HeroPoseOptions
    hitbox: Hitbox
  }> = [
    {
      id: 'idle-001',
      animationId: 'idle',
      name: 'Idle 001',
      durationMs: 180,
      notes: 'Neutral standing pose with cape at rest.',
      tags: ['idle', 'hero', 'cape'],
      pose: { dy: 0, capeShift: 0, swordReach: 0, swordY: 15 },
      hitbox: { x: 10, y: 7, width: 14, height: 19 },
    },
    {
      id: 'idle-002',
      animationId: 'idle',
      name: 'Idle 002',
      durationMs: 180,
      notes: 'Breathing lift, cape trails slightly.',
      tags: ['idle', 'hero', 'cape'],
      pose: { dy: -1, capeShift: 0, swordReach: 0, swordY: 14 },
      hitbox: { x: 10, y: 6, width: 14, height: 20 },
    },
    {
      id: 'idle-003',
      animationId: 'idle',
      name: 'Idle 003',
      durationMs: 180,
      notes: 'Return pose with sword hand steady.',
      tags: ['idle', 'hero', 'cape'],
      pose: { dy: 0, capeShift: 1, swordReach: 0, swordY: 15 },
      hitbox: { x: 9, y: 7, width: 15, height: 19 },
    },
    {
      id: 'idle-004',
      animationId: 'idle',
      name: 'Idle 004',
      durationMs: 180,
      notes: 'Low breathing frame before loop.',
      tags: ['idle', 'hero', 'cape'],
      pose: { dy: 1, capeShift: 0, swordReach: 0, swordY: 16 },
      hitbox: { x: 10, y: 8, width: 14, height: 18 },
    },
    {
      id: 'jump-001',
      animationId: 'jump',
      name: 'Jump 001',
      durationMs: 140,
      notes: 'Anticipation crouch before takeoff.',
      tags: ['jump', 'anticipation', 'hero'],
      pose: { dy: 1, crouch: 2, capeShift: 0, swordReach: 0, swordY: 17 },
      hitbox: { x: 10, y: 10, width: 14, height: 16 },
    },
    {
      id: 'jump-002',
      animationId: 'jump',
      name: 'Jump 002',
      durationMs: 120,
      notes: 'Takeoff frame, cape drops behind.',
      tags: ['jump', 'takeoff', 'hero'],
      pose: { dy: -2, capeShift: -1, swordReach: 0, swordY: 13, legTuck: true },
      hitbox: { x: 10, y: 5, width: 15, height: 18 },
    },
    {
      id: 'jump-003',
      animationId: 'jump',
      name: 'Jump 003',
      durationMs: 160,
      notes: 'Apex frame with tucked legs.',
      tags: ['jump', 'apex', 'hero'],
      pose: { dy: -5, capeShift: -1, swordReach: 1, swordY: 10, legTuck: true },
      hitbox: { x: 10, y: 2, width: 16, height: 18 },
    },
    {
      id: 'jump-004',
      animationId: 'jump',
      name: 'Jump 004',
      durationMs: 120,
      notes: 'Falling frame, sword returns forward.',
      tags: ['jump', 'fall', 'hero'],
      pose: { dy: -2, capeShift: 1, swordReach: 1, swordY: 13, legTuck: true },
      hitbox: { x: 9, y: 5, width: 17, height: 18 },
    },
    {
      id: 'jump-005',
      animationId: 'jump',
      name: 'Jump 005',
      durationMs: 150,
      notes: 'Landing compression frame.',
      tags: ['jump', 'landing', 'hero'],
      pose: { dy: 1, crouch: 1, capeShift: 1, swordReach: 0, swordY: 16 },
      hitbox: { x: 9, y: 9, width: 16, height: 17 },
    },
    {
      id: 'crouch-001',
      animationId: 'crouch',
      name: 'Crouch 001',
      durationMs: 160,
      notes: 'Start lowering into crouch.',
      tags: ['crouch', 'hero'],
      pose: { dy: 1, crouch: 1, capeShift: 0, swordReach: 0, swordY: 16 },
      hitbox: { x: 10, y: 9, width: 14, height: 17 },
    },
    {
      id: 'crouch-002',
      animationId: 'crouch',
      name: 'Crouch 002',
      durationMs: 220,
      notes: 'Held crouch pose with wider stance.',
      tags: ['crouch', 'hold', 'hero'],
      pose: { dy: 2, crouch: 2, capeShift: 1, swordReach: 0, swordY: 17 },
      hitbox: { x: 9, y: 10, width: 16, height: 16 },
    },
    {
      id: 'crouch-003',
      animationId: 'crouch',
      name: 'Crouch 003',
      durationMs: 160,
      notes: 'Recovery from crouch.',
      tags: ['crouch', 'recovery', 'hero'],
      pose: { dy: 1, crouch: 1, capeShift: 0, swordReach: 0, swordY: 16 },
      hitbox: { x: 10, y: 9, width: 14, height: 17 },
    },
    {
      id: 'sword-stab-001',
      animationId: 'sword_stab',
      name: 'Sword Stab 001',
      durationMs: 120,
      notes: 'Windup with arm pulled back.',
      tags: ['attack', 'sword', 'windup', 'hero'],
      pose: { dy: 0, capeShift: 1, swordReach: 0, swordY: 15, armBack: true },
      hitbox: { x: 9, y: 7, width: 15, height: 19 },
    },
    {
      id: 'sword-stab-002',
      animationId: 'sword_stab',
      name: 'Sword Stab 002',
      durationMs: 90,
      notes: 'Sword begins extending.',
      tags: ['attack', 'sword', 'thrust', 'hero'],
      pose: { dx: 1, dy: 0, capeShift: 1, swordReach: 3, swordY: 14 },
      hitbox: { x: 10, y: 7, width: 18, height: 19 },
    },
    {
      id: 'sword-stab-003',
      animationId: 'sword_stab',
      name: 'Sword Stab 003',
      durationMs: 90,
      notes: 'Full extension with readable sword reach.',
      tags: ['attack', 'sword', 'contact', 'hero'],
      pose: { dx: 2, dy: 0, capeShift: 2, swordReach: 6, swordY: 14 },
      hitbox: { x: 11, y: 7, width: 20, height: 19 },
    },
    {
      id: 'sword-stab-004',
      animationId: 'sword_stab',
      name: 'Sword Stab 004',
      durationMs: 120,
      notes: 'Held contact frame.',
      tags: ['attack', 'sword', 'hold', 'hero'],
      pose: { dx: 2, dy: 0, capeShift: 2, swordReach: 6, swordY: 15 },
      hitbox: { x: 11, y: 7, width: 20, height: 19 },
    },
    {
      id: 'sword-stab-005',
      animationId: 'sword_stab',
      name: 'Sword Stab 005',
      durationMs: 140,
      notes: 'Recovery back toward idle stance.',
      tags: ['attack', 'sword', 'recovery', 'hero'],
      pose: { dx: 1, dy: 0, capeShift: 1, swordReach: 2, swordY: 15 },
      hitbox: { x: 10, y: 7, width: 17, height: 19 },
    },
  ]

  const frames = frameSpecs.map<SpriteFrame>((spec) => ({
    id: spec.id,
    name: spec.name,
    durationMs: spec.durationMs,
    notes: spec.notes,
    tags: spec.tags,
    layers: [makeBaseLayer(makeHeroCells(spec.pose))],
    anchor: { x: 16, y: 25 },
    hitbox: spec.hitbox,
  }))

  return {
    id: 'spritewrite-hero-demo',
    name,
    description: 'A 32x32 multi-row hero sprite sheet demo for testing animation and export workflows.',
    assetType: 'character',
    version: 1,
    canvas: {
      width: 32,
      height: 32,
    },
    palette: makeHeroPalette(),
    animations: [
      {
        id: 'idle',
        name: 'Idle',
        fps: 6,
        frameIds: ['idle-001', 'idle-002', 'idle-003', 'idle-004'],
      },
      {
        id: 'jump',
        name: 'Jump',
        fps: 8,
        frameIds: ['jump-001', 'jump-002', 'jump-003', 'jump-004', 'jump-005'],
      },
      {
        id: 'crouch',
        name: 'Crouch',
        fps: 6,
        frameIds: ['crouch-001', 'crouch-002', 'crouch-003'],
      },
      {
        id: 'sword_stab',
        name: 'Sword Stab',
        fps: 10,
        frameIds: [
          'sword-stab-001',
          'sword-stab-002',
          'sword-stab-003',
          'sword-stab-004',
          'sword-stab-005',
        ],
      },
    ],
    frames,
    metadata: {
      defaultAnimationId: 'idle',
      defaultLayerId: 'base',
      createdAt: DEFAULT_TIMESTAMP,
      updatedAt: DEFAULT_TIMESTAMP,
      notes:
        'Hero demo is structured grid data. Use Full Sheet to inspect rows, edit individual frames, and export clean PNG sheets.',
    },
  }
}

export function createDefaultProject(): SpriteProject {
  return createOozeDemoProject()
}

function isIntegerCoordinate(value: unknown): value is number {
  return Number.isInteger(value) && typeof value === 'number'
}

export function validatePatch(
  project: SpriteProject,
  animationId: AnimationId,
  frameId: FrameId,
  layerId: LayerId,
  patch: unknown,
) {
  const errors: string[] = []
  const animation = getAnimation(project, animationId)
  const frame = getFrame(project, frameId)
  const layer = frame ? getLayer(frame, layerId) : undefined
  const paletteIds = new Set(project.palette.map((color) => color.id))

  if (!animation) {
    errors.push(`Missing animation "${animationId}".`)
  }

  if (animation && !animation.frameIds.includes(frameId)) {
    errors.push(`Frame "${frameId}" is not part of animation "${animationId}".`)
  }

  if (!frame) {
    errors.push(`Missing frame "${frameId}".`)
  }

  if (!layer) {
    errors.push(`Missing layer "${layerId}".`)
  } else if (!layer.editable) {
    errors.push(`Layer "${layerId}" is not editable.`)
  }

  if (!Array.isArray(patch)) {
    errors.push('Patch must be an array of operations.')
    return { valid: false, errors }
  }

  patch.forEach((operation, index) => {
    if (!operation || typeof operation !== 'object') {
      errors.push(`Operation ${index} must be an object.`)
      return
    }

    const candidate = operation as Record<string, unknown>
    const allowedKeys =
      candidate.op === 'set' ? new Set(['op', 'x', 'y', 'colorId']) : new Set(['op', 'x', 'y'])

    Object.keys(candidate).forEach((key) => {
      if (!allowedKeys.has(key)) {
        errors.push(`Operation ${index} contains unsupported field "${key}".`)
      }
    })

    if (candidate.op !== 'set' && candidate.op !== 'clear') {
      errors.push(`Operation ${index} has invalid op "${String(candidate.op)}".`)
      return
    }

    if (!isIntegerCoordinate(candidate.x) || !isIntegerCoordinate(candidate.y)) {
      errors.push(`Operation ${index} coordinates must be integer numbers.`)
      return
    }

    if (
      candidate.x < 0 ||
      candidate.y < 0 ||
      candidate.x >= project.canvas.width ||
      candidate.y >= project.canvas.height
    ) {
      errors.push(`Operation ${index} targets out-of-bounds cell ${candidate.x},${candidate.y}.`)
    }

    if (candidate.op === 'set') {
      if (typeof candidate.colorId !== 'string') {
        errors.push(`Operation ${index} set operation requires colorId.`)
      } else if (!paletteIds.has(candidate.colorId)) {
        errors.push(`Operation ${index} uses unknown colorId "${candidate.colorId}".`)
      } else if (candidate.colorId === TRANSPARENT_COLOR_ID) {
        errors.push(`Operation ${index} cannot set transparent; use clear instead.`)
      }
    }
  })

  return {
    valid: errors.length === 0,
    errors,
  }
}

export function applyPatch(
  project: SpriteProject,
  animationId: AnimationId,
  frameId: FrameId,
  layerId: LayerId,
  patch: PixelPatchOperation[],
): SpriteProject {
  const validation = validatePatch(project, animationId, frameId, layerId, patch)
  if (!validation.valid) {
    throw new Error(validation.errors.join('\n'))
  }

  const nextProject = cloneProject(project)
  const frame = getFrame(nextProject, frameId)
  const layer = frame ? getLayer(frame, layerId) : undefined
  if (!frame || !layer) {
    throw new Error('Patch target disappeared during apply.')
  }

  patch.forEach((operation) => {
    const key = cellKey(operation.x, operation.y)
    if (operation.op === 'set') {
      layer.cells[key] = operation.colorId
    } else {
      delete layer.cells[key]
    }
  })

  nextProject.metadata.updatedAt = new Date().toISOString()
  return nextProject
}
