import type { AiPatchProvider, AiPatchRequest } from './aiPatchProvider'
import type { PaletteColor, PixelPatchOperation, SpriteProject } from '../domain/spriteTypes'
import { layerCellsToPixels, getFrame, getLayer } from '../domain/spriteData'

export interface OllamaPatchProviderOptions {
  baseUrl: string
  model: string
  timeoutMs?: number
}

export interface OllamaModelInfo {
  name: string
  modifiedAt?: string
  size?: number
  capabilities?: string[]
  family?: string
  families?: string[]
  parameterSize?: string
}

export interface OllamaAnimationDraftFrame {
  name?: string
  durationMs?: number
  patch: PixelPatchOperation[]
}

export interface OllamaAnimationDraft {
  animationName?: string
  fps?: number
  paletteAdditions?: PaletteColor[]
  frames: OllamaAnimationDraftFrame[]
}

export interface OllamaAnimationSetDraft {
  animations: OllamaAnimationDraft[]
}

type JsonSchema = Record<string, unknown>
type OllamaGenerateBody = {
  model: string
  stream: false
  format: JsonSchema | 'json'
  think: false
  options: { temperature: number }
  prompt: string
}

const SET_PATCH_OPERATION_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['op', 'x', 'y', 'colorId'],
  properties: {
    op: { const: 'set' },
    x: { type: 'integer' },
    y: { type: 'integer' },
    colorId: { type: 'string' },
  },
}

const CLEAR_PATCH_OPERATION_SCHEMA: JsonSchema = {
  type: 'object',
  additionalProperties: false,
  required: ['op', 'x', 'y'],
  properties: {
    op: { const: 'clear' },
    x: { type: 'integer' },
    y: { type: 'integer' },
  },
}

export class OllamaPatchProvider implements AiPatchProvider {
  id = 'ollama'
  label = 'Ollama Experimental'
  private options: OllamaPatchProviderOptions

  constructor(options: OllamaPatchProviderOptions) {
    this.options = options
  }

  async requestPatch(request: AiPatchRequest): Promise<PixelPatchOperation[]> {
    const frame = getFrame(request.project, request.frameId)
    const layer = frame ? getLayer(frame, request.layerId) : undefined

    const prompt = buildOllamaPrompt(request, layer ? layerCellsToPixels(layer) : [])

    const response = await postOllamaGenerate(
      this.options.baseUrl,
      {
        model: this.options.model,
        stream: false,
        format: createOllamaPatchSchema(request.constraints.maxOperations ?? 24),
        think: false,
        options: { temperature: 0 },
        prompt,
      },
      this.options.timeoutMs,
    )

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as { response?: string }
    const raw = payload.response?.trim()
    if (!raw) {
      throw new Error('Ollama returned an empty response.')
    }

    let parsed: unknown
    try {
      parsed = parseOllamaPatchResponse(raw)
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : 'Ollama did not return parseable JSON.'}\n\nRaw Ollama response:\n${raw}`,
        { cause: error },
      )
    }
    if (!Array.isArray(parsed)) {
      throw new Error(`${describeUnexpectedPatchShape(parsed)}\n\nRaw Ollama response:\n${raw}`)
    }

    return parsed
  }

  async requestAnimationDraft(
    request: AiPatchRequest & { frameCount?: number },
  ): Promise<OllamaAnimationDraft> {
    if (shouldUseRecipeDraft(request.instruction)) {
      const setDraft = await this.requestAnimationSetDraft({
        ...request,
        variationCount: 1,
      })
      return setDraft.animations[0]
    }

    const frame = getFrame(request.project, request.frameId)
    const layer = frame ? getLayer(frame, request.layerId) : undefined
    const prompt = buildOllamaAnimationDraftPrompt(request, layer ? layerCellsToPixels(layer) : [])

    const response = await postOllamaGenerate(
      this.options.baseUrl,
      {
        model: this.options.model,
        stream: false,
        format: 'json',
        think: false,
        options: { temperature: 0 },
        prompt,
      },
      this.options.timeoutMs,
    )

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as { response?: string }
    const raw = payload.response?.trim()
    if (!raw) {
      throw new Error('Ollama returned an empty response.')
    }

    try {
      return parseOllamaAnimationDraftResponse(raw)
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : 'Ollama did not return a usable animation draft.'}\n\nRaw Ollama response:\n${raw}`,
        { cause: error },
      )
    }
  }

  async requestAnimationSetDraft(
    request: AiPatchRequest & { frameCount?: number; variationCount?: number },
  ): Promise<OllamaAnimationSetDraft> {
    const prompt = buildOllamaRecipeDraftPrompt(request)
    const response = await postOllamaGenerate(
      this.options.baseUrl,
      {
        model: this.options.model,
        stream: false,
        format: 'json',
        think: false,
        options: { temperature: 0 },
        prompt,
      },
      this.options.timeoutMs,
    )

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as { response?: string }
    const raw = payload.response?.trim()
    if (!raw) {
      throw new Error('Ollama returned an empty recipe response.')
    }

    try {
      return expandOllamaRecipeDraft(parseOllamaRecipeDraftResponse(raw), request.project, {
        frameCount: Math.max(3, Math.min(6, Math.round(request.frameCount ?? 4))),
        variationCount: Math.max(1, Math.min(6, Math.round(request.variationCount ?? 1))),
      })
    } catch (error) {
      throw new Error(
        `${error instanceof Error ? error.message : 'Ollama did not return a usable SpriteWrite recipe.'}\n\nRaw Ollama response:\n${raw}`,
        { cause: error },
      )
    }
  }
}

