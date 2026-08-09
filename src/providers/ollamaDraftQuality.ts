import { addPaletteColorToProject, cloneProject, getColor, validatePatch } from '../domain/spriteData'
import type { AiPatchRequest } from './aiPatchProvider'
import type { PaletteColor, PixelPatchOperation, SpriteProject } from '../domain/spriteTypes'
import type {
  OllamaAnimationDraft,
  OllamaAnimationSetDraft,
  OllamaPatchProvider,
} from './ollamaPatchProvider'

export interface OllamaDraftQualityAttempt<TDraft> {
  attempt: number
  draft?: TDraft
  errors: string[]
}

export interface OllamaDraftQualityResult<TDraft> {
  draft: TDraft
  attempts: Array<OllamaDraftQualityAttempt<TDraft>>
}

export interface OllamaDraftQualityOptions {
  maxAttempts?: number
}

export class OllamaDraftQualityError<TDraft> extends Error {
  attempts: Array<OllamaDraftQualityAttempt<TDraft>>

  constructor(message: string, attempts: Array<OllamaDraftQualityAttempt<TDraft>>) {
    super(message)
    this.name = 'OllamaDraftQualityError'
    this.attempts = attempts
  }
}

interface EvaluationContext {
  project: SpriteProject
  animationId: string
  frameId: string
  layerId: string
  userInstruction: string
  requestedFrameCount: number
  requestedVariationCount?: number
  allowDistributed?: boolean
}

interface FrameStats {
  setCount: number
  uniqueCellCount: number
  minX: number
  maxX: number
  minY: number
  maxY: number
  width: number
  height: number
  centerX: number
  centerY: number
  signature: string
  usedColorIds: Set<string>
}

export async function requestImprovedAnimationDraft(
  provider: OllamaPatchProvider,
  request: AiPatchRequest & { frameCount?: number },
  context: EvaluationContext,
  options: OllamaDraftQualityOptions = {},
): Promise<OllamaDraftQualityResult<OllamaAnimationDraft>> {
  const maxAttempts = normalizeMaxAttempts(options.maxAttempts)
  const attempts: Array<OllamaDraftQualityAttempt<OllamaAnimationDraft>> = []
  let instruction = request.instruction

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const draft = await provider.requestAnimationDraft({
      ...request,
      instruction,
    })
    const errors = evaluateAnimationDraft(draft, context)
    attempts.push({ attempt, draft, errors })

    if (!errors.length) {
      return { draft, attempts }
    }

    instruction = buildRepairInstruction(request.instruction, errors, attempt + 1)
  }

  if (shouldTryRecipeFallback(context.userInstruction)) {
    const fallbackAttempt = attempts.length + 1
    try {
      const setDraft = await provider.requestAnimationSetDraft({
        ...request,
        instruction: buildRecipeFallbackInstruction(request.instruction, attempts),
        variationCount: 1,
      })
      const draft = setDraft.animations[0]
      if (!draft) {
        attempts.push({
          attempt: fallbackAttempt,
          errors: ['SpriteWrite recipe fallback did not return an animation row.'],
        })
      } else {
        const errors = evaluateAnimationDraft(draft, context)
        attempts.push({ attempt: fallbackAttempt, draft, errors })
        if (!errors.length) {
          return { draft, attempts }
        }
      }
    } catch (error) {
      attempts.push({
        attempt: fallbackAttempt,
        errors: [`SpriteWrite recipe fallback failed: ${error instanceof Error ? error.message : String(error)}`],
      })
    }
  }

  throw new OllamaDraftQualityError(
    `Ollama draft failed SpriteWrite quality checks after ${attempts.length} attempt${
      attempts.length === 1 ? '' : 's'
    }.`,
    attempts,
  )
}

export async function requestImprovedAnimationSetDraft(
  provider: OllamaPatchProvider,
  request: AiPatchRequest & { frameCount?: number; variationCount?: number },
  context: EvaluationContext,
  options: OllamaDraftQualityOptions = {},
): Promise<OllamaDraftQualityResult<OllamaAnimationSetDraft>> {
  const maxAttempts = normalizeMaxAttempts(options.maxAttempts)
  const attempts: Array<OllamaDraftQualityAttempt<OllamaAnimationSetDraft>> = []
  let instruction = request.instruction

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const draft = await provider.requestAnimationSetDraft({
      ...request,
      instruction,
    })
    const errors = evaluateAnimationSetDraft(draft, context)
    attempts.push({ attempt, draft, errors })

    if (!errors.length) {
      return { draft, attempts }
    }

    instruction = buildRepairInstruction(request.instruction, errors, attempt + 1)
  }

  throw new OllamaDraftQualityError(
    `Ollama animation set failed SpriteWrite quality checks after ${maxAttempts} attempt${
      maxAttempts === 1 ? '' : 's'
    }.`,
    attempts,
  )
}

