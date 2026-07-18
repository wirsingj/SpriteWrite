import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type DragEvent,
  type MouseEvent,
  type PointerEvent as ReactPointerEvent,
} from 'react'
import './App.css'
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
  PixelPatchOperation,
  SpriteAssetType,
  SpriteFrame,
  SpriteProject,
} from './domain/spriteTypes'
import {
  getProjectTemplate,
  SPRITE_PROJECT_TEMPLATES,
} from './domain/projectTemplates'
import { MockPatchProvider } from './providers/mockPatchProvider'
import {
  listOllamaModels,
  type OllamaAnimationSetDraft,
  type OllamaAnimationDraft,
  OllamaPatchProvider,
  pullOllamaModel,
  testOllamaConnection,
  type OllamaModelInfo,
} from './providers/ollamaPatchProvider'
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
type ProviderChoice = 'mock' | 'ollama'
type AppMode = 'start' | 'editor'
type WorkspaceMode = 'frame' | 'sheet'
type DockTab = 'palette' | 'layers'
type InspectorTab = 'frame' | 'animation'
type ShortcutAction = 'paint' | 'erase'
type LayerPresetId = 'art' | 'guide' | 'shadow' | 'highlight'
type ProviderAttemptContext = {
  attempt: number
  startedAt: number
}
type CommandItem = {
  id: string
  label: string
  description: string
  shortcut?: string
  disabled?: boolean
  run: () => void | Promise<void>
}

const mockProvider = new MockPatchProvider()
const TRANSPARENT_LABEL = 'transparent'
const BROWSER_DRAFT_STORAGE_KEY = 'spritewrite.browserDraft.v1'
const SHORTCUTS_STORAGE_KEY = 'spritewrite.shortcuts.v1'
const DEFAULT_SHORTCUTS: Record<ShortcutAction, string> = {
  paint: 'p',
  erase: 'e',
}
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
const ASSET_TYPE_OPTIONS: SpriteAssetType[] = [
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
]
const ASSET_TYPE_LABELS: Record<SpriteAssetType, string> = {
  character: 'Character',
  creature: 'Creature',
  tile: 'Tile',
  environment: 'Environment',
  prop: 'Prop',
  object: 'Object',
  background: 'Background',
  effect: 'Effect',
  ui: 'UI / Icon',
  icon: 'Icon',
  custom: 'Custom',
  enemy: 'Enemy (legacy)',
  ooze: 'Creature (legacy ooze)',
  button: 'UI (legacy button)',
  parallax: 'Background (legacy parallax)',
  generic: 'Custom (legacy)',
}
const MIN_RIGHT_PANEL_WIDTH = 260
const MAX_RIGHT_PANEL_WIDTH = 520
const DEFAULT_RIGHT_PANEL_WIDTH = 360
const MIN_ATLAS_PANEL_HEIGHT = 150
const MAX_ATLAS_PANEL_HEIGHT = 360
const DEFAULT_ATLAS_PANEL_HEIGHT = 240
const DEFAULT_PREVIEW_BACKGROUND = '#1f2a2d'

function getFirstPaintColorId(project: SpriteProject): string {
  return project.palette.find((color) => !color.isTransparent)?.id ?? project.palette[0]?.id ?? ''
}

function formatAssetType(assetType: SpriteAssetType | undefined): string {
  return assetType ? ASSET_TYPE_LABELS[assetType] : ASSET_TYPE_LABELS.custom
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

function formatErrorForDetails(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message,
      stack: error.stack,
    }
  }

  return { message: String(error) }
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

function loadShortcutSettings(): Record<ShortcutAction, string> {
  if (typeof window === 'undefined') {
    return DEFAULT_SHORTCUTS
  }

  try {
    const stored = window.localStorage.getItem(SHORTCUTS_STORAGE_KEY)
    if (!stored) {
      return DEFAULT_SHORTCUTS
    }
    const parsed = JSON.parse(stored) as Partial<Record<ShortcutAction, unknown>>
    const shortcuts = {
      paint: normalizeShortcutValue(parsed.paint, DEFAULT_SHORTCUTS.paint),
      erase: normalizeShortcutValue(parsed.erase, DEFAULT_SHORTCUTS.erase),
    }
    return shortcuts.paint === shortcuts.erase ? DEFAULT_SHORTCUTS : shortcuts
  } catch {
    window.localStorage.removeItem(SHORTCUTS_STORAGE_KEY)
    return DEFAULT_SHORTCUTS
  }
}