async function postOllamaGenerate(
  baseUrl: string,
  body: OllamaGenerateBody,
  timeoutMs = 120_000,
): Promise<Response> {
  const controller = new AbortController()
  const timeout = globalThis.setTimeout(() => controller.abort(), timeoutMs)

  try {
    return await fetch(`${normalizeOllamaBaseUrl(baseUrl)}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: controller.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new Error(`Ollama request timed out after ${timeoutMs}ms.`, { cause: error })
    }
    throw error
  } finally {
    globalThis.clearTimeout(timeout)
  }
}

function createOllamaPatchSchema(maxOperations: number): JsonSchema {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['patch'],
    properties: {
      patch: {
        type: 'array',
        minItems: 0,
        maxItems: Math.max(0, Math.round(maxOperations)),
        items: {
          oneOf: [SET_PATCH_OPERATION_SCHEMA, CLEAR_PATCH_OPERATION_SCHEMA],
        },
      },
    },
  }
}

function describeUnexpectedPatchShape(parsed: unknown): string {
  if (parsed && typeof parsed === 'object' && 'frames' in parsed) {
    return 'Ollama returned an animation draft object, not a selected-frame patch. Use a broad animation prompt or the draft flow for multi-frame work.'
  }

  const keys = parsed && typeof parsed === 'object' ? Object.keys(parsed).join(', ') : typeof parsed
  return `Ollama response was JSON, but not usable patch operations. Expected [{"op":"set"|"clear",...}] or {"patch":[...]}. Received ${keys || 'unknown shape'}.`
}

function shouldUseRecipeDraft(instruction: string): boolean {
  const normalized = instruction.toLowerCase()
  return (
    normalized.includes('grass') ||
    normalized.includes('hero') ||
    normalized.includes('character') ||
    normalized.includes('cape') ||
    normalized.includes('coin') ||
    normalized.includes('spinning') ||
    normalized.includes('rotating') ||
    normalized.includes('tentacle') ||
    normalized.includes('monster')
  )
}

function parseOllamaRecipeDraftResponse(raw: string): unknown {
  const parsed = parseOllamaPatchResponse(raw)
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Ollama recipe response must be a JSON object.')
  }
  return parsed
}

function expandOllamaRecipeDraft(
  recipe: unknown,
  project: SpriteProject,
  options: { frameCount: number; variationCount: number },
): OllamaAnimationSetDraft {
  if (!recipe || typeof recipe !== 'object' || Array.isArray(recipe)) {
    throw new Error('Ollama recipe response must be an object.')
  }

  const candidate = recipe as Record<string, unknown>
  if (Object.keys(candidate).length === 0) {
    throw new Error(
      'Ollama returned an empty JSON object instead of SpriteWrite recipe data. The model ignored the SpriteWrite recipe contract.',
    )
  }

  if (candidate.recipe === 'grass_wave_tiles') {
    return expandGrassWaveRecipe(candidate, project, options)
  }

  if (candidate.recipe === 'character_idle') {
    return {
      animations: [expandCharacterIdleRecipe(candidate, project, options.frameCount)],
    }
  }

  if (candidate.recipe === 'tentacle_creature_variations') {
    return expandTentacleCreatureRecipe(candidate, project, options)
  }

  if (candidate.recipe === 'spinning_object') {
    return {
      animations: [expandSpinningObjectRecipe(candidate, project, options.frameCount)],
    }
  }

  if ('frames' in candidate && Array.isArray(candidate.frames)) {
    return {
      animations: [parseOllamaAnimationDraftObject(candidate)],
    }
  }

  throw new Error(`Unsupported SpriteWrite recipe "${String(candidate.recipe)}".`)
}


function expandSpinningObjectRecipe(recipe: Record<string, unknown>, project: SpriteProject, frameCount: number): OllamaAnimationDraft {
  const requestedFrameCount = Math.max(3, Math.min(6, frameCount))
  const frames = Array.isArray(recipe.frames) ? recipe.frames : []
  const material = typeof recipe.material === 'string' ? recipe.material.toLowerCase() : ''
  const paletteAdditions = createSpinningObjectPaletteAdditions(material, recipe)
  const colorIds = getSpinningObjectColorIds(project, paletteAdditions, material)
  const fallbackWidths = [10, 5, 3, 5, 10, 5]

  return {
    animationName: typeof recipe.animationName === 'string' && recipe.animationName.trim() ? recipe.animationName.trim() : material.includes('gold') ? 'Gold Spin' : 'Object Spin',
    fps: typeof recipe.fps === 'number' && Number.isFinite(recipe.fps) ? Math.max(1, Math.round(recipe.fps)) : 8,
    paletteAdditions,
    frames: Array.from({ length: requestedFrameCount }, (_, index) => {
      const sourceFrame = frames[index] && typeof frames[index] === 'object' ? (frames[index] as Record<string, unknown>) : {}
      const width = clampInteger(sourceFrame.width, 2, Math.min(14, project.canvas.width), fallbackWidths[index % fallbackWidths.length])
      const height = clampInteger(sourceFrame.height, 6, Math.min(16, project.canvas.height), 12)
      const highlightX = clampInteger(sourceFrame.highlightX, -6, 6, index % 2 === 0 ? -3 : 1)
      const shadowX = clampInteger(sourceFrame.shadowX, -6, 6, index % 2 === 0 ? 3 : -1)
      const frameName = typeof sourceFrame.name === 'string' ? sourceFrame.name : ''
      const animationName = typeof recipe.animationName === 'string' ? recipe.animationName : 'Spin'
      return {
        name: frameName || animationName + ' ' + String(index + 1).padStart(3, '0'),
        durationMs: 125,
        patch: createSpinningObjectPatch(project, { width, height, highlightX, shadowX, colors: colorIds }),
      }
    }),
  }
}

function createSpinningObjectPaletteAdditions(material: string, recipe: Record<string, unknown>): PaletteColor[] {
  const explicit = parsePaletteAdditions(recipe.paletteAdditions)
  if (explicit?.length) {
    return explicit
  }
  if (material.includes('gold') || material.includes('coin')) {
    return [
      { id: 'asset_gold_shadow', name: 'Asset Gold Shadow', hex: '#7a4d10' },
      { id: 'asset_gold', name: 'Asset Gold', hex: '#d99a1e' },
      { id: 'asset_gold_light', name: 'Asset Gold Light', hex: '#f6c945' },
      { id: 'asset_gold_highlight', name: 'Asset Gold Highlight', hex: '#fff0a8' },
    ]
  }
  return []
}

function getSpinningObjectColorIds(project: SpriteProject, additions: PaletteColor[], material: string) {
  const ids = new Set([...project.palette.map((color) => color.id), ...additions.map((color) => color.id)])
  const first = project.palette.find((color) => !color.isTransparent)?.id ?? 'accent'
  const pick = (...candidates: string[]) => candidates.find((candidate) => ids.has(candidate)) ?? first
  const isGold = material.includes('gold') || material.includes('coin') || additions.some((color) => color.id.includes('gold'))
  return {
    outline: pick('ink', 'outline', 'charcoal', 'shadow'),
    shadow: isGold ? pick('asset_gold_shadow', 'coin_shadow', 'shadow', 'charcoal') : pick('shadow', 'charcoal', 'mid_gray'),
    mid: isGold ? pick('asset_gold', 'coin_gold', 'accent') : pick('accent', 'mid_gray', first),
    light: isGold ? pick('asset_gold_light', 'coin_light', 'light_gray') : pick('light_gray', 'white', 'accent'),
    highlight: isGold ? pick('asset_gold_highlight', 'coin_highlight', 'white') : pick('white', 'light_gray', 'accent'),
  }
}

function createSpinningObjectPatch(
  project: SpriteProject,
  options: { width: number; height: number; highlightX: number; shadowX: number; colors: { outline: string; shadow: string; mid: string; light: string; highlight: string } },
): PixelPatchOperation[] {
  const cx = Math.floor(project.canvas.width / 2)
  const cy = Math.floor(project.canvas.height / 2)
  const rx = Math.max(1, options.width / 2)
  const ry = Math.max(3, options.height / 2)
  const cells = new Map<string, string>()
  for (let y = Math.max(0, Math.floor(cy - ry - 1)); y <= Math.min(project.canvas.height - 1, Math.ceil(cy + ry + 1)); y += 1) {
    for (let x = Math.max(0, Math.floor(cx - rx - 1)); x <= Math.min(project.canvas.width - 1, Math.ceil(cx + rx + 1)); x += 1) {
      const nx = (x - cx) / rx
      const ny = (y - cy) / ry
      const distance = nx * nx + ny * ny
      if (distance <= 1.08) {
        const edge = distance > 0.76
        const highlight = Math.abs(x - (cx + options.highlightX)) <= 1 && y <= cy + 1 && y >= cy - Math.floor(ry)
        const shadow = Math.abs(x - (cx + options.shadowX)) <= 1 && y >= cy
        const colorId = edge ? options.colors.outline : highlight ? options.colors.highlight : shadow ? options.colors.shadow : y < cy ? options.colors.light : options.colors.mid
        setRecipeCell(cells, x, y, colorId, project)
      }
    }
  }
  return mapCellsToPatch(cells)
}

function expandGrassWaveRecipe(
  recipe: Record<string, unknown>,
  project: SpriteProject,
  options: { frameCount: number; variationCount: number },
): OllamaAnimationSetDraft {
  const variations = Array.isArray(recipe.variations) ? recipe.variations : []

  return {
    animations: Array.from({ length: options.variationCount }, (_, index) => {
      const variation =
        variations[index] && typeof variations[index] === 'object'
          ? (variations[index] as Record<string, unknown>)
          : {}
      const sourceFrame =
        Array.isArray(variation.frames) && variation.frames[0] && typeof variation.frames[0] === 'object'
          ? (variation.frames[0] as Record<string, unknown>)
          : {}
      const blades = normalizeGrassBlades(sourceFrame.blades, index)

      return {
        animationName:
          typeof variation.animationName === 'string'
            ? variation.animationName
            : `Grass ${String.fromCharCode(65 + index)}`,
        fps: typeof recipe.fps === 'number' && Number.isFinite(recipe.fps) ? Math.round(recipe.fps) : 4,
        frames: Array.from({ length: options.frameCount }, (_, frameIndex) => {
          const windCycle = [-1, 0, 1, 0, -1, 1]
          const wind = windCycle[frameIndex % windCycle.length]
          const animationName =
            typeof variation.animationName === 'string'
              ? variation.animationName
              : `Grass ${String.fromCharCode(65 + index)}`

          return {
            name: `${animationName} ${String(frameIndex + 1).padStart(3, '0')}`,
            durationMs: 250,
            patch: createGrassPatch(project, blades, wind),
          }
        }),
      }
    }),
  }
}

function normalizeGrassBlades(input: unknown, variationIndex: number) {
  if (Array.isArray(input) && input.length >= 4) {
    return input.map((blade, index) => {
      const candidate = blade && typeof blade === 'object' ? (blade as Record<string, unknown>) : {}
      return {
        x: clampInteger(candidate.x, 0, 31, defaultBladeX(index)),
        baseY: clampInteger(candidate.baseY, 24, 31, 31),
        height: clampInteger(candidate.height, 2, 8, 4),
        lean: clampInteger(candidate.lean, -2, 2, 0),
      }
    })
  }

  return Array.from({ length: 8 }, (_, index) => ({
    x: defaultBladeX(index),
    baseY: 31 - ((index + variationIndex) % 3),
    height: 3 + ((index + variationIndex) % 4),
    lean: ((index + variationIndex) % 3) - 1,
  }))
}

function defaultBladeX(index: number): number {
  return [0, 3, 7, 12, 16, 21, 27, 31][index % 8]
}

function createGrassPatch(
  project: SpriteProject,
  blades: Array<{ x: number; baseY: number; height: number; lean: number }>,
  wind: number,
): PixelPatchOperation[] {
  const colors = getRecipeColors(project)
  const cells = new Map<string, string>()

  blades.forEach((blade, index) => {
    const tipX = blade.x + blade.lean + wind
    const tipY = blade.baseY - blade.height
    const steps = Math.max(1, blade.height)
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps
      const x = Math.round(blade.x + (tipX - blade.x) * t)
      const y = Math.round(blade.baseY + (tipY - blade.baseY) * t)
      const color = step === steps ? colors.highlight : index % 3 === 0 ? colors.shadow : colors.accent
      setRecipeCell(cells, x, y, color, project)
    }
    setRecipeCell(cells, blade.x, blade.baseY, colors.mid, project)
  })

  return mapCellsToPatch(cells)
}

function expandCharacterIdleRecipe(
  recipe: Record<string, unknown>,
  project: SpriteProject,
  frameCount: number,
): OllamaAnimationDraft {
  const frames = Array.isArray(recipe.frames) ? recipe.frames : []
  const requestedFrameCount = Math.max(3, Math.min(6, frameCount))
  const fallbackBob = [0, 1, 0, -1, 0, 1]

  return {
    animationName: typeof recipe.animationName === 'string' ? recipe.animationName : 'Hero Idle',
    fps: typeof recipe.fps === 'number' && Number.isFinite(recipe.fps) ? Math.round(recipe.fps) : 4,
    frames: Array.from({ length: requestedFrameCount }, (_, index) => {
      const frame = frames[index] && typeof frames[index] === 'object' ? (frames[index] as Record<string, unknown>) : {}
      const bob = clampInteger(frame.bob, -1, 1, fallbackBob[index % fallbackBob.length])
      const capeLean = clampInteger(frame.capeLean, -2, 2, index % 2 === 0 ? -1 : 1)
      const headTilt = clampInteger(frame.headTilt, -2, 2, 0)
      const armPose = clampInteger(frame.armPose, -2, 2, index % 2 === 0 ? 0 : 1)

      return {
        name: typeof frame.name === 'string' ? frame.name : `Hero Idle ${String(index + 1).padStart(3, '0')}`,
        durationMs: 250,
        patch: createCharacterIdlePatch(project, { bob, capeLean, headTilt, armPose }),
      }
    }),
  }
}

function createCharacterIdlePatch(
  project: SpriteProject,
  options: { bob: number; capeLean: number; headTilt: number; armPose: number },
): PixelPatchOperation[] {
  const cx = Math.floor(project.canvas.width / 2)
  const baseY = Math.min(project.canvas.height - 5, Math.floor(project.canvas.height * 0.72))
  const y = options.bob
  const colors = getRecipeColors(project)
  const cells = new Map<string, string>()

  // Cape/back silhouette.
  for (let row = 0; row < 7; row += 1) {
    const capeX = cx - 4 + Math.round((row / 6) * options.capeLean)
    setRecipeCell(cells, capeX, baseY - 9 + row + y, colors.shadow, project)
    setRecipeCell(cells, capeX - 1, baseY - 8 + row + y, colors.shadow, project)
  }

  // Legs.
  ;[
    [cx - 2, baseY - 2],
    [cx - 2, baseY - 1],
    [cx - 3, baseY],
    [cx + 2, baseY - 2],
    [cx + 2, baseY - 1],
    [cx + 3, baseY],
  ].forEach(([cellX, cellY]) => setRecipeCell(cells, cellX, cellY + y, colors.ink, project))

  // Torso and outline.
  for (let row = 0; row < 6; row += 1) {
    for (let col = -2; col <= 2; col += 1) {
      const edge = Math.abs(col) === 2 || row === 0 || row === 5
      setRecipeCell(cells, cx + col, baseY - 8 + row + y, edge ? colors.ink : colors.accent, project)
    }
  }

  // Arms.
  const armOffset = options.armPose > 0 ? 1 : options.armPose < 0 ? -1 : 0
  ;[
    [cx - 3, baseY - 7],
    [cx - 4, baseY - 6 + armOffset],
    [cx + 3, baseY - 7],
    [cx + 4, baseY - 6 - armOffset],
  ].forEach(([cellX, cellY]) => setRecipeCell(cells, cellX, cellY + y, colors.ink, project))

  // Head.
  const headY = baseY - 12 + y
  for (let row = -1; row <= 1; row += 1) {
    for (let col = -1; col <= 1; col += 1) {
      setRecipeCell(cells, cx + col + Math.sign(options.headTilt), headY + row, colors.mid, project)
    }
  }
  setRecipeCell(cells, cx - 1 + Math.sign(options.headTilt), headY - 2, colors.ink, project)
  setRecipeCell(cells, cx + 1 + Math.sign(options.headTilt), headY - 2, colors.ink, project)
  setRecipeCell(cells, cx - 1 + Math.sign(options.headTilt), headY, colors.highlight, project)

  return mapCellsToPatch(cells)
}

function expandTentacleCreatureRecipe(
  recipe: Record<string, unknown>,
  project: SpriteProject,
  options: { frameCount: number; variationCount: number },
): OllamaAnimationSetDraft {
  const variations = Array.isArray(recipe.variations) ? recipe.variations : []

  return {
    animations: Array.from({ length: options.variationCount }, (_, index) => {
      const variation =
        variations[index] && typeof variations[index] === 'object'
          ? (variations[index] as Record<string, unknown>)
          : {}
      const animationName =
        typeof variation.animationName === 'string'
          ? variation.animationName
          : `Tentacle ${String.fromCharCode(65 + index)}`
      const base = normalizeTentacleCreature(variation, index)

      return {
        animationName,
        fps: typeof recipe.fps === 'number' && Number.isFinite(recipe.fps) ? Math.round(recipe.fps) : 4,
        frames: Array.from({ length: options.frameCount }, (_, frameIndex) => {
          const wiggle = [-1, 0, 1, 0, -1, 1][frameIndex % 6]

          return {
            name: `${animationName} ${String(frameIndex + 1).padStart(3, '0')}`,
            durationMs: 250,
            patch: createTentacleCreaturePatch(project, base, wiggle),
          }
        }),
      }
    }),
  }
}

function normalizeTentacleCreature(input: Record<string, unknown>, variationIndex: number) {
  const tentacles = Array.isArray(input.tentacles) ? input.tentacles : []
  const fallbackAnchors = ['left', 'right', 'bottom', 'top', 'left', 'right']
  const normalizedTentacles = Array.from({ length: Math.max(3, Math.min(6, tentacles.length || 4)) }, (_, index) => {
    const candidate = tentacles[index] && typeof tentacles[index] === 'object' ? (tentacles[index] as Record<string, unknown>) : {}
    const anchor = typeof candidate.anchor === 'string' ? candidate.anchor : fallbackAnchors[index]

    return {
      anchor: ['left', 'right', 'bottom', 'top'].includes(anchor) ? anchor : fallbackAnchors[index],
      length: clampInteger(candidate.length, 3, 9, 5 + ((index + variationIndex) % 3)),
      curl: clampInteger(candidate.curl, -2, 2, ((index + variationIndex) % 5) - 2),
    }
  })

  return {
    bodyRx: clampInteger(input.bodyRx, 3, 7, 5),
    bodyRy: clampInteger(input.bodyRy, 3, 6, 4),
    eyeCount: clampInteger(input.eyeCount, 1, 3, 1 + (variationIndex % 2)),
    tentacles: normalizedTentacles,
  }
}

function createTentacleCreaturePatch(
  project: SpriteProject,
  creature: {
    bodyRx: number
    bodyRy: number
    eyeCount: number
    tentacles: Array<{ anchor: string; length: number; curl: number }>
  },
  wiggle: number,
): PixelPatchOperation[] {
  const cx = Math.floor(project.canvas.width / 2)
  const cy = Math.floor(project.canvas.height * 0.56)
  const colors = getRecipeColors(project)
  const cells = new Map<string, string>()

  for (let y = cy - creature.bodyRy; y <= cy + creature.bodyRy; y += 1) {
    for (let x = cx - creature.bodyRx; x <= cx + creature.bodyRx; x += 1) {
      const normalized = ((x - cx) / creature.bodyRx) ** 2 + ((y - cy) / creature.bodyRy) ** 2
      if (normalized <= 1) {
        const edge = normalized > 0.68
        cells.set(`${x},${y}`, edge ? colors.ink : colors.accent)
      }
    }
  }

  creature.tentacles.forEach((tentacle, index) => {
    const start = getTentacleAnchor(cx, cy, creature.bodyRx, creature.bodyRy, tentacle.anchor, index)
    const direction = getTentacleDirection(tentacle.anchor)
    const side = index % 2 === 0 ? -1 : 1
    const end = {
      x: start.x + direction.x * tentacle.length + (tentacle.curl + wiggle) * side,
      y: start.y + direction.y * tentacle.length + Math.abs(tentacle.curl + wiggle),
    }
    drawRecipeLine(cells, start.x, start.y, end.x, end.y, index % 2 === 0 ? colors.shadow : colors.mid, project)
    setRecipeCell(cells, Math.round(end.x), Math.round(end.y), colors.highlight, project)
  })

  const eyeOffsets = creature.eyeCount === 1 ? [0] : creature.eyeCount === 2 ? [-2, 2] : [-3, 0, 3]
  eyeOffsets.forEach((offset) => {
    setRecipeCell(cells, cx + offset, cy - 1, colors.highlight, project)
    setRecipeCell(cells, cx + offset, cy, colors.ink, project)
  })

  return mapCellsToPatch(cells)
}

function getTentacleAnchor(
  cx: number,
  cy: number,
  bodyRx: number,
  bodyRy: number,
  anchor: string,
  index: number,
) {
  if (anchor === 'left') {
    return { x: cx - bodyRx, y: cy + ((index % 3) - 1) }
  }
  if (anchor === 'right') {
    return { x: cx + bodyRx, y: cy + ((index % 3) - 1) }
  }
  if (anchor === 'top') {
    return { x: cx + ((index % 3) - 1), y: cy - bodyRy }
  }
  return { x: cx + ((index % 3) - 1), y: cy + bodyRy }
}

function getTentacleDirection(anchor: string) {
  if (anchor === 'left') {
    return { x: -1, y: 0 }
  }
  if (anchor === 'right') {
    return { x: 1, y: 0 }
  }
  if (anchor === 'top') {
    return { x: 0, y: -1 }
  }
  return { x: 0, y: 1 }
}

function drawRecipeLine(
  cells: Map<string, string>,
  startX: number,
  startY: number,
  endX: number,
  endY: number,
  colorId: string,
  project: SpriteProject,
) {
  const steps = Math.max(Math.abs(Math.round(endX - startX)), Math.abs(Math.round(endY - startY)), 1)
  for (let step = 0; step <= steps; step += 1) {
    const t = step / steps
    setRecipeCell(
      cells,
      Math.round(startX + (endX - startX) * t),
      Math.round(startY + (endY - startY) * t),
      colorId,
      project,
    )
  }
}

function getRecipeColors(project: SpriteProject) {
  const ids = new Set(project.palette.map((color) => color.id))
  const first = project.palette.find((color) => !color.isTransparent)?.id ?? 'accent'
  const pick = (...candidates: string[]) => candidates.find((candidate) => ids.has(candidate)) ?? first

  return {
    ink: pick('ink', 'outline', 'charcoal', 'shadow'),
    shadow: pick('shadow', 'charcoal', 'mid_gray'),
    mid: pick('mid_gray', 'slime_mid', 'accent'),
    accent: pick('accent', 'gold', 'slime_light', first),
    highlight: pick('white', 'light_gray', 'slime_highlight', 'accent'),
  }
}

function setRecipeCell(cells: Map<string, string>, x: number, y: number, colorId: string, project: SpriteProject) {
  if (x >= 0 && y >= 0 && x < project.canvas.width && y < project.canvas.height) {
    cells.set(`${x},${y}`, colorId)
  }
}

function mapCellsToPatch(cells: Map<string, string>): PixelPatchOperation[] {
  return Array.from(cells.entries()).map(([key, colorId]) => {
    const [x, y] = key.split(',').map(Number)
    return { op: 'set', x, y, colorId }
  })
}

function clampInteger(value: unknown, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value) || typeof value !== 'number') {
    return fallback
  }
  return Math.max(min, Math.min(max, Math.round(value)))
}

export async function testOllamaConnection(baseUrl: string): Promise<string> {
  const models = await listOllamaModels(baseUrl)
  const names = models.map((model) => model.name).join(', ')
  return names ? `Connected. Models: ${names}` : 'Connected. No models reported.'
}

export async function listOllamaModels(baseUrl: string): Promise<OllamaModelInfo[]> {
  const response = await fetch(`${normalizeOllamaBaseUrl(baseUrl)}/api/tags`)
  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status} ${response.statusText}`)
  }
  const payload = (await response.json()) as {
    models?: Array<{
      name: string
      modified_at?: string
      size?: number
      capabilities?: string[]
      details?: {
        family?: string
        families?: string[]
        parameter_size?: string
      }
    }>
  }

  const normalizedModels: OllamaModelInfo[] = []
  const seenNames = new Set<string>()

  for (const model of payload.models ?? []) {
    if (typeof model.name !== 'string') {
      continue
    }

    const name = model.name.trim()
    const normalizedName = name.toLowerCase()
    if (!name || seenNames.has(normalizedName)) {
      continue
    }

    const family = model.details?.family
    const families = model.details?.families?.filter((item): item is string => typeof item === 'string') ?? []
    const derivedCapabilities = new Set(model.capabilities ?? [])
    if (families.includes('clip')) {
      derivedCapabilities.add('vision')
    }
    if (family) {
      derivedCapabilities.add('completion')
    }

    normalizedModels.push({
      name,
      modifiedAt: model.modified_at,
      size: model.size,
      capabilities: Array.from(derivedCapabilities),
      family,
      families,
      parameterSize: model.details?.parameter_size,
    })
    seenNames.add(normalizedName)
  }

  return normalizedModels
}

