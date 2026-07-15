import type {
  AnimationId,
  FrameId,
  LayerId,
  PixelPatchOperation,
  SpriteProject,
} from '../domain/spriteTypes'

export interface PatchRequestConstraints {
  selectedColorId: string
  maxOperations?: number
}

export interface AiPatchRequest {
  project: SpriteProject
  animationId: AnimationId
  frameId: FrameId
  layerId: LayerId
  instruction: string
  constraints: PatchRequestConstraints
}

export interface AiPatchProvider {
  id: string
  label: string
  requestPatch(request: AiPatchRequest): Promise<PixelPatchOperation[]>
}
