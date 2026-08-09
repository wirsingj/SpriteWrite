import {
  Fragment,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import { flushSync } from 'react-dom'
import './App.css'
import { AtlasOverview } from './components/AtlasOverview'
import { ColorPickerField } from './components/ColorPickerField'
import { CommandPalette, type CommandItem } from './components/CommandPalette'
import { FullSheetWorkspace } from './components/FullSheetWorkspace'
import { MiniSprite } from './components/MiniSprite'
import { ProviderDetails } from './components/ProviderDetails'
import { StartScreen } from './components/StartScreen'
import { formatAssetType } from './domain/assetTypes'
import {
  applyPatch,
  addAnimationToProject,
  addLayerToProject,
  addPaletteColorToProject,
  cellKey,
  cloneProject,
  deleteAnimationFromProject,
  deleteLayerFromProject,
  deletePaletteColorFromProject,
  duplicateAnimationInProject,
  getAnimation,
  getColor,
  getFrame,
  getLayer,
  moveAnimationInProject,
  moveFrameInAnimation,
  moveLayerInProject,
  movePaletteColorInProject,
  setFrameHitboxInProject,
  setLayerVisibilityInProject,
  updateLayerPropertiesInProject,
  updateAnimationPropertiesInProject,
  updateFramePropertiesInProject,
  updateFramesPropertiesInProject,
  updatePaletteColorInProject,
  validateProject,
  validatePatch,
} from './domain/spriteData'
import { composeFramePixels, getLayerColorId } from './domain/rendering'
import { createFullSpriteSheetLayout, createSpriteSheetLayout } from './domain/exportPlanning'
import type {
  AnimationId,
  FrameId,
  PaletteColor,
  PixelPatchOperation,
  SpriteAssetType,
  SpriteFrame,
  SpriteProject,
} from './domain/spriteTypes'
import {
  getProjectTemplate,
  SPRITE_PROJECT_TEMPLATES,
} from './domain/projectTemplates'
import {
  listOllamaModels,
  type OllamaAnimationSetDraft,
  type OllamaAnimationDraft,
  OllamaPatchProvider,
  pullOllamaModel,
  type OllamaModelInfo,
} from './providers/ollamaPatchProvider'
import {
  formatDraftQualityAttempts,
  OllamaDraftQualityError,
  requestImprovedAnimationDraft,
  requestImprovedAnimationSetDraft,
  type OllamaDraftQualityAttempt,
} from './providers/ollamaDraftQuality'
import {
  createSpriteWritePromptIntent,
  type SpriteWriteAssetOutputContext,
  type SpriteWritePromptIntent,
  type SpriteWriteViewAngleContext,
} from './providers/spriteWritePromptIntent'
import {
  exportFramePng,
  exportFullSpriteSheetMetadata,
  exportFullSpriteSheetPng,
  exportSpritesheetPng,
} from './utils/canvasExport'
import { downloadBlob, downloadTextFile } from './utils/download'

type Tool = 'paint' | 'erase'
type AppMode = 'start' | 'editor'
type WorkspaceMode = 'frame' | 'sheet'
type DockTab = 'palette' | 'layers'
type InspectorTab = 'frame' | 'animation'
type LayerPresetId = 'art' | 'guide' | 'shadow' | 'highlight'
type ProviderAttemptContext = {
  attempt: number
  startedAt: number
}
type ProviderReview = {
  title: string
  metrics: Array<{ label: string; value: string }>
  rows: string[]
  paletteAdditions?: PaletteColor[]
}
type PendingAnimationDraft = {
  project: SpriteProject
  animationId: AnimationId
  frameId: FrameId
  atlasFrameIds: FrameId[]
  workspaceMode: WorkspaceMode
  appliedMessage: string
}

const TRANSPARENT_LABEL = 'transparent'
const BROWSER_DRAFT_STORAGE_KEY = 'spritewrite.browserDraft.v1'
const DEFAULT_SHORTCUTS = {
  paint: 'p',
  erase: 'e',
} as const
const LAYER_PRESETS: Array<{
  id: LayerPresetId
  label: string
  properties: { exportable: boolean; opacity: number; blendMode: 'normal' | 'multiply' | 'screen' }
}> = [
  { id: 'art', label: 'Art', properties: { exportable: true, opacity: 1, blendMode: 'normal' } },
  { id: 'guide', label: 'Guide', properties: { exportable: false, opacity: 0.45, blendMode: 'normal' } },
  { id: 'shadow', label: 'Shadow', properties: { exportable: true, opacity: 0.55, blendMode: 'multiply' } },
  { id: 'highlight', label: 'Highlight', properties: { exportable: true, opacity: 0.7, blendMode: 'screen' } },
]
const MIN_RIGHT_PANEL_WIDTH = 260
const MAX_RIGHT_PANEL_WIDTH = 560
const DEFAULT_RIGHT_PANEL_WIDTH = 360
const MIN_PREVIEW_BOX_HEIGHT = 170
const MAX_PREVIEW_BOX_HEIGHT = 560
const DEFAULT_PREVIEW_BOX_HEIGHT = 220
const MIN_ATLAS_PANEL_HEIGHT = 150
const MAX_ATLAS_PANEL_HEIGHT = 360
const DEFAULT_ATLAS_PANEL_HEIGHT = 240
const DEFAULT_PREVIEW_BACKGROUND = '#222631'
const DEFAULT_EDITOR_BACKGROUND = '#1d2028'

function getFirstPaintColorId(project: SpriteProject): string {
  return project.palette.find((color) => !color.isTransparent)?.id ?? project.palette[0]?.id ?? ''
}

function getDefaultPatchInstruction(project: SpriteProject): string {
  switch (project.assetType) {
    case 'creature':
    case 'ooze':
      return 'Add a small readable creature detail while preserving the silhouette.'
    case 'character':
    case 'enemy':
      return 'Add a readable character detail while preserving identity and proportions.'
    case 'tile':
    case 'environment':
      return 'Add a tileable environment detail within the existing palette.'
    case 'prop':
    case 'object':
      return 'Add a readable object detail while preserving the asset shape.'
    case 'effect':
      return 'Add a crisp effect detail that reads at small size.'
    case 'ui':
    case 'button':
      return 'Add a clean readable UI detail.'
    case 'icon':
      return 'Add a crisp icon detail.'
    case 'background':
    case 'parallax':
      return 'Add a subtle readable background detail.'
    default:
      return 'Add a small readable detail.'
  }
}

function getMaxOllamaDraftOperations(project: SpriteProject): number {
  const cellCount = project.canvas.width * project.canvas.height
  return Math.min(cellCount, 64, Math.max(24, Math.floor(cellCount * 0.12)))
}

function summarizeProviderErrors(errors: string[]): string {
  const uniqueErrors = Array.from(new Set(errors))
  const firstErrors = uniqueErrors.slice(0, 2).join(' ')
  const remainingCount = uniqueErrors.length - 2

  return remainingCount > 0 ? `${firstErrors} +${remainingCount} more.` : firstErrors
}

function formatElapsedMs(startedAt: number): string {
  return `${Math.max(0, Math.round(performance.now() - startedAt))}ms`
}

function slugifyId(value: string, fallback: string): string {
  const slug = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')

  return slug || fallback
}

function allowsDistributedDraft(intent: SpriteWritePromptIntent): boolean {
  const normalized = intent.userInstruction.toLowerCase()
  return ['grass', 'tile', 'tileset', 'wall', 'floor', 'terrain', 'background', 'parallax'].some((word) =>
    normalized.includes(word),
  )
}

function parseTagsInput(value: string): string[] {
  const tags = new Map<string, string>()
  value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .forEach((tag) => {
      tags.set(tag.toLowerCase(), tag)
    })

  return Array.from(tags.values())
}

function normalizeModelName(model: string): string {
  return model.trim()
}

function normalizeModelValue(model: string): string {
  return model.trim().toLowerCase()
}

function tagsEqual(left: string[], right: string[]): boolean {
  return left.length === right.length && left.every((tag, index) => tag === right[index])
}

function formatOllamaError(error: unknown, baseUrl: string): string {
  if (error instanceof TypeError) {
    return `Could not reach Ollama at ${baseUrl}. Start Ollama locally, then refresh models.`
  }

  return error instanceof Error ? error.message.split('\n')[0] : 'Ollama provider failed.'
}

function formatProviderDetails(title: string, details: Record<string, unknown>): string {
  return `${title}\n\n${safeStringify(details)}`
}

function formatUnknownError(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}

function formatErrorForDetails(error: unknown): Record<string, unknown> {
  if (error instanceof OllamaDraftQualityError) {
    return {
      name: error.name,
      message: error.message,
      attempts: formatDraftQualityAttempts(error.attempts as Array<OllamaDraftQualityAttempt<unknown>>),
    }
  }

  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return { message: String(error) }
}

function countDraftOperations(draft: OllamaAnimationDraft): number {
  return draft.frames.reduce((total, frame) => total + frame.patch.length, 0)
}

function createAnimationDraftReview(
  project: SpriteProject,
  draft: OllamaAnimationDraft,
  createdFrameIds: FrameId[],
  qualityAttempts: Array<OllamaDraftQualityAttempt<OllamaAnimationDraft>>,
): ProviderReview {
  const paletteAdditions = getReviewPaletteAdditions(project, draft.paletteAdditions)
  return {
    title: `Draft review: ${draft.animationName?.trim() || 'Animation row'}`,
    metrics: [
      { label: 'Frames', value: String(draft.frames.length) },
      { label: 'Patch ops', value: String(countDraftOperations(draft)) },
      { label: 'Palette additions', value: String(draft.paletteAdditions?.length ?? 0) },
      { label: 'Quality attempts', value: String(qualityAttempts.length) },
      { label: 'FPS', value: String(draft.fps ?? 'unchanged') },
    ],
    rows: draft.frames.map((frame, index) => {
      const name = frame.name?.trim() || createdFrameIds[index] || `Frame ${index + 1}`
      return `${name} - ${frame.patch.length} operation${frame.patch.length === 1 ? '' : 's'}`
    }),
    paletteAdditions,
  }
}

function createAnimationSetDraftReview(
  project: SpriteProject,
  draft: OllamaAnimationSetDraft,
  qualityAttempts: Array<OllamaDraftQualityAttempt<OllamaAnimationSetDraft>>,
): ProviderReview {
  const frameCount = draft.animations.reduce((total, animation) => total + animation.frames.length, 0)
  const patchOperationCount = draft.animations.reduce(
    (total, animation) => total + animation.frames.reduce((frameTotal, frame) => frameTotal + frame.patch.length, 0),
    0,
  )
  const paletteAdditionCount = draft.animations.reduce(
    (total, animation) => total + (animation.paletteAdditions?.length ?? 0),
    0,
  )
  const paletteAdditions = getReviewPaletteAdditions(
    project,
    draft.animations.flatMap((animation) => animation.paletteAdditions ?? []),
  )

  return {
    title: 'Draft review: animation set',
    metrics: [
      { label: 'Rows', value: String(draft.animations.length) },
      { label: 'Frames', value: String(frameCount) },
      { label: 'Patch ops', value: String(patchOperationCount) },
      { label: 'Palette additions', value: String(paletteAdditionCount) },
      { label: 'Quality attempts', value: String(qualityAttempts.length) },
    ],
    rows: draft.animations.map((animation, index) => {
      const name = animation.animationName?.trim() || `Animation ${index + 1}`
      const operations = animation.frames.reduce((total, frame) => total + frame.patch.length, 0)
      return `${name} - ${animation.frames.length} frame${
        animation.frames.length === 1 ? '' : 's'
      }, ${operations} operation${operations === 1 ? '' : 's'}`
    }),
    paletteAdditions,
  }
}

function getReviewPaletteAdditions(project: SpriteProject, additions: PaletteColor[] | undefined): PaletteColor[] {
  if (!additions?.length) {
    return []
  }

  const existingIds = new Set(project.palette.map((color) => color.id))
  const seenIds = new Set<string>()
  const reviewAdditions: PaletteColor[] = []

  additions.forEach((color) => {
    const id = color.id.trim()
    if (!id || existingIds.has(id) || seenIds.has(id)) {
      return
    }

    seenIds.add(id)
    reviewAdditions.push({
      id,
      name: color.name.trim(),
      hex: color.hex,
    })
  })

  return reviewAdditions
}

function flushProviderMessage(setProviderMessage: (message: string) => void, message: string) {
  flushSync(() => {
    setProviderMessage(message)
  })
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value, null, 2)
  } catch {
    return String(value)
  }
}

function getOllamaModelSuitabilityNote(model: string): string {
  const normalized = model.toLowerCase()
  const visionModelHints = ['llava', 'bakllava', 'moondream', 'minicpm-v', 'vision']

  if (visionModelHints.some((hint) => normalized.includes(hint))) {
    return 'Vision-oriented Ollama models often follow strict JSON poorly here. A text/instruction or code model is usually a better fit for SpriteWrite edits.'
  }

  return ''
}

function shouldSkipBrowserOnlyStartupWork(): boolean {
  return import.meta.env.MODE === 'test'
}

function choosePreferredOllamaModel(models: OllamaModelInfo[]): OllamaModelInfo | undefined {
  return models.find((model) => !model.capabilities?.includes('vision')) ?? models[0]
}

function getGeneratedPatchCoherenceErrors(
  patch: PixelPatchOperation[],
  frameNumber: number,
  canvasWidth: number,
  canvasHeight: number,
  options: { allowDistributed?: boolean } = {},
): string[] {
  const setOperations = patch.filter(
    (operation): operation is Extract<PixelPatchOperation, { op: 'set' }> => operation.op === 'set',
  )
  if (setOperations.length < 8) {
    return [`Draft frame ${frameNumber} has too few painted cells to be a readable sprite.`]
  }

  const xs = setOperations.map((operation) => operation.x)
  const ys = setOperations.map((operation) => operation.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  const boxWidth = maxX - minX + 1
  const boxHeight = maxY - minY + 1
  const maxUsefulWidth = Math.max(3, Math.ceil(canvasWidth * 0.85))
  const maxUsefulHeight = Math.max(3, Math.ceil(canvasHeight * 0.92))

  if (!options.allowDistributed && (boxWidth > maxUsefulWidth || boxHeight > maxUsefulHeight)) {
    return [`Draft frame ${frameNumber} is spread too far across the canvas.`]
  }

  if (options.allowDistributed) {
    return []
  }

  const cells = new Set(setOperations.map((operation) => cellKey(operation.x, operation.y)))
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
        cellKey(x + 1, y),
        cellKey(x - 1, y),
        cellKey(x, y + 1),
        cellKey(x, y - 1),
        cellKey(x + 1, y + 1),
        cellKey(x + 1, y - 1),
        cellKey(x - 1, y + 1),
        cellKey(x - 1, y - 1),
      ].forEach((neighbor) => {
        if (remaining.has(neighbor)) {
          remaining.delete(neighbor)
          queue.push(neighbor)
        }
      })
    }

    largestComponentSize = Math.max(largestComponentSize, componentSize)
  }

  if (largestComponentSize / setOperations.length < 0.55) {
    return [`Draft frame ${frameNumber} is too scattered; expected one coherent sprite shape.`]
  }

  return []
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function filenameSlug(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || 'spritewrite'
}

function getLayerGroupLabel(group: string | undefined): string {
  return group?.trim() || 'Ungrouped'
}

function loadInitialProject(): SpriteProject {
  if (typeof window !== 'undefined') {
    try {
      const storedProject = window.localStorage.getItem(BROWSER_DRAFT_STORAGE_KEY)
      if (storedProject) {
        const validation = validateProject(JSON.parse(storedProject) as unknown)
        if (validation.valid) {
          return validation.value
        }
      }
    } catch {
      window.localStorage.removeItem(BROWSER_DRAFT_STORAGE_KEY)
    }
  }

  return getProjectTemplate('blank-32').createProject({ name: 'Untitled Sprite' })
}