export async function pullOllamaModel(baseUrl: string, modelName: string): Promise<string> {
  const name = modelName.trim()
  if (!name) {
    throw new Error('Choose or enter an Ollama model name first.')
  }

  const response = await fetch(`${normalizeOllamaBaseUrl(baseUrl)}/api/pull`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name, stream: false }),
  })

  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status} ${response.statusText}`)
  }

  return `Downloaded ${name}.`
}

export function parseOllamaPatchResponse(raw: string): unknown {
  const trimmed = raw.trim()
  const withoutFence = trimmed
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  try {
    const parsed = JSON.parse(withoutFence)
    if (Array.isArray(parsed)) {
      return parsed
    }
    if (parsed && typeof parsed === 'object' && 'patch' in parsed) {
      return (parsed as { patch: unknown }).patch
    }
    if (parsed && typeof parsed === 'object' && 'operations' in parsed) {
      return (parsed as { operations: unknown }).operations
    }
    if (parsed && typeof parsed === 'object' && 'ops' in parsed) {
      return (parsed as { ops: unknown }).ops
    }
    if (parsed && typeof parsed === 'object' && 'patchOperations' in parsed) {
      return (parsed as { patchOperations: unknown }).patchOperations
    }
    if (parsed && typeof parsed === 'object' && 'patch_operations' in parsed) {
      return (parsed as { patch_operations: unknown }).patch_operations
    }
    if (isPatchOperationObject(parsed)) {
      return [parsed]
    }
    return parsed
  } catch {
    const arrayStart = withoutFence.indexOf('[')
    const arrayEnd = withoutFence.lastIndexOf(']')
    if (arrayStart >= 0 && arrayEnd > arrayStart) {
      return JSON.parse(withoutFence.slice(arrayStart, arrayEnd + 1))
    }
    throw new Error('Ollama did not return parseable JSON patch operations.')
  }
}

function isPatchOperationObject(value: unknown): value is PixelPatchOperation {
  return (
    !!value &&
    typeof value === 'object' &&
    'op' in value &&
    ((value as { op?: unknown }).op === 'set' || (value as { op?: unknown }).op === 'clear')
  )
}

export function parseOllamaAnimationDraftResponse(raw: string): OllamaAnimationDraft {
  const parsed = parseOllamaPatchResponse(raw)
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) && Object.keys(parsed).length === 0) {
    throw new Error(
      'Ollama returned an empty JSON object instead of animation draft frames. The model ignored the SpriteWrite schema.',
    )
  }

  const draft =
    parsed && typeof parsed === 'object' && !Array.isArray(parsed) && 'frames' in parsed
      ? (parsed as { animationName?: unknown; fps?: unknown; frames?: unknown })
      : undefined

  if (!draft || !Array.isArray(draft.frames)) {
    throw new Error('Ollama response was JSON, but not an animation draft with frames.')
  }

  return parseOllamaAnimationDraftObject(draft)
}

function parseOllamaAnimationDraftObject(draft: {
  animationName?: unknown
  fps?: unknown
  paletteAdditions?: unknown
  frames?: unknown
}): OllamaAnimationDraft {
  if (!Array.isArray(draft.frames)) {
    throw new Error('Ollama response was JSON, but not an animation draft with frames.')
  }

  const frames = draft.frames.map((frame, index) => {
    if (!frame || typeof frame !== 'object') {
      throw new Error(`Ollama draft frame ${index + 1} was not an object.`)
    }
    const candidate = frame as { name?: unknown; durationMs?: unknown; patch?: unknown; operations?: unknown }
    const patch = candidate.patch ?? candidate.operations
    if (!Array.isArray(patch)) {
      throw new Error(`Ollama draft frame ${index + 1} did not include a patch array.`)
    }

    return {
      name: typeof candidate.name === 'string' ? candidate.name : `Draft ${index + 1}`,
      durationMs:
        typeof candidate.durationMs === 'number' && Number.isFinite(candidate.durationMs)
          ? Math.max(1, Math.round(candidate.durationMs))
          : 250,
      patch: patch as PixelPatchOperation[],
    }
  })

  return {
    animationName: typeof draft.animationName === 'string' ? draft.animationName : undefined,
    fps: typeof draft.fps === 'number' && Number.isFinite(draft.fps) ? Math.max(1, Math.round(draft.fps)) : undefined,
    paletteAdditions: parsePaletteAdditions(draft.paletteAdditions),
    frames,
  }
}

function parsePaletteAdditions(input: unknown): PaletteColor[] | undefined {
  if (input === undefined) {
    return undefined
  }
  if (!Array.isArray(input)) {
    throw new Error('Ollama draft paletteAdditions must be an array when provided.')
  }

  return input.map((color, index) => {
    if (!color || typeof color !== 'object') {
      throw new Error(`Ollama draft paletteAdditions item ${index + 1} was not an object.`)
    }
    const candidate = color as { id?: unknown; name?: unknown; hex?: unknown }
    if (typeof candidate.id !== 'string' || typeof candidate.name !== 'string' || typeof candidate.hex !== 'string') {
      throw new Error(`Ollama draft paletteAdditions item ${index + 1} must include id, name, and hex strings.`)
    }

    return {
      id: candidate.id,
      name: candidate.name,
      hex: candidate.hex,
    }
  })
}

function buildOllamaPrompt(
  request: AiPatchRequest,
  currentCells: Array<{ x: number; y: number; colorId: string }>,
): string {
  return `You are editing a pixel sprite represented as grid cells.
