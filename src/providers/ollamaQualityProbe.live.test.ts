import { describe, expect, it } from 'vitest'
import { createBlankProject } from '../domain/spriteData'
import { listOllamaModels, OllamaPatchProvider } from './ollamaPatchProvider'
import {
  formatDraftQualityAttempts,
  OllamaDraftQualityError,
  requestImprovedAnimationDraft,
  requestImprovedAnimationSetDraft,
} from './ollamaDraftQuality'
import { createSpriteWritePromptIntent } from './spriteWritePromptIntent'

const OLLAMA_BASE_URL = 'http://localhost:11434'
const OLLAMA_MODEL = 'qwen3:14b'

async function requireLocalQwen(): Promise<void> {
  const models = await listOllamaModels(OLLAMA_BASE_URL)
  const modelNames = models.map((model) => model.name)
  if (!modelNames.includes(OLLAMA_MODEL)) {
    throw new Error(
      `SpriteWrite Ollama quality probe requires ${OLLAMA_MODEL}. Found: ${
        modelNames.join(', ') || 'no local models'
      }. Run: ollama pull ${OLLAMA_MODEL}`,
    )
  }
}

function formatProbeFailure(error: unknown): Error {
  if (error instanceof OllamaDraftQualityError) {
    return new Error(
      `${error.message}\n\nSpriteWrite quality attempts:\n${JSON.stringify(
        formatDraftQualityAttempts(error.attempts),
        null,
        2,
      )}`,
    )
  }

  return error instanceof Error ? error : new Error(String(error))
}

describe('live Ollama SpriteWrite quality probe', () => {
  it(
    'turns a natural coin prompt into a reviewed editable 4-frame animation draft',
    async () => {
      await requireLocalQwen()
      const project = createBlankProject({
        name: 'Live Coin Probe',
        width: 32,
        height: 32,
        assetType: 'icon',
      })
      const intent = createSpriteWritePromptIntent('golden coin rotating. 4 frames.', project, {
        output: 'animated',
      })
      const provider = new OllamaPatchProvider({
        baseUrl: OLLAMA_BASE_URL,
        model: OLLAMA_MODEL,
        timeoutMs: 120_000,
      })

      try {
        const result = await requestImprovedAnimationDraft(
          provider,
          {
            project,
            animationId: 'idle',
            frameId: 'idle-001',
            layerId: 'base',
            instruction: intent.paddedInstruction,
            constraints: { selectedColorId: 'accent', maxOperations: 64 },
            frameCount: intent.frameCount,
          },
          {
            project,
            animationId: 'idle',
            frameId: 'idle-001',
            layerId: 'base',
            userInstruction: intent.userInstruction,
            requestedFrameCount: intent.frameCount,
          },
          { maxAttempts: 2 },
        )

        expect(result.draft.frames).toHaveLength(4)
        expect(result.attempts.at(-1)?.errors).toEqual([])
      } catch (error) {
        throw formatProbeFailure(error)
      }
    },
    260_000,
  )

  it(
    'turns a natural grass prompt into reviewed editable tile variation rows',
    async () => {
      await requireLocalQwen()
      const project = createBlankProject({
        name: 'Live Grass Probe',
        width: 32,
        height: 32,
        assetType: 'tile',
      })
      const intent = createSpriteWritePromptIntent(
        '3 sets of 4 frames of short grass waving in the wind that can tile.',
        project,
        {
          output: 'animated',
          viewAngle: 'top-down',
        },
      )
      const provider = new OllamaPatchProvider({
        baseUrl: OLLAMA_BASE_URL,
        model: OLLAMA_MODEL,
        timeoutMs: 120_000,
      })

      try {
        const result = await requestImprovedAnimationSetDraft(
          provider,
          {
            project,
            animationId: 'idle',
            frameId: 'idle-001',
            layerId: 'base',
            instruction: intent.paddedInstruction,
            constraints: { selectedColorId: 'accent', maxOperations: 64 },
            frameCount: intent.frameCount,
            variationCount: intent.variationCount,
          },
          {
            project,
            animationId: 'idle',
            frameId: 'idle-001',
            layerId: 'base',
            userInstruction: intent.userInstruction,
            requestedFrameCount: intent.frameCount,
            requestedVariationCount: intent.variationCount,
            allowDistributed: true,
          },
          { maxAttempts: 2 },
        )

        expect(result.draft.animations).toHaveLength(3)
        expect(result.draft.animations.every((animation) => animation.frames.length === 4)).toBe(true)
        expect(result.attempts.at(-1)?.errors).toEqual([])
      } catch (error) {
        throw formatProbeFailure(error)
      }
    },
    260_000,
  )
})
