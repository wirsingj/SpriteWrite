import { useEffect, useMemo, useRef, useState } from 'react'
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
  moveLayerInProject,
  movePaletteColorInProject,
  setFrameHitboxInProject,
  setLayerVisibilityInProject,
  updateLayerPropertiesInProject,
  updateAnimationPropertiesInProject,
  updateFramePropertiesInProject,
  updatePaletteColorInProject,
  validateProject,
  validatePatch,
} from './domain/spriteData'
import { composeFramePixels, getLayerColorId } from './domain/rendering'
import { createSpriteSheetLayout } from './domain/exportPlanning'
import type {
  SpriteAssetType,
  FrameId,
  PixelPatchOperation,
  SpriteFrame,
  SpriteProject,
} from './domain/spriteTypes'
import {
  getProjectTemplate,
  SPRITE_PROJECT_TEMPLATES,
} from './domain/projectTemplates'
import { MockPatchProvider } from './providers/mockPatchProvider'
import { OllamaPatchProvider, testOllamaConnection } from './providers/ollamaPatchProvider'
import {
  exportFramePng,
  exportSpritesheetMetadata,
  exportSpritesheetPng,
} from './utils/canvasExport'
import { downloadBlob, downloadTextFile } from './utils/download'

type Tool = 'paint' | 'erase'
type ProviderChoice = 'mock' | 'ollama'
type AppMode = 'start' | 'editor'
type ShortcutAction = 'paint' | 'erase'
type LayerPresetId = 'art' | 'guide' | 'shadow' | 'highlight'
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
  'generic',
  'character',
  'enemy',
  'ooze',
  'icon',
  'ui',
  'button',
  'background',
  'parallax',
]

function getFirstPaintColorId(project: SpriteProject): string {
  return project.palette.find((color) => !color.isTransparent)?.id ?? project.palette[0]?.id ?? ''
}