Return JSON only. Return exactly { "patch": [...] }.
Allowed operations:
set: { "op": "set", "x": number, "y": number, "colorId": string }
clear: { "op": "clear", "x": number, "y": number }

Rules:
- Coordinates must be within canvas bounds.
- colorId must be one of the provided palette IDs.
- Do not invent colors.
- Do not resize the canvas.
- Do not return markdown.
- Do not return explanations.
- Do not return an image.
- Do not alter hidden layers.
- Keep the sprite readable at small size.
- Return at most ${request.constraints.maxOperations ?? 24} operations.
- This endpoint edits only the selected frame and layer.
- Do not create a whole character, animation, spritesheet, or atlas here.
- Do not scatter isolated pixels. Keep changes spatially coherent and near the current sprite.
- Do not use placeholder marks, X marks, labels, arrows, or diagnostic symbols.
- If the requested edit cannot be done as a small selected-frame patch, return [].

Canvas: ${request.project.canvas.width}x${request.project.canvas.height}
Palette IDs: ${request.project.palette.map((color) => color.id).join(', ')}
Selected color: ${request.constraints.selectedColorId}
Instruction: ${request.instruction}
Current layer cells JSON:
${JSON.stringify(currentCells)}
`
}

function buildOllamaAnimationDraftPrompt(
  request: AiPatchRequest & { frameCount?: number },
  currentCells: Array<{ x: number; y: number; colorId: string }>,
): string {
  const requestedFrameCount = Math.max(3, Math.min(6, Math.round(request.frameCount ?? 4)))
  const preferredMaxOperations = Math.min(64, request.constraints.maxOperations ?? 64)
  return `Return JSON only. No markdown. No prose.