function App() {
  const [project, setProject] = useState(loadInitialProject)
  const [appMode, setAppMode] = useState<AppMode>('start')
  const [workspaceMode, setWorkspaceMode] = useState<WorkspaceMode>('frame')
  const [dockTab, setDockTab] = useState<DockTab>('palette')
  const [paletteEditorOpen, setPaletteEditorOpen] = useState(false)
  const [autoOpenPaletteColorId, setAutoOpenPaletteColorId] = useState<string | null>(null)
  const [inspectorTab, setInspectorTab] = useState<InspectorTab>('frame')
  const [selectedAnimationId, setSelectedAnimationId] = useState(project.metadata.defaultAnimationId)
  const selectedAnimation = getAnimation(project, selectedAnimationId) ?? project.animations[0]
  const selectedAnimationIndex = project.animations.findIndex((animation) => animation.id === selectedAnimation.id)
  const [selectedFrameId, setSelectedFrameId] = useState<FrameId>(selectedAnimation.frameIds[0])
  const [selectedAtlasFrameIds, setSelectedAtlasFrameIds] = useState<Set<FrameId>>(
    () => new Set([selectedAnimation.frameIds[0]]),
  )
  const [atlasSelectionAnchorId, setAtlasSelectionAnchorId] = useState<FrameId | null>(
    selectedAnimation.frameIds[0],
  )
  const [draggedAtlasFrame, setDraggedAtlasFrame] = useState<{
    animationId: AnimationId
    frameId: FrameId
  } | null>(null)
  const [selectedLayerId, setSelectedLayerId] = useState(project.metadata.defaultLayerId)
  const [selectedColorId, setSelectedColorId] = useState(() => getFirstPaintColorId(project))
  const [tool, setTool] = useState<Tool>('paint')
  const [onionSkin, setOnionSkin] = useState(true)
  const [isPointerDown, setIsPointerDown] = useState(false)
  const [lastPaintKey, setLastPaintKey] = useState<string | null>(null)
  const [undoStack, setUndoStack] = useState<SpriteProject[]>([])
  const [redoStack, setRedoStack] = useState<SpriteProject[]>([])
  const [isPlaying, setIsPlaying] = useState(true)
  const [previewIndex, setPreviewIndex] = useState(0)
  const [rightPanelWidth, setRightPanelWidth] = useState(DEFAULT_RIGHT_PANEL_WIDTH)
  const [previewBoxHeight, setPreviewBoxHeight] = useState(DEFAULT_PREVIEW_BOX_HEIGHT)
  const [atlasPanelHeight, setAtlasPanelHeight] = useState(DEFAULT_ATLAS_PANEL_HEIGHT)
  const [useSolidPreviewBackground, setUseSolidPreviewBackground] = useState(false)
  const [previewBackgroundColor, setPreviewBackgroundColor] = useState(DEFAULT_PREVIEW_BACKGROUND)
  const [useSolidEditorBackground, setUseSolidEditorBackground] = useState(false)
  const [editorBackgroundColor, setEditorBackgroundColor] = useState(DEFAULT_EDITOR_BACKGROUND)
  const [assetOutputContext, setAssetOutputContext] = useState<SpriteWriteAssetOutputContext>('auto')
  const [viewAngleContext, setViewAngleContext] = useState<SpriteWriteViewAngleContext>('auto')
  const [instruction, setInstruction] = useState(() => getDefaultPatchInstruction(project))
  const [proposedPatch, setProposedPatch] = useState<PixelPatchOperation[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [providerMessage, setProviderMessage] = useState('')
  const [providerDetails, setProviderDetails] = useState('')
  const [providerReview, setProviderReview] = useState<ProviderReview | null>(null)
  const [pendingAnimationDraft, setPendingAnimationDraft] = useState<PendingAnimationDraft | null>(null)
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const activeOllamaModel = normalizeModelName(ollamaModel)
  const normalizedOllamaModel = normalizeModelValue(activeOllamaModel)
  const [ollamaModels, setOllamaModels] = useState<OllamaModelInfo[]>([])
  const [isOllamaBusy, setIsOllamaBusy] = useState(false)
  const [exportScale, setExportScale] = useState(1)
  const [exportMargin, setExportMargin] = useState(0)
  const [exportSpacing, setExportSpacing] = useState(0)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const shortcuts = DEFAULT_SHORTCUTS
  const [newProjectName, setNewProjectName] = useState('Untitled Sprite')
  const [newProjectTemplateId, setNewProjectTemplateId] = useState('blank-32')
  const [newProjectWidth, setNewProjectWidth] = useState(32)
  const [newProjectHeight, setNewProjectHeight] = useState(32)
  const [newProjectAssetType, setNewProjectAssetType] = useState<SpriteAssetType>('custom')
  const heroDemoProject = useMemo(
    () => getProjectTemplate('hero-32-demo').createProject({ name: 'Hero Sprite Demo' }),
    [],
  )
  const ollamaModelSuitabilityNote = getOllamaModelSuitabilityNote(activeOllamaModel)
  const spriteWritePromptIntent = useMemo(
    () =>
      createSpriteWritePromptIntent(instruction, project, {
        output: assetOutputContext,
        viewAngle: viewAngleContext,
      }),
    [assetOutputContext, instruction, project, viewAngleContext],
  )
  const selectedInstalledOllamaModel = ollamaModels.some((model) =>
    normalizeModelValue(model.name) === normalizeModelValue(activeOllamaModel),
  )
    ? activeOllamaModel
    : ''
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const layerNameInputRef = useRef<HTMLInputElement | null>(null)
  const layerGroupInputRef = useRef<HTMLInputElement | null>(null)
  const colorNameInputRef = useRef<HTMLInputElement | null>(null)
  const colorHexInputRef = useRef<HTMLInputElement | null>(null)
  const ollamaAttemptRef = useRef(0)
  const didAutoRefreshOllamaRef = useRef(false)
  const animationNameInputRef = useRef<HTMLInputElement | null>(null)
  const frameNameInputRef = useRef<HTMLInputElement | null>(null)
  const frameNotesInputRef = useRef<HTMLTextAreaElement | null>(null)
  const frameTagsInputRef = useRef<HTMLInputElement | null>(null)

  const selectedFrame = getFrame(project, selectedFrameId) ?? project.frames[0]
  const selectedLayer = selectedFrame ? getLayer(selectedFrame, selectedLayerId) : undefined
  const selectedLayerIndex = selectedFrame?.layers.findIndex((layer) => layer.id === selectedLayerId) ?? -1
  const selectedColor = getColor(project, selectedColorId)
  const selectedColorIndex = project.palette.findIndex((color) => color.id === selectedColorId)
  const frameIds = selectedAnimation.frameIds
  const visibleAtlasFrameIds = useMemo(() => {
    const availableFrameIds = new Set(frameIds)
    const next = new Set(Array.from(selectedAtlasFrameIds).filter((frameId) => availableFrameIds.has(frameId)))
    if (availableFrameIds.has(selectedFrameId)) {
      next.add(selectedFrameId)
    }
    return next
  }, [frameIds, selectedAtlasFrameIds, selectedFrameId])
  const selectedAtlasFrameIdsInRow = useMemo(
    () => frameIds.filter((frameId) => visibleAtlasFrameIds.has(frameId)),
    [frameIds, visibleAtlasFrameIds],
  )
  const selectedFrameIndex = frameIds.indexOf(selectedFrameId)
  const previousFrameId = selectedFrameIndex > 0 ? frameIds[selectedFrameIndex - 1] : undefined
  const previewFrameId = frameIds[previewIndex % frameIds.length] ?? selectedFrameId
  const previewFrameNumber = frameIds.length ? (previewIndex % frameIds.length) + 1 : 0
  const previewFrame = getFrame(project, previewFrameId)
  const fps = selectedAnimation.fps
  const activeProposedPatch = proposedPatch
  const patchValidation = useMemo(
    () =>
      activeProposedPatch.length
        ? validatePatch(project, selectedAnimation.id, selectedFrameId, selectedLayerId, activeProposedPatch)
        : { valid: true, errors: [] },
    [activeProposedPatch, project, selectedAnimation.id, selectedFrameId, selectedLayerId],
  )
  const animationStripLayout = useMemo(
    () =>
      createSpriteSheetLayout(project, selectedAnimation.id, {
        scale: exportScale,
        margin: exportMargin,
        spacing: exportSpacing,
      }),
    [exportMargin, exportScale, exportSpacing, project, selectedAnimation.id],
  )
  const fullSpriteSheetImageFilename = `${filenameSlug(project.name)}-sprite-sheet@${exportScale}x.png`
  const fullSpriteSheetLayout = useMemo(
    () =>
      createFullSpriteSheetLayout(project, {
        scale: exportScale,
        margin: exportMargin,
        spacing: exportSpacing,
        imageFilename: fullSpriteSheetImageFilename,
      }),
    [exportMargin, exportScale, exportSpacing, fullSpriteSheetImageFilename, project],
  )

  function clearProviderDiagnostics() {
    setProviderDetails('')
    setProviderReview(null)
    setPendingAnimationDraft(null)
  }

  useEffect(() => {
    if (!isPlaying || frameIds.length < 2) {
      return
    }

    const interval = window.setInterval(() => {
      setPreviewIndex((index) => (index + 1) % frameIds.length)
    }, previewFrame?.durationMs ?? 1000 / Math.max(1, fps))

    return () => window.clearInterval(interval)
  }, [fps, frameIds.length, isPlaying, previewFrame?.durationMs])

  useEffect(() => {
    const releasePointer = () => {
      setIsPointerDown(false)
      setLastPaintKey(null)
    }
    window.addEventListener('pointerup', releasePointer)
    return () => window.removeEventListener('pointerup', releasePointer)
  }, [])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const isTyping =
        target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement ||
        target?.isContentEditable

      if (isTyping) {
        return
      }

      const key = event.key.toLowerCase()
      const isCommandPaletteShortcut = (event.ctrlKey || event.metaKey) && key === 'k'
      if (isCommandPaletteShortcut) {
        event.preventDefault()
        setIsCommandPaletteOpen((open) => !open)
        return
      }

      if (isCommandPaletteOpen && event.key === 'Escape') {
        event.preventDefault()
        setIsCommandPaletteOpen(false)
        setCommandQuery('')
        return
      }

      const isUndo = (event.ctrlKey || event.metaKey) && key === 'z' && !event.shiftKey
      const isRedo =
        ((event.ctrlKey || event.metaKey) && key === 'y') ||
        ((event.ctrlKey || event.metaKey) && event.shiftKey && key === 'z')

      if (isUndo) {
        event.preventDefault()
        undo()
        return
      }

      if (isRedo) {
        event.preventDefault()
        redo()
        return
      }

      if (key === shortcuts.paint) {
        setTool('paint')
        return
      }

      if (key === shortcuts.erase) {
        setTool('erase')
        return
      }

      if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
        event.preventDefault()
        const offset = event.key === 'ArrowLeft' ? -1 : 1
        const currentIndex = Math.max(0, frameIds.indexOf(selectedFrameId))
        const nextIndex = Math.max(0, Math.min(frameIds.length - 1, currentIndex + offset))
        const nextFrameId = frameIds[nextIndex]
        if (nextFrameId) {
          selectFrameForEditing(selectedAnimation.id, nextFrameId)
        }
        return
      }

      if (event.key === ' ') {
        event.preventDefault()
        setIsPlaying((value) => !value)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  })

  useEffect(() => {
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!hasUnsavedChanges) {
        return
      }

      event.preventDefault()
      event.returnValue = ''
    }

    window.addEventListener('beforeunload', warnBeforeUnload)
    return () => window.removeEventListener('beforeunload', warnBeforeUnload)
  }, [hasUnsavedChanges])

  useEffect(() => {
    try {
      window.localStorage.setItem(BROWSER_DRAFT_STORAGE_KEY, JSON.stringify(project))
    } catch {
      // Browser draft autosave is a convenience layer; Project JSON remains the real save artifact.
    }
  }, [project])

  useEffect(() => {
    if (didAutoRefreshOllamaRef.current || shouldSkipBrowserOnlyStartupWork()) {
      return
    }

    didAutoRefreshOllamaRef.current = true
    setProviderMessage(`Checking local Ollama at ${ollamaBaseUrl}...`)
    clearProviderDiagnostics()
    setIsOllamaBusy(true)

    listOllamaModels(ollamaBaseUrl)
      .then((models) => {
        setOllamaModels(models)
        const selectedModel = models.some((model) => normalizeModelValue(model.name) === normalizeModelValue(activeOllamaModel))
          ? activeOllamaModel
          : choosePreferredOllamaModel(models)?.name
        if (selectedModel) {
          setOllamaModel(selectedModel)
        }
        setProviderMessage(
          models.length
            ? `Found ${models.length} local Ollama model${models.length === 1 ? '' : 's'}: ${models
                .map((model) => model.name)
                .join(', ')}.`
            : 'Ollama is running, but no local models were reported.',
        )
        setProviderDetails(
          formatProviderDetails('Ollama model refresh result', {
            baseUrl: ollamaBaseUrl,
            selectedModel: selectedModel ?? activeOllamaModel,
            modelCount: models.length,
            models,
            automatic: true,
          }),
        )
      })
      .catch((error) => {
        setProviderMessage(formatOllamaError(error, ollamaBaseUrl))
        setProviderDetails(
          formatProviderDetails('Ollama model refresh error', {
            baseUrl: ollamaBaseUrl,
            error: formatErrorForDetails(error),
            automatic: true,
          }),
        )
      })
      .finally(() => setIsOllamaBusy(false))
  }, [ollamaBaseUrl, activeOllamaModel])

  function commitProject(nextProject: SpriteProject) {
    setUndoStack((stack) => [...stack.slice(-49), cloneProject(project)])
    setRedoStack([])
    setProject(nextProject)
    setHasUnsavedChanges(true)
  }

  function clearPatchProposalState() {
    setProposedPatch([])
  }

  function selectFrameForEditing(
    animationId: AnimationId,
    frameId: FrameId,
    options: { range?: boolean; toggle?: boolean } = {},
  ) {
    const animation = getAnimation(project, animationId)
    if (!animation || !animation.frameIds.includes(frameId)) {
      return
    }

    const nextFrameIndex = animation.frameIds.indexOf(frameId)
    setSelectedAnimationId(animation.id)
    setSelectedFrameId(frameId)
    setWorkspaceMode('frame')
    setPreviewIndex(nextFrameIndex)
    clearPatchProposalState()

    setSelectedAtlasFrameIds((current) => {
      if (
        options.range &&
        selectedAnimation.id === animationId &&
        atlasSelectionAnchorId &&
        animation.frameIds.includes(atlasSelectionAnchorId)
      ) {
        const anchorIndex = animation.frameIds.indexOf(atlasSelectionAnchorId)
        const start = Math.min(anchorIndex, nextFrameIndex)
        const end = Math.max(anchorIndex, nextFrameIndex)
        return new Set(animation.frameIds.slice(start, end + 1))
      }

      if (options.toggle) {
        const next = selectedAnimation.id === animationId ? new Set(current) : new Set<FrameId>()
        if (next.has(frameId) && next.size > 1) {
          next.delete(frameId)
        } else {
          next.add(frameId)
        }
        return next
      }

      return new Set([frameId])
    })

    if (!options.range) {
      setAtlasSelectionAnchorId(frameId)
    }
  }

  function dropAtlasFrame(animationId: AnimationId, targetFrameId: FrameId) {
    if (!draggedAtlasFrame) {
      return
    }

    if (draggedAtlasFrame.animationId !== animationId) {
      setProviderMessage('Frame dragging is currently limited to one atlas row at a time.')
      setDraggedAtlasFrame(null)
      return
    }

    if (draggedAtlasFrame.frameId === targetFrameId) {
      setDraggedAtlasFrame(null)
      return
    }

    const animation = getAnimation(project, animationId)
    const targetIndex = animation?.frameIds.indexOf(targetFrameId) ?? -1
    if (!animation || targetIndex < 0) {
      setDraggedAtlasFrame(null)
      return
    }

    const nextProject = moveFrameInAnimation(project, animationId, draggedAtlasFrame.frameId, targetIndex)
    const nextAnimation = getAnimation(nextProject, animationId)
    const nextFrameIndex = nextAnimation?.frameIds.indexOf(draggedAtlasFrame.frameId) ?? 0
    commitProject(nextProject)
    setSelectedAnimationId(animationId)
    setSelectedFrameId(draggedAtlasFrame.frameId)
    setPreviewIndex(nextFrameIndex)
    setSelectedAtlasFrameIds(new Set([draggedAtlasFrame.frameId]))
    setAtlasSelectionAnchorId(draggedAtlasFrame.frameId)
    setDraggedAtlasFrame(null)
    clearPatchProposalState()
    setProviderMessage('Frame order updated.')
  }

  function createUniqueFrameId(draft: SpriteProject, baseId: string): FrameId {
    let candidate = baseId
    let suffix = 2
    while (draft.frames.some((frame) => frame.id === candidate)) {
      candidate = `${baseId}-${suffix}`
      suffix += 1
    }

    return candidate
  }

  function createUniqueAnimationId(draft: SpriteProject, baseId: string): AnimationId {
    let candidate = baseId
    let suffix = 2
    while (draft.animations.some((animation) => animation.id === candidate)) {
      candidate = `${baseId}-${suffix}`
      suffix += 1
    }

    return candidate
  }

  function isFrameEmpty(frame: SpriteFrame | undefined): boolean {
    return !frame || frame.layers.every((layer) => Object.keys(layer.cells).length === 0)
  }

  function isAnimationEmpty(projectToCheck: SpriteProject, animationId: AnimationId): boolean {
    const animation = getAnimation(projectToCheck, animationId)
    return !!animation && animation.frameIds.every((frameId) => isFrameEmpty(getFrame(projectToCheck, frameId)))
  }

  function shouldReplaceSelectedAnimationForDraft(sourceInstruction: string): boolean {
    if (isAnimationEmpty(project, selectedAnimation.id)) {
      return true
    }

    return /\b(replace|overwrite|redo|remake|update|revise)\b/i.test(sourceInstruction)
  }

  function duplicateSelectedAtlasFrames() {
    const selectedIds = selectedAtlasFrameIdsInRow.length ? selectedAtlasFrameIdsInRow : [selectedFrameId]
    const insertionIndex = Math.max(...selectedIds.map((frameId) => frameIds.indexOf(frameId))) + 1
    const createdFrameIds: FrameId[] = []
    const timestamp = Date.now()

    updateProject((draft) => {
      const animation = getAnimation(draft, selectedAnimation.id)
      if (!animation) {
        return
      }

      const duplicatedFrames = selectedIds.flatMap((frameId, index) => {
        const source = getFrame(draft, frameId)
        if (!source) {
          return []
        }

        const id = createUniqueFrameId(draft, `frame-${timestamp}-${index + 1}`)
        const duplicate: SpriteFrame = {
          ...structuredClone(source),
          id,
          name: `${source.name} Copy`,
        }
        createdFrameIds.push(id)
        return [duplicate]
      })

      if (!duplicatedFrames.length) {
        return
      }

      draft.frames.push(...duplicatedFrames)
      animation.frameIds.splice(insertionIndex, 0, ...createdFrameIds)
      setSelectedFrameId(createdFrameIds[0])
      setSelectedAtlasFrameIds(new Set(createdFrameIds))
      setAtlasSelectionAnchorId(createdFrameIds[0])
      setPreviewIndex(insertionIndex)
    })

    if (createdFrameIds.length) {
      clearPatchProposalState()
      setProviderMessage(
        `Duplicated ${createdFrameIds.length} selected frame${createdFrameIds.length === 1 ? '' : 's'}.`,
      )
    }
  }

  function deleteSelectedAtlasFrames() {
    const selectedIds = selectedAtlasFrameIdsInRow.length ? selectedAtlasFrameIdsInRow : [selectedFrameId]
    if (frameIds.length - selectedIds.length < 1) {
      setProviderMessage('Keep at least one frame in the atlas row.')
      return
    }

    const selectedIdSet = new Set(selectedIds)
    const firstSelectedIndex = Math.min(...selectedIds.map((frameId) => frameIds.indexOf(frameId)))
    const remainingFrameIds = frameIds.filter((frameId) => !selectedIdSet.has(frameId))
    const nextSelectedFrameId =
      remainingFrameIds[Math.min(firstSelectedIndex, remainingFrameIds.length - 1)] ?? remainingFrameIds[0]

    updateProject((draft) => {
      const animation = getAnimation(draft, selectedAnimation.id)
      if (!animation || !nextSelectedFrameId) {
        return
      }

      animation.frameIds = animation.frameIds.filter((frameId) => !selectedIdSet.has(frameId))
      const stillReferencedFrameIds = new Set(draft.animations.flatMap((item) => item.frameIds))
      draft.frames = draft.frames.filter((frame) => !selectedIdSet.has(frame.id) || stillReferencedFrameIds.has(frame.id))
      setSelectedFrameId(nextSelectedFrameId)
      setSelectedAtlasFrameIds(new Set([nextSelectedFrameId]))
      setAtlasSelectionAnchorId(nextSelectedFrameId)
      setPreviewIndex(animation.frameIds.indexOf(nextSelectedFrameId))
    })

    clearPatchProposalState()
    setProviderMessage(`Deleted ${selectedIds.length} selected frame${selectedIds.length === 1 ? '' : 's'}.`)
  }

  function setSelectedAtlasFrameDuration(durationMs: number) {
    const nextDurationMs = Math.round(durationMs)
    if (!Number.isInteger(nextDurationMs) || nextDurationMs <= 0) {
      setProviderMessage('Frame duration must be a positive whole number of milliseconds.')
      return
    }

    const selectedIds = selectedAtlasFrameIdsInRow.length ? selectedAtlasFrameIdsInRow : [selectedFrameId]
    commitProject(updateFramesPropertiesInProject(project, selectedIds, { durationMs: nextDurationMs }))
    clearPatchProposalState()
    setProviderMessage(
      `Set duration to ${nextDurationMs}ms on ${selectedIds.length} selected frame${
        selectedIds.length === 1 ? '' : 's'
      }.`,
    )
  }

  function setSelectedAtlasFrameTags(tagsInput: string) {
    const tags = parseTagsInput(tagsInput)
    if (!tags.length) {
      setProviderMessage('Enter at least one tag for selected frames.')
      return
    }

    const selectedIds = selectedAtlasFrameIdsInRow.length ? selectedAtlasFrameIdsInRow : [selectedFrameId]
    commitProject(updateFramesPropertiesInProject(project, selectedIds, { tags }))
    clearPatchProposalState()
    setProviderMessage(
      `Set tags on ${selectedIds.length} selected frame${selectedIds.length === 1 ? '' : 's'}.`,
    )
  }

  function setSelectedAtlasFrameNotes(notes: string) {
    const selectedIds = selectedAtlasFrameIdsInRow.length ? selectedAtlasFrameIdsInRow : [selectedFrameId]
    commitProject(updateFramesPropertiesInProject(project, selectedIds, { notes }))
    clearPatchProposalState()
    setProviderMessage(
      `Set notes on ${selectedIds.length} selected frame${selectedIds.length === 1 ? '' : 's'}.`,
    )
  }

  function confirmReplaceProject(): boolean {
    return (
      !hasUnsavedChanges ||
      window.confirm('Replace the current project without exporting Project JSON? Unsaved editable work will be lost.')
    )
  }

  function openProject(nextProject: SpriteProject, message = '', dirty = false) {
    const animation = getAnimation(nextProject, nextProject.metadata.defaultAnimationId) ?? nextProject.animations[0]
    setUndoStack([])
    setRedoStack([])
    setProject(nextProject)
    setHasUnsavedChanges(dirty)
    setSelectedAnimationId(animation.id)
    setSelectedFrameId(animation.frameIds[0])
    setSelectedAtlasFrameIds(new Set([animation.frameIds[0]]))
    setAtlasSelectionAnchorId(animation.frameIds[0])
    setDraggedAtlasFrame(null)
    setSelectedLayerId(nextProject.metadata.defaultLayerId)
    setSelectedColorId(getFirstPaintColorId(nextProject))
    setInstruction(getDefaultPatchInstruction(nextProject))
    setTool('paint')
    setPreviewIndex(0)
    setProposedPatch([])
    setImportErrors([])
    setProviderMessage(message)
    setAppMode('editor')
    setWorkspaceMode('frame')
  }

  function createProjectFromTemplate(templateId = newProjectTemplateId) {
    if (!confirmReplaceProject()) {
      return
    }

    const template = getProjectTemplate(templateId)
    const nextProject = template.createProject({
      name: newProjectName,
      width: newProjectWidth,
      height: newProjectHeight,
      assetType: newProjectAssetType,
    })
    openProject(nextProject, 'New project created. Undo history reset.', true)
  }

  function updateProject(mutator: (draft: SpriteProject) => void) {
    const nextProject = cloneProject(project)
    mutator(nextProject)
    nextProject.metadata.updatedAt = new Date().toISOString()
    commitProject(nextProject)
  }

  function paintCell(x: number, y: number) {
    if (!selectedLayer?.editable) {
      setProviderMessage(`Layer "${selectedLayer?.name ?? selectedLayerId}" is locked.`)
      return
    }

    const key = cellKey(x, y)
    if (lastPaintKey === `${tool}:${selectedColorId}:${key}`) {
      return
    }

    const currentColor = getLayerColorId(project, selectedFrameId, selectedLayerId, x, y)
    const operation: PixelPatchOperation =
      tool === 'erase' ? { op: 'clear', x, y } : { op: 'set', x, y, colorId: selectedColorId }

    if (tool === 'paint' && currentColor === selectedColorId) {
      return
    }

    if (tool === 'erase' && !currentColor) {
      return
    }

    commitProject(applyPatch(project, selectedAnimation.id, selectedFrameId, selectedLayerId, [operation]))
    setLastPaintKey(`${tool}:${selectedColorId}:${key}`)
    setProposedPatch([])
  }

  function undo() {
    const previous = undoStack.at(-1)
    if (!previous) {
      return
    }
    const animation = getAnimation(previous, selectedAnimationId) ?? previous.animations[0]
    const frameId = animation.frameIds.includes(selectedFrameId) ? selectedFrameId : animation.frameIds[0]
    setRedoStack((stack) => [...stack, cloneProject(project)])
    setUndoStack((stack) => stack.slice(0, -1))
    setProject(previous)
    setSelectedAnimationId(animation.id)
    setSelectedFrameId(frameId)
    setPreviewIndex(animation.frameIds.indexOf(frameId))
    setSelectedAtlasFrameIds(new Set([frameId]))
    setAtlasSelectionAnchorId(frameId)
    clearPatchProposalState()
    setDraggedAtlasFrame(null)
  }

  function redo() {
    const next = redoStack.at(-1)
    if (!next) {
      return
    }
    const animation = getAnimation(next, selectedAnimationId) ?? next.animations[0]
    const frameId = animation.frameIds.includes(selectedFrameId) ? selectedFrameId : animation.frameIds[0]
    setUndoStack((stack) => [...stack, cloneProject(project)])
    setRedoStack((stack) => stack.slice(0, -1))
    setProject(next)
    setSelectedAnimationId(animation.id)
    setSelectedFrameId(frameId)
    setPreviewIndex(animation.frameIds.indexOf(frameId))
    setSelectedAtlasFrameIds(new Set([frameId]))
    setAtlasSelectionAnchorId(frameId)
    clearPatchProposalState()
    setDraggedAtlasFrame(null)
  }

  function addFrame() {
    updateProject((draft) => {
      const animation = getAnimation(draft, selectedAnimation.id)
      const source = getFrame(draft, selectedFrameId)
      if (!animation || !source) {
        return
      }
      const id = `frame-${Date.now()}`
      const frame: SpriteFrame = {
        ...cloneProject({ ...draft, frames: [source] }).frames[0],
        id,
        name: `Frame ${animation.frameIds.length + 1}` ,
        notes: '',
        tags: [],
        layers: source.layers.map((layer) => ({ ...layer, cells: {} })),
      }
      draft.frames.push(frame)
      animation.frameIds.splice(selectedFrameIndex + 1, 0, id)
      setSelectedFrameId(id)
      setSelectedAtlasFrameIds(new Set([id]))
      setAtlasSelectionAnchorId(id)
    })
  }

  function duplicateFrame() {
    updateProject((draft) => {
      const animation = getAnimation(draft, selectedAnimation.id)
      const source = getFrame(draft, selectedFrameId)
      if (!animation || !source) {
        return
      }
      const id = `frame-${Date.now()}`
      const frame = structuredClone(source)
      frame.id = id
      frame.name = `${source.name} Copy`
      draft.frames.push(frame)
      animation.frameIds.splice(selectedFrameIndex + 1, 0, id)
      setSelectedFrameId(id)
      setSelectedAtlasFrameIds(new Set([id]))
      setAtlasSelectionAnchorId(id)
    })
  }

  function deleteFrame() {
    if (frameIds.length <= 1) {
      return
    }

    const nextSelectedFrameId = frameIds[selectedFrameIndex - 1] ?? frameIds[selectedFrameIndex + 1]
    updateProject((draft) => {
      const animation = getAnimation(draft, selectedAnimation.id)
      if (!animation) {
        return
      }
      animation.frameIds = animation.frameIds.filter((frameId) => frameId !== selectedFrameId)
      draft.frames = draft.frames.filter((frame) => frame.id !== selectedFrameId)
      setSelectedFrameId(nextSelectedFrameId)
      setSelectedAtlasFrameIds(new Set([nextSelectedFrameId]))
      setAtlasSelectionAnchorId(nextSelectedFrameId)
    })
  }

  async function generateOllamaPatch() {
    const attemptContext: ProviderAttemptContext = {
      attempt: ollamaAttemptRef.current + 1,
      startedAt: performance.now(),
    }
    ollamaAttemptRef.current = attemptContext.attempt
    if (spriteWritePromptIntent.mode === 'animation-draft') {
      await generateOllamaAnimationDraft(spriteWritePromptIntent, attemptContext)
      return
    }

    setProviderMessage(
      `Attempt ${attemptContext.attempt}: ${spriteWritePromptIntent.summary} Asking Ollama model "${activeOllamaModel}" for editable JSON...${
        ollamaModelSuitabilityNote ? ` ${ollamaModelSuitabilityNote}` : ''
      }`,
    )
    clearProviderDiagnostics()
    setIsOllamaBusy(true)
    try {
      const provider = new OllamaPatchProvider({ baseUrl: ollamaBaseUrl, model: normalizedOllamaModel })
      const maxOperations =
        spriteWritePromptIntent.mode === 'frame-draft' ? getMaxOllamaDraftOperations(project) : 24
      const patch = await provider.requestPatch({
        project,
        animationId: selectedAnimation.id,
        frameId: selectedFrameId,
        layerId: selectedLayerId,
        instruction: spriteWritePromptIntent.paddedInstruction,
        constraints: { selectedColorId, maxOperations },
      })
      const validation = validatePatch(project, selectedAnimation.id, selectedFrameId, selectedLayerId, patch)
      setProposedPatch(patch)
      setProviderDetails(
        formatProviderDetails('Ollama frame edit response', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          mode: spriteWritePromptIntent.mode,
          userInstruction: spriteWritePromptIntent.userInstruction,
          paddedInstruction: spriteWritePromptIntent.paddedInstruction,
          baseUrl: ollamaBaseUrl,
          model: normalizedOllamaModel,
          maxOperations,
          validationErrors: validation.errors,
          patch,
        }),
      )
      setProviderMessage(
        validation.valid
          ? `Attempt ${attemptContext.attempt} completed in ${formatElapsedMs(
              attemptContext.startedAt,
            )}. Ollama proposed ${patch.length} change${patch.length === 1 ? '' : 's'}. Review before applying.`
          : `Attempt ${attemptContext.attempt} completed in ${formatElapsedMs(
              attemptContext.startedAt,
            )}. Ollama returned ${patch.length} change${
              patch.length === 1 ? '' : 's'
            }, but validation found issues. The canvas overlay is hidden until the edit is valid.`,
      )
    } catch (error) {
      setProposedPatch([])
      setProviderMessage(formatOllamaError(error, ollamaBaseUrl))
      setProviderDetails(
        formatProviderDetails('Ollama frame edit error', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          mode: spriteWritePromptIntent.mode,
          userInstruction: spriteWritePromptIntent.userInstruction,
          paddedInstruction: spriteWritePromptIntent.paddedInstruction,
          baseUrl: ollamaBaseUrl,
          model: normalizedOllamaModel,
          error: formatErrorForDetails(error),
        }),
      )
    } finally {
      setIsOllamaBusy(false)
    }
  }

  async function generateOllamaAnimationDraft(
    intent: SpriteWritePromptIntent = spriteWritePromptIntent,
    attemptContext: ProviderAttemptContext = {
      attempt: ollamaAttemptRef.current + 1,
      startedAt: performance.now(),
    },
  ) {
    ollamaAttemptRef.current = Math.max(ollamaAttemptRef.current, attemptContext.attempt)
    setProviderMessage(
      `Attempt ${attemptContext.attempt}: ${intent.summary} Asking Ollama model "${activeOllamaModel}" for structured editable frames...${
        ollamaModelSuitabilityNote ? ` ${ollamaModelSuitabilityNote}` : ''
      }`,
    )
    setProposedPatch([])
    clearProviderDiagnostics()
    setIsOllamaBusy(true)

    try {
      const provider = new OllamaPatchProvider({ baseUrl: ollamaBaseUrl, model: normalizedOllamaModel })
      const maxDraftOperations = getMaxOllamaDraftOperations(project)
      if (intent.variationCount > 1) {
        const result = await requestImprovedAnimationSetDraft(
          provider,
          {
            project,
            animationId: selectedAnimation.id,
            frameId: selectedFrameId,
            layerId: selectedLayerId,
            instruction: intent.paddedInstruction,
            constraints: { selectedColorId, maxOperations: maxDraftOperations },
            frameCount: intent.frameCount,
            variationCount: intent.variationCount,
          },
          {
            project,
            animationId: selectedAnimation.id,
            frameId: selectedFrameId,
            layerId: selectedLayerId,
            userInstruction: intent.userInstruction,
            requestedFrameCount: intent.frameCount,
            requestedVariationCount: intent.variationCount,
            allowDistributed: allowsDistributedDraft(intent),
          },
        )
        applyOllamaAnimationSetDraft(result.draft, intent.userInstruction, intent, attemptContext, result.attempts)
        return
      }

      const result = await requestImprovedAnimationDraft(
        provider,
        {
          project,
          animationId: selectedAnimation.id,
          frameId: selectedFrameId,
          layerId: selectedLayerId,
          instruction: intent.paddedInstruction,
          constraints: { selectedColorId, maxOperations: maxDraftOperations },
          frameCount: intent.frameCount,
        },
        {
          project,
          animationId: selectedAnimation.id,
          frameId: selectedFrameId,
          layerId: selectedLayerId,
          userInstruction: intent.userInstruction,
          requestedFrameCount: intent.frameCount,
          allowDistributed: allowsDistributedDraft(intent),
        },
      )
      applyOllamaAnimationDraft(result.draft, intent.userInstruction, intent, attemptContext, result.attempts)
    } catch (error) {
      setProposedPatch([])
      setProviderMessage(formatOllamaError(error, ollamaBaseUrl))
      setProviderDetails(
        formatProviderDetails('Ollama animation draft error', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          mode: intent.mode,
          userInstruction: intent.userInstruction,
          paddedInstruction: intent.paddedInstruction,
          requestedFrameCount: intent.frameCount,
          baseUrl: ollamaBaseUrl,
          model: normalizedOllamaModel,
          error: formatErrorForDetails(error),
        }),
      )
    } finally {
      setIsOllamaBusy(false)
    }
  }

  function mergeDraftPaletteAdditions(
    baseProject: SpriteProject,
    additions: PaletteColor[] | undefined,
  ): { project: SpriteProject; errors: string[] } {
    if (!additions?.length) {
      return { project: baseProject, errors: [] }
    }

    let nextProject = baseProject
    const errors: string[] = []
    const seenIds = new Set<string>()

    additions.forEach((color, index) => {
      const id = color.id.trim()
      if (!id) {
        errors.push(`Palette addition ${index + 1}: color id must not be empty.`)
        return
      }
      if (seenIds.has(id) || getColor(nextProject, id)) {
        seenIds.add(id)
        return
      }
      seenIds.add(id)

      try {
        nextProject = addPaletteColorToProject(nextProject, {
          id,
          name: color.name,
          hex: color.hex,
        })
      } catch (error) {
        errors.push(
          `Palette addition "${id}": ${error instanceof Error ? error.message : 'could not be added.'}`,
        )
      }
    })

    return { project: nextProject, errors }
  }

  function applyOllamaAnimationDraft(
    draft: OllamaAnimationDraft,
    sourceInstruction = instruction,
    intent: SpriteWritePromptIntent = spriteWritePromptIntent,
    attemptContext: ProviderAttemptContext = {
      attempt: ollamaAttemptRef.current,
      startedAt: performance.now(),
    },
    qualityAttempts: Array<OllamaDraftQualityAttempt<OllamaAnimationDraft>> = [],
  ) {
    if (!selectedFrame) {
      setProviderMessage('Cannot draft animation because no frame is selected.')
      setProviderDetails(
        formatProviderDetails('Ollama animation draft rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          reason: 'No selected frame.',
          qualityAttempts: formatDraftQualityAttempts(qualityAttempts),
          draft,
        }),
      )
      return
    }

    if (draft.frames.length < 3 || draft.frames.length > 6) {
      setProviderMessage('Ollama animation draft rejected. Expected 3 to 6 frames.')
      setProviderDetails(
        formatProviderDetails('Ollama animation draft rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          reason: 'Frame count outside supported MVP range.',
          receivedFrameCount: draft.frames.length,
          requestedFrameCount: intent.frameCount,
          qualityAttempts: formatDraftQualityAttempts(qualityAttempts),
          draft,
        }),
      )
      return
    }

    const timestamp = Date.now()
    const replaceSelectedAnimation = shouldReplaceSelectedAnimationForDraft(sourceInstruction)
    const oldFrameIds = replaceSelectedAnimation ? [...selectedAnimation.frameIds] : []
    const createdFrameIds: FrameId[] = []
    const createdAnimationIds: AnimationId[] = []
    let nextProject = cloneProject(project)
    const paletteMerge = mergeDraftPaletteAdditions(nextProject, draft.paletteAdditions)
    if (paletteMerge.errors.length) {
      setProviderMessage(
        `Attempt ${attemptContext.attempt} completed in ${formatElapsedMs(
          attemptContext.startedAt,
        )}. Ollama animation draft rejected. Palette additions were invalid; no frames were changed.`,
      )
      setProviderDetails(
        formatProviderDetails('Ollama animation draft rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          mode: intent.mode,
          userInstruction: intent.userInstruction,
          paddedInstruction: intent.paddedInstruction,
          validationErrors: paletteMerge.errors,
          qualityAttempts: formatDraftQualityAttempts(qualityAttempts),
          draft,
        }),
      )
      return
    }
    nextProject = paletteMerge.project
    const selectedTargetAnimation = getAnimation(nextProject, selectedAnimation.id)
    if (!selectedTargetAnimation) {
      setProviderMessage(`Cannot draft animation because animation "${selectedAnimation.id}" is missing.`)
      setProviderDetails(
        formatProviderDetails('Ollama animation draft rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          reason: 'Selected animation was missing.',
          animationId: selectedAnimation.id,
          draft,
        }),
      )
      return
    }

    const animation = replaceSelectedAnimation
      ? selectedTargetAnimation
      : {
          id: createUniqueAnimationId(
            nextProject,
            slugifyId(draft.animationName ?? 'ollama-draft', 'ollama-draft'),
          ),
          name: draft.animationName?.trim() || 'Ollama Draft',
          fps: draft.fps ?? selectedAnimation.fps,
          frameIds: [],
        }

    if (!replaceSelectedAnimation) {
      nextProject.animations.push(animation)
    }

    animation.name = draft.animationName?.trim() || animation.name
    animation.fps = draft.fps ?? animation.fps
    animation.frameIds = []
    createdAnimationIds.push(animation.id)

    draft.frames.forEach((frameDraft, index) => {
      const id = createUniqueFrameId(nextProject, `${animation.id}-ollama-${timestamp}-${index + 1}`)
      const frame: SpriteFrame = {
        ...structuredClone(selectedFrame),
        id,
        name: frameDraft.name?.trim() || `Ollama Draft ${index + 1}`,
        durationMs: frameDraft.durationMs ?? selectedFrame.durationMs,
        notes: `Structured Ollama draft for: ${sourceInstruction}`,
        tags: Array.from(new Set([...(selectedFrame.tags ?? []), 'ollama-draft'])),
        layers: selectedFrame.layers.map((layer) => ({ ...structuredClone(layer), cells: {} })),
      }
      nextProject.frames.push(frame)
      animation.frameIds.push(id)
      createdFrameIds.push(id)
    })

    const errors: string[] = []
    draft.frames.forEach((frameDraft, index) => {
      const frameId = createdFrameIds[index]
      const validation = validatePatch(nextProject, animation.id, frameId, selectedLayerId, frameDraft.patch)
      if (!validation.valid) {
        errors.push(...validation.errors.map((error) => `Frame ${index + 1}: ${error}`))
      }
      errors.push(
        ...getGeneratedPatchCoherenceErrors(
          frameDraft.patch,
          index + 1,
          project.canvas.width,
          project.canvas.height,
          { allowDistributed: allowsDistributedDraft(intent) },
        ),
      )
      if (!errors.length) {
        nextProject = applyPatch(nextProject, animation.id, frameId, selectedLayerId, frameDraft.patch)
      }
    })

    if (errors.length) {
      setProviderMessage(
        `Attempt ${attemptContext.attempt} completed in ${formatElapsedMs(
          attemptContext.startedAt,
        )}. Ollama animation draft rejected. ${errors.length} validation issue${
          errors.length === 1 ? '' : 's'
        } found; no frames were changed. ${summarizeProviderErrors(errors)}`,
      )
      setProviderDetails(
        formatProviderDetails('Ollama animation draft rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          mode: intent.mode,
          userInstruction: intent.userInstruction,
          paddedInstruction: intent.paddedInstruction,
          requestedFrameCount: intent.frameCount,
          receivedFrameCount: draft.frames.length,
          baseUrl: ollamaBaseUrl,
          model: normalizedOllamaModel,
          validationErrors: errors,
          qualityAttempts: formatDraftQualityAttempts(qualityAttempts),
          draft,
        }),
      )
      return
    }

    const activeFrameIds = new Set(nextProject.animations.flatMap((candidate) => candidate.frameIds))
    nextProject.frames = nextProject.frames.filter(
      (frame) => !oldFrameIds.includes(frame.id) || activeFrameIds.has(frame.id),
    )
    nextProject.metadata.updatedAt = new Date().toISOString()

    const appliedPlacementMessage = replaceSelectedAnimation ? `to "${animation.name}"` : `as new row "${animation.name}"`
    const draftPlacementMessage = replaceSelectedAnimation ? `for "${animation.name}"` : `as new row "${animation.name}"`
    const appliedMessage = `Ollama ${replaceSelectedAnimation ? 'applied' : 'added'} ${
      createdFrameIds.length
    } editable frame${
      createdFrameIds.length === 1 ? '' : 's'
    } ${appliedPlacementMessage}.`
    setProposedPatch([])
    setProviderMessage(
      `Attempt ${attemptContext.attempt} completed in ${formatElapsedMs(
        attemptContext.startedAt,
      )}. Ollama drafted ${createdFrameIds.length} editable frame${
        createdFrameIds.length === 1 ? '' : 's'
      } ${draftPlacementMessage}. Review before applying.`,
    )
    setPendingAnimationDraft({
      project: nextProject,
      animationId: animation.id,
      frameId: createdFrameIds[0],
      atlasFrameIds: [createdFrameIds[0]],
      workspaceMode: 'frame',
      appliedMessage,
    })
    setProviderReview(createAnimationDraftReview(project, draft, createdFrameIds, qualityAttempts))
    setProviderDetails(
      formatProviderDetails('Ollama animation draft staged', {
        attempt: attemptContext.attempt,
        elapsedMs: formatElapsedMs(attemptContext.startedAt),
        mode: intent.mode,
        userInstruction: intent.userInstruction,
        paddedInstruction: intent.paddedInstruction,
        requestedFrameCount: intent.frameCount,
        replacedSelectedAnimation: replaceSelectedAnimation,
        createdAnimationIds,
        createdFrameIds,
        animationName: animation.name,
        qualityAttempts: formatDraftQualityAttempts(qualityAttempts),
        draft,
      }),
    )
  }

  function applyOllamaAnimationSetDraft(
    setDraft: OllamaAnimationSetDraft,
    sourceInstruction = instruction,
    intent: SpriteWritePromptIntent = spriteWritePromptIntent,
    attemptContext: ProviderAttemptContext = {
      attempt: ollamaAttemptRef.current,
      startedAt: performance.now(),
    },
    qualityAttempts: Array<OllamaDraftQualityAttempt<OllamaAnimationSetDraft>> = [],
  ) {
    if (!selectedFrame) {
      setProviderMessage('Cannot draft animation set because no frame is selected.')
      setProviderDetails(
        formatProviderDetails('Ollama animation set rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          reason: 'No selected frame.',
          qualityAttempts: formatDraftQualityAttempts(qualityAttempts),
          setDraft,
        }),
      )
      return
    }

    if (!setDraft.animations.length) {
      setProviderMessage('Ollama animation set rejected. No animation rows were returned.')
      setProviderDetails(
        formatProviderDetails('Ollama animation set rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          reason: 'No animations returned.',
          qualityAttempts: formatDraftQualityAttempts(qualityAttempts),
          setDraft,
        }),
      )
      return
    }

    const timestamp = Date.now()
    const replaceSelectedAnimation = shouldReplaceSelectedAnimationForDraft(sourceInstruction)
    const oldFrameIds = replaceSelectedAnimation ? [...selectedAnimation.frameIds] : []
    let nextProject = cloneProject(project)
    const paletteMerge = mergeDraftPaletteAdditions(
      nextProject,
      setDraft.animations.flatMap((animationDraft) => animationDraft.paletteAdditions ?? []),
    )
    if (paletteMerge.errors.length) {
      setProviderMessage(
        `Attempt ${attemptContext.attempt} completed in ${formatElapsedMs(
          attemptContext.startedAt,
        )}. Ollama animation set rejected. Palette additions were invalid; no frames were changed.`,
      )
      setProviderDetails(
        formatProviderDetails('Ollama animation set rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          mode: intent.mode,
          userInstruction: intent.userInstruction,
          paddedInstruction: intent.paddedInstruction,
          validationErrors: paletteMerge.errors,
          qualityAttempts: formatDraftQualityAttempts(qualityAttempts),
          setDraft,
        }),
      )
      return
    }
    nextProject = paletteMerge.project
    const errors: string[] = []
    const createdFrameIds: FrameId[] = []
    const createdAnimationIds: AnimationId[] = []
    const framePatches: Array<{
      animationId: AnimationId
      frameId: FrameId
      frameNumber: number
      patch: PixelPatchOperation[]
    }> = []

    setDraft.animations.forEach((animationDraft, animationIndex) => {
      const useSelectedAnimation = replaceSelectedAnimation && animationIndex === 0
      const animationId =
        useSelectedAnimation
          ? selectedAnimation.id
          : createUniqueAnimationId(
              nextProject,
              slugifyId(animationDraft.animationName ?? `ollama-draft-${animationIndex + 1}`, 'ollama-draft'),
            )
      const animation =
        useSelectedAnimation
          ? getAnimation(nextProject, selectedAnimation.id)
          : {
              id: animationId,
              name: animationDraft.animationName?.trim() || `Ollama Draft ${animationIndex + 1}`,
              fps: animationDraft.fps ?? selectedAnimation.fps,
              frameIds: [],
            }

      if (!animation) {
        errors.push(`Animation row ${animationIndex + 1}: target animation "${selectedAnimation.id}" is missing.`)
        return
      }

      if (!useSelectedAnimation) {
        nextProject.animations.push(animation)
      }

      animation.name = animationDraft.animationName?.trim() || animation.name
      animation.fps = animationDraft.fps ?? animation.fps
      animation.frameIds = []
      createdAnimationIds.push(animation.id)

      animationDraft.frames.forEach((frameDraft, frameIndex) => {
        const frameId = createUniqueFrameId(
          nextProject,
          `${animation.id}-ollama-${timestamp}-${frameIndex + 1}`,
        )
        const frame: SpriteFrame = {
          ...structuredClone(selectedFrame),
          id: frameId,
          name: frameDraft.name?.trim() || `${animation.name} ${String(frameIndex + 1).padStart(3, '0')}`,
          durationMs: frameDraft.durationMs ?? selectedFrame.durationMs,
          notes: `Structured Ollama draft for: ${sourceInstruction}`,
          tags: Array.from(new Set([...(selectedFrame.tags ?? []), 'ollama-draft'])),
          layers: selectedFrame.layers.map((layer) => ({ ...structuredClone(layer), cells: {} })),
        }
        nextProject.frames.push(frame)
        animation.frameIds.push(frameId)
        createdFrameIds.push(frameId)
        framePatches.push({
          animationId: animation.id,
          frameId,
          frameNumber: frameIndex + 1,
          patch: frameDraft.patch,
        })
      })
    })

    framePatches.forEach(({ animationId, frameId, frameNumber, patch }) => {
      const validation = validatePatch(nextProject, animationId, frameId, selectedLayerId, patch)
      if (!validation.valid) {
        errors.push(...validation.errors.map((error) => `${animationId} frame ${frameNumber}: ${error}`))
      }
      errors.push(
        ...getGeneratedPatchCoherenceErrors(
          patch,
          frameNumber,
          project.canvas.width,
          project.canvas.height,
          { allowDistributed: allowsDistributedDraft(intent) },
        ).map((error) => `${animationId}: ${error}`),
      )
    })

    if (!createdFrameIds.length) {
      errors.push('Ollama returned animation rows, but no editable frames were created.')
    }

    if (errors.length) {
      setProviderMessage(
        `Attempt ${attemptContext.attempt} completed in ${formatElapsedMs(
          attemptContext.startedAt,
        )}. Ollama animation set rejected. ${errors.length} validation issue${
          errors.length === 1 ? '' : 's'
        } found; no frames were changed. ${summarizeProviderErrors(errors)}`,
      )
      setProviderDetails(
        formatProviderDetails('Ollama animation set rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          mode: intent.mode,
          userInstruction: intent.userInstruction,
          paddedInstruction: intent.paddedInstruction,
          requestedFrameCount: intent.frameCount,
          requestedVariationCount: intent.variationCount,
          baseUrl: ollamaBaseUrl,
          model: normalizedOllamaModel,
          validationErrors: errors,
          qualityAttempts: formatDraftQualityAttempts(qualityAttempts),
          setDraft,
        }),
      )
      return
    }

    framePatches.forEach(({ animationId, frameId, patch }) => {
      nextProject = applyPatch(nextProject, animationId, frameId, selectedLayerId, patch)
    })

    const activeFrameIds = new Set(nextProject.animations.flatMap((candidate) => candidate.frameIds))
    nextProject.frames = nextProject.frames.filter(
      (frame) => !oldFrameIds.includes(frame.id) || activeFrameIds.has(frame.id),
    )
    nextProject.metadata.updatedAt = new Date().toISOString()

    const appliedMessage = `Ollama applied ${setDraft.animations.length} animation row${
      setDraft.animations.length === 1 ? '' : 's'
    } with ${createdFrameIds.length} editable frame${createdFrameIds.length === 1 ? '' : 's'}.`
    setProposedPatch([])
    setProviderMessage(
      `Attempt ${attemptContext.attempt} completed in ${formatElapsedMs(
        attemptContext.startedAt,
      )}. Ollama drafted ${setDraft.animations.length} animation row${
        setDraft.animations.length === 1 ? '' : 's'
      } with ${createdFrameIds.length} editable frame${
        createdFrameIds.length === 1 ? '' : 's'
      }. Review before applying.`,
    )
    setPendingAnimationDraft({
      project: nextProject,
      animationId: createdAnimationIds[0] ?? selectedAnimation.id,
      frameId: createdFrameIds[0],
      atlasFrameIds: [createdFrameIds[0]],
      workspaceMode: 'sheet',
      appliedMessage,
    })
    setProviderReview(createAnimationSetDraftReview(project, setDraft, qualityAttempts))
    setProviderDetails(
      formatProviderDetails('Ollama animation set staged', {
        attempt: attemptContext.attempt,
        elapsedMs: formatElapsedMs(attemptContext.startedAt),
        mode: intent.mode,
        userInstruction: intent.userInstruction,
        paddedInstruction: intent.paddedInstruction,
        requestedFrameCount: intent.frameCount,
        requestedVariationCount: intent.variationCount,
        replacedSelectedAnimation: replaceSelectedAnimation,
        createdAnimationIds,
        createdFrameIds,
        qualityAttempts: formatDraftQualityAttempts(qualityAttempts),
        setDraft,
      }),
    )
  }

  async function refreshOllamaModels() {
    setProviderMessage(`Checking Ollama at ${ollamaBaseUrl}...`)
    clearProviderDiagnostics()
    setIsOllamaBusy(true)
    try {
      const models = await listOllamaModels(ollamaBaseUrl)
      setOllamaModels(models)
      const selectedModel =
        models.length &&
        !models.some((model) => normalizeModelValue(model.name) === normalizeModelValue(activeOllamaModel))
          ? choosePreferredOllamaModel(models)?.name ?? models[0].name
          : activeOllamaModel
      if (selectedModel) {
        setOllamaModel(selectedModel)
      }
      setProviderMessage(
        models.length
          ? `Found ${models.length} local Ollama model${models.length === 1 ? '' : 's'}: ${models
              .map((model) => model.name)
              .join(', ')}.`
          : 'Ollama is running, but no local models were reported.',
      )
      setProviderDetails(
        formatProviderDetails('Ollama model refresh result', {
          baseUrl: ollamaBaseUrl,
          selectedModel,
          modelCount: models.length,
          models,
        }),
      )
    } catch (error) {
      setProviderMessage(formatOllamaError(error, ollamaBaseUrl))
      setProviderDetails(
        formatProviderDetails('Ollama model refresh error', {
          baseUrl: ollamaBaseUrl,
          error: formatErrorForDetails(error),
        }),
      )
    } finally {
      setIsOllamaBusy(false)
    }
  }

  async function downloadOllamaModel() {
    setProviderMessage(`Downloading Ollama model "${activeOllamaModel}"...`)
    clearProviderDiagnostics()
    setIsOllamaBusy(true)
    try {
      const message = await pullOllamaModel(ollamaBaseUrl, normalizedOllamaModel)
      const models = await listOllamaModels(ollamaBaseUrl)
      setOllamaModels(models)
      setProviderMessage(`${message} Ready for structured edit requests.`)
      setProviderDetails(
        formatProviderDetails('Ollama model download result', {
          baseUrl: ollamaBaseUrl,
          downloadedModel: activeOllamaModel,
          modelCount: models.length,
          models,
        }),
      )
    } catch (error) {
      setProviderMessage(formatOllamaError(error, ollamaBaseUrl))
      setProviderDetails(
        formatProviderDetails('Ollama model download error', {
          baseUrl: ollamaBaseUrl,
          model: normalizedOllamaModel,
          error: formatErrorForDetails(error),
        }),
      )
    } finally {
      setIsOllamaBusy(false)
    }
  }

  function applyProposedPatch() {
    const validation = validatePatch(
      project,
      selectedAnimation.id,
      selectedFrameId,
      selectedLayerId,
      activeProposedPatch,
    )
    if (!validation.valid) {
      setProviderDetails(
        formatProviderDetails('Edit apply blocked by validation', {
          validationErrors: validation.errors,
          activePatch: activeProposedPatch,
        }),
      )
      return
    }
    commitProject(applyPatch(project, selectedAnimation.id, selectedFrameId, selectedLayerId, activeProposedPatch))
    setProposedPatch([])
    setProviderMessage('Edit applied.')
    clearProviderDiagnostics()
  }

  function applyPendingAnimationDraft() {
    if (!pendingAnimationDraft) {
      return
    }

    commitProject(pendingAnimationDraft.project)
    setSelectedAnimationId(pendingAnimationDraft.animationId)
    setSelectedFrameId(pendingAnimationDraft.frameId)
    setSelectedAtlasFrameIds(new Set(pendingAnimationDraft.atlasFrameIds))
    setAtlasSelectionAnchorId(pendingAnimationDraft.frameId)
    setPreviewIndex(0)
    setWorkspaceMode(pendingAnimationDraft.workspaceMode)
    setProposedPatch([])
    setProviderMessage(pendingAnimationDraft.appliedMessage)
    setPendingAnimationDraft(null)
  }

  function rejectPendingAnimationDraft() {
    if (!pendingAnimationDraft) {
      return
    }

    setPendingAnimationDraft(null)
    setProviderReview(null)
    setProviderDetails('')
    setProviderMessage('Ollama draft rejected. No project data changed.')
  }

  function rejectPatch() {
    setProposedPatch([])
    setProviderMessage('Edit rejected.')
    clearProviderDiagnostics()
  }

  function runCommand(command: CommandItem) {
    if (command.disabled) {
      return
    }

    void command.run()
    setIsCommandPaletteOpen(false)
    setCommandQuery('')
  }

  function exportProjectJson() {
    setImportErrors([])
    downloadTextFile(`${project.name.replace(/\s+/g, '-').toLowerCase()}.spritewrite.json`, JSON.stringify(project, null, 2))
    setHasUnsavedChanges(false)
  }

  function importProjectJson(file: File | undefined) {
    if (!file) {
      return
    }

    file
      .text()
      .then((text) => {
        const parsed = JSON.parse(text) as unknown
        const validation = validateProject(parsed)
        if (!validation.valid) {
          setImportErrors(validation.errors)
          setProviderMessage('Import rejected.')
          return
        }

        if (!confirmReplaceProject()) {
          return
        }

        openProject(validation.value, 'Project imported. Undo history reset.')
      })
      .catch((error) => {
        const message = error instanceof Error ? error.message : 'Could not import project JSON.'
        setImportErrors([message])
        setProviderMessage('Import failed.')
      })
  }

  async function exportCurrentFramePng() {
    try {
      flushProviderMessage(setProviderMessage, 'Preparing current frame PNG...')
      const blob = await exportFramePng(project, selectedFrameId, exportScale)
      flushProviderMessage(setProviderMessage, 'Current frame PNG ready for download.')
      downloadBlob(`${selectedFrameId}@${exportScale}x.png`, blob)
    } catch (error) {
      setProviderMessage(`Current frame PNG export failed: ${formatUnknownError(error)}`)
    }
  }

  async function exportAnimationStripPng() {
    try {
      flushProviderMessage(setProviderMessage, 'Preparing current animation strip PNG...')
      const blob = await exportSpritesheetPng(project, selectedAnimation.id, {
        scale: exportScale,
        margin: exportMargin,
        spacing: exportSpacing,
      })
      flushProviderMessage(setProviderMessage, 'Current animation strip PNG ready for download.')
      downloadBlob(`${selectedAnimation.id}-animation-strip@${exportScale}x.png`, blob)
    } catch (error) {
      setProviderMessage(`Current animation strip PNG export failed: ${formatUnknownError(error)}`)
    }
  }

  async function exportFullSpriteSheetPngOnly() {
    try {
      flushProviderMessage(setProviderMessage, 'Preparing full sprite sheet PNG...')
      const blob = await exportFullSpriteSheetPng(project, {
        scale: exportScale,
        margin: exportMargin,
        spacing: exportSpacing,
        imageFilename: fullSpriteSheetImageFilename,
      })
      flushProviderMessage(setProviderMessage, 'Full sprite sheet PNG ready for download.')
      downloadBlob(fullSpriteSheetImageFilename, blob)
    } catch (error) {
      setProviderMessage(`Full sprite sheet PNG export failed: ${formatUnknownError(error)}`)
    }
  }

  async function exportFullSpriteSheetWithMetadata() {
    await exportFullSpriteSheetPngOnly()
    flushProviderMessage(setProviderMessage, 'Full sprite sheet PNG and metadata JSON ready for download.')
    downloadTextFile(
      fullSpriteSheetImageFilename.replace(/\.png$/i, '.metadata.json'),
      exportFullSpriteSheetMetadata(project, {
        scale: exportScale,
        margin: exportMargin,
        spacing: exportSpacing,
        imageFilename: fullSpriteSheetImageFilename,
      }),
    )
  }

  function updateFps(nextFps: number) {
    updateProject((draft) => {
      const animation = getAnimation(draft, selectedAnimation.id)
      if (animation) {
        animation.fps = nextFps
      }
    })
  }

  function beginRightPanelResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    const startX = event.clientX
    const startWidth = rightPanelWidth
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'

    const onPointerMove = (moveEvent: PointerEvent) => {
      setRightPanelWidth(
        clampNumber(startWidth - (moveEvent.clientX - startX), MIN_RIGHT_PANEL_WIDTH, MAX_RIGHT_PANEL_WIDTH),
      )
    }
    const stopPointerMove = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopPointerMove)
      window.removeEventListener('pointercancel', stopPointerMove)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopPointerMove, { once: true })
    window.addEventListener('pointercancel', stopPointerMove)
  }

  function beginPreviewBoxResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    const startX = event.clientX
    const startY = event.clientY
    const startWidth = rightPanelWidth
    const startHeight = previewBoxHeight
    document.body.style.cursor = 'nwse-resize'
    document.body.style.userSelect = 'none'

    const onPointerMove = (moveEvent: PointerEvent) => {
      setRightPanelWidth(clampNumber(startWidth + (moveEvent.clientX - startX), MIN_RIGHT_PANEL_WIDTH, MAX_RIGHT_PANEL_WIDTH))
      setPreviewBoxHeight(
        clampNumber(startHeight + (moveEvent.clientY - startY), MIN_PREVIEW_BOX_HEIGHT, MAX_PREVIEW_BOX_HEIGHT),
      )
    }
    const stopPointerMove = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopPointerMove)
      window.removeEventListener('pointercancel', stopPointerMove)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopPointerMove, { once: true })
    window.addEventListener('pointercancel', stopPointerMove)
  }

  function beginAtlasPanelResize(event: ReactPointerEvent<HTMLButtonElement>) {
    event.preventDefault()
    const startY = event.clientY
    const startHeight = atlasPanelHeight
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'

    const onPointerMove = (moveEvent: PointerEvent) => {
      setAtlasPanelHeight(
        clampNumber(startHeight - (moveEvent.clientY - startY), MIN_ATLAS_PANEL_HEIGHT, MAX_ATLAS_PANEL_HEIGHT),
      )
    }
    const stopPointerMove = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', stopPointerMove)
      window.removeEventListener('pointercancel', stopPointerMove)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', stopPointerMove, { once: true })
    window.addEventListener('pointercancel', stopPointerMove)
  }

  function saveSelectedFrameProperties() {
    if (!selectedFrame) {
      return
    }

    const nextName = frameNameInputRef.current?.value ?? selectedFrame.name
    const nextNotes = frameNotesInputRef.current?.value ?? selectedFrame.notes ?? ''
    const nextTags = parseTagsInput(frameTagsInputRef.current?.value ?? selectedFrame.tags?.join(', ') ?? '')
    const nextDurationMs = Math.max(1, Math.round(selectedFrame.durationMs))
    if (
      nextName.trim() === selectedFrame.name &&
      nextDurationMs === selectedFrame.durationMs &&
      nextNotes === (selectedFrame.notes ?? '') &&
      tagsEqual(nextTags, selectedFrame.tags ?? [])
    ) {
      return
    }

    commitProject(
      updateFramePropertiesInProject(project, selectedFrame.id, {
        name: nextName,
        durationMs: nextDurationMs,
        notes: nextNotes,
        tags: nextTags,
      }),
    )
  }

  function updateSelectedFrameAnchor(axis: 'x' | 'y', value: number) {
    if (!selectedFrame) {
      return
    }

    const nextAnchor = {
      ...selectedFrame.anchor,
      [axis]: Math.max(
        0,
        Math.min(axis === 'x' ? project.canvas.width - 1 : project.canvas.height - 1, Math.round(value)),
      ),
    }

    commitProject(
      updateFramePropertiesInProject(project, selectedFrame.id, {
        anchor: nextAnchor,
      }),
    )
  }

  function setSelectedFrameHitboxEnabled(enabled: boolean) {
    if (!selectedFrame) {
      return
    }

    const defaultHitbox = {
      x: 0,
      y: 0,
      width: project.canvas.width,
      height: project.canvas.height,
    }
    commitProject(setFrameHitboxInProject(project, selectedFrame.id, enabled ? defaultHitbox : undefined))
  }

  function updateSelectedFrameHitbox(key: 'x' | 'y' | 'width' | 'height', value: number) {
    if (!selectedFrame?.hitbox) {
      return
    }

    const nextHitbox = {
      ...selectedFrame.hitbox,
      [key]: Math.round(value),
    }

    nextHitbox.x = Math.max(0, Math.min(project.canvas.width - 1, nextHitbox.x))
    nextHitbox.y = Math.max(0, Math.min(project.canvas.height - 1, nextHitbox.y))
    nextHitbox.width = Math.max(1, Math.min(project.canvas.width - nextHitbox.x, nextHitbox.width))
    nextHitbox.height = Math.max(1, Math.min(project.canvas.height - nextHitbox.y, nextHitbox.height))

    commitProject(setFrameHitboxInProject(project, selectedFrame.id, nextHitbox))
  }

  function addLayer() {
    const nextProject = addLayerToProject(project)
    const nextFrame = getFrame(nextProject, selectedFrameId) ?? nextProject.frames[0]
    const nextLayer = nextFrame?.layers.at(-1)
    commitProject(nextProject)
    if (nextLayer) {
      setSelectedLayerId(nextLayer.id)
    }
  }

  function selectAnimation(animationId: string) {
    const animation = getAnimation(project, animationId)
    if (!animation) {
      return
    }

    setSelectedAnimationId(animation.id)
    setSelectedFrameId(animation.frameIds[0])
    setSelectedAtlasFrameIds(new Set([animation.frameIds[0]]))
    setAtlasSelectionAnchorId(animation.frameIds[0])
    setPreviewIndex(0)
    clearPatchProposalState()
  }

  function addAnimation() {
    const animationNumber = project.animations.length + 1
    const id = `animation-${Date.now()}`
    const nextProject = addAnimationToProject(project, {
      id,
      name: `Animation ${animationNumber}`,
      fps: selectedAnimation.fps,
    })
    const animation = getAnimation(nextProject, id)
    commitProject(nextProject)
    if (animation) {
      setSelectedAnimationId(animation.id)
      setSelectedFrameId(animation.frameIds[0])
      setSelectedAtlasFrameIds(new Set([animation.frameIds[0]]))
      setAtlasSelectionAnchorId(animation.frameIds[0])
      setPreviewIndex(0)
      clearPatchProposalState()
    }
  }

  function saveSelectedAnimationName() {
    const nextName = animationNameInputRef.current?.value ?? selectedAnimation.name
    if (nextName.trim() === '' || nextName.trim() === selectedAnimation.name) {
      return
    }

    commitProject(
      updateAnimationPropertiesInProject(project, selectedAnimation.id, {
        name: nextName,
      }),
    )
  }

  function deleteSelectedAnimation() {
    if (project.animations.length <= 1) {
      return
    }

    const nextProject = deleteAnimationFromProject(project, selectedAnimation.id)
    const nextAnimation = getAnimation(nextProject, nextProject.metadata.defaultAnimationId) ?? nextProject.animations[0]
    commitProject(nextProject)
    setSelectedAnimationId(nextAnimation.id)
    setSelectedFrameId(nextAnimation.frameIds[0])
    setSelectedAtlasFrameIds(new Set([nextAnimation.frameIds[0]]))
    setAtlasSelectionAnchorId(nextAnimation.frameIds[0])
    setPreviewIndex(0)
    clearPatchProposalState()
  }

  function duplicateSelectedAnimation() {
    const id = `${selectedAnimation.id}-copy-${Date.now()}`
    const nextProject = duplicateAnimationInProject(project, selectedAnimation.id, {
      id,
      name: `${selectedAnimation.name} Copy`,
    })
    const animation = getAnimation(nextProject, id)
    commitProject(nextProject)
    if (animation) {
      setSelectedAnimationId(animation.id)
      setSelectedFrameId(animation.frameIds[0])
      setSelectedAtlasFrameIds(new Set([animation.frameIds[0]]))
      setAtlasSelectionAnchorId(animation.frameIds[0])
      setPreviewIndex(0)
      clearPatchProposalState()
    }
  }

  function moveSelectedAnimation(direction: -1 | 1) {
    commitProject(moveAnimationInProject(project, selectedAnimation.id, direction))
  }

  function deleteSelectedLayer() {
    if (!selectedLayer || selectedLayer.id === project.metadata.defaultLayerId) {
      return
    }

    commitProject(deleteLayerFromProject(project, selectedLayer.id))
    setSelectedLayerId(project.metadata.defaultLayerId)
  }

  function moveSelectedLayer(direction: -1 | 1) {
    if (!selectedLayer) {
      return
    }

    commitProject(moveLayerInProject(project, selectedLayer.id, direction))
  }

  function toggleLayerVisibility(layerId: string) {
    const layer = selectedFrame ? getLayer(selectedFrame, layerId) : undefined
    if (layer) {
      commitProject(setLayerVisibilityInProject(project, layerId, !layer.visible))
    }
  }

  function saveSelectedLayerName(nextName = layerNameInputRef.current?.value ?? '') {
    if (!selectedLayer || nextName.trim() === '' || nextName.trim() === selectedLayer.name) {
      return
    }

    commitProject(updateLayerPropertiesInProject(project, selectedLayer.id, { name: nextName }))
  }

  function saveSelectedLayerGroup(nextGroup = layerGroupInputRef.current?.value ?? '') {
    if (!selectedLayer || nextGroup.trim() === (selectedLayer.group ?? '')) {
      return
    }

    commitProject(updateLayerPropertiesInProject(project, selectedLayer.id, { group: nextGroup }))
  }

  function setSelectedLayerEditable(editable: boolean) {
    if (selectedLayer) {
      commitProject(updateLayerPropertiesInProject(project, selectedLayer.id, { editable }))
    }
  }

  function setSelectedLayerExportable(exportable: boolean) {
    if (selectedLayer) {
      commitProject(updateLayerPropertiesInProject(project, selectedLayer.id, { exportable }))
    }
  }

  function setSelectedLayerOpacity(opacityPercent: number) {
    if (selectedLayer) {
      commitProject(
        updateLayerPropertiesInProject(project, selectedLayer.id, {
          opacity: Math.max(0, Math.min(1, opacityPercent / 100)),
        }),
      )
    }
  }

  function setSelectedLayerBlendMode(blendMode: 'normal' | 'multiply' | 'screen') {
    if (selectedLayer) {
      commitProject(updateLayerPropertiesInProject(project, selectedLayer.id, { blendMode }))
    }
  }

  function applySelectedLayerPreset(presetId: LayerPresetId) {
    if (!selectedLayer) {
      return
    }

    const preset = LAYER_PRESETS.find((candidate) => candidate.id === presetId)
    if (!preset) {
      return
    }

    commitProject(updateLayerPropertiesInProject(project, selectedLayer.id, preset.properties))
    setProviderMessage(`Applied ${preset.label} layer preset.`)
  }

  function saveSelectedColor(overrides: { name?: string; hex?: string } = {}) {
    if (!selectedColor || selectedColor.isTransparent) {
      return
    }

    const name = overrides.name ?? colorNameInputRef.current?.value ?? selectedColor.name
    const hex = overrides.hex ?? colorHexInputRef.current?.value ?? selectedColor.hex
    if (name.trim() === selectedColor.name && hex.trim() === selectedColor.hex) {
      return
    }

    try {
      commitProject(
        updatePaletteColorInProject(project, selectedColor.id, {
          name,
          hex: hex.trim(),
        }),
      )
      setProviderMessage('Updated palette color "' + selectedColor.id + '".')
    } catch (error) {
      setProviderMessage(error instanceof Error ? error.message : 'Palette color update failed.')
    }
  }

  function addPaletteColor() {
    const id = `color-${Date.now()}`
    const nextProject = addPaletteColorToProject(project, {
      id,
      name: `Color ${project.palette.length}`,
      hex: '#ffffff',
    })
    commitProject(nextProject)
    setSelectedColorId(id)
    setTool('paint')
    setDockTab('palette')
    setPaletteEditorOpen(true)
    setAutoOpenPaletteColorId(id)
  }

  function deleteSelectedPaletteColor() {
    if (!selectedColor || selectedColor.isTransparent) {
      return
    }

    try {
      const nextProject = deletePaletteColorFromProject(project, selectedColor.id)
      commitProject(nextProject)
      setSelectedColorId(getFirstPaintColorId(nextProject))
      setProviderMessage(`Deleted palette color "${selectedColor.id}".`)
    } catch (error) {
      setProviderMessage(error instanceof Error ? error.message : 'Palette color delete failed.')
    }
  }

  function moveSelectedPaletteColor(direction: -1 | 1) {
    if (!selectedColor) {
      return
    }

    commitProject(movePaletteColorInProject(project, selectedColor.id, direction))
  }

  const proposedPatchByCell = useMemo(() => {
    const map = new Map<string, PixelPatchOperation>()
    if (patchValidation.valid) {
      activeProposedPatch.forEach((operation) => map.set(cellKey(operation.x, operation.y), operation))
    }
    return map
  }, [activeProposedPatch, patchValidation.valid])

  const onionPixels = useMemo(() => {
    const map = new Map<string, string>()
    if (!previousFrameId || !onionSkin) {
      return map
    }
    composeFramePixels(project, previousFrameId, selectedLayerId).forEach((pixel) => {
      map.set(cellKey(pixel.x, pixel.y), pixel.hex)
    })
    return map
  }, [onionSkin, previousFrameId, project, selectedLayerId])

  const commands: CommandItem[] = [
    {
      id: 'tool-paint',
      label: 'Paint tool',
      description: 'Switch to painting with the selected palette color.',
      shortcut: shortcuts.paint.toUpperCase(),
      run: () => setTool('paint'),
    },
    {
      id: 'tool-erase',
      label: 'Erase tool',
      description: 'Switch to clearing cells.',
      shortcut: shortcuts.erase.toUpperCase(),
      run: () => setTool('erase'),
    },
    {
      id: 'preview-toggle',
      label: isPlaying ? 'Stop preview' : 'Play preview',
      description: 'Toggle animation preview playback.',
      shortcut: 'Space',
      run: () => setIsPlaying((value) => !value),
    },
    {
      id: 'frame-previous',
      label: 'Previous frame',
      description: 'Select the previous frame in the current animation.',
      shortcut: 'Left',
      disabled: selectedFrameIndex <= 0,
      run: () => {
        const nextFrameId = frameIds[selectedFrameIndex - 1]
        if (nextFrameId) {
          selectFrameForEditing(selectedAnimation.id, nextFrameId)
        }
      },
    },
    {
      id: 'frame-next',
      label: 'Next frame',
      description: 'Select the next frame in the current animation.',
      shortcut: 'Right',
      disabled: selectedFrameIndex >= frameIds.length - 1,
      run: () => {
        const nextFrameId = frameIds[selectedFrameIndex + 1]
        if (nextFrameId) {
          selectFrameForEditing(selectedAnimation.id, nextFrameId)
        }
      },
    },
    {
      id: 'frame-add',
      label: 'Add frame',
      description: 'Insert a blank frame after the selected frame.',
      run: addFrame,
    },
    {
      id: 'frame-duplicate',
      label: 'Duplicate frame',
      description: 'Copy the selected frame after the current sheet-strip position.',
      run: duplicateFrame,
    },
    {
      id: 'frame-delete',
      label: 'Delete frame',
      description: 'Delete the selected frame when the animation has another frame.',
      disabled: frameIds.length <= 1,
      run: deleteFrame,
    },
    {
      id: 'layer-add',
      label: 'Add layer',
      description: 'Add an editable layer to every frame.',
      run: addLayer,
    },
    {
      id: 'animation-add',
      label: 'Add animation',
      description: 'Create another animation track for this asset.',
      run: addAnimation,
    },
    {
      id: 'patch-apply',
      label: 'Apply proposed edit',
      description: 'Accept the current validated edit proposal.',
      disabled: activeProposedPatch.length === 0 || !patchValidation.valid,
      run: applyProposedPatch,
    },
    {
      id: 'patch-reject',
      label: 'Reject proposed edit',
      description: 'Discard the current edit proposal.',
      disabled: proposedPatch.length === 0,
      run: rejectPatch,
    },
    {
      id: 'undo',
      label: 'Undo',
      description: 'Undo the last project edit.',
      shortcut: 'Ctrl+Z',
      disabled: undoStack.length === 0,
      run: undo,
    },
    {
      id: 'redo',
      label: 'Redo',
      description: 'Redo the last undone project edit.',
      shortcut: 'Ctrl+Y',
      disabled: redoStack.length === 0,
      run: redo,
    },
    {
      id: 'export-project-json',
      label: 'Export Project JSON',
      description: 'Save the editable SpriteWrite source artifact.',
      run: exportProjectJson,
    },
    {
      id: 'export-frame-png',
      label: 'Export Current Frame PNG',
      description: 'Export the selected frame as crisp transparent PNG.',
      run: exportCurrentFramePng,
    },
    {
      id: 'export-animation-strip-png',
      label: 'Export Current Animation Strip PNG',
      description: 'Export the current animation as one horizontal strip.',
      run: exportAnimationStripPng,
    },
    {
      id: 'export-full-sprite-sheet-png',
      label: 'Export Full Sprite Sheet PNG',
      description: 'Export the whole project as one animation-row grid PNG.',
      run: exportFullSpriteSheetPngOnly,
    },
    {
      id: 'export-full-sprite-sheet-bundle',
      label: 'Export Full Sprite Sheet PNG + Metadata JSON',
      description: 'Export the whole project sheet PNG and matching engine-friendly metadata JSON.',
      run: exportFullSpriteSheetWithMetadata,
    },
    {
      id: 'home',
      label: 'Go home',
      description: 'Return to the start screen without changing the current project.',
      run: () => setAppMode('start'),
    },
  ]

  const importInput = (
    <input
      ref={importInputRef}
      type="file"
      accept="application/json,.json"
      className="hidden-input"
      onChange={(event) => {
        importProjectJson(event.target.files?.[0])
        event.currentTarget.value = ''
      }}
    />
  )

  if (appMode === 'start') {
    return (
      <main className="app-shell">
        {importInput}
        <StartScreen
          heroDemoProject={heroDemoProject}
          importErrors={importErrors}
          newProjectAssetType={newProjectAssetType}
          newProjectHeight={newProjectHeight}
          newProjectName={newProjectName}
          newProjectTemplateId={newProjectTemplateId}
          newProjectWidth={newProjectWidth}
          onCreateProject={() => createProjectFromTemplate()}
          onImport={() => importInputRef.current?.click()}
          onOpenCurrent={() => openProject(project)}
          onOpenDemo={() =>
            confirmReplaceProject()
              ? openProject(
                  getProjectTemplate('hero-32-demo').createProject({ name: 'Hero Sprite Demo' }),
                  'Opened hero sprite sheet demo template.',
                  true,
                )
              : undefined
          }
          onSetAssetType={setNewProjectAssetType}
          onSetHeight={setNewProjectHeight}
          onSetName={setNewProjectName}
          onSetTemplate={(templateId) => {
            const template = getProjectTemplate(templateId)
            setNewProjectTemplateId(templateId)
            setNewProjectWidth(template.width)
            setNewProjectHeight(template.height)
            setNewProjectAssetType(template.assetType)
          }}
          onSetWidth={setNewProjectWidth}
          templates={SPRITE_PROJECT_TEMPLATES}
        />
      </main>
    )
  }

  return (
    <main className="app-shell">
      {importInput}
      <CommandPalette
        commands={commands}
        isOpen={isCommandPaletteOpen}
        query={commandQuery}
        onClose={() => {
          setIsCommandPaletteOpen(false)
          setCommandQuery('')
        }}
        onQueryChange={setCommandQuery}
        onRunCommand={runCommand}
      />
      <header className="topbar creative-topbar">
        <div>
          <p className="eyebrow">SpriteWrite / {formatAssetType(project.assetType)} / {project.canvas.width}x{project.canvas.height}</p>
          <h1>{project.name}</h1>
          <p className="status-line">
            {hasUnsavedChanges
              ? 'Unsaved changes'
              : 'Saved as Project JSON'}
          </p>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={() => setAppMode('start')}>
            Home
          </button>
          <button type="button" onClick={() => importInputRef.current?.click()}>
            Import
          </button>
          <button type="button" onClick={undo} disabled={!undoStack.length} title="Undo">
            Undo
          </button>
          <button type="button" onClick={redo} disabled={!redoStack.length} title="Redo">
            Redo
          </button>
          <details className="export-menu">
            <summary>Export</summary>
            <div className="export-menu-panel">
              <button type="button" onClick={exportProjectJson}>
                Export Project JSON
              </button>
              <button type="button" onClick={exportCurrentFramePng}>
                Export Current Frame PNG
              </button>
              <button type="button" onClick={exportAnimationStripPng}>
                Export Current Animation Strip PNG
              </button>
              <button type="button" onClick={exportFullSpriteSheetPngOnly}>
                Export Full Sprite Sheet PNG
              </button>
              <button type="button" onClick={exportFullSpriteSheetWithMetadata}>
                Export Full Sprite Sheet PNG + Metadata JSON
              </button>
              <details className="advanced-panel">
                <summary>Export Plan</summary>
                <p className="status-line">
                  Animation strip: {selectedAnimation.id} | Frames: {animationStripLayout.frameCount} |{' '}
                  {animationStripLayout.sheetWidth}x{animationStripLayout.sheetHeight}
                </p>
                <p className="status-line">
                  Full sprite sheet: {fullSpriteSheetLayout.rowCount} row(s) x{' '}
                  {fullSpriteSheetLayout.columnCount} column(s) | {fullSpriteSheetLayout.sheetWidth}x
                  {fullSpriteSheetLayout.sheetHeight}
                </p>
                <label>
                  Export scale
                  <input
                    type="number"
                    min="1"
                    max="16"
                    value={exportScale}
                    onChange={(event) => {
                      const nextScale = Math.max(1, Math.min(16, Math.round(Number(event.target.value) || 1)))
                      setExportScale(nextScale)
                    }}
                  />
                </label>
                <div className="form-grid">
                  <label>
                    Margin
                    <input
                      type="number"
                      min="0"
                      value={exportMargin}
                      onChange={(event) =>
                        setExportMargin(Math.max(0, Math.round(Number(event.target.value) || 0)))
                      }
                    />
                  </label>
                  <label>
                    Spacing
                    <input
                      type="number"
                      min="0"
                      value={exportSpacing}
                      onChange={(event) =>
                        setExportSpacing(Math.max(0, Math.round(Number(event.target.value) || 0)))
                      }
                    />
                  </label>
                </div>
                <div className="export-actions-card">
                  <strong>Production outputs</strong>
                  <span>Current frame PNG: {selectedFrameId}@{exportScale}x</span>
                  <span>
                    Animation strip: {selectedAnimation.id}, {animationStripLayout.frameCount} frame(s),{' '}
                    {animationStripLayout.sheetWidth}x{animationStripLayout.sheetHeight}
                  </span>
                  <span>
                    Full sprite sheet: {fullSpriteSheetLayout.rowCount} row(s),{' '}
                    {fullSpriteSheetLayout.columnCount} column(s), {fullSpriteSheetLayout.sheetWidth}x
                    {fullSpriteSheetLayout.sheetHeight}
                  </span>
                  <span>Full sheet metadata JSON matches the row/column cell regions.</span>
                </div>
              </details>
            </div>
          </details>
        </div>
      </header>

      {importErrors.length ? (
        <div className="validation-errors app-alert">
          {importErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      <section
        className="workbench"
        style={
          {
            '--right-panel-width': `${rightPanelWidth}px`,
            '--atlas-panel-height': `${atlasPanelHeight}px`,
            '--editor-background-color': editorBackgroundColor,
          } as CSSProperties
        }
      >
        <aside className="panel tools-panel">
          <details className="advanced-panel ai-entry">
            <summary>AI Assist</summary>
          <section className="atlas-request-panel">
            <h2>Ask / Start</h2>
            <label>
              Asset request
              <textarea
                value={instruction}
                onChange={(event) => setInstruction(event.target.value)}
                placeholder="Hero wearing a cape. Standing animation."
              />
            </label>
            <div className="form-grid">
              <label>
                Output
                <select
                  value={assetOutputContext}
                  onChange={(event) => setAssetOutputContext(event.target.value as SpriteWriteAssetOutputContext)}
                >
                  <option value="auto">Auto</option>
                  <option value="static">Static frame / tile</option>
                  <option value="animated">Animated row</option>
                </select>
              </label>
              <label>
                View
                <select
                  value={viewAngleContext}
                  onChange={(event) => setViewAngleContext(event.target.value as SpriteWriteViewAngleContext)}
                >
                  <option value="auto">Auto</option>
                  <option value="side-scroller">Side-scroller</option>
                  <option value="top-down">Top-down</option>
                  <option value="three-quarter">2.5D / three-quarter</option>
                </select>
              </label>
            </div>
            <div className="ollama-settings">
              <label>
                Ollama URL
                <input value={ollamaBaseUrl} onChange={(event) => setOllamaBaseUrl(event.target.value)} />
              </label>
              <label>
                Installed model
                <select
                  value={selectedInstalledOllamaModel}
                  onChange={(event) => setOllamaModel(event.target.value)}
                  disabled={!ollamaModels.length}
                >
                  <option value="" disabled>
                    {ollamaModels.length ? 'Choose installed model' : 'Checking local models...'}
                  </option>
                  {ollamaModels.map((model) => (
                    <option key={model.name} value={model.name}>
                      {model.name}
                      {model.parameterSize ? ` (${model.parameterSize})` : ''}
                      {model.capabilities?.includes('vision') ? ' - vision' : ''}
                    </option>
                  ))}
                </select>
              </label>
                <label>
                  Model name
                  <input
                    value={ollamaModel}
                    onChange={(event) => setOllamaModel(event.target.value)}
                    onBlur={(event) => {
                      const normalized = normalizeModelName(event.target.value)
                      if (normalized !== ollamaModel) {
                        setOllamaModel(normalized)
                      }
                    }}
                    placeholder="llama3.2"
                  />
                </label>
              {ollamaModelSuitabilityNote ? (
                <p className="status-line">{ollamaModelSuitabilityNote}</p>
              ) : null}
              <div className="button-stack">
                <button type="button" onClick={refreshOllamaModels} disabled={isOllamaBusy}>
                  Refresh Models
                </button>
                <button type="button" onClick={downloadOllamaModel} disabled={isOllamaBusy}>
                  Download Model
                </button>
              </div>
            </div>
            <div className="button-stack">
              <button type="button" onClick={generateOllamaPatch} disabled={isOllamaBusy}>
                {isOllamaBusy
                  ? 'Working...'
                  : spriteWritePromptIntent.mode === 'animation-draft'
                    ? spriteWritePromptIntent.variationCount > 1
                      ? 'Ask Ollama For Animation Set'
                      : 'Ask Ollama For Animation Draft'
                    : spriteWritePromptIntent.mode === 'frame-draft'
                      ? 'Ask Ollama For Frame Draft'
                      : 'Ask Ollama For Frame Edit'}
              </button>
            </div>
            {providerMessage ? <p className="provider-message">{providerMessage}</p> : null}
            {providerReview ? (
              <section className="provider-review" aria-label="Draft review">
                <strong>{providerReview.title}</strong>
                <dl>
                  {providerReview.metrics.map((metric) => (
                    <div key={metric.label}>
                      <dt>{metric.label}</dt>
                      <dd>{metric.value}</dd>
                    </div>
                  ))}
                </dl>
                <ul>
                  {providerReview.rows.map((row) => (
                    <li key={row}>{row}</li>
                  ))}
                </ul>
                {providerReview.paletteAdditions?.length ? (
                  <div className="provider-palette-review" aria-label="Palette additions">
                    {providerReview.paletteAdditions.map((color) => (
                      <div key={color.id} className="provider-palette-swatch">
                        <span style={{ background: color.hex }} aria-hidden="true" />
                        <div>
                          <strong>{color.name}</strong>
                          <small>
                            {color.id} {color.hex}
                          </small>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : null}
              </section>
            ) : null}
            {pendingAnimationDraft ? (
              <div className="draft-review-actions">
                <button type="button" onClick={applyPendingAnimationDraft}>
                  Apply Draft
                </button>
                <button type="button" onClick={rejectPendingAnimationDraft}>
                  Reject Draft
                </button>
              </div>
            ) : null}
            <ProviderDetails details={providerDetails} />
            <p className="status-line">
              SpriteWrite pads plain prompts into focused frame edits, single-frame drafts, or
              animation row drafts. Ollama only returns editable grid data, never opaque image blobs.
            </p>
          </section>
          </details>

          <section>
            <h2>Tool</h2>
            <div className="segmented">
              <button
                type="button"
                aria-pressed={tool === 'paint'}
                className={tool === 'paint' ? 'active' : ''}
                onClick={() => setTool('paint')}
              >
                <span
                  className="tool-glyph tool-glyph-paint"
                  style={{ '--tool-color': selectedColor?.hex ?? '#8de06f' } as CSSProperties}
                  aria-hidden="true"
                />
                <span>Paint</span>
                <kbd>P</kbd>
              </button>
              <button
                type="button"
                aria-pressed={tool === 'erase'}
                className={tool === 'erase' ? 'active' : ''}
                onClick={() => setTool('erase')}
              >
                <span className="tool-glyph tool-glyph-erase" aria-hidden="true" />
                <span>Erase</span>
                <kbd>E</kbd>
              </button>
            </div>
          </section>

          <div className="dock-tabs" aria-label="Asset panels">
            <button
              type="button"
              className={dockTab === 'palette' ? 'active' : ''}
              onClick={() => setDockTab('palette')}
            >
              Palette
            </button>
            <button
              type="button"
              className={dockTab === 'layers' ? 'active' : ''}
              onClick={() => setDockTab('layers')}
            >
              Layers
            </button>
          </div>

          <section className={`dock-panel ${dockTab === 'palette' ? 'active' : ''}`}>
            <h2>Palette</h2>
            <div className="palette-selected">
              <span
                className={tool === 'erase' || selectedColor?.isTransparent ? 'transparent-swatch' : ''}
                style={{
                  background:
                    tool === 'erase' || selectedColor?.isTransparent ? undefined : selectedColor?.hex,
                }}
              />
              <div>
                <strong>{tool === 'erase' ? 'Eraser' : selectedColor?.name ?? selectedColorId}</strong>
                <code>{tool === 'erase' ? TRANSPARENT_LABEL : selectedColor?.id ?? selectedColorId}</code>
              </div>
            </div>
            <div className="palette-grid" aria-label="Palette colors">
              {project.palette.map((color) => (
                <button
                  key={color.id}
                  type="button"
                  className={`palette-chip ${selectedColorId === color.id && tool === 'paint' ? 'active' : ''}`}
                  onClick={() => {
                    if (!color.isTransparent) {
                      setSelectedColorId(color.id)
                      setTool('paint')
                    } else {
                      setTool('erase')
                    }
                  }}
                  title={`${color.name} (${color.id})`}
                >
                  <span
                    className={color.isTransparent ? 'transparent-swatch' : ''}
                    style={{ background: color.isTransparent ? undefined : color.hex }}
                  />
                </button>
              ))}
            </div>
            {selectedColor && !selectedColor.isTransparent && tool === 'paint' ? (
              <details
                className="advanced-panel"
                open={paletteEditorOpen}
                onToggle={(event) => setPaletteEditorOpen(event.currentTarget.open)}
              >
                <summary>Edit Palette Color</summary>
                <div className="palette-inspector">
                  <div className="palette-name-row">
                    <label>
                      Name
                      <input
                        key={selectedColor.id + '-name'}
                        ref={colorNameInputRef}
                        defaultValue={selectedColor.name}
                      />
                    </label>
                    <ColorPickerField
                      key={selectedColor.id + '-' + (autoOpenPaletteColorId === selectedColor.id ? 'auto' : 'manual')}
                      label="Palette color"
                      value={selectedColor.hex}
                      initialOpen={autoOpenPaletteColorId === selectedColor.id}
                      onClose={() => setAutoOpenPaletteColorId(null)}
                      onChange={(nextColor) => {
                        if (colorHexInputRef.current) {
                          colorHexInputRef.current.value = nextColor
                        }
                        saveSelectedColor({ hex: nextColor })
                      }}
                    />
                  </div>
                  <label>
                    Hex
                    <div className="inline-control">
                      <input
                        key={`${selectedColor.id}-hex`}
                        ref={colorHexInputRef}
                        defaultValue={selectedColor.hex}
                        spellCheck={false}
                      />
                      <button type="button" onClick={() => saveSelectedColor()}>
                        Save
                      </button>
                    </div>
                  </label>
                  <div className="button-stack">
                    <button type="button" onClick={addPaletteColor}>
                      Add Color
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSelectedPaletteColor(-1)}
                      disabled={selectedColorIndex <= 0}
                    >
                      Up
                    </button>
                    <button
                      type="button"
                      onClick={() => moveSelectedPaletteColor(1)}
                      disabled={selectedColorIndex < 0 || selectedColorIndex >= project.palette.length - 1}
                    >
                      Down
                    </button>
                    <button type="button" onClick={deleteSelectedPaletteColor}>
                      Delete Color
                    </button>
                  </div>
                </div>
              </details>
            ) : null}
          </section>

          <section className={`dock-panel layers-panel ${dockTab === 'layers' ? 'active' : ''}`}>
            <h2>Layers</h2>
            <div className="layer-actions">
              <button type="button" onClick={addLayer}>
                Add
              </button>
              <button type="button" onClick={() => moveSelectedLayer(-1)} disabled={selectedLayerIndex <= 0}>
                Up
              </button>
              <button
                type="button"
                onClick={() => moveSelectedLayer(1)}
                disabled={selectedLayerIndex < 0 || selectedLayerIndex >= selectedFrame.layers.length - 1}
              >
                Down
              </button>
              <button
                type="button"
                onClick={deleteSelectedLayer}
                disabled={!selectedLayer || selectedLayer.id === project.metadata.defaultLayerId}
              >
                Delete
              </button>
            </div>
            <div className="layer-list">
              {selectedFrame.layers.map((layer, index) => {
                const groupLabel = getLayerGroupLabel(layer.group)
                const previousGroupLabel = getLayerGroupLabel(selectedFrame.layers[index - 1]?.group)
                const showGroupHeading = index === 0 || groupLabel !== previousGroupLabel

                return (
                  <Fragment key={layer.id}>
                    {showGroupHeading ? <div className="layer-group-heading">{groupLabel}</div> : null}
                    <div className={`layer-row ${selectedLayerId === layer.id ? 'active' : ''}`}>
                      <button
                        type="button"
                        className="layer-main"
                        onClick={() => setSelectedLayerId(layer.id)}
                      >
                        <strong>{layer.name}</strong>
                        <span>
                          {layer.visible ? 'Visible' : 'Hidden'} | {layer.editable ? 'Editable' : 'Locked'} |{' '}
                          {layer.exportable !== false ? 'Exports' : 'No export'} | {Object.keys(layer.cells).length}{' '}
                          cells
                        </span>
                      </button>
                      <button
                        type="button"
                        className="layer-toggle"
                        onClick={() => toggleLayerVisibility(layer.id)}
                        title={layer.visible ? 'Hide layer' : 'Show layer'}
                      >
                        {layer.visible ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </Fragment>
                )
              })}
            </div>
            {selectedLayer ? (
              <div className="layer-inspector">
                <label>
                  Name
                  <div className="inline-control">
                    <input
                      key={selectedLayer.id}
                      ref={layerNameInputRef}
                      defaultValue={selectedLayer.name}
                      onBlur={(event) => saveSelectedLayerName(event.target.value)}
                    />
                    <button type="button" onClick={() => saveSelectedLayerName()}>
                      Save
                    </button>
                  </div>
                </label>
                <label>
                  Folder
                  <div className="inline-control">
                    <input
                      key={`${selectedLayer.id}-group`}
                      ref={layerGroupInputRef}
                      defaultValue={selectedLayer.group ?? ''}
                      onBlur={(event) => saveSelectedLayerGroup(event.target.value)}
                      placeholder="Ungrouped"
                    />
                    <button type="button" onClick={() => saveSelectedLayerGroup()}>
                      Save
                    </button>
                  </div>
                </label>
                <label>
                  Opacity {Math.round(selectedLayer.opacity * 100)}%
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={Math.round(selectedLayer.opacity * 100)}
                    onChange={(event) => setSelectedLayerOpacity(Number(event.target.value))}
                  />
                </label>
                <label>
                  Blend mode
                  <select
                    value={selectedLayer.blendMode ?? 'normal'}
                    onChange={(event) =>
                      setSelectedLayerBlendMode(event.target.value as 'normal' | 'multiply' | 'screen')
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="multiply">Multiply</option>
                    <option value="screen">Screen</option>
                  </select>
                </label>
                <div className="layer-presets">
                  <span>Preset</span>
                  <div className="segmented">
                    {LAYER_PRESETS.map((preset) => (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => applySelectedLayerPreset(preset.id)}
                      >
                        {preset.label}
                      </button>
                    ))}
                  </div>
                </div>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={selectedLayer.editable}
                    onChange={(event) => setSelectedLayerEditable(event.target.checked)}
                  />
                  Editable layer
                </label>
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={selectedLayer.exportable !== false}
                    onChange={(event) => setSelectedLayerExportable(event.target.checked)}
                  />
                  Include in PNG export
                </label>
              </div>
            ) : null}
          </section>
        </aside>

        <AtlasOverview
          project={project}
          selectedAnimationId={selectedAnimation.id}
          selectedFrameId={selectedFrameId}
          selectedFrameIds={visibleAtlasFrameIds}
          draggedFrameId={draggedAtlasFrame?.frameId}
          onSelectFrame={selectFrameForEditing}
          onFrameDragStart={(animationId, frameId) => setDraggedAtlasFrame({ animationId, frameId })}
          onFrameDrop={dropAtlasFrame}
          onFrameDragEnd={() => setDraggedAtlasFrame(null)}
          onAddFrame={addFrame}
          onDuplicateSelectedFrames={duplicateSelectedAtlasFrames}
          onDeleteSelectedFrames={deleteSelectedAtlasFrames}
          onSetSelectedDuration={setSelectedAtlasFrameDuration}
          onSetSelectedTags={setSelectedAtlasFrameTags}
          onSetSelectedNotes={setSelectedAtlasFrameNotes}
          workspaceMode={workspaceMode}
          onWorkspaceModeChange={setWorkspaceMode}
          onResizeStart={beginAtlasPanelResize}
        />

        {workspaceMode === 'sheet' ? (
          <FullSheetWorkspace
            project={project}
            selectedAnimationId={selectedAnimation.id}
            selectedFrameId={selectedFrameId}
            selectedFrameIds={visibleAtlasFrameIds}
            onSelectFrame={selectFrameForEditing}
          />
        ) : (
          <section className="editor-stage">
            <div className="stage-header canvas-toolbar">
              <div>
                <h2>{selectedAnimation.name}</h2>
                <p>
                  {project.canvas.width}x{project.canvas.height} cells, layer{' '}
                  {selectedLayer?.name ?? selectedLayerId}
                </p>
              </div>
              <div className="animation-controls">
                <label>
                  Animation
                  <select
                    value={selectedAnimation.id}
                    onChange={(event) => selectAnimation(event.target.value)}
                  >
                    {project.animations.map((animation) => (
                      <option key={animation.id} value={animation.id}>
                        {animation.name}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="button" onClick={addAnimation}>
                  Add Animation
                </button>
                <button type="button" onClick={duplicateSelectedAnimation}>
                  Duplicate
                </button>
                <button type="button" onClick={() => moveSelectedAnimation(-1)} disabled={selectedAnimationIndex <= 0}>
                  Up
                </button>
                <button
                  type="button"
                  onClick={() => moveSelectedAnimation(1)}
                  disabled={selectedAnimationIndex < 0 || selectedAnimationIndex >= project.animations.length - 1}
                >
                  Down
                </button>
                <button
                  type="button"
                  onClick={deleteSelectedAnimation}
                  disabled={project.animations.length <= 1}
                >
                  Delete
                </button>
              </div>
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={onionSkin}
                  onChange={(event) => setOnionSkin(event.target.checked)}
                />
                Onion skin
              </label>
              <div className="canvas-background-controls">
                <label className="toggle-row">
                  <input
                    type="checkbox"
                    checked={useSolidEditorBackground}
                    onChange={(event) => setUseSolidEditorBackground(event.target.checked)}
                  />
                  Canvas background
                </label>
                <ColorPickerField
                  label="Canvas background color"
                  value={editorBackgroundColor}
                  onChange={setEditorBackgroundColor}
                  disabled={!useSolidEditorBackground}
                />
              </div>
            </div>

            <details className="animation-inspector">
              <summary>Animation Settings</summary>
              <label>
                Animation name
                <div className="inline-control">
                  <input
                    key={selectedAnimation.id}
                    ref={animationNameInputRef}
                    defaultValue={selectedAnimation.name}
                  />
                  <button type="button" onClick={saveSelectedAnimationName}>
                    Save
                  </button>
                </div>
              </label>
            </details>

            {proposedPatch.length ? (
              <div className="canvas-proposal-bar" role="status">
                <div>
                  <strong>Proposed edit</strong>
                  <span>
                    {activeProposedPatch.length}/{proposedPatch.length} enabled
                    {patchValidation.valid ? '' : ' - validation issues'}
                  </span>
                </div>
                <div className="canvas-proposal-actions">
                  <button
                    type="button"
                    onClick={applyProposedPatch}
                    disabled={activeProposedPatch.length === 0 || !patchValidation.valid}
                  >
                    Apply Edit
                  </button>
                  <button type="button" onClick={rejectPatch}>
                    Reject Edit
                  </button>
                </div>
              </div>
            ) : null}

            <div className={`pixel-grid-scroll ${useSolidEditorBackground ? 'solid-editor-background' : ''}`}>
              <div
                className="pixel-grid"
                style={{
                  gridTemplateColumns: `repeat(${project.canvas.width}, var(--cell-size))`,
                  gridTemplateRows: `repeat(${project.canvas.height}, var(--cell-size))`,
                }}
                onPointerLeave={() => setLastPaintKey(null)}
              >
                {Array.from({ length: project.canvas.width * project.canvas.height }).map((_, index) => {
                  const x = index % project.canvas.width
                  const y = Math.floor(index / project.canvas.width)
                  const key = cellKey(x, y)
                  const colorId = selectedLayer?.cells[key]
                  const color = colorId ? getColor(project, colorId) : undefined
                  const onionHex = onionPixels.get(key)
                  const proposed = proposedPatchByCell.get(key)
                  const proposedColor =
                    proposed?.op === 'set' ? getColor(project, proposed.colorId)?.hex : undefined

                  return (
                    <button
                      key={key}
                      type="button"
                      className={`pixel-cell ${proposed ? 'has-proposal' : ''}`}
                      onPointerDown={(event) => {
                        event.preventDefault()
                        setIsPointerDown(true)
                        paintCell(x, y)
                      }}
                      onPointerEnter={() => {
                        if (isPointerDown) {
                          paintCell(x, y)
                        }
                      }}
                      title={`${x},${y}${colorId ? ` ${colorId}` : ''}`}
                    >
                      {onionHex && !color ? (
                        <span className="onion-pixel" style={{ background: onionHex }} />
                      ) : null}
                      {color ? <span className="painted-pixel" style={{ background: color.hex }} /> : null}
                      {proposed ? (
                        <span
                          className={proposed.op === 'clear' ? 'proposal-clear' : 'proposal-pixel'}
                          style={{ background: proposedColor }}
                        />
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </div>
          </section>
        )}

        <aside className="panel right-panel">
          <button
            type="button"
            className="panel-resize-handle panel-resize-handle-vertical"
            aria-label="Resize preview and inspector panel"
            title="Drag to resize preview and inspector"
            onPointerDown={beginRightPanelResize}
          />
          <section>
            <h2>Preview</h2>
            <p className="status-line">
              {frameIds.length > 1 ? 'Playing' : 'Showing'} {selectedAnimation.name}, frame{' '}
              {previewFrameNumber} of {frameIds.length}.
            </p>
            <div
              className={`preview-box ${useSolidPreviewBackground ? 'solid-preview-background' : ''}`}
              style={
                {
                  '--preview-background-color': previewBackgroundColor,
                  height: previewBoxHeight,
                } as CSSProperties
              }
            >
              <MiniSprite
                project={project}
                frameId={previewFrameId}
                className={useSolidPreviewBackground ? 'solid-preview-background' : undefined}
              />
              <button
                type="button"
                className="preview-resize-corner"
                aria-label="Resize preview"
                title="Drag to resize preview"
                onPointerDown={beginPreviewBoxResize}
              />
            </div>
            <div className="preview-controls">
              <button type="button" onClick={() => setIsPlaying((value) => !value)}>
                {isPlaying ? 'Stop' : 'Play'}
              </button>
              <label>
                FPS
                <input
                  type="number"
                  min="1"
                  max="24"
                  value={fps}
                  onChange={(event) => updateFps(Number(event.target.value))}
                />
              </label>
            </div>
            <div className="preview-background-controls">
              <label className="toggle-row">
                <input
                  type="checkbox"
                  checked={useSolidPreviewBackground}
                  onChange={(event) => setUseSolidPreviewBackground(event.target.checked)}
                />
                Solid preview background
              </label>
              <ColorPickerField
                label="Preview background color"
                value={previewBackgroundColor}
                onChange={setPreviewBackgroundColor}
                disabled={!useSolidPreviewBackground}
              />
            </div>
          </section>

          <div className="inspector-tabs" aria-label="Inspector panels">
            <button
              type="button"
              className={inspectorTab === 'frame' ? 'active' : ''}
              onClick={() => setInspectorTab('frame')}
            >
              Frame
            </button>
            <button
              type="button"
              className={inspectorTab === 'animation' ? 'active' : ''}
              onClick={() => setInspectorTab('animation')}
            >
              Animation
            </button>
          </div>

          <section className={`inspector-section ${inspectorTab === 'frame' ? 'active' : ''}`}>
            <h2>Frame Details</h2>
            <p className="status-line">
              Top strip controls sheet order. Edit this frame's metadata here.
            </p>
            {selectedFrame ? (
              <div className="frame-inspector">
                <section className="frame-inspector-group" aria-labelledby="frame-inspector-identity">
                  <h3 id="frame-inspector-identity">Identity</h3>
                  <label>
                    Frame name
                    <input
                      key={`${selectedFrame.id}-name`}
                      ref={frameNameInputRef}
                      defaultValue={selectedFrame.name}
                      onBlur={() => saveSelectedFrameProperties()}
                    />
                  </label>
                </section>
                <section className="frame-inspector-group" aria-labelledby="frame-inspector-timing">
                  <h3 id="frame-inspector-timing">Timing & Anchor</h3>
                  <label>
                    Duration
                    <div className="inline-control">
                      <input
                        type="number"
                        min="1"
                        value={selectedFrame.durationMs}
                        onChange={(event) => {
                          const durationMs = Math.max(1, Math.round(Number(event.target.value) || 1))
                          commitProject(
                            updateFramePropertiesInProject(project, selectedFrame.id, {
                              durationMs,
                            }),
                          )
                        }}
                      />
                      <button type="button" onClick={() => saveSelectedFrameProperties()}>
                        Save
                      </button>
                    </div>
                  </label>
                  <div className="form-grid">
                    <label>
                      Anchor X
                      <input
                        type="number"
                        min="0"
                        max={project.canvas.width - 1}
                        value={selectedFrame.anchor.x}
                        onChange={(event) => updateSelectedFrameAnchor('x', Number(event.target.value))}
                      />
                    </label>
                    <label>
                      Anchor Y
                      <input
                        type="number"
                        min="0"
                        max={project.canvas.height - 1}
                        value={selectedFrame.anchor.y}
                        onChange={(event) => updateSelectedFrameAnchor('y', Number(event.target.value))}
                      />
                    </label>
                  </div>
                </section>
                <section className="frame-inspector-group" aria-labelledby="frame-inspector-notes">
                  <h3 id="frame-inspector-notes">Notes & Tags</h3>
                  <label>
                    Frame notes
                    <textarea
                      key={`${selectedFrame.id}-notes`}
                      ref={frameNotesInputRef}
                      defaultValue={selectedFrame.notes ?? ''}
                      onBlur={() => saveSelectedFrameProperties()}
                    />
                  </label>
                  <label>
                    Tags
                    <div className="inline-control">
                      <input
                        key={`${selectedFrame.id}-tags`}
                        ref={frameTagsInputRef}
                        defaultValue={(selectedFrame.tags ?? []).join(', ')}
                        onBlur={() => saveSelectedFrameProperties()}
                      />
                      <button type="button" onClick={() => saveSelectedFrameProperties()}>
                        Save
                      </button>
                    </div>
                  </label>
                </section>
                <section className="frame-inspector-group" aria-labelledby="frame-inspector-hitbox">
                  <h3 id="frame-inspector-hitbox">Hitbox</h3>
                  <label className="toggle-row">
                    <input
                      type="checkbox"
                      checked={Boolean(selectedFrame.hitbox)}
                      onChange={(event) => setSelectedFrameHitboxEnabled(event.target.checked)}
                    />
                    Hitbox metadata
                  </label>
                  {selectedFrame.hitbox ? (
                    <div className="form-grid">
                      {(['x', 'y', 'width', 'height'] as const).map((key) => (
                        <label key={key}>
                          {key}
                          <input
                            type="number"
                            min={key === 'width' || key === 'height' ? 1 : 0}
                            value={selectedFrame.hitbox?.[key] ?? 0}
                            onChange={(event) => updateSelectedFrameHitbox(key, Number(event.target.value))}
                          />
                        </label>
                      ))}
                    </div>
                  ) : null}
                </section>
              </div>
            ) : null}
          </section>

          <section className={`inspector-section ${inspectorTab === 'animation' ? 'active' : ''}`}>
            <h2>Animation</h2>
            <p className="status-line">
              {selectedAnimation.name} / {frameIds.length} frame{frameIds.length === 1 ? '' : 's'} / {fps} FPS
            </p>
            <p className="status-line">
              Rename, reorder, and switch animations from the canvas toolbar while drawing.
            </p>
          </section>
        </aside>
      </section>
    </main>
  )
}

export default App


