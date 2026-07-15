import type { AiPatchProvider, AiPatchRequest } from './aiPatchProvider'
import type { PixelPatchOperation } from '../domain/spriteTypes'
import { layerCellsToPixels, getFrame, getLayer } from '../domain/spriteData'

export interface OllamaPatchProviderOptions {
  baseUrl: string
  model: string
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

    const response = await fetch(`${this.options.baseUrl.replace(/\/$/, '')}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: this.options.model,
        stream: false,
        format: 'json',
        prompt,
      }),
    })

    if (!response.ok) {
      throw new Error(`Ollama returned ${response.status} ${response.statusText}`)
    }

    const payload = (await response.json()) as { response?: string }
    const raw = payload.response?.trim()
    if (!raw) {
      throw new Error('Ollama returned an empty response.')
    }

    const parsed = parseOllamaPatchResponse(raw)
    if (!Array.isArray(parsed)) {
      throw new Error('Ollama response was JSON, but not a patch operation array.')
    }

    return parsed
  }
}

export async function testOllamaConnection(baseUrl: string): Promise<string> {
  const response = await fetch(`${baseUrl.replace(/\/$/, '')}/api/tags`)
  if (!response.ok) {
    throw new Error(`Ollama returned ${response.status} ${response.statusText}`)
  }
  const payload = (await response.json()) as { models?: Array<{ name: string }> }
  const names = payload.models?.map((model) => model.name).join(', ')
  return names ? `Connected. Models: ${names}` : 'Connected. No models reported.'
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

function buildOllamaPrompt(
  request: AiPatchRequest,
  currentCells: Array<{ x: number; y: number; colorId: string }>,
): string {
  return `You are editing a pixel sprite represented as grid cells.
Return JSON only. Prefer a raw JSON array. If your JSON mode requires an object, return { "patch": [...] }.
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
- Prefer small patches over huge rewrites unless the user explicitly asks for a major change.

Canvas: ${request.project.canvas.width}x${request.project.canvas.height}
Palette IDs: ${request.project.palette.map((color) => color.id).join(', ')}
Selected color: ${request.constraints.selectedColorId}
Instruction: ${request.instruction}
Current layer cells JSON:
${JSON.stringify(currentCells)}
`
}