Task: ${request.instruction}
Canvas: ${request.project.canvas.width}x${request.project.canvas.height}
Palette IDs: ${request.project.palette.map((color) => color.id).join(', ')}

Return exactly this shape:
{"animationName":"Name","fps":4,"paletteAdditions":[{"id":"asset_gold","name":"Asset Gold","hex":"#d99a1e"}],"frames":[{"name":"Frame 001","durationMs":250,"patch":[{"op":"set","x":15,"y":15,"colorId":"accent"}]}]}

Rules:
- Return exactly ${requestedFrameCount} frames.
- Each frame patch must draw the full visible frame on a blank layer.
- Use only set operations.
- Each operation must be exactly {"op":"set","x":number,"y":number,"colorId":string}.
- Do not include width, height, radius, size, alpha, labels, markdown, prose, images, or invented colors.
- Operation colorId must be one of the provided palette IDs or one of your paletteAdditions IDs.
- If the current palette lacks colors clearly needed by the requested asset, include 1 to 6 paletteAdditions with stable lowercase IDs, readable names, and valid #rrggbb hex values.
- Coordinates must be integers inside the ${request.project.canvas.width}x${request.project.canvas.height} canvas.
- Use 8 to ${preferredMaxOperations} set operations per frame.
- Keep the sprite centered and coherent, not scattered.
- For rotating/spinning assets, vary silhouette width and highlight position across frames.