function getDefaultPatchInstruction(project: SpriteProject): string {
  switch (project.assetType) {
    case 'ooze':
      return 'Add a small readable ooze detail.'
    case 'button':
      return 'Add a clean readable button detail.'
    case 'icon':
      return 'Add a crisp icon detail.'
    case 'background':
    case 'parallax':
      return 'Add a subtle readable background detail.'
    default:
      return 'Add a small readable detail.'
  }
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
  const [selectedAnimationId, setSelectedAnimationId] = useState(project.metadata.defaultAnimationId)
  const selectedAnimation = getAnimation(project, selectedAnimationId) ?? project.animations[0]
  const selectedAnimationIndex = project.animations.findIndex((animation) => animation.id === selectedAnimation.id)
  const [selectedFrameId, setSelectedFrameId] = useState<FrameId>(selectedAnimation.frameIds[0])
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
  const [providerChoice, setProviderChoice] = useState<ProviderChoice>('mock')
  const [instruction, setInstruction] = useState(() => getDefaultPatchInstruction(project))
  const [proposedPatch, setProposedPatch] = useState<PixelPatchOperation[]>([])
  const [disabledPatchOperationIndexes, setDisabledPatchOperationIndexes] = useState<Set<number>>(
    () => new Set(),
  )
  const [patchErrors, setPatchErrors] = useState<string[]>([])
  const [importErrors, setImportErrors] = useState<string[]>([])
  const [providerMessage, setProviderMessage] = useState('')
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false)
  const [ollamaBaseUrl, setOllamaBaseUrl] = useState('http://localhost:11434')
  const [ollamaModel, setOllamaModel] = useState('llama3.2')
  const [exportScale, setExportScale] = useState(1)
  const [exportMargin, setExportMargin] = useState(0)
  const [exportSpacing, setExportSpacing] = useState(0)
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false)
  const [commandQuery, setCommandQuery] = useState('')
  const [shortcuts, setShortcuts] = useState(loadShortcutSettings)
  const [newProjectName, setNewProjectName] = useState('Untitled Sprite')
  const [newProjectTemplateId, setNewProjectTemplateId] = useState('blank-32')
  const [newProjectWidth, setNewProjectWidth] = useState(32)
  const [newProjectHeight, setNewProjectHeight] = useState(32)
  const [newProjectAssetType, setNewProjectAssetType] = useState<SpriteAssetType>('generic')
  const importInputRef = useRef<HTMLInputElement | null>(null)
  const layerNameInputRef = useRef<HTMLInputElement | null>(null)
  const colorNameInputRef = useRef<HTMLInputElement | null>(null)
  const colorHexInputRef = useRef<HTMLInputElement | null>(null)
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
  const selectedFrameIndex = frameIds.indexOf(selectedFrameId)
  const previousFrameId = selectedFrameIndex > 0 ? frameIds[selectedFrameIndex - 1] : undefined
  const previewFrameId = frameIds[previewIndex % frameIds.length] ?? selectedFrameId
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
  const exportLayout = useMemo(
    () =>
      createSpriteSheetLayout(project, selectedAnimation.id, {
        scale: exportScale,
        margin: exportMargin,
        spacing: exportSpacing,
      }),
    [exportMargin, exportScale, exportSpacing, project, selectedAnimation.id],
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
          setSelectedFrameId(nextFrameId)
          setPreviewIndex(nextIndex)
          setProposedPatch([])
          setDisabledPatchOperationIndexes(new Set())
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
    setRedoStack((stack) => [...stack, cloneProject(project)])
    setUndoStack((stack) => stack.slice(0, -1))
    setProject(previous)
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
  }

  function redo() {
    const next = redoStack.at(-1)
    if (!next) {
      return
    }
    setUndoStack((stack) => [...stack, cloneProject(project)])
    setRedoStack((stack) => stack.slice(0, -1))
    setProject(next)
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
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
    })
  }

  async function generateMockPatch() {
    setProviderMessage('')
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
    } catch (error) {
      setProviderMessage(error instanceof Error ? error.message : 'Mock provider failed.')
    }
  }

  async function generateOllamaPatch() {
    setProviderMessage('')
    try {
      const provider = new OllamaPatchProvider({ baseUrl: ollamaBaseUrl, model: ollamaModel })
      const patch = await provider.requestPatch({
        project,
        animationId: selectedAnimation.id,
        frameId: selectedFrameId,
        layerId: selectedLayerId,
        instruction,
        constraints: { selectedColorId, maxOperations: 24 },
      })
      const validation = validatePatch(project, selectedAnimation.id, selectedFrameId, selectedLayerId, patch)
      setProposedPatch(patch)
      setDisabledPatchOperationIndexes(new Set())
      setPatchErrors(validation.errors)
    } catch (error) {
      setProviderMessage(error instanceof Error ? error.message : 'Ollama provider failed.')
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
      return
    }
    commitProject(applyPatch(project, selectedAnimation.id, selectedFrameId, selectedLayerId, activeProposedPatch))
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
    setPatchErrors([])
    setProviderMessage('Patch applied.')
  }

  function rejectPatch() {
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
    setPatchErrors([])
    setProviderMessage('Patch rejected.')
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

  async function exportAnimationPng() {
    const blob = await exportSpritesheetPng(project, selectedAnimation.id, {
      scale: exportScale,
      margin: exportMargin,
      spacing: exportSpacing,
    })
    downloadBlob(`${selectedAnimation.id}-spritesheet@${exportScale}x.png`, blob)
  }

  function exportMetadataJson() {
    downloadTextFile(
      `${selectedAnimation.id}-metadata@${exportScale}x.json`,
      exportSpritesheetMetadata(project, selectedAnimation.id, {
        scale: exportScale,
        margin: exportMargin,
        spacing: exportSpacing,
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
    setPreviewIndex(0)
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
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
      setPreviewIndex(0)
      setProposedPatch([])
      setDisabledPatchOperationIndexes(new Set())
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
    setPreviewIndex(0)
    setProposedPatch([])
    setDisabledPatchOperationIndexes(new Set())
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
      setPreviewIndex(0)
      setProposedPatch([])
      setDisabledPatchOperationIndexes(new Set())
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

  function updateShortcut(action: ShortcutAction, value: string) {
    const nextShortcut = value.trim().slice(0, 1).toLowerCase()
    if (!nextShortcut) {
      return
    }

    const conflictingAction = (Object.keys(shortcuts) as ShortcutAction[]).find(
      (candidate) => candidate !== action && shortcuts[candidate] === nextShortcut,
    )
    if (conflictingAction) {
      setProviderMessage(`Shortcut "${nextShortcut.toUpperCase()}" is already assigned to ${conflictingAction}.`)
      return
    }

    setShortcuts((current) => ({ ...current, [action]: nextShortcut }))
    setProviderMessage(`Updated ${action} shortcut to "${nextShortcut.toUpperCase()}".`)
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
    activeProposedPatch.forEach((operation) => map.set(cellKey(operation.x, operation.y), operation))
    return map
  }, [activeProposedPatch])

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
          setSelectedFrameId(nextFrameId)
          setPreviewIndex(selectedFrameIndex - 1)
          setProposedPatch([])
          setDisabledPatchOperationIndexes(new Set())
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
          setSelectedFrameId(nextFrameId)
          setPreviewIndex(selectedFrameIndex + 1)
          setProposedPatch([])
          setDisabledPatchOperationIndexes(new Set())
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
      description: 'Copy the selected frame after the current timeline position.',
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
      label: 'Generate mock patch',
      description: 'Ask the deterministic local mock provider for a patch proposal.',
      run: generateMockPatch,
    },
    {
      id: 'patch-apply',
      label: 'Apply proposed patch',
      description: 'Accept the current validated patch proposal.',
      disabled: proposedPatch.length === 0 || !patchValidation.valid,
      run: applyProposedPatch,
    },
    {
      id: 'patch-reject',
      label: 'Reject proposed patch',
      description: 'Discard the current patch proposal.',
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
      id: 'export-spritesheet-png',
      label: 'Export Animation Spritesheet PNG',
      description: 'Export the current animation as a horizontal PNG sheet.',
      run: exportAnimationPng,
    },
    {
      id: 'export-metadata-json',
      label: 'Export Animation Metadata JSON',
      description: 'Export boring JSON metadata that matches the spritesheet layout.',
      run: exportMetadataJson,
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
                  getProjectTemplate('ooze-32-demo').createProject({ name: 'Ooze Sprite Starter' }),
                  'Opened ooze demo template.',
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
      <header className="topbar">
        <div>
          <p className="eyebrow">SpriteWrite / {project.assetType ?? 'generic'} / {project.canvas.width}x{project.canvas.height}</p>
          <h1>{project.name}</h1>
          <p className="status-line">
            {hasUnsavedChanges
              ? 'Unsaved editable changes. Export Project JSON to save.'
              : 'Project JSON export is current.'}
          </p>
        </div>
        <div className="topbar-actions">
          <button type="button" onClick={() => setIsCommandPaletteOpen(true)} title="Open command palette">
            Commands
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
          <button type="button" onClick={exportProjectJson}>
            Export Project JSON
          </button>
          <button type="button" onClick={exportCurrentFramePng}>
            Export Frame PNG
          </button>
          <button type="button" onClick={exportAnimationPng}>
            Export Spritesheet PNG
          </button>
          <button type="button" onClick={exportMetadataJson}>
            Export Metadata JSON
          </button>
          <button type="button" onClick={undo} disabled={!undoStack.length} title="Undo">
            Undo
          </button>
          <button type="button" onClick={redo} disabled={!redoStack.length} title="Redo">
            Redo
          </button>
        </div>
      </header>

      <section className="workbench">
        <aside className="panel tools-panel">
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

          <section>
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
            ) : null}
          </section>

          <section>
            <h2>Project</h2>
            <p className="status-line">
              Animation: {selectedAnimation.id} | Frames: {exportLayout.frameCount} | Frame:{' '}
              {exportLayout.frameWidth}x{exportLayout.frameHeight} | Sheet:{' '}
              {exportLayout.sheetWidth}x{exportLayout.sheetHeight}
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
            <p className="status-line">SpriteWrite does not manage a file library yet.</p>
            <p className="status-line">Browser draft autosaves locally. Export Project JSON for durable work.</p>
            <p className="status-line">
              Shortcuts: Ctrl+K commands, {shortcuts.paint.toUpperCase()} paint,{' '}
              {shortcuts.erase.toUpperCase()} erase, Space preview, Ctrl+Z/Y undo/redo, arrows change frames.
            </p>
            {importErrors.length ? (
              <div className="validation-errors">
                {importErrors.map((error) => (
                  <p key={error}>{error}</p>
                ))}
              </div>
            ) : null}
          </section>

          <section className="shortcut-settings">
            <h2>Shortcuts</h2>
            <div className="form-grid">
              <label>
                Paint
                <input
                  maxLength={1}
                  value={shortcuts.paint.toUpperCase()}
                  onChange={(event) => updateShortcut('paint', event.target.value)}
                />
              </label>
              <label>
                Erase
                <input
                  maxLength={1}
                  value={shortcuts.erase.toUpperCase()}
                  onChange={(event) => updateShortcut('erase', event.target.value)}
                />
              </label>
            </div>
            <button type="button" onClick={() => setShortcuts(DEFAULT_SHORTCUTS)}>
              Reset Shortcuts
            </button>
          </section>

          <section>
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

        <section className="editor-stage">
          <div className="stage-header">
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

          <div className="animation-inspector">
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
          </div>

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

        <aside className="panel right-panel">
          <section>
            <h2>Preview</h2>
            <div className="preview-box">
              <MiniSprite project={project} frameId={previewFrameId} />
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
          </section>

          <section>
            <h2>Frames</h2>
            <div className="timeline">
              {frameIds.map((frameId, index) => (
                <button
                  key={frameId}
                  type="button"
                  className={selectedFrameId === frameId ? 'active' : ''}
                  onClick={() => {
                    setSelectedFrameId(frameId)
                    setPreviewIndex(index)
                    setProposedPatch([])
                    setDisabledPatchOperationIndexes(new Set())
                  }}
                >
                  <MiniSprite project={project} frameId={frameId} />
                  <span>{index + 1}</span>
                </button>
              ))}
            </div>
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

          <PatchAssistant
            project={project}
            proposedPreviewProject={proposedPreviewProject}
            frameId={selectedFrameId}
            providerChoice={providerChoice}
            setProviderChoice={setProviderChoice}
            instruction={instruction}
            setInstruction={setInstruction}
            proposedPatch={proposedPatch}
            activeProposedPatch={activeProposedPatch}
            disabledOperationIndexes={disabledPatchOperationIndexes}
            patchErrors={[...patchErrors, ...patchValidation.errors]}
            providerMessage={providerMessage}
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
                setProviderMessage(await testOllamaConnection(ollamaBaseUrl))
              } catch (error) {
                setProviderMessage(error instanceof Error ? error.message : 'Ollama test failed.')
              }
            }}
          />
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
          Build production-friendly sprite assets as explicit grid data, then export clean PNGs,
          spritesheets, metadata, and project JSON.
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
                  {assetType}
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
                  {template.assetType} / {template.width}x{template.height}
                </span>
                <span>{template.description}</span>
              </button>
            ))}
          </div>
          <button type="button" onClick={onOpenDemo}>
            Open Ooze Demo
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
            <p>Find editor actions, exports, frames, layers, and patch commands.</p>
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

