import type { SpriteProject } from '../domain/spriteTypes'

export type SpriteWritePromptMode = 'frame-patch' | 'frame-draft' | 'animation-draft'

export interface SpriteWritePromptIntent {
  mode: SpriteWritePromptMode
  userInstruction: string
  paddedInstruction: string
  frameCount: number
  summary: string
}

export function createSpriteWritePromptIntent(
  instruction: string,
  project: SpriteProject,
): SpriteWritePromptIntent {
  const userInstruction = instruction.trim() || 'Create a readable pixel asset.'
  const mode = inferPromptMode(userInstruction)
  const frameCount = mode === 'animation-draft' ? inferRequestedFrameCount(userInstruction) : 1
  const paletteIds = project.palette.map((color) => color.id).join(', ')

  if (mode === 'animation-draft') {
    const paddedInstruction = [
      `User request: ${userInstruction}`,
      `SpriteWrite interpretation: Draft a ${frameCount}-frame editable animation row from this request.`,
      `Canvas/frame size: ${project.canvas.width}x${project.canvas.height} cells.`,
      `Use only these palette IDs: ${paletteIds}.`,
      'Create full readable frame patches, not a tiny partial edit.',
      'Keep the asset centered unless the user explicitly asks otherwise.',
      'Keep scale, proportions, silhouette, and palette consistent across frames.',
      'Make frame-to-frame motion intentional and easy to read at small pixel size.',
      'For spinning or rotating assets, change silhouette width, highlight position, and shadow position across frames.',
      'For tiles, walls, floors, icons, effects, props, backgrounds, or UI assets, keep the result grid-aligned and export-friendly.',
      'Return structured editable patch JSON only; no raster images, markdown, prose, labels, or placeholder marks.',
    ].join('\n')

    return {
      mode,
      userInstruction,
      paddedInstruction,
      frameCount,
      summary: `SpriteWrite framed this as a ${frameCount}-frame editable animation draft.`,
    }
  }

  if (mode === 'frame-draft') {
    return {
      mode,
      userInstruction,
      frameCount,
      paddedInstruction: [
        `User request: ${userInstruction}`,
        'SpriteWrite interpretation: Draft one full readable editable frame on the selected frame and layer.',
        `Canvas/frame size: ${project.canvas.width}x${project.canvas.height} cells.`,
        `Use only these palette IDs: ${paletteIds}.`,
        'Create a complete readable asset, not a tiny partial edit.',
        'Keep the asset centered unless the user explicitly asks otherwise.',
        'Keep the silhouette clean and readable at small pixel size.',
        'For tiles, walls, floors, icons, effects, props, backgrounds, or UI assets, keep the result grid-aligned and export-friendly.',
        'Return structured editable patch JSON only; no raster images, markdown, prose, labels, or placeholder marks.',
      ].join('\n'),
      summary: 'SpriteWrite framed this as a single-frame editable asset draft.',
    }
  }

  return {
    mode,
    userInstruction,
    frameCount,
    paddedInstruction: [
      `User request: ${userInstruction}`,
      'SpriteWrite interpretation: Propose a focused selected-frame edit.',
      `Canvas/frame size: ${project.canvas.width}x${project.canvas.height} cells.`,
      `Use only these palette IDs: ${paletteIds}.`,
      'Edit only the selected frame and selected layer.',
      'Keep the patch small, coherent, and readable.',
      'Preserve the existing asset identity, palette, silhouette, and frame dimensions.',
      'Return structured editable patch JSON only; no raster images, markdown, prose, labels, or placeholder marks.',
    ].join('\n'),
    summary: 'SpriteWrite framed this as a selected-frame patch.',
  }
}

export function looksLikeAnimationOrWholeAssetRequest(instruction: string): boolean {
  return inferPromptMode(instruction) === 'animation-draft'
}

export function inferPromptMode(instruction: string): SpriteWritePromptMode {
  const normalized = instruction.toLowerCase()
  const asksForFrameSequence = /\b\d+\s*(?:-|to)?\s*\d*\s*frames?\b/.test(normalized)
  const asksForAnimation = [
    'animation',
    'animated',
    'sprite sheet',
    'spritesheet',
    'atlas',
    'walk cycle',
    'idle cycle',
    'standing',
    'spinning',
    'rotating',
  ].some((word) => normalized.includes(word))
  const asksForWholeAsset = [
    'character',
    'hero',
    'enemy',
    'creature',
    'tile',
    'tileset',
    'wall',
    'floor',
    'terrain',
    'environment',
    'prop',
    'object',
    'background',
    'effect',
    'icon',
    'ui',
    'coin',
  ].some((word) => normalized.includes(word))
  const smallEditOnly = [
    'highlight',
    'shade',
    'outline',
    'detail',
    'fix',
    'tweak',
    'clean',
    'remove',
    'clear',
  ].some((word) => normalized.includes(word))

  const asksForSingleFrame = /\b(?:single|one|1)\s*frames?\b/.test(normalized) || normalized.includes('static')

  if ((asksForFrameSequence || asksForAnimation) && !asksForSingleFrame) {
    return 'animation-draft'
  }

  if (asksForWholeAsset && !smallEditOnly) {
    return 'frame-draft'
  }

  return 'frame-patch'
}

export function inferRequestedFrameCount(instruction: string): number {
  const normalized = instruction.toLowerCase()
  const rangeMatch = normalized.match(/\b(\d+)\s*(?:-|to)\s*(\d+)\s*frames?\b/)
  if (rangeMatch) {
    return clampFrameCount(Math.max(Number(rangeMatch[1]), Number(rangeMatch[2])))
  }

  const countMatch = normalized.match(/\b(\d+)\s*frames?\b/)
  if (countMatch) {
    return clampFrameCount(Number(countMatch[1]))
  }

  return 4
}

function clampFrameCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 4
  }

  return Math.max(3, Math.min(6, Math.round(value)))
}