Current cells: ${JSON.stringify(currentCells)}
`
}

function buildOllamaRecipeDraftPrompt(
  request: AiPatchRequest & { frameCount?: number; variationCount?: number },
): string {
  const normalized = request.instruction.toLowerCase()
  const frameCount = Math.max(3, Math.min(6, Math.round(request.frameCount ?? 4)))
  const variationCount = Math.max(1, Math.min(6, Math.round(request.variationCount ?? 1)))

  if (normalized.includes('grass')) {
    return `Return JSON only. No markdown. No cells.
SpriteWrite padded request:
${request.instruction}
Return exactly this shape:
{"recipe":"grass_wave_tiles","fps":4,"variations":[{"animationName":"Grass A","frames":[{"name":"Grass A 001","wind":-1,"blades":[{"x":0,"baseY":31,"height":4,"lean":-1}]}]}]}

Rules:
- Return exactly ${variationCount} variations.
- Each variation may return one base frame; SpriteWrite will expand it into ${frameCount} animation frames.
- Each base frame must have 6 to 10 blades.
- Blade x is 0-31, baseY is 28-31, height is 2-8, lean is -2 to 2.
- Include blades near x 0 and x 31 so the tile can repeat.
- No patch arrays, no width/height, no prose.`
  }

  if (normalized.includes('tentacle') || normalized.includes('monster')) {
    return `Return JSON only. No markdown. No cells.