function MiniSprite({
  project,
  frameId,
  highlightedOperations = [],
}: {
  project: SpriteProject
  frameId: FrameId
  highlightedOperations?: PixelPatchOperation[]
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
      className="mini-sprite"
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
  proposedPatch,
  activeProposedPatch,
  disabledOperationIndexes,
  patchErrors,
  providerMessage,
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
  proposedPatch: PixelPatchOperation[]
  activeProposedPatch: PixelPatchOperation[]
  disabledOperationIndexes: Set<number>
  patchErrors: string[]
  providerMessage: string
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
      <h2>Patch Assistant</h2>
      <label>
        Provider
        <select
          value={providerChoice}
          onChange={(event) => setProviderChoice(event.target.value as ProviderChoice)}
        >
          <option value="mock">Mock</option>
          <option value="ollama">Ollama experimental</option>
        </select>
      </label>
      <label>
        Instruction
        <textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} />
      </label>

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
            Generate Mock Patch
          </button>
        </div>
      )}

      <div className="patch-json-header">
        <span>Active patch JSON</span>
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
      {disabledCount ? <p className="status-line">{disabledCount} operation(s) excluded from apply.</p> : null}

      <div className="frame-actions">
        <button type="button" onClick={onApply} disabled={!canApply}>
          Apply Patch
        </button>
        <button type="button" onClick={onReject} disabled={!proposedPatch.length}>
          Reject Patch
        </button>
      </div>
    </section>
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
        <span>Proposed patch</span>
        {proposedPreviewProject ? (
          <MiniSprite
            project={proposedPreviewProject}
            frameId={frameId}
            highlightedOperations={highlightedOperations}
          />
        ) : (
          <div className="mini-sprite empty-preview">
            {hasActivePatch ? 'Invalid' : 'No patch'}
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
        <div className="patch-group-list" aria-label="Active patch groups">
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
        <p>No proposed patch.</p>
      )}
      {patch.length > 12 ? <p>{patch.length - 12} more operation(s).</p> : null}
    </div>
  )
}

export default App