function normalizeShortcutValue(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const normalized = value.trim().slice(0, 1).toLowerCase()
  return normalized || fallback
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

function filenameSlug(value: string): string {
  const slug = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  return slug || 'spritewrite'
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
  const [atlasPanelHeight, setAtlasPanelHeight] = useState(DEFAULT_ATLAS_PANEL_HEIGHT)
  const [useSolidPreviewBackground, setUseSolidPreviewBackground] = useState(false)
  const [previewBackgroundColor, setPreviewBackgroundColor] = useState(DEFAULT_PREVIEW_BACKGROUND)
  const [providerChoice, setProviderChoice] = useState<ProviderChoice>('ollama')
  const [assetOutputContext, setAssetOutputContext] = useState<SpriteWriteAssetOutputContext>('auto')
  const [viewAngleContext, setViewAngleContext] = useState<SpriteWriteViewAngleContext>('auto')
  const [instruction, setInstruction] = useState(() => getDefaultPatchInstruction(project))
  const [proposedPatch, setProposedPatch] = useState<PixelPatchOperation[]>([])
  const [disabledPatchOperationIndexes, setDisabledPatchOperationIndexes] = useState<Set<number>>(
    () => new Set(),
  )
  const [patchErrors, setPatchErrors] = useState<string[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [providerMessage, setProviderMessage] = useState('')
  const [providerDetails, setProviderDetails] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const [ollamaModels, setOllamaModels] = useState<OllamaModelInfo[]>([])
  const [isOllamaBusy, setIsOllamaBusy] = useState(false)
  const [exportScale, setExportScale] = useState(1)
  const [exportMargin, setExportMargin] = useState(0)
  const [exportSpacing, setExportSpacing] = useState(0)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [shortcuts] = useState(loadShortcutSettings)
  const [newProjectName, setNewProjectName] = useState('Untitled Sprite')
  const [newProjectTemplateId, setNewProjectTemplateId] = useState('blank-32')
  const [newProjectWidth, setNewProjectWidth] = useState(32)
  const [newProjectHeight, setNewProjectHeight] = useState(32)
  const [newProjectAssetType, setNewProjectAssetType] = useState<SpriteAssetType>('custom')
  const ollamaModelSuitabilityNote = getOllamaModelSuitabilityNote(ollamaModel)
  const spriteWritePromptIntent = useMemo(
    () =>
      createSpriteWritePromptIntent(instruction, project, {
        output: assetOutputContext,
        viewAngle: viewAngleContext,
      }),
    [assetOutputContext, instruction, project, viewAngleContext],
  )
  const selectedInstalledOllamaModel = ollamaModels.some((model) => model.name === ollamaModel)
    ? ollamaModel
    : ''
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const layerNameInputRef = useRef<HTMLInputElement | null>(null)
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
  const activeProposedPatch = useMemo(
    () => proposedPatch.filter((_, index) => !disabledPatchOperationIndexes.has(index)),
    [disabledPatchOperationIndexes, proposedPatch],
  )
  const patchValidation = useMemo(
    () =>
      activeProposedPatch.length
        ? validatePatch(project, selectedAnimation.id, selectedFrameId, selectedLayerId, activeProposedPatch)
        : { valid: true, errors: [] },
    [activeProposedPatch, project, selectedAnimation.id, selectedFrameId, selectedLayerId],
  )
  const proposedPreviewProject = useMemo(() => {
    if (!activeProposedPatch.length || !patchValidation.valid) {
      return undefined
    }

    try {
      return applyPatch(project, selectedAnimation.id, selectedFrameId, selectedLayerId, activeProposedPatch)
    } catch {
      return undefined
    }
  }, [activeProposedPatch, patchValidation.valid, project, selectedAnimation.id, selectedFrameId, selectedLayerId])
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
    setProviderChoice('ollama')
    setProviderMessage(`Checking local Ollama at ${ollamaBaseUrl}...`)
    setProviderDetails('')
    setIsOllamaBusy(true)

    listOllamaModels(ollamaBaseUrl)
      .then((models) => {
        setOllamaModels(models)
        const selectedModel = models.some((model) => model.name === ollamaModel)
          ? ollamaModel
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
            selectedModel: selectedModel ?? ollamaModel,
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
  }, [ollamaBaseUrl, ollamaModel])

  useEffect(() => {
    try {
      window.localStorage.setItem(SHORTCUTS_STORAGE_KEY, JSON.stringify(shortcuts))
    } catch {
      // Shortcut settings are a convenience preference and can be safely ignored if storage fails.
    }
  }, [shortcuts])

  function commitProject(nextProject: SpriteProject) {
    setUndoStack((stack) => [...stack.slice(-49), cloneProject(project)])
    setRedoStack([])
    setProject(nextProject)
    setHasUnsavedChanges(true)
  }

  function clearPatchProposalState() {
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
    setPatchErrors([])
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
        selectedAnimationId === animationId &&
        atlasSelectionAnchorId &&
        animation.frameIds.includes(atlasSelectionAnchorId)
      ) {
        const anchorIndex = animation.frameIds.indexOf(atlasSelectionAnchorId)
        const start = Math.min(anchorIndex, nextFrameIndex)
        const end = Math.max(anchorIndex, nextFrameIndex)
        return new Set(animation.frameIds.slice(start, end + 1))
      }

      if (options.toggle) {
        const next = selectedAnimationId === animationId ? new Set(current) : new Set<FrameId>()
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
    setDisabledPatchOperationIndexes(new Set())
    setPatchErrors([])
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
    setDisabledPatchOperationIndexes(new Set())
    setPatchErrors([])
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

  async function generateMockPatch() {
    setProviderMessage('')
    setProviderDetails('')
    try {
      const patch = await mockProvider.requestPatch({
        project,
        animationId: selectedAnimation.id,
        frameId: selectedFrameId,
        layerId: selectedLayerId,
        instruction,
        constraints: { selectedColorId, maxOperations: 16 },
      })
      const validation = validatePatch(project, selectedAnimation.id, selectedFrameId, selectedLayerId, patch)
      setProposedPatch(patch)
      setDisabledPatchOperationIndexes(new Set())
      setPatchErrors(validation.errors)
      setProviderDetails(
        formatProviderDetails('Mock edit result', {
          instruction,
          validationErrors: validation.errors,
          patch,
        }),
      )
    } catch (error) {
      setProposedPatch([])
      setDisabledPatchOperationIndexes(new Set())
      setPatchErrors([])
      setProviderMessage(error instanceof Error ? error.message : 'Mock provider failed.')
      setProviderDetails(
        formatProviderDetails('Mock provider error', {
          instruction,
          error: formatErrorForDetails(error),
        }),
      )
    }
  }

  async function generateOllamaPatch() {
    setProviderChoice('ollama')
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
      `Attempt ${attemptContext.attempt}: ${spriteWritePromptIntent.summary} Asking Ollama model "${ollamaModel}" for editable JSON...${
        ollamaModelSuitabilityNote ? ` ${ollamaModelSuitabilityNote}` : ''
      }`,
    )
    setProviderDetails('')
    setIsOllamaBusy(true)
    try {
      const provider = new OllamaPatchProvider({ baseUrl: ollamaBaseUrl, model: ollamaModel })
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
      setDisabledPatchOperationIndexes(new Set())
      setPatchErrors(validation.errors)
      setProviderDetails(
        formatProviderDetails('Ollama frame edit response', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          mode: spriteWritePromptIntent.mode,
          userInstruction: spriteWritePromptIntent.userInstruction,
          paddedInstruction: spriteWritePromptIntent.paddedInstruction,
          baseUrl: ollamaBaseUrl,
          model: ollamaModel,
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
      setDisabledPatchOperationIndexes(new Set())
      setPatchErrors([])
      setProviderMessage(formatOllamaError(error, ollamaBaseUrl))
      setProviderDetails(
        formatProviderDetails('Ollama frame edit error', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          mode: spriteWritePromptIntent.mode,
          userInstruction: spriteWritePromptIntent.userInstruction,
          paddedInstruction: spriteWritePromptIntent.paddedInstruction,
          baseUrl: ollamaBaseUrl,
          model: ollamaModel,
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
    setProviderChoice('ollama')
    setProviderMessage(
      `Attempt ${attemptContext.attempt}: ${intent.summary} Asking Ollama model "${ollamaModel}" for structured editable frames...${
        ollamaModelSuitabilityNote ? ` ${ollamaModelSuitabilityNote}` : ''
      }`,
    )
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
    setPatchErrors([])
    setProviderDetails('')
    setIsOllamaBusy(true)

    try {
      const provider = new OllamaPatchProvider({ baseUrl: ollamaBaseUrl, model: ollamaModel })
      const maxDraftOperations = getMaxOllamaDraftOperations(project)
      if (intent.variationCount > 1) {
        const setDraft = await provider.requestAnimationSetDraft({
          project,
          animationId: selectedAnimation.id,
          frameId: selectedFrameId,
          layerId: selectedLayerId,
          instruction: intent.paddedInstruction,
          constraints: { selectedColorId, maxOperations: maxDraftOperations },
          frameCount: intent.frameCount,
          variationCount: intent.variationCount,
        })
        applyOllamaAnimationSetDraft(setDraft, intent.userInstruction, intent, attemptContext)
        return
      }

      const draft = await provider.requestAnimationDraft({
        project,
        animationId: selectedAnimation.id,
        frameId: selectedFrameId,
        layerId: selectedLayerId,
        instruction: intent.paddedInstruction,
        constraints: { selectedColorId, maxOperations: maxDraftOperations },
        frameCount: intent.frameCount,
      })
      applyOllamaAnimationDraft(draft, intent.userInstruction, intent, attemptContext)
    } catch (error) {
      setProposedPatch([])
      setDisabledPatchOperationIndexes(new Set())
      setPatchErrors([])
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
          model: ollamaModel,
          error: formatErrorForDetails(error),
        }),
      )
    } finally {
      setIsOllamaBusy(false)
    }
  }

  function applyOllamaAnimationDraft(
    draft: OllamaAnimationDraft,
    sourceInstruction = instruction,
    intent: SpriteWritePromptIntent = spriteWritePromptIntent,
    attemptContext: ProviderAttemptContext = {
      attempt: ollamaAttemptRef.current,
      startedAt: performance.now(),
    },
  ) {
    if (!selectedFrame) {
      setProviderMessage('Cannot draft animation because no frame is selected.')
      setProviderDetails(
        formatProviderDetails('Ollama animation draft rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          reason: 'No selected frame.',
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
          draft,
        }),
      )
      return
    }

    const timestamp = Date.now()
    const oldFrameIds = [...selectedAnimation.frameIds]
    const createdFrameIds: FrameId[] = []
    let nextProject = cloneProject(project)
    const animation = getAnimation(nextProject, selectedAnimation.id)
    if (!animation) {
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

    animation.name = draft.animationName?.trim() || animation.name
    animation.fps = draft.fps ?? animation.fps
    animation.frameIds = []

    draft.frames.forEach((frameDraft, index) => {
      const id = createUniqueFrameId(nextProject, `${selectedAnimation.id}-ollama-${timestamp}-${index + 1}`)
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
      const validation = validatePatch(nextProject, selectedAnimation.id, frameId, selectedLayerId, frameDraft.patch)
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
        nextProject = applyPatch(nextProject, selectedAnimation.id, frameId, selectedLayerId, frameDraft.patch)
      }
    })

    if (errors.length) {
      setPatchErrors(errors)
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
          model: ollamaModel,
          validationErrors: errors,
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

    commitProject(nextProject)
    setSelectedAnimationId(selectedAnimation.id)
    setSelectedFrameId(createdFrameIds[0])
    setSelectedAtlasFrameIds(new Set([createdFrameIds[0]]))
    setAtlasSelectionAnchorId(createdFrameIds[0])
    setPreviewIndex(0)
    setWorkspaceMode('frame')
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
    setPatchErrors([])
    setProviderMessage(
      `Attempt ${attemptContext.attempt} completed in ${formatElapsedMs(
        attemptContext.startedAt,
      )}. Ollama drafted ${createdFrameIds.length} editable frame${
        createdFrameIds.length === 1 ? '' : 's'
      } for "${animation.name}".`,
    )
    setProviderDetails(
      formatProviderDetails('Ollama animation draft accepted', {
        attempt: attemptContext.attempt,
        elapsedMs: formatElapsedMs(attemptContext.startedAt),
        mode: intent.mode,
        userInstruction: intent.userInstruction,
        paddedInstruction: intent.paddedInstruction,
        requestedFrameCount: intent.frameCount,
        createdFrameIds,
        animationName: animation.name,
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
  ) {
    if (!selectedFrame) {
      setProviderMessage('Cannot draft animation set because no frame is selected.')
      setProviderDetails(
        formatProviderDetails('Ollama animation set rejected', {
          attempt: attemptContext.attempt,
          elapsedMs: formatElapsedMs(attemptContext.startedAt),
          reason: 'No selected frame.',
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
          setDraft,
        }),
      )
      return
    }

    const timestamp = Date.now()
    const oldFrameIds = [...selectedAnimation.frameIds]
    let nextProject = cloneProject(project)
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
      const animationId =
        animationIndex === 0
          ? selectedAnimation.id
          : createUniqueAnimationId(
              nextProject,
              slugifyId(animationDraft.animationName ?? `ollama-draft-${animationIndex + 1}`, 'ollama-draft'),
            )
      const animation =
        animationIndex === 0
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

      if (animationIndex > 0) {
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
      setPatchErrors(errors)
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
          model: ollamaModel,
          validationErrors: errors,
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

    commitProject(nextProject)
    setSelectedAnimationId(createdAnimationIds[0] ?? selectedAnimation.id)
    setSelectedFrameId(createdFrameIds[0])
    setSelectedAtlasFrameIds(new Set([createdFrameIds[0]]))
    setAtlasSelectionAnchorId(createdFrameIds[0])
    setPreviewIndex(0)
    setWorkspaceMode('sheet')
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
    setPatchErrors([])
    setProviderMessage(
      `Attempt ${attemptContext.attempt} completed in ${formatElapsedMs(
        attemptContext.startedAt,
      )}. Ollama drafted ${setDraft.animations.length} animation row${
        setDraft.animations.length === 1 ? '' : 's'
      } with ${createdFrameIds.length} editable frame${createdFrameIds.length === 1 ? '' : 's'}.`,
    )
    setProviderDetails(
      formatProviderDetails('Ollama animation set accepted', {
        attempt: attemptContext.attempt,
        elapsedMs: formatElapsedMs(attemptContext.startedAt),
        mode: intent.mode,
        userInstruction: intent.userInstruction,
        paddedInstruction: intent.paddedInstruction,
        requestedFrameCount: intent.frameCount,
        requestedVariationCount: intent.variationCount,
        createdAnimationIds,
        createdFrameIds,
        setDraft,
      }),
    )
  }

  async function refreshOllamaModels() {
    setProviderChoice('ollama')
    setProviderMessage(`Checking Ollama at ${ollamaBaseUrl}...`)
    setProviderDetails('')
    setIsOllamaBusy(true)
    try {
      const models = await listOllamaModels(ollamaBaseUrl)
      setOllamaModels(models)
      if (models.length && !models.some((model) => model.name === ollamaModel)) {
        setOllamaModel(choosePreferredOllamaModel(models)?.name ?? models[0].name)
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
          selectedModel: ollamaModel,
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
    setProviderChoice('ollama')
    setProviderMessage(`Downloading Ollama model "${ollamaModel}"...`)
    setProviderDetails('')
    setIsOllamaBusy(true)
    try {
      const message = await pullOllamaModel(ollamaBaseUrl, ollamaModel)
      const models = await listOllamaModels(ollamaBaseUrl)
      setOllamaModels(models)
      setProviderMessage(`${message} Ready for structured edit requests.`)
      setProviderDetails(
        formatProviderDetails('Ollama model download result', {
          baseUrl: ollamaBaseUrl,
          downloadedModel: ollamaModel,
          modelCount: models.length,
          models,
        }),
      )
    } catch (error) {
      setProviderMessage(formatOllamaError(error, ollamaBaseUrl))
      setProviderDetails(
        formatProviderDetails('Ollama model download error', {
          baseUrl: ollamaBaseUrl,
          model: ollamaModel,
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
      setPatchErrors(validation.errors)
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
    setDisabledPatchOperationIndexes(new Set())
    setPatchErrors([])
    setProviderMessage('Edit applied.')
    setProviderDetails('')
  }

  function rejectPatch() {
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
    setPatchErrors([])
    setProviderMessage('Edit rejected.')
    setProviderDetails('')
  }

  function removeProposedPatchOperation(index: number) {
    setProposedPatch((patch) => patch.filter((_, operationIndex) => operationIndex !== index))
    setDisabledPatchOperationIndexes((current) => {
      const next = new Set<number>()
      current.forEach((disabledIndex) => {
        if (disabledIndex < index) {
          next.add(disabledIndex)
        } else if (disabledIndex > index) {
          next.add(disabledIndex - 1)
        }
      })
      return next
    })
    setPatchErrors([])
  }

  function toggleProposedPatchOperation(index: number) {
    setDisabledPatchOperationIndexes((current) => {
      const next = new Set(current)
      if (next.has(index)) {
        next.delete(index)
      } else {
        next.add(index)
      }
      return next
    })
    setPatchErrors([])
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
    const blob = await exportFramePng(project, selectedFrameId, exportScale)
    downloadBlob(`${selectedFrameId}@${exportScale}x.png`, blob)
  }

  async function exportAnimationStripPng() {
    const blob = await exportSpritesheetPng(project, selectedAnimation.id, {
      scale: exportScale,
      margin: exportMargin,
      spacing: exportSpacing,
    })
    downloadBlob(`${selectedAnimation.id}-animation-strip@${exportScale}x.png`, blob)
  }

  async function exportFullSpriteSheetPngOnly() {
    const blob = await exportFullSpriteSheetPng(project, {
      scale: exportScale,
      margin: exportMargin,
      spacing: exportSpacing,
      imageFilename: fullSpriteSheetImageFilename,
    })
    downloadBlob(fullSpriteSheetImageFilename, blob)
  }

  async function exportFullSpriteSheetWithMetadata() {
    await exportFullSpriteSheetPngOnly()
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
    const onPointerUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
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
    const onPointerUp = () => {
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      window.removeEventListener('pointermove', onPointerMove)
      window.removeEventListener('pointerup', onPointerUp)
    }

    window.addEventListener('pointermove', onPointerMove)
    window.addEventListener('pointerup', onPointerUp, { once: true })
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

  function saveSelectedColor() {
    if (!selectedColor || selectedColor.isTransparent) {
      return
    }

    const name = colorNameInputRef.current?.value ?? selectedColor.name
    const hex = colorHexInputRef.current?.value ?? selectedColor.hex
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
      setProviderMessage(`Updated palette color "${selectedColor.id}".`)
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
      id: 'patch-generate-mock',
      label: 'Generate mock edit',
      description: 'Ask the deterministic local mock provider for an editable change.',
      run: generateMockPatch,
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
          <button type="button" onClick={() => setIsCommandPaletteOpen(true)} title="Open command palette (Ctrl+K)">
            Cmd
          </button>
          <button type="button" onClick={() => setAppMode('start')}>
            Home
          </button>
          <button type="button" onClick={() => setAppMode('start')}>
            New
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
            <label>
              Provider
              <select
                value={providerChoice}
                onChange={(event) => setProviderChoice(event.target.value as ProviderChoice)}
              >
                <option value="ollama">Ollama local</option>
                <option value="mock">Mock local</option>
              </select>
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
            {providerChoice === 'ollama' ? (
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
            ) : null}
            <div className="button-stack">
              <button type="button" onClick={generateMockPatch}>
                Generate Mock Edit
              </button>
              <button type="button" onClick={generateOllamaPatch} disabled={isOllamaBusy}>
                {isOllamaBusy && providerChoice === 'ollama'
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
                className={tool === 'paint' ? 'active' : ''}
                onClick={() => setTool('paint')}
              >
                Paint
              </button>
              <button
                type="button"
                className={tool === 'erase' ? 'active' : ''}
                onClick={() => setTool('erase')}
              >
                Erase
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
              <details className="advanced-panel">
                <summary>Edit Palette Color</summary>
                <div className="palette-inspector">
                  <label>
                    Name
                    <input
                      key={`${selectedColor.id}-name`}
                      ref={colorNameInputRef}
                      defaultValue={selectedColor.name}
                    />
                  </label>
                  <label>
                    Hex
                    <div className="inline-control">
                      <input
                        key={`${selectedColor.id}-hex`}
                        ref={colorHexInputRef}
                        defaultValue={selectedColor.hex}
                        spellCheck={false}
                      />
                      <button type="button" onClick={saveSelectedColor}>
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
              {selectedFrame.layers.map((layer) => (
                <div
                  key={layer.id}
                  className={`layer-row ${selectedLayerId === layer.id ? 'active' : ''}`}
                >
                  <button
                    type="button"
                    className="layer-main"
                    onClick={() => setSelectedLayerId(layer.id)}
                  >
                    <strong>{layer.name}</strong>
                    <span>
                      {layer.visible ? 'Visible' : 'Hidden'} | {layer.editable ? 'Editable' : 'Locked'} |{' '}
                      {layer.exportable !== false ? 'Exports' : 'No export'} | {Object.keys(layer.cells).length} cells
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
              ))}
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

            <div className="pixel-grid-scroll">
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
                } as CSSProperties
              }
            >
              <MiniSprite
                project={project}
                frameId={previewFrameId}
                className={useSolidPreviewBackground ? 'solid-preview-background' : undefined}
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
              <label>
                Background
                <input
                  type="color"
                  value={previewBackgroundColor}
                  onChange={(event) => setPreviewBackgroundColor(event.target.value)}
                  disabled={!useSolidPreviewBackground}
                />
              </label>
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
            <div className="frame-actions">
              <button type="button" onClick={addFrame}>
                Add Frame
              </button>
              <button type="button" onClick={duplicateFrame}>
                Duplicate Frame
              </button>
              <button type="button" onClick={deleteFrame} disabled={frameIds.length <= 1}>
                Delete Frame
              </button>
            </div>
            {selectedFrame ? (
              <div className="frame-inspector">
                <label>
                  Frame name
                  <input
                    key={`${selectedFrame.id}-name`}
                    ref={frameNameInputRef}
                    defaultValue={selectedFrame.name}
                    onBlur={() => saveSelectedFrameProperties()}
                  />
                </label>
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
              </div>
            ) : null}
          </section>

          <section className={`inspector-section ${inspectorTab === 'animation' ? 'active' : ''}`}>
            <h2>Animation</h2>
            <p className="status-line">
              {selectedAnimation.name} / {frameIds.length} frame{frameIds.length === 1 ? '' : 's'} / {fps} FPS
            </p>
            <div className="frame-actions">
              <button type="button" onClick={addAnimation}>
                Add Animation
              </button>
              <button type="button" onClick={duplicateSelectedAnimation}>
                Duplicate
              </button>
              <button
                type="button"
                onClick={deleteSelectedAnimation}
                disabled={project.animations.length <= 1}
              >
                Delete
              </button>
            </div>
            <p className="status-line">
              Rename, reorder, and switch animations from the canvas toolbar while drawing.
            </p>
          </section>

          <details className="optional-panel">
            <summary>
              <span>
                <strong>AI Assistant</strong>
                <small>Optional structured edit proposals. Manual drawing and exports work without it.</small>
              </span>
            </summary>
            <PatchAssistant
              project={project}
              proposedPreviewProject={proposedPreviewProject}
              frameId={selectedFrameId}
              providerChoice={providerChoice}
              setProviderChoice={setProviderChoice}
              instruction={instruction}
              setInstruction={setInstruction}
              assetOutputContext={assetOutputContext}
              setAssetOutputContext={setAssetOutputContext}
              viewAngleContext={viewAngleContext}
              setViewAngleContext={setViewAngleContext}
              proposedPatch={proposedPatch}
              activeProposedPatch={activeProposedPatch}
              disabledOperationIndexes={disabledPatchOperationIndexes}
              patchErrors={[...patchErrors, ...patchValidation.errors]}
              providerMessage={providerMessage}
              providerDetails={providerDetails}
              ollamaBaseUrl={ollamaBaseUrl}
              setOllamaBaseUrl={setOllamaBaseUrl}
              ollamaModel={ollamaModel}
              setOllamaModel={setOllamaModel}
              onGenerateMock={generateMockPatch}
              onGenerateOllama={generateOllamaPatch}
              onApply={applyProposedPatch}
              onReject={rejectPatch}
              onRemoveOperation={removeProposedPatchOperation}
              onToggleOperation={toggleProposedPatchOperation}
              canApply={activeProposedPatch.length > 0 && patchValidation.valid}
              onTestOllama={async () => {
                try {
                  setProviderDetails('')
                  const message = await testOllamaConnection(ollamaBaseUrl)
                  setProviderMessage(message)
                  setProviderDetails(
                    formatProviderDetails('Ollama connection test result', {
                      baseUrl: ollamaBaseUrl,
                      message,
                    }),
                  )
                } catch (error) {
                  setProviderMessage(formatOllamaError(error, ollamaBaseUrl))
                  setProviderDetails(
                    formatProviderDetails('Ollama connection test error', {
                      baseUrl: ollamaBaseUrl,
                      error: formatErrorForDetails(error),
                    }),
                  )
                }
              }}
            />
          </details>
        </aside>
      </section>
    </main>
  )
}

function StartScreen({
  importErrors,
  newProjectAssetType,
  newProjectHeight,
  newProjectName,
  newProjectTemplateId,
  newProjectWidth,
  onCreateProject,
  onImport,
  onOpenCurrent,
  onOpenDemo,
  onSetAssetType,
  onSetHeight,
  onSetName,
  onSetTemplate,
  onSetWidth,
  templates,
}: {
  importErrors: string[]
  newProjectAssetType: SpriteAssetType
  newProjectHeight: number
  newProjectName: string
  newProjectTemplateId: string
  newProjectWidth: number
  templates: typeof SPRITE_PROJECT_TEMPLATES
  onCreateProject: () => void
  onImport: () => void
  onOpenCurrent: () => void
  onOpenDemo: () => void
  onSetAssetType: (assetType: SpriteAssetType) => void
  onSetHeight: (height: number) => void
  onSetName: (name: string) => void
  onSetTemplate: (templateId: string) => void
  onSetWidth: (width: number) => void
}) {
  return (
    <section className="start-screen">
      <div className="start-hero">
        <p className="eyebrow">Local-first structured pixel asset workbench</p>
        <h1>SpriteWrite</h1>
        <p className="start-tagline">
          Draw static or animated pixel assets on a fixed grid, preview the result, then export
          clean PNGs, animation strips, full sprite sheets, matching metadata, and editable project JSON.
        </p>
      </div>

      <div className="start-grid">
        <section className="panel start-panel">
          <h2>New Project</h2>
          <label>
            Project name
            <input value={newProjectName} onChange={(event) => onSetName(event.target.value)} />
          </label>
          <label>
            Template
            <select value={newProjectTemplateId} onChange={(event) => onSetTemplate(event.target.value)}>
              {templates.map((template) => (
                <option key={template.id} value={template.id}>
                  {template.name}
                </option>
              ))}
            </select>
          </label>
          <div className="form-grid">
            <label>
              Width
              <input
                min="1"
                max="256"
                type="number"
                value={newProjectWidth}
                onChange={(event) => onSetWidth(Number(event.target.value))}
              />
            </label>
            <label>
              Height
              <input
                min="1"
                max="256"
                type="number"
                value={newProjectHeight}
                onChange={(event) => onSetHeight(Number(event.target.value))}
              />
            </label>
          </div>
          <label>
            Asset type
            <select
              value={newProjectAssetType}
              onChange={(event) => onSetAssetType(event.target.value as SpriteAssetType)}
            >
              {ASSET_TYPE_OPTIONS.map((assetType) => (
                <option key={assetType} value={assetType}>
                  {formatAssetType(assetType)}
                </option>
              ))}
            </select>
          </label>
          <div className="button-stack">
            <button type="button" onClick={onCreateProject}>
              New Project
            </button>
            <button type="button" onClick={onImport}>
              Import Project JSON
            </button>
            <button type="button" onClick={onOpenCurrent}>
              Open Current Project
            </button>
          </div>
          {importErrors.length ? (
            <div className="validation-errors">
              {importErrors.map((error) => (
                <p key={error}>{error}</p>
              ))}
            </div>
          ) : null}
        </section>

        <section className="panel start-panel">
          <h2>New From Template</h2>
          <div className="template-list">
            {templates.map((template) => (
              <button
                key={template.id}
                type="button"
                className={newProjectTemplateId === template.id ? 'template-card active' : 'template-card'}
                onClick={() => onSetTemplate(template.id)}
              >
                <strong>{template.name}</strong>
                <span>
                  {formatAssetType(template.assetType)} / {template.width}x{template.height}
                </span>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={onOpenDemo}>
            Open Hero Demo
          </button>
        </section>

        <section className="panel start-panel">
          <h2>Browser Draft</h2>
          <p className="status-line">
            SpriteWrite restores the last valid browser draft on load. This is a convenience, not a
            project library.
          </p>
          <p className="status-line">
            Project JSON is the editable source artifact. PNGs and metadata are production exports.
          </p>
        </section>
      </div>
    </section>
  )
}

function CommandPalette({
  commands,
  isOpen,
  query,
  onClose,
  onQueryChange,
  onRunCommand,
}: {
  commands: CommandItem[]
  isOpen: boolean
  query: string
  onClose: () => void
  onQueryChange: (query: string) => void
  onRunCommand: (command: CommandItem) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCommands = commands.filter((command) => {
    const haystack = `${command.label} ${command.description} ${command.shortcut ?? ''}`.toLowerCase()
    return haystack.includes(normalizedQuery)
  })

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-palette-header">
          <div>
            <h2>Commands</h2>
            <p>Find editor actions, exports, frames, layers, and edit commands.</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <input
          ref={inputRef}
          value={query}
          placeholder="Search commands..."
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }

            if (event.key === 'Enter') {
              const firstEnabledCommand = filteredCommands.find((command) => !command.disabled)
              if (firstEnabledCommand) {
                event.preventDefault()
                onRunCommand(firstEnabledCommand)
              }
            }
          }}
        />
        <div className="command-list">
          {filteredCommands.length ? (
            filteredCommands.map((command) => (
              <button
                key={command.id}
                type="button"
                className="command-item"
                onClick={() => onRunCommand(command)}
                disabled={command.disabled}
              >
                <span>
                  <strong>{command.label}</strong>
                  <small>{command.description}</small>
                </span>
                {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
              </button>
            ))
          ) : (
            <p className="empty-state">No matching command.</p>
          )}
        </div>
      </section>
    </div>
  )
}

function AtlasOverview({
  project,
  selectedAnimationId,
  selectedFrameId,
  selectedFrameIds,
  draggedFrameId,
  onSelectFrame,
  onFrameDragStart,
  onFrameDrop,
  onFrameDragEnd,
  onDuplicateSelectedFrames,
  onDeleteSelectedFrames,
  onSetSelectedDuration,
  onSetSelectedTags,
  onSetSelectedNotes,
  workspaceMode,
  onWorkspaceModeChange,
  onResizeStart,
}: {
  project: SpriteProject
  selectedAnimationId: AnimationId
  selectedFrameId: FrameId
  selectedFrameIds: Set<FrameId>
  draggedFrameId?: FrameId
  onSelectFrame: (
    animationId: AnimationId,
    frameId: FrameId,
    options?: { range?: boolean; toggle?: boolean },
  ) => void
  onFrameDragStart: (animationId: AnimationId, frameId: FrameId) => void
  onFrameDrop: (animationId: AnimationId, targetFrameId: FrameId) => void
  onFrameDragEnd: () => void
  onDuplicateSelectedFrames: () => void
  onDeleteSelectedFrames: () => void
  onSetSelectedDuration: (durationMs: number) => void
  onSetSelectedTags: (tagsInput: string) => void
  onSetSelectedNotes: (notes: string) => void
  workspaceMode: WorkspaceMode
  onWorkspaceModeChange: (mode: WorkspaceMode) => void
  onResizeStart: (event: ReactPointerEvent<HTMLButtonElement>) => void
}) {
  const durationInputRef = useRef<HTMLInputElement | null>(null)
  const tagsInputRef = useRef<HTMLInputElement | null>(null)
  const notesInputRef = useRef<HTMLTextAreaElement | null>(null)
  const selectedAnimation = getAnimation(project, selectedAnimationId) ?? project.animations[0]
  const selectedFrameIdList = selectedAnimation.frameIds.filter((frameId) => selectedFrameIds.has(frameId))
  const selectedFrameCount = selectedFrameIdList.length || 1
  const selectedFrames = (selectedFrameIdList.length ? selectedFrameIdList : [selectedFrameId])
    .map((frameId) => getFrame(project, frameId))
    .filter((frame): frame is SpriteFrame => Boolean(frame))
  const selectedDurations = Array.from(new Set(selectedFrames.map((frame) => frame.durationMs)))
  const durationInputDefault = selectedDurations.length === 1 ? selectedDurations[0] : selectedFrames[0]?.durationMs ?? 100
  const selectedTagValues = Array.from(new Set(selectedFrames.map((frame) => (frame.tags ?? []).join(', '))))
  const tagsInputDefault = selectedTagValues.length === 1 ? selectedTagValues[0] : ''
  const selectedNoteValues = Array.from(new Set(selectedFrames.map((frame) => frame.notes ?? '')))
  const notesInputDefault = selectedNoteValues.length === 1 ? selectedNoteValues[0] : ''
  const canDeleteSelectedFrames = selectedAnimation.frameIds.length - selectedFrameCount >= 1

  return (
    <section className="atlas-overview" aria-label="Sprite atlas overview">
      <button
        type="button"
        className="panel-resize-handle panel-resize-handle-horizontal"
        aria-label="Resize sprite sheet rows panel"
        title="Drag to resize sprite sheet rows"
        onPointerDown={onResizeStart}
      />
      <div className="atlas-header">
        <div>
          <p className="eyebrow">Atlas</p>
          <h2>Sprite Sheet Rows</h2>
        </div>
        <div className="atlas-actions">
          <p className="status-line">
            {selectedFrameCount} selected. Shift-click selects a range, ctrl/cmd-click toggles, drag reorders.
          </p>
          <div className="segmented workspace-mode-toggle" aria-label="Workspace view">
            <button
              type="button"
              className={workspaceMode === 'frame' ? 'active' : ''}
              onClick={() => onWorkspaceModeChange('frame')}
            >
              Edit Frame
            </button>
            <button
              type="button"
              className={workspaceMode === 'sheet' ? 'active' : ''}
              onClick={() => onWorkspaceModeChange('sheet')}
            >
              Full Sheet
            </button>
          </div>
          <div className="segmented">
            <button type="button" onClick={onDuplicateSelectedFrames}>
              Duplicate Selected
            </button>
            <button type="button" onClick={onDeleteSelectedFrames} disabled={!canDeleteSelectedFrames}>
              Delete Selected
            </button>
          </div>
          <details className="atlas-batch-details">
            <summary>Batch Metadata</summary>
            <div className="atlas-batch-metadata">
              <label>
                Duration ms
                <input
                  key={`${selectedAnimationId}-${selectedFrameId}-${selectedFrameCount}-${durationInputDefault}`}
                  ref={durationInputRef}
                  type="number"
                  min="1"
                  defaultValue={durationInputDefault}
                />
              </label>
              <button
                type="button"
                onClick={() => onSetSelectedDuration(Number(durationInputRef.current?.value ?? durationInputDefault))}
              >
                Set Duration
              </button>
              {selectedDurations.length > 1 ? <span>Mixed timing</span> : null}
              <label>
                Tags
                <input
                  key={`${selectedAnimationId}-${selectedFrameId}-${selectedFrameCount}-tags-${tagsInputDefault}`}
                  ref={tagsInputRef}
                  defaultValue={tagsInputDefault}
                  placeholder={selectedTagValues.length > 1 ? 'mixed tags' : 'idle, contact'}
                />
              </label>
              <button
                type="button"
                onClick={() => onSetSelectedTags(tagsInputRef.current?.value ?? tagsInputDefault)}
              >
                Set Tags
              </button>
              {selectedTagValues.length > 1 ? <span>Mixed tags</span> : null}
              <label className="atlas-notes-field">
                Notes
                <textarea
                  key={`${selectedAnimationId}-${selectedFrameId}-${selectedFrameCount}-notes-${notesInputDefault}`}
                  ref={notesInputRef}
                  defaultValue={notesInputDefault}
                  placeholder={selectedNoteValues.length > 1 ? 'mixed notes' : 'Frame note'}
                />
              </label>
              <button
                type="button"
                onClick={() => onSetSelectedNotes(notesInputRef.current?.value ?? notesInputDefault)}
              >
                Set Notes
              </button>
              {selectedNoteValues.length > 1 ? <span>Mixed notes</span> : null}
            </div>
          </details>
        </div>
      </div>

      <div className="atlas-row-list">
        {project.animations.map((animation) => (
          <div
            key={animation.id}
            className={`atlas-row ${selectedAnimationId === animation.id ? 'active' : ''}`}
          >
            <button
              type="button"
              className="atlas-row-label"
              onClick={() => onSelectFrame(animation.id, animation.frameIds[0])}
            >
              <strong>{animation.name}</strong>
              <span>
                {animation.frameIds.length} frame{animation.frameIds.length === 1 ? '' : 's'} / {animation.fps} FPS
              </span>
              <span>
                {animation.frameIds.filter((frameId) => selectedFrameIds.has(frameId)).length || 1} selected
              </span>
            </button>
            <div className="atlas-frame-strip">
              {animation.frameIds.map((frameId, index) => {
                const selected = selectedFrameIds.has(frameId)
                const active = selectedFrameId === frameId
                const dragged = draggedFrameId === frameId
                const className = [
                  active ? 'active' : '',
                  selected ? 'selected' : '',
                  dragged ? 'dragging' : '',
                ]
                  .filter(Boolean)
                  .join(' ')

                return (
                  <button
                    key={frameId}
                    type="button"
                    className={className}
                    draggable
                    aria-pressed={selected}
                    onClick={(event: MouseEvent<HTMLButtonElement>) => {
                      onSelectFrame(animation.id, frameId, {
                        range: event.shiftKey,
                        toggle: event.ctrlKey || event.metaKey,
                      })
                    }}
                    onDragStart={(event: DragEvent<HTMLButtonElement>) => {
                      event.dataTransfer.effectAllowed = 'move'
                      event.dataTransfer.setData('text/plain', frameId)
                      onFrameDragStart(animation.id, frameId)
                    }}
                    onDragOver={(event: DragEvent<HTMLButtonElement>) => {
                      event.preventDefault()
                      event.dataTransfer.dropEffect = 'move'
                    }}
                    onDrop={(event: DragEvent<HTMLButtonElement>) => {
                      event.preventDefault()
                      onFrameDrop(animation.id, frameId)
                    }}
                    onDragEnd={onFrameDragEnd}
                    title={`${animation.name} frame ${index + 1}. Drag to reorder.`}
                  >
                    <MiniSprite project={project} frameId={frameId} />
                    <span>{index + 1}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function FullSheetWorkspace({
  project,
  selectedAnimationId,
  selectedFrameId,
  selectedFrameIds,
  onSelectFrame,
}: {
  project: SpriteProject
  selectedAnimationId: AnimationId
  selectedFrameId: FrameId
  selectedFrameIds: Set<FrameId>
  onSelectFrame: (animationId: AnimationId, frameId: FrameId) => void
}) {
  const columnCount = Math.max(...project.animations.map((animation) => animation.frameIds.length))

  return (
    <section className="sheet-workspace" aria-label="Full sprite sheet view">
      <div className="stage-header">
        <div>
          <p className="eyebrow">Workspace</p>
          <h2>Full Sprite Sheet View</h2>
          <p>
            {project.animations.length} row{project.animations.length === 1 ? '' : 's'} /{' '}
            {project.canvas.width}x{project.canvas.height} cells per frame. Click any frame to edit it.
          </p>
        </div>
      </div>

      <div className="sheet-row-list">
        {project.animations.map((animation) => (
          <div
            key={animation.id}
            className={`sheet-row ${selectedAnimationId === animation.id ? 'active' : ''}`}
          >
            <div className="sheet-row-heading">
              <strong>{animation.name}</strong>
              <span>
                {animation.frameIds.length} frame{animation.frameIds.length === 1 ? '' : 's'} / {animation.fps} FPS
              </span>
            </div>
            <div className="sheet-row-strip">
              {Array.from({ length: columnCount }).map((_, index) => {
                const frameId = animation.frameIds[index]
                if (!frameId) {
                  return (
                    <div
                      key={`${animation.id}-empty-${index}`}
                      className="sheet-frame-placeholder"
                      aria-label={`${animation.name} empty sprite sheet cell ${index + 1}`}
                    >
                      <span>{index + 1}</span>
                    </div>
                  )
                }

                const active = selectedFrameId === frameId
                const selected = selectedFrameIds.has(frameId)

                return (
                  <button
                    key={frameId}
                    type="button"
                    className={`${active ? 'active' : ''} ${selected ? 'selected' : ''}`.trim()}
                    onClick={() => onSelectFrame(animation.id, frameId)}
                    title={`Edit ${animation.name} frame ${index + 1}`}
                  >
                    <MiniSprite project={project} frameId={frameId} />
                    <span>{index + 1}</span>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

function MiniSprite({
  project,
  frameId,
  highlightedOperations = [],
  className,
}: {
  project: SpriteProject
  frameId: FrameId
  highlightedOperations?: PixelPatchOperation[]
  className?: string
}) {
  const pixels = composeFramePixels(project, frameId)
  const highlightedCells = Array.from(
    highlightedOperations
      .reduce((cells, operation) => {
        cells.set(cellKey(operation.x, operation.y), operation)
        return cells
      }, new Map<string, PixelPatchOperation>())
      .values(),
  )

  return (
    <div
      className={className ? `mini-sprite ${className}` : 'mini-sprite'}
      style={{
        gridTemplateColumns: `repeat(${project.canvas.width}, 1fr)`,
        gridTemplateRows: `repeat(${project.canvas.height}, 1fr)`,
      }}
    >
      {pixels.map((pixel) => (
        <span
          key={`${pixel.x},${pixel.y},${pixel.colorId}`}
          className="mini-pixel"
          style={{
            gridColumn: pixel.x + 1,
            gridRow: pixel.y + 1,
            background: pixel.hex,
            opacity: pixel.opacity,
            mixBlendMode: pixel.blendMode,
          }}
        />
      ))}
      {highlightedCells.map((operation) => (
        <span
          key={`highlight-${operation.x}-${operation.y}`}
          className={`mini-highlight mini-highlight-${operation.op}`}
          title={
            operation.op === 'set'
              ? `Proposed set ${operation.x},${operation.y} to ${operation.colorId}`
              : `Proposed clear ${operation.x},${operation.y}`
          }
          style={{
            gridColumn: operation.x + 1,
            gridRow: operation.y + 1,
          }}
        />
      ))}
    </div>
  )
}

function PatchAssistant({
  project,
  proposedPreviewProject,
  frameId,
  providerChoice,
  setProviderChoice,
  instruction,
  setInstruction,
  assetOutputContext,
  setAssetOutputContext,
  viewAngleContext,
  setViewAngleContext,
  proposedPatch,
  activeProposedPatch,
  disabledOperationIndexes,
  patchErrors,
  providerMessage,
  providerDetails,
  ollamaBaseUrl,
  setOllamaBaseUrl,
  ollamaModel,
  setOllamaModel,
  onGenerateMock,
  onGenerateOllama,
  onApply,
  onReject,
  onRemoveOperation,
  onToggleOperation,
  canApply,
  onTestOllama,
}: {
  project: SpriteProject
  proposedPreviewProject?: SpriteProject
  frameId: FrameId
  providerChoice: ProviderChoice
  setProviderChoice: (provider: ProviderChoice) => void
  instruction: string
  setInstruction: (instruction: string) => void
  assetOutputContext: SpriteWriteAssetOutputContext
  setAssetOutputContext: (context: SpriteWriteAssetOutputContext) => void
  viewAngleContext: SpriteWriteViewAngleContext
  setViewAngleContext: (context: SpriteWriteViewAngleContext) => void
  proposedPatch: PixelPatchOperation[]
  activeProposedPatch: PixelPatchOperation[]
  disabledOperationIndexes: Set<number>
  patchErrors: string[]
  providerMessage: string
  providerDetails: string
  ollamaBaseUrl: string
  setOllamaBaseUrl: (value: string) => void
  ollamaModel: string
  setOllamaModel: (value: string) => void
  onGenerateMock: () => void
  onGenerateOllama: () => void
  onApply: () => void
  onReject: () => void
  onRemoveOperation: (index: number) => void
  onToggleOperation: (index: number) => void
  canApply: boolean
  onTestOllama: () => void
}) {
  const uniqueErrors = Array.from(new Set(patchErrors))
  const disabledCount = disabledOperationIndexes.size

  return (
    <section className="patch-assistant">
      <h2>AI Assistant</h2>
      <label>
        Provider
        <select
          value={providerChoice}
          onChange={(event) => setProviderChoice(event.target.value as ProviderChoice)}
        >
          <option value="ollama">Ollama local</option>
          <option value="mock">Mock local</option>
        </select>
      </label>
      <label>
        Instruction
        <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} />
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

      {providerChoice === 'ollama' ? (
        <div className="ollama-settings">
          <label>
            Base URL
            <input value={ollamaBaseUrl} onChange={(event) => setOllamaBaseUrl(event.target.value)} />
          </label>
          <label>
            Model
            <input value={ollamaModel} onChange={(event) => setOllamaModel(event.target.value)} />
          </label>
          <button type="button" onClick={onTestOllama}>
            Test Ollama
          </button>
        </div>
      ) : null}

      {providerChoice === 'ollama' ? (
        <div className="button-stack">
          <button type="button" onClick={onGenerateOllama}>
            Generate With Ollama
          </button>
        </div>
      ) : (
        <div className="button-stack">
          <button type="button" onClick={onGenerateMock}>
            Generate Mock Edit
          </button>
        </div>
      )}

      <div className="patch-json-header">
        <span>Active edit JSON</span>
        {proposedPatch.length ? (
          <span>
            {activeProposedPatch.length}/{proposedPatch.length} enabled
          </span>
        ) : null}
      </div>
      <pre className="json-preview">
        {activeProposedPatch.length ? JSON.stringify(activeProposedPatch, null, 2) : '[]'}
      </pre>

      <PatchPreviewComparison
        project={project}
        proposedPreviewProject={proposedPreviewProject}
        frameId={frameId}
        hasActivePatch={activeProposedPatch.length > 0}
        highlightedOperations={activeProposedPatch}
      />

      <PatchDiff
        patch={proposedPatch}
        disabledOperationIndexes={disabledOperationIndexes}
        onRemoveOperation={onRemoveOperation}
        onToggleOperation={onToggleOperation}
      />

      {uniqueErrors.length ? (
        <div className="validation-errors">
          {uniqueErrors.map((error) => (
            <p key={error}>{error}</p>
          ))}
        </div>
      ) : null}

      {providerMessage ? <p className="provider-message">{providerMessage}</p> : null}
      <ProviderDetails details={providerDetails} />
      {disabledCount ? <p className="status-line">{disabledCount} operation(s) excluded from apply.</p> : null}

      <div className="frame-actions">
        <button type="button" onClick={onApply} disabled={!canApply}>
          Apply Edit
        </button>
        <button type="button" onClick={onReject} disabled={!proposedPatch.length}>
          Reject Edit
        </button>
      </div>
    </section>
  )
}

function ProviderDetails({ details }: { details: string }) {
  if (!details.trim()) {
    return null
  }

  return (
    <details className="provider-details">
      <summary>Show provider details</summary>
      <pre>{details}</pre>
    </details>
  )
}

function PatchPreviewComparison({
  project,
  proposedPreviewProject,
  frameId,
  hasActivePatch,
  highlightedOperations,
}: {
  project: SpriteProject
  proposedPreviewProject?: SpriteProject
  frameId: FrameId
  hasActivePatch: boolean
  highlightedOperations: PixelPatchOperation[]
}) {
  return (
    <div className="patch-preview-compare">
      <div>
        <span>Current frame</span>
        <MiniSprite
          project={project}
          frameId={frameId}
          highlightedOperations={highlightedOperations}
        />
      </div>
      <div>
        <span>Proposed edit</span>
        {proposedPreviewProject ? (
          <MiniSprite
            project={proposedPreviewProject}
            frameId={frameId}
            highlightedOperations={highlightedOperations}
          />
        ) : (
          <div className="mini-sprite empty-preview">
            {hasActivePatch ? 'Invalid' : 'No edit'}
          </div>
        )}
      </div>
    </div>
  )
}

function PatchDiff({
  patch,
  disabledOperationIndexes,
  onRemoveOperation,
  onToggleOperation,
}: {
  patch: PixelPatchOperation[]
  disabledOperationIndexes: Set<number>
  onRemoveOperation: (index: number) => void
  onToggleOperation: (index: number) => void
}) {
  const activePatch = patch.filter((_, index) => !disabledOperationIndexes.has(index))
  const setCount = activePatch.filter((operation) => operation.op === 'set').length
  const clearCount = activePatch.filter((operation) => operation.op === 'clear').length
  const affectedCells = new Set(activePatch.map((operation) => `${operation.x},${operation.y}`))
  const operationGroups = activePatch.reduce<Record<string, number>>((groups, operation) => {
    const key = operation.op === 'set' ? operation.colorId : 'clear'
    groups[key] = (groups[key] ?? 0) + 1
    return groups
  }, {})
  const bounds = activePatch.length
    ? activePatch.reduce(
        (current, operation) => ({
          minX: Math.min(current.minX, operation.x),
          minY: Math.min(current.minY, operation.y),
          maxX: Math.max(current.maxX, operation.x),
          maxY: Math.max(current.maxY, operation.y),
        }),
        {
          minX: activePatch[0].x,
          minY: activePatch[0].y,
          maxX: activePatch[0].x,
          maxY: activePatch[0].y,
        },
      )
    : undefined

  return (
    <div className="patch-diff">
      <div className="patch-diff-summary">
        <span>Set {setCount}</span>
        <span>Clear {clearCount}</span>
        <span>Ops {activePatch.length}</span>
        <span>Cells {affectedCells.size}</span>
        <span>
          Bounds{' '}
          {bounds
            ? `${bounds.minX},${bounds.minY}-${bounds.maxX},${bounds.maxY}`
            : 'none'}
        </span>
      </div>
      {activePatch.length ? (
        <div className="patch-group-list" aria-label="Active edit groups">
          {Object.entries(operationGroups).map(([group, count]) => (
            <span key={group}>
              {group} {count}
            </span>
          ))}
        </div>
      ) : null}
      {patch.length ? (
        <ol>
          {patch.slice(0, 12).map((operation, index) => {
            const disabled = disabledOperationIndexes.has(index)
            return (
              <li
                key={`${operation.op}-${operation.x}-${operation.y}-${index}`}
                className={disabled ? 'disabled-operation' : ''}
              >
                <span>
                  {operation.op === 'set'
                    ? `set ${operation.x},${operation.y} -> ${operation.colorId}`
                    : `clear ${operation.x},${operation.y}`}
                </span>
                <div className="patch-operation-actions">
                  <button type="button" onClick={() => onToggleOperation(index)}>
                    {disabled ? 'Include' : 'Exclude'}
                  </button>
                  <button type="button" onClick={() => onRemoveOperation(index)}>
                    Remove
                  </button>
                </div>
              </li>
            )
          })}
        </ol>
      ) : (
        <p>No proposed edit.</p>
      )}
      {patch.length > 12 ? <p>{patch.length - 12} more operation(s).</p> : null}
    </div>
  )
}

export default App