SpriteWrite padded request:
${request.instruction}
Return exactly this shape:
{"recipe":"tentacle_creature_variations","fps":4,"variations":[{"animationName":"Tentacle A","bodyRx":5,"bodyRy":4,"eyeCount":1,"tentacles":[{"anchor":"left","length":6,"curl":-1},{"anchor":"right","length":6,"curl":1}]}]}

Rules:
- Return exactly ${variationCount} variations.
- Each variation may return one base creature; SpriteWrite will expand it into ${frameCount} animation frames.
- bodyRx is 3-7, bodyRy is 3-6, eyeCount is 1-3.
- tentacles must have 3 to 6 items.
- anchor is one of left, right, bottom, top.
- length is 3-9, curl is -2 to 2.
- No patch arrays, no width/height, no prose.`
  }

  if (normalized.includes('hero') || normalized.includes('character') || normalized.includes('cape')) {
    return `Return JSON only. No markdown. No cells.
SpriteWrite padded request:
${request.instruction}
Return exactly this shape:
{"recipe":"character_idle","animationName":"Hero Idle","fps":4,"frames":[{"name":"Hero Idle 001","bob":0,"capeLean":-1,"headTilt":0,"armPose":0}]}

Rules:
- Return exactly ${frameCount} frames.
- bob is -1, 0, or 1.
- capeLean, headTilt, and armPose are integers from -2 to 2.
- Keep the same character identity across frames.
- No patch arrays, no width/height, no prose.`
  }


  if (normalized.includes('coin') || normalized.includes('spinning') || normalized.includes('rotating')) {
    return `Return JSON only. No markdown. No cells.