export function evaluateAnimationDraft(
  draft: OllamaAnimationDraft,
  context: EvaluationContext,
): string[] {
  const errors: string[] = []

  if (draft.frames.length !== context.requestedFrameCount) {
    errors.push(
      `Expected ${context.requestedFrameCount} frames, but Ollama returned ${draft.frames.length}.`,
    )
  }

  const paletteMerge = mergePaletteAdditionsForEvaluation(context.project, draft.paletteAdditions)
  errors.push(...paletteMerge.errors)

  const frameStats = draft.frames.map((frame, index) => {
    const validation = validatePatch(
      paletteMerge.project,
      context.animationId,
      context.frameId,
      context.layerId,
      frame.patch,
    )
    if (!validation.valid) {
      errors.push(...validation.errors.map((error) => `Frame ${index + 1}: ${error}`))
    }

    const stats = getFrameStats(frame.patch)
    errors.push(
      ...getFrameCoherenceErrors(frame.patch, index + 1, context.project.canvas.width, context.project.canvas.height, {
        allowDistributed: context.allowDistributed,
      }),
    )
    return stats
  })

  errors.push(...getIntentQualityErrors(draft, frameStats, paletteMerge.project, context.userInstruction))
  errors.push(
    ...getFrameContinuityErrors(frameStats, context.project.canvas.width, context.project.canvas.height, {
      allowDistributed: context.allowDistributed,
    }),
  )

  return Array.from(new Set(errors))
}

export function evaluateAnimationSetDraft(
  setDraft: OllamaAnimationSetDraft,
  context: EvaluationContext,
): string[] {
  const errors: string[] = []
  const requestedVariationCount = context.requestedVariationCount ?? 1

  if (setDraft.animations.length !== requestedVariationCount) {
    errors.push(
      `Expected ${requestedVariationCount} animation row${
        requestedVariationCount === 1 ? '' : 's'
      }, but Ollama returned ${setDraft.animations.length}.`,
    )
  }

  setDraft.animations.forEach((animation, index) => {
    const rowErrors = evaluateAnimationDraft(animation, context).map(
      (error) => `Row ${index + 1}: ${error}`,
    )
    errors.push(...rowErrors)
  })

  return Array.from(new Set(errors))
}

export function formatDraftQualityAttempts(attempts: Array<OllamaDraftQualityAttempt<unknown>>) {
  return attempts.map((attempt) => ({
    attempt: attempt.attempt,
    errors: attempt.errors,
    draft: attempt.draft,
  }))
}

function normalizeMaxAttempts(input: number | undefined): number {
  if (!Number.isFinite(input) || typeof input !== 'number') {
    return 2
  }

  return Math.max(1, Math.min(3, Math.round(input)))
}

function mergePaletteAdditionsForEvaluation(
  baseProject: SpriteProject,
  additions: PaletteColor[] | undefined,
): { project: SpriteProject; errors: string[] } {
  if (!additions?.length) {
    return { project: baseProject, errors: [] }
  }

  let project = cloneProject(baseProject)
  const seenIds = new Set<string>()
  const errors: string[] = []

  additions.forEach((color, index) => {
    const id = color.id.trim()
    if (!id) {
      errors.push(`Palette addition ${index + 1}: color id must not be empty.`)
      return
    }
    if (seenIds.has(id) || getColor(project, id)) {
      seenIds.add(id)
      return
    }
    seenIds.add(id)

    try {
      project = addPaletteColorToProject(project, {
        id,
        name: color.name,
        hex: color.hex,
      })
    } catch (error) {
      errors.push(`Palette addition "${id}": ${error instanceof Error ? error.message : 'could not be added.'}`)
    }
  })

  return { project, errors }
}

function getFrameCoherenceErrors(
  patch: PixelPatchOperation[],
  frameNumber: number,
  canvasWidth: number,
  canvasHeight: number,
  options: { allowDistributed?: boolean } = {},
): string[] {
  const stats = getFrameStats(patch)
  if (stats.setCount < 10) {
    return [`Frame ${frameNumber} has too few painted cells to be a readable sprite.`]
  }

  const maxUsefulWidth = Math.max(3, Math.ceil(canvasWidth * 0.85))
  const maxUsefulHeight = Math.max(3, Math.ceil(canvasHeight * 0.92))
  if (!options.allowDistributed && (stats.width > maxUsefulWidth || stats.height > maxUsefulHeight)) {
    return [`Frame ${frameNumber} is spread too far across the canvas.`]
  }

  if (options.allowDistributed) {
    return []
  }

  const connectedRatio = getLargestConnectedComponentRatio(patch)
  if (connectedRatio < 0.55) {
    return [`Frame ${frameNumber} is too scattered; expected one coherent sprite shape.`]
  }

  return []
}

