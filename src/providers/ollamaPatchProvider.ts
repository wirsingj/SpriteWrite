import type { AiPatchProvider, AiPatchRequest } from './aiPatchProvider'
import type { PixelPatchOperation } from '../domain/spriteTypes'
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
  frames: OllamaAnimationDraftFrame[]
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

  return (payload.models ?? [])
    .filter((model) => typeof model.name === 'string' && model.name.trim() !== '')
    .map((model) => {
      const family = model.details?.family
      const families = model.details?.families?.filter((item): item is string => typeof item === 'string') ?? []
      const derivedCapabilities = new Set(model.capabilities ?? [])
      if (families.includes('clip')) {
        derivedCapabilities.add('vision')
      }
      if (family) {
        derivedCapabilities.add('completion')
      }

      return {
        name: model.name.trim(),
        modifiedAt: model.modified_at,
        size: model.size,
        capabilities: Array.from(derivedCapabilities),
        family,
        families,
        parameterSize: model.details?.parameter_size,
      }
    })
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
    frames,
  }
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
{"animationName":"Name","fps":4,"frames":[{"name":"Frame 001","durationMs":250,"patch":[{"op":"set","x":15,"y":15,"colorId":"accent"}]}]}

Rules:
- Return exactly ${requestedFrameCount} frames.
- Each frame patch must draw the full visible frame on a blank layer.
- Use only set operations.
- Each operation must be exactly {"op":"set","x":number,"y":number,"colorId":string}.
- Do not include width, height, radius, size, alpha, labels, markdown, prose, images, or invented colors.
- Coordinates must be integers inside the ${request.project.canvas.width}x${request.project.canvas.height} canvas.
- Use 8 to ${preferredMaxOperations} set operations per frame.
- Keep the sprite centered and coherent, not scattered.
- For rotating/spinning assets, vary silhouette width and highlight position across frames.

Current cells: ${JSON.stringify(currentCells)}
`
}

function normalizeOllamaBaseUrl(baseUrl: string): string {
  return baseUrl.trim().replace(/\/$/, '')
}
