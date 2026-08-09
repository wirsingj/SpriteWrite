export type ColorId = string
export type AnimationId = string
export type FrameId = string
export type LayerId = string
export type SpriteAssetType =
  | 'character'
  | 'creature'
  | 'tile'
  | 'environment'
  | 'prop'
  | 'object'
  | 'background'
  | 'effect'
  | 'ui'
  | 'icon'
  | 'custom'
  // Legacy import aliases from early SpriteWrite prototypes. Keep valid for old Project JSON.
  | 'enemy'
  | 'ooze'
  | 'button'
  | 'parallax'
  | 'generic'

export interface PaletteColor {
  id: ColorId
  name: string
  hex: string
  isTransparent?: boolean
}

export interface PixelCell {
  x: number
  y: number
  colorId: ColorId
}

export type LayerCellMap = Record<string, ColorId>
export type LayerBlendMode = 'normal' | 'multiply' | 'screen'

export interface SpriteLayer {
  id: LayerId
  name: string
  group?: string
  visible: boolean
  exportable: boolean
  editable: boolean
  opacity: number
  blendMode: LayerBlendMode
  cells: LayerCellMap
}

export interface AnchorPoint {
  x: number
  y: number
}

export interface Hitbox {
  x: number
  y: number
  width: number
  height: number
}

export interface SpriteFrame {
  id: FrameId
  name: string
  durationMs: number
  notes?: string
  tags?: string[]
  layers: SpriteLayer[]
  anchor: AnchorPoint
  hitbox?: Hitbox
}

export interface SpriteAnimation {
  id: AnimationId
  name: string
  fps: number
  frameIds: FrameId[]
}

export type SpriteSheetOrientation = 'horizontal'

export interface SpriteSheetExportOptions {
  animationId: AnimationId
  orientation?: SpriteSheetOrientation
  scale?: number
  margin?: number
  spacing?: number
  background?: 'transparent'
  includeMetadata?: boolean
}

export interface FullSpriteSheetExportOptions {
  scale?: number
  margin?: number
  spacing?: number
  background?: 'transparent'
  includeMetadata?: boolean
  imageFilename?: string
}

export interface ExportedFrameRegion {
  frameId: FrameId
  frameName: string
  index: number
  x: number
  y: number
  width: number
  height: number
  durationMs: number
  notes?: string
  tags?: string[]
  anchor: AnchorPoint
  hitbox?: Hitbox
}

export interface FullSpriteSheetFrameRegion extends ExportedFrameRegion {
  animationId: AnimationId
  animationName: string
  rowIndex: number
  columnIndex: number
}

export interface FullSpriteSheetAnimationMetadata {
  animationId: AnimationId
  animationName: string
  rowIndex: number
  frameCount: number
  fps: number
  loop: boolean
  frames: FullSpriteSheetFrameRegion[]
}

export interface ExportedLayerMetadata {
  id: LayerId
  name: string
  group?: string
  index: number
  visible: boolean
  exportable: boolean
  includedInExport: boolean
  opacity: number
  blendMode: LayerBlendMode
}

export interface SpriteSheetLayout {
  animationId: AnimationId
  animationName: string
  orientation: SpriteSheetOrientation
  scale: number
  margin: number
  spacing: number
  background: 'transparent'
  sourceFrameWidth: number
  sourceFrameHeight: number
  frameWidth: number
  frameHeight: number
  frameCount: number
  sheetWidth: number
  sheetHeight: number
  fps: number
  anchor: AnchorPoint
  hitbox?: Hitbox
  layers: ExportedLayerMetadata[]
  frames: ExportedFrameRegion[]
  grid: SpriteSheetGridMetadata
  importHints: SpriteSheetImportHints
  importProfile: SpriteSheetGenericImportProfile
}

export interface FullSpriteSheetLayout {
  imageFilename: string
  orientation: 'rows'
  scale: number
  margin: number
  spacing: number
  background: 'transparent'
  sourceFrameWidth: number
  sourceFrameHeight: number
  frameWidth: number
  frameHeight: number
  sheetWidth: number
  sheetHeight: number
  rowCount: number
  columnCount: number
  animations: FullSpriteSheetAnimationMetadata[]
  frames: FullSpriteSheetFrameRegion[]
  grid: SpriteSheetGridMetadata
  importHints: SpriteSheetImportHints
  importProfile: SpriteSheetGenericImportProfile
}

export interface SpriteSheetExportMetadata extends SpriteSheetLayout {
  formatName: 'SpriteWrite'
  formatVersion: number
  projectId: string
  projectName: string
  projectDescription?: string
  assetType?: SpriteAssetType
  generatedAt: string
}

export interface FullSpriteSheetExportMetadata extends FullSpriteSheetLayout {
  formatName: 'SpriteWrite'
  formatVersion: number
  projectId: string
  projectName: string
  projectDescription?: string
  assetType?: SpriteAssetType
  generatedAt: string
}

export interface SpriteSheetGridMetadata {
  columns: number
  rows: number
  originX: number
  originY: number
  cellWidth: number
  cellHeight: number
  margin: number
  spacing: number
}

export interface SpriteSheetImportHints {
  alpha: 'straight'
  transparentBackground: true
  premultipliedAlpha: false
  smoothing: false
  frameRegionUnit: 'pixels'
  frameRegionBasis: 'top-left'
}

export interface SpriteSheetGenericImportProfile {
  kind: 'grid-animation-strip' | 'grid-animation-rows'
  description: string
  slice: {
    originX: number
    originY: number
    cellWidth: number
    cellHeight: number
    spacing: number
    columns: number
    rows: number
  }
  animationClips: SpriteSheetGenericAnimationClip[]
}

export interface SpriteSheetGenericAnimationClip {
  animationId: AnimationId
  animationName: string
  rowIndex: number
  startColumn: number
  frameCount: number
  fps: number
  loop: true
}

export interface FrameExportMetadata {
  formatName: 'SpriteWrite'
  formatVersion: number
  projectId: string
  projectName: string
  projectDescription?: string
  assetType?: SpriteAssetType
  frameId: FrameId
  frameWidth: number
  frameHeight: number
  sourceFrameWidth: number
  sourceFrameHeight: number
  scale: number
  background: 'transparent'
  anchor: AnchorPoint
  hitbox?: Hitbox
  generatedAt: string
}

export type PixelPatchOperation =
  | {
      op: 'set'
      x: number
      y: number
      colorId: ColorId
    }
  | {
      op: 'clear'
      x: number
      y: number
    }

export interface SpriteProject {
  id: string
  name: string
  description?: string
  assetType?: SpriteAssetType
  version: number
  canvas: {
    width: number
    height: number
  }
  palette: PaletteColor[]
  animations: SpriteAnimation[]
  frames: SpriteFrame[]
  metadata: {
    defaultAnimationId: AnimationId
    defaultLayerId: LayerId
    createdAt: string
    updatedAt: string
    notes: string
  }
}

export interface PatchValidationResult {
  valid: boolean
  errors: string[]
}

export type ValidationResult<T> =
  | {
      valid: true
      value: T
      errors: []
    }
  | {
      valid: false
      errors: string[]
    }