SpriteWrite padded request:
${request.instruction}
Return exactly this shape:
{"recipe":"spinning_object","animationName":"Gold Coin","fps":8,"material":"gold","frames":[{"name":"Spin 001","width":10,"height":12,"highlightX":-3,"shadowX":3},{"name":"Spin 002","width":5,"height":12,"highlightX":0,"shadowX":2}]}

Rules:
- Return exactly ${frameCount} frames.
- This is a compact recipe, not patch operations.
- width is 2-14. Use wide/narrow/wide/narrow rhythm for rotation.
- height is 6-16 and should stay mostly stable.
- highlightX and shadowX are offsets from the centered object, -6 to 6.
- material should match the user request when obvious, such as gold, silver, copper, gem, crystal, fire, ice, leaf, or generic.
- No patch arrays, no colorId fields, no transparent operations, no prose.`
  }

  return `Return JSON only. No markdown. No prose.
SpriteWrite padded request:
${request.instruction}
Return exactly this shape:
{"animationName":"Asset Draft","fps":4,"paletteAdditions":[{"id":"asset_gold","name":"Asset Gold","hex":"#d99a1e"}],"frames":[{"name":"Asset Draft 001","durationMs":250,"patch":[{"op":"set","x":15,"y":15,"colorId":"accent"}]}]}

Rules:
- Return exactly ${frameCount} frames.
- Each frame patch must draw the full visible frame on a blank layer.
- Use only set operations.
- colorId must be one of the provided palette IDs or one of your paletteAdditions IDs.
- If the current palette lacks colors clearly needed by the requested asset, include 1 to 6 paletteAdditions with stable lowercase IDs, readable names, and valid #rrggbb hex values.
- Do not include width/height fields, markdown, prose, labels, placeholder marks, or raster image data.`
}

function normalizeOllamaBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '')
}
