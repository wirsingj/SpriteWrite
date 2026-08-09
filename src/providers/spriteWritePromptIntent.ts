import type { SpriteProject } from '../domain/spriteTypes'

export type SpriteWritePromptMode = 'frame-patch' | 'frame-draft' | 'animation-draft'
export type SpriteWriteAssetOutputContext = 'auto' | 'static' | 'animated'
export type SpriteWriteViewAngleContext = 'auto' | 'side-scroller' | 'top-down' | 'three-quarter'

export interface SpriteWritePromptContextOptions {
  output?: SpriteWriteAssetOutputContext
  viewAngle?: SpriteWriteViewAngleContext
}

export interface SpriteWritePromptIntent {
  mode: SpriteWritePromptMode
  userInstruction: string
  paddedInstruction: string
  frameCount: number
  variationCount: number
  summary: string
}

export function createSpriteWritePromptIntent(
  instruction: string,
  project: SpriteProject,
  context: SpriteWritePromptContextOptions = {},
): SpriteWritePromptIntent {
  const userInstruction = instruction.trim() || 'Create a readable pixel asset.'
  const mode = inferPromptMode(userInstruction, context)
  const frameCount = mode === 'animation-draft' ? inferRequestedFrameCount(userInstruction) : 1
  const variationCount = mode === 'animation-draft' ? inferRequestedVariationCount(userInstruction) : 1
  const paletteIds = project.palette.map((color) => color.id).join(', ')
  const contextLines = createPromptContextLines(context)

  if (mode === 'animation-draft') {
    const interpretation =
      variationCount > 1
        ? `SpriteWrite interpretation: Draft ${variationCount} editable animation rows with ${frameCount} frames each from this request.`
        : `SpriteWrite interpretation: Draft a ${frameCount}-frame editable animation row from this request.`
    const paddedInstruction = [
      `User request: ${userInstruction}`,
      interpretation,
      `Canvas/frame size: ${project.canvas.width}x${project.canvas.height} cells.`,
      ...contextLines,
      `Use only these palette IDs: ${paletteIds}.`,
      'Create full readable frame patches, not a tiny partial edit.',
      'Keep the asset centered unless the user explicitly asks otherwise.',
      'Keep scale, proportions, silhouette, and palette consistent across frames.',
      'Make frame-to-frame motion intentional and easy to read at small pixel size.',
      variationCount > 1
        ? 'Each animation row should represent a distinct requested action, pose, variant, or asset from the user request.'
        : '',
      'For spinning or rotating assets, change silhouette width, highlight position, and shadow position across frames.',
      'For tiles, walls, floors, icons, effects, props, backgrounds, or UI assets, keep the result grid-aligned and export-friendly.',
      'Return structured editable patch JSON only; no raster images, markdown, prose, labels, or placeholder marks.',
    ].join('\n')

    return {
      mode,
      userInstruction,
      paddedInstruction,
      frameCount,
      variationCount,
      summary:
        variationCount > 1
          ? `SpriteWrite framed this as ${variationCount} editable animation variations with ${frameCount} frames each.`
          : `SpriteWrite framed this as a ${frameCount}-frame editable animation draft.`,
    }
  }

  if (mode === 'frame-draft') {
    return {
      mode,
      userInstruction,
      frameCount,
      variationCount,
      paddedInstruction: [
        `User request: ${userInstruction}`,
        'SpriteWrite interpretation: Draft one full readable editable frame on the selected frame and layer.',
        `Canvas/frame size: ${project.canvas.width}x${project.canvas.height} cells.`,
        ...contextLines,
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
    variationCount,
    paddedInstruction: [
      `User request: ${userInstruction}`,
      'SpriteWrite interpretation: Propose a focused selected-frame edit.',
      `Canvas/frame size: ${project.canvas.width}x${project.canvas.height} cells.`,
      ...contextLines,
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

export function inferPromptMode(
  instruction: string,
  context: SpriteWritePromptContextOptions = {},
): SpriteWritePromptMode {
  const normalized = instruction.toLowerCase()
  const asksForFrameSequence = /\b\d+\s*(?:-|to)?\s*\d*\s*frames?\b/.test(normalized)
  const asksForVariations =
    /\b\d+\s*(?:frame\s*set\s*)?variations?\b/.test(normalized) ||
    /\b\d+\s*(?:animation\s*)?(?:animations?|rows?)\b/.test(normalized)
  const asksForAnimation = [
    'animation',
    'animated',
    'sprite sheet',
    'spritesheet',
    'atlas',
    'idle',
    'walk cycle',
    'idle cycle',
    'standing',
    'spinning',
    'rotating',
    'waving',
  ].some((word) => normalized.includes(word))
  const asksForWholeAsset = [
    'character',
    'hero',
    'enemy',
    'creature',
    'monster',
    'tentacle',
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

  if (smallEditOnly && !asksForFrameSequence && !asksForVariations && !normalized.includes('animation')) {
    return 'frame-patch'
  }

  if (context.output === 'animated' && !asksForSingleFrame) {
    return 'animation-draft'
  }

  if (
    context.output === 'static' &&
    !asksForFrameSequence &&
    !asksForVariations &&
    !normalized.includes('animation') &&
    !normalized.includes('animated')
  ) {
    return 'frame-draft'
  }

  if ((asksForFrameSequence || asksForVariations || asksForAnimation) && !asksForSingleFrame) {
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

export function inferRequestedVariationCount(instruction: string): number {
  const normalized = instruction.toLowerCase()
  const variationMatch =
    normalized.match(/\b(\d+)\s*(?:frame\s*set\s*)?variations?\b/) ??
    normalized.match(/\b(\d+)\s*(?:animation\s*)?(?:animations?|rows?)\b/) ??
    normalized.match(/\b(\d+)\s*(?:tile\s*)?(?:sets?|rows?)\b/)

  if (!variationMatch) {
    return 1
  }

  return Math.max(1, Math.min(6, Math.round(Number(variationMatch[1]))))
}

function clampFrameCount(value: number): number {
  if (!Number.isFinite(value)) {
    return 4
  }

  return Math.max(3, Math.min(6, Math.round(value)))
}

function createPromptContextLines(context: SpriteWritePromptContextOptions): string[] {
  const lines: string[] = []

  if (context.output === 'static') {
    lines.push('Output intent: static asset or tile; make one complete readable frame unless the user explicitly asks for multiple frames.')
  } else if (context.output === 'animated') {
    lines.push('Output intent: animated sprite or frame row; preserve identity, scale, palette, and motion continuity across frames.')
  }

  if (context.viewAngle === 'side-scroller') {
    lines.push('View context: side-scroller side view; emphasize a clear side silhouette, bottom ground contact, and lateral readability.')
  } else if (context.viewAngle === 'top-down') {
    lines.push('View context: top-down view; emphasize footprint, north/east/south/west edge continuity for tileable assets, and minimal side-facing profile.')
  } else if (context.viewAngle === 'three-quarter') {
    lines.push('View context: 2.5D/three-quarter view; show readable top and front/side planes with consistent depth cues inside the fixed grid.')
  }

  return lines
}