function getIntentQualityErrors(
  draft: OllamaAnimationDraft,
  frameStats: FrameStats[],
  project: SpriteProject,
  instruction: string,
): string[] {
  const normalized = instruction.toLowerCase()
  const errors: string[] = []
  const nonEmptyStats = frameStats.filter((stats) => stats.setCount > 0)

  if (!nonEmptyStats.length) {
    return ['Draft did not paint any visible cells.']
  }

  if (normalized.includes('coin') || normalized.includes('gold') || normalized.includes('golden')) {
    const usedColorIds = new Set(nonEmptyStats.flatMap((stats) => Array.from(stats.usedColorIds)))
    const usesGoldLikeColor = Array.from(usedColorIds).some((colorId) => isGoldLikeColor(project, colorId))

    if (!usesGoldLikeColor) {
      errors.push(
        'Expected gold/yellow/orange coin colors, but the draft did not use or add a gold-like palette color.',
      )
    }
  }

  if (normalized.includes('rotating') || normalized.includes('spinning') || normalized.includes('spin')) {
    const uniqueSignatures = new Set(nonEmptyStats.map((stats) => stats.signature))
    const widths = nonEmptyStats.map((stats) => stats.width)
    const widthRange = Math.max(...widths) - Math.min(...widths)
    const highlightXPositions = getHighlightXPositions(draft, project)

    if (uniqueSignatures.size < Math.min(3, nonEmptyStats.length)) {
      errors.push('Expected visible frame-to-frame motion, but too many returned frames are identical.')
    }

    if (widthRange < 2 && new Set(highlightXPositions).size < 2) {
      errors.push(
        'Expected a rotation read: vary silhouette width or highlight position across frames.',
      )
    }
  }

  if (normalized.includes('grass')) {
    nonEmptyStats.forEach((stats, index) => {
      if (stats.maxY < Math.floor(project.canvas.height * 0.78)) {
        errors.push(`Grass frame ${index + 1} should be anchored near the bottom of the tile.`)
      }
      if (stats.width < Math.floor(project.canvas.width * 0.5)) {
        errors.push(`Grass frame ${index + 1} should cover enough horizontal tile width to read as grass.`)
      }
    })
  }

  return errors
}

function getFrameContinuityErrors(
  frameStats: FrameStats[],
  canvasWidth: number,
  canvasHeight: number,
  options: { allowDistributed?: boolean } = {},
): string[] {
  if (options.allowDistributed) {
    return []
  }

  const nonEmptyStats = frameStats.filter((stats) => stats.setCount > 0)
  if (nonEmptyStats.length < 2) {
    return []
  }

  const errors: string[] = []
  const maxCenterShift = Math.max(3, Math.round(Math.min(canvasWidth, canvasHeight) * 0.22))
  const maxSizeShift = Math.max(4, Math.round(Math.min(canvasWidth, canvasHeight) * 0.3))

  for (let index = 1; index < nonEmptyStats.length; index += 1) {
    const previous = nonEmptyStats[index - 1]
    const current = nonEmptyStats[index]
    const centerShift = Math.hypot(current.centerX - previous.centerX, current.centerY - previous.centerY)
    const widthShift = Math.abs(current.width - previous.width)
    const heightShift = Math.abs(current.height - previous.height)

    if (centerShift > maxCenterShift) {
      errors.push(
        `Frame ${index + 1} jumps too far from the previous frame; keep animation motion continuous.`,
      )
    }

    if (widthShift > maxSizeShift || heightShift > maxSizeShift) {
      errors.push(
        `Frame ${index + 1} changes silhouette bounds too abruptly; preserve scale across neighboring frames.`,
      )
    }
  }

  return errors
}

function getFrameStats(patch: PixelPatchOperation[]): FrameStats {
  const cells = new Map<string, Extract<PixelPatchOperation, { op: 'set' }>>()
  patch.forEach((operation) => {
    if (operation.op === 'set') {
      cells.set(`${operation.x},${operation.y}`, operation)
    }
  })

  const setOperations = Array.from(cells.values())
  if (!setOperations.length) {
    return {
      setCount: 0,
      uniqueCellCount: 0,
      minX: 0,
      maxX: 0,
      minY: 0,
      maxY: 0,
      width: 0,
      height: 0,
      centerX: 0,
      centerY: 0,
      signature: '',
      usedColorIds: new Set(),
    }
  }

  const xs = setOperations.map((operation) => operation.x)
  const ys = setOperations.map((operation) => operation.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const signature = setOperations
    .map((operation) => `${operation.x},${operation.y},${operation.colorId}`)
    .sort()
    .join('|')

  return {
    setCount: patch.filter((operation) => operation.op === 'set').length,
    uniqueCellCount: cells.size,
    minX,
    maxX,
    minY,
    maxY,
    width: maxX - minX + 1,
    height: maxY - minY + 1,
    centerX: (minX + maxX) / 2,
    centerY: (minY + maxY) / 2,
    signature,
    usedColorIds: new Set(setOperations.map((operation) => operation.colorId)),
  }
}

function getLargestConnectedComponentRatio(patch: PixelPatchOperation[]): number {
  const cells = new Set(
    patch
      .filter((operation) => operation.op === 'set')
      .map((operation) => `${operation.x},${operation.y}`),
  )
  if (!cells.size) {
    return 0
  }

  const remaining = new Set(cells)
  let largestComponentSize = 0

  for (const start of cells) {
    if (!remaining.has(start)) {
      continue
    }
    const queue = [start]
    remaining.delete(start)
    let componentSize = 0

    while (queue.length) {
      const key = queue.pop()
      if (!key) {
        continue
      }
      componentSize += 1
      const [x, y] = key.split(',').map(Number)
      ;[
        `${x + 1},${y}`,
        `${x - 1},${y}`,
        `${x},${y + 1}`,
        `${x},${y - 1}`,
        `${x + 1},${y + 1}`,
        `${x + 1},${y - 1}`,
        `${x - 1},${y + 1}`,
        `${x - 1},${y - 1}`,
      ].forEach((neighbor) => {
        if (remaining.has(neighbor)) {
          remaining.delete(neighbor)
          queue.push(neighbor)
        }
      })
    }

    largestComponentSize = Math.max(largestComponentSize, componentSize)
  }

  return largestComponentSize / cells.size
}

function isGoldLikeColor(project: SpriteProject, colorId: string): boolean {
  const color = getColor(project, colorId)
  if (!color) {
    return false
  }
  const searchable = `${color.id} ${color.name}`.toLowerCase()
  if (['gold', 'golden', 'coin', 'yellow', 'orange', 'amber'].some((word) => searchable.includes(word))) {
    return true
  }

  const rgb = parseHexColor(color.hex)
  if (!rgb) {
    return false
  }

  return rgb.r >= 160 && rgb.g >= 105 && rgb.g <= 245 && rgb.b <= 120 && rgb.r >= rgb.g * 0.8
}

function parseHexColor(hex: string): { r: number; g: number; b: number } | undefined {
  const match = hex.match(/^#([0-9a-f]{6})$/i)
  if (!match) {
    return undefined
  }

  return {
    r: Number.parseInt(match[1].slice(0, 2), 16),
    g: Number.parseInt(match[1].slice(2, 4), 16),
    b: Number.parseInt(match[1].slice(4, 6), 16),
  }
}

function getHighlightXPositions(draft: OllamaAnimationDraft, project: SpriteProject): number[] {
  return draft.frames.map((frame) => {
    const highlights = frame.patch.filter(
      (operation): operation is Extract<PixelPatchOperation, { op: 'set' }> =>
        operation.op === 'set' && isHighlightLikeColor(project, operation.colorId),
    )
    if (!highlights.length) {
      return Number.NaN
    }

    return Math.round(highlights.reduce((sum, operation) => sum + operation.x, 0) / highlights.length)
  })
}

function isHighlightLikeColor(project: SpriteProject, colorId: string): boolean {
  const color = getColor(project, colorId)
  if (!color) {
    return false
  }
  const searchable = `${color.id} ${color.name}`.toLowerCase()
  if (['highlight', 'white', 'light'].some((word) => searchable.includes(word))) {
    return true
  }

  const rgb = parseHexColor(color.hex)
  return !!rgb && rgb.r >= 220 && rgb.g >= 220 && rgb.b >= 160
}

function buildRepairInstruction(originalInstruction: string, errors: string[], nextAttempt: number): string {
  return `${originalInstruction}

SpriteWrite quality review rejected the previous draft. Regenerate the entire editable result for attempt ${nextAttempt}.
Fix these issues:
${errors.map((error) => `- ${error}`).join('\n')}

Keep the original user intent. Return only the requested SpriteWrite JSON shape.`
}

function shouldTryRecipeFallback(instruction: string): boolean {
  const normalized = instruction.toLowerCase()
  return ['coin', 'spinning', 'rotating', 'spin'].some((word) => normalized.includes(word))
}

function buildRecipeFallbackInstruction(
  originalInstruction: string,
  attempts: Array<OllamaDraftQualityAttempt<unknown>>,
): string {
  const errors = Array.from(new Set(attempts.flatMap((attempt) => attempt.errors))).slice(0, 8)
  return `${originalInstruction}

SpriteWrite direct draft attempts failed quality checks. Use the compact SpriteWrite recipe fallback only to preserve the user's visible intent.
Observed issues:
${errors.map((error) => `- ${error}`).join('\n') || '- Direct draft did not produce usable editable frames.'}

Return only the compact recipe JSON shape requested by SpriteWrite.`
}
