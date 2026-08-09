import { cellKey, createBlankProject, createHeroDemoProject, createOozeDemoProject } from './spriteData'
import type { SpriteAssetType, SpriteFrame, SpriteProject } from './spriteTypes'

export interface CreateProjectInput {
  name: string
  width?: number
  height?: number
  assetType?: SpriteAssetType
}

export interface SpriteProjectTemplate {
  id: string
  name: string
  description: string
  assetType: SpriteAssetType
  width: number
  height: number
  createProject(input: CreateProjectInput): SpriteProject
}

export const SPRITE_PROJECT_TEMPLATES: SpriteProjectTemplate[] = [
  {
    id: 'blank-32',
    name: 'Blank 32x32',
    description: 'A compact blank sprite grid for icons, tiny actors, and experiments.',
    assetType: 'custom',
    width: 32,
    height: 32,
    createProject(input) {
      return createBlankProject({
        name: input.name,
        width: input.width ?? 32,
        height: input.height ?? 32,
        assetType: input.assetType ?? 'custom',
      })
    },
  },
  {
    id: 'blank-64',
    name: 'Blank 64x64',
    description: 'A larger blank sprite grid for characters, enemies, and chunky effects.',
    assetType: 'custom',
    width: 64,
    height: 64,
    createProject(input) {
      return createBlankProject({
        name: input.name,
        width: input.width ?? 64,
        height: input.height ?? 64,
        assetType: input.assetType ?? 'custom',
      })
    },
  },
  {
    id: 'icon-32',
    name: 'Icon 32x32',
    description: 'A blank icon-sized grid with generic colors for tool, item, and UI symbols.',
    assetType: 'icon',
    width: 32,
    height: 32,
    createProject(input) {
      return createBlankProject({
        name: input.name,
        width: input.width ?? 32,
        height: input.height ?? 32,
        assetType: input.assetType ?? 'icon',
      })
    },
  },
  {
    id: 'button-64x24',
    name: 'UI Button 64x24',
    description: 'A blank wide grid for small button states and menu controls.',
    assetType: 'ui',
    width: 64,
    height: 24,
    createProject(input) {
      return createBlankProject({
        name: input.name,
        width: input.width ?? 64,
        height: input.height ?? 24,
        assetType: input.assetType ?? 'ui',
      })
    },
  },
  {
    id: 'coin-32',
    name: 'Coin 32x32',
    description: 'A compact four-frame spinning coin starter for pickups, icons, and rewards.',
    assetType: 'object',
    width: 32,
    height: 32,
    createProject(input) {
      return { ...createCoinProject(input.name || 'Coin Starter'), assetType: input.assetType ?? 'object' }
    },
  },
  {
    id: 'tile-grass-32',
    name: 'Grass Tile Variants 32x32',
    description: 'Four editable terrain tile variants with anchored grass and transparent edges.',
    assetType: 'tile',
    width: 32,
    height: 32,
    createProject(input) {
      return { ...createGrassTileProject(input.name || 'Grass Tile Variants'), assetType: input.assetType ?? 'tile' }
    },
  },
  {
    id: 'terrain-tileset-32',
    name: 'Terrain Tileset 3x3 32x32',
    description: 'Nine editable edge, corner, and interior tiles for platform or terrain autotile starts.',
    assetType: 'tile',
    width: 32,
    height: 32,
    createProject(input) {
      return { ...createTerrainTilesetProject(input.name || 'Terrain Tileset 3x3'), assetType: input.assetType ?? 'tile' }
    },
  },
  {
    id: 'wall-floor-tiles-32',
    name: 'Wall/Floor Tile Strip 32x32',
    description: 'Six editable wall, floor, corner, and stair tiles for dungeon or platform block starts.',
    assetType: 'tile',
    width: 32,
    height: 32,
    createProject(input) {
      return { ...createWallFloorTileProject(input.name || 'Wall Floor Tile Strip'), assetType: input.assetType ?? 'tile' }
    },
  },
  {
    id: 'prop-crate-32',
    name: 'Prop Crate 32x32',
    description: 'A simple readable object starter with outline, face, highlight, and shadow shapes.',
    assetType: 'prop',
    width: 32,
    height: 32,
    createProject(input) {
      return { ...createCratePropProject(input.name || 'Crate Prop Starter'), assetType: input.assetType ?? 'prop' }
    },
  },
  {
    id: 'background-band-64x32',
    name: 'Background Band 64x32',
    description: 'A wide layered background starter for horizon, silhouettes, and parallax experiments.',
    assetType: 'background',
    width: 64,
    height: 32,
    createProject(input) {
      return { ...createBackgroundBandProject(input.name || 'Background Band Starter'), assetType: input.assetType ?? 'background' }
    },
  },
  {
    id: 'mountain-64x32',
    name: 'Mountain 64x32',
    description: 'A calm layered mountain background starter with ridge, snow, and foreground bands.',
    assetType: 'background',
    width: 64,
    height: 32,
    createProject(input) {
      return { ...createMountainProject(input.name || 'Mountain Starter'), assetType: input.assetType ?? 'background' }
    },
  },
  {
    id: 'effect-burst-32',
    name: 'Effect Burst 32x32',
    description: 'A four-frame burst animation starter for impact, sparkle, and magic effects.',
    assetType: 'effect',
    width: 32,
    height: 32,
    createProject(input) {
      return { ...createEffectBurstProject(input.name || 'Effect Burst Starter'), assetType: input.assetType ?? 'effect' }
    },
  },
  {
    id: 'hero-32-demo',
    name: 'Hero 32x32 Sprite Sheet Demo',
    description: 'A multi-row hero sprite sheet with Idle, Jump, Crouch, and Sword Stab animations.',
    assetType: 'character',
    width: 32,
    height: 32,
    createProject(input) {
      const project = createHeroDemoProject(input.name || 'Hero Sprite Demo')
      return {
        ...project,
        assetType: input.assetType ?? 'character',
      }
    },
  },
  {
    id: 'ooze-32-demo',
    name: 'Ooze 32x32 Demo',
    description: 'A tiny two-frame ooze reference, kept mostly as a minimal comparison asset.',
    assetType: 'creature',
    width: 32,
    height: 32,
    createProject(input) {
      const project = createOozeDemoProject(input.name || 'Ooze Sprite Starter')
      return {
        ...project,
        assetType: input.assetType ?? 'creature',
      }
    },
  },
]

export function getProjectTemplate(templateId: string): SpriteProjectTemplate {
  const template = SPRITE_PROJECT_TEMPLATES.find((item) => item.id === templateId)
  if (!template) {
    throw new Error(`Missing project template "${templateId}".`)
  }
  return template
}

function createGrassTileProject(name: string): SpriteProject {
  const project = createBlankProject({
    name,
    width: 32,
    height: 32,
    assetType: 'tile',
    description: 'Editable grass tile variants for terrain, ground, or platform starts.',
  })

  const frames = [0, 1, 2, 3].map((variant) =>
    makeTemplateFrame({
      id: `grass-variant-${variant + 1}`,
      name: `Grass Variant ${variant + 1}`,
      durationMs: 250,
      width: 32,
      height: 32,
      tags: ['tile', 'grass', 'variant'],
      notes: 'Keep bottom anchoring stable so neighboring tiles line up.',
      cells: makeGrassTileCells(variant),
    }),
  )

  return {
    ...project,
    animations: [{ id: 'variants', name: 'Variants', fps: 4, frameIds: frames.map((frame) => frame.id) }],
    frames,
    metadata: {
      ...project.metadata,
      defaultAnimationId: 'variants',
      notes: 'Starter recipe: editable grass tile variants. Use frames as alternatives, not necessarily playback animation.',
    },
  }
}

type TerrainEdge = 'north' | 'east' | 'south' | 'west'

const TERRAIN_TILE_SPECS: Array<{
  id: string
  name: string
  outside: TerrainEdge[]
}> = [
  { id: 'terrain-north-west', name: 'North West Corner', outside: ['north', 'west'] },
  { id: 'terrain-north', name: 'North Edge', outside: ['north'] },
  { id: 'terrain-north-east', name: 'North East Corner', outside: ['north', 'east'] },
  { id: 'terrain-west', name: 'West Edge', outside: ['west'] },
  { id: 'terrain-interior', name: 'Interior', outside: [] },
  { id: 'terrain-east', name: 'East Edge', outside: ['east'] },
  { id: 'terrain-south-west', name: 'South West Corner', outside: ['south', 'west'] },
  { id: 'terrain-south', name: 'South Edge', outside: ['south'] },
  { id: 'terrain-south-east', name: 'South East Corner', outside: ['south', 'east'] },
]

function createTerrainTilesetProject(name: string): SpriteProject {
  const project = createBlankProject({
    name,
    width: 32,
    height: 32,
    assetType: 'tile',
    description: 'Editable 3x3 terrain tile set with edge, corner, and interior pieces.',
  })

  const frames = TERRAIN_TILE_SPECS.map((spec, index) =>
    makeTemplateFrame({
      id: spec.id,
      name: spec.name,
      durationMs: 250,
      width: 32,
      height: 32,
      tags: ['tile', 'terrain', spec.outside.length ? 'edge' : 'interior'],
      notes: `Tileset slot ${index + 1}: ${spec.name}. Keep matching borders aligned across neighboring tiles.`,
      cells: makeTerrainTilesetCells(spec.outside),
    }),
  )

  return {
    ...project,
    animations: [{ id: 'tileset', name: 'Tileset', fps: 1, frameIds: frames.map((frame) => frame.id) }],
    frames,
    metadata: {
      ...project.metadata,
      defaultAnimationId: 'tileset',
      notes: 'Starter recipe: nine edge/corner/interior terrain tiles arranged for strip or full-sheet export.',
    },
  }
}

type WallFloorTileKind = 'floor' | 'floor-edge' | 'wall-face' | 'wall-top' | 'wall-corner' | 'stair-step'

const WALL_FLOOR_TILE_SPECS: Array<{
  id: string
  name: string
  kind: WallFloorTileKind
}> = [
  { id: 'floor-interior', name: 'Floor Interior', kind: 'floor' },
  { id: 'floor-edge', name: 'Floor Edge', kind: 'floor-edge' },
  { id: 'wall-face', name: 'Wall Face', kind: 'wall-face' },
  { id: 'wall-top', name: 'Wall Top', kind: 'wall-top' },
  { id: 'wall-corner', name: 'Wall Corner', kind: 'wall-corner' },
  { id: 'stair-step', name: 'Stair Step', kind: 'stair-step' },
]

function createWallFloorTileProject(name: string): SpriteProject {
  const project = createBlankProject({
    name,
    width: 32,
    height: 32,
    assetType: 'tile',
    description: 'Editable wall and floor tile strip for dungeon, platform, or blockout starts.',
  })

  const frames = WALL_FLOOR_TILE_SPECS.map((spec) =>
    makeTemplateFrame({
      id: spec.id,
      name: spec.name,
      durationMs: 250,
      width: 32,
      height: 32,
      tags: Array.from(new Set(['tile', 'wall', 'floor', spec.kind])),
      notes: `${spec.name}: keep outer 32x32 boundaries aligned before adding style-specific texture.`,
      cells: makeWallFloorTileCells(spec.kind),
    }),
  )

  return {
    ...project,
    animations: [{ id: 'tiles', name: 'Tiles', fps: 1, frameIds: frames.map((frame) => frame.id) }],
    frames,
    metadata: {
      ...project.metadata,
      defaultAnimationId: 'tiles',
      notes: 'Starter recipe: wall/floor/corner/stair tile alternatives for strip or full-sheet export.',
    },
  }
}

function createCoinProject(name: string): SpriteProject {
  const project = createBlankProject({
    name,
    width: 32,
    height: 32,
    assetType: 'object',
    description: 'Editable four-frame spinning coin starter.',
  })
  const frames = [0, 1, 2, 3].map((step) =>
    makeTemplateFrame({
      id: `coin-spin-${step + 1}`,
      name: `Coin Spin ${step + 1}`,
      durationMs: 110,
      width: 32,
      height: 32,
      tags: ['object', 'coin', 'pickup'],
      notes: 'Keep the center and shadow stable so the coin reads as a loop.',
      cells: makeCoinCells(step),
    }),
  )

  return {
    ...project,
    palette: project.palette.map((color) => {
      if (color.id === 'accent') {
        return { ...color, name: 'Gold', hex: '#f2c14e' }
      }
      if (color.id === 'mid_gray') {
        return { ...color, name: 'Coin Mid', hex: '#d8892d' }
      }
      if (color.id === 'light_gray') {
        return { ...color, name: 'Coin Light', hex: '#ffe082' }
      }
      if (color.id === 'shadow') {
        return { ...color, name: 'Coin Shadow', hex: '#5f3719' }
      }
      return color
    }),
    animations: [{ id: 'spin', name: 'Spin', fps: 10, frameIds: frames.map((frame) => frame.id) }],
    frames,
    metadata: {
      ...project.metadata,
      defaultAnimationId: 'spin',
      notes: 'Starter recipe: four-frame spinning coin with editable palette and cells.',
    },
  }
}

function createCratePropProject(name: string): SpriteProject {
  const project = createBlankProject({
    name,
    width: 32,
    height: 32,
    assetType: 'prop',
    description: 'Editable prop/object starter with readable volume and shadow.',
  })
  const frame = makeTemplateFrame({
    id: 'crate-001',
    name: 'Crate 001',
    durationMs: 250,
    width: 32,
    height: 32,
    tags: ['prop', 'object'],
    notes: 'Use as a neutral prop scaffold; repaint palette IDs for wood, metal, stone, or sci-fi panels.',
    cells: makeCrateCells(),
  })

  return {
    ...project,
    animations: [{ id: 'static', name: 'Static', fps: 1, frameIds: [frame.id] }],
    frames: [frame],
    metadata: {
      ...project.metadata,
      defaultAnimationId: 'static',
      notes: 'Starter recipe: one-frame prop/object with outline, highlight, and shadow.',
    },
  }
}

function createBackgroundBandProject(name: string): SpriteProject {
  const project = createBlankProject({
    name,
    width: 64,
    height: 32,
    assetType: 'background',
    description: 'Editable wide background band for parallax, silhouettes, and horizon studies.',
  })
  const frame = makeTemplateFrame({
    id: 'background-001',
    name: 'Background 001',
    durationMs: 250,
    width: 64,
    height: 32,
    tags: ['background', 'parallax'],
    notes: 'Keep major silhouettes separated into obvious bands before adding detail.',
    cells: makeBackgroundBandCells(),
  })

  return {
    ...project,
    animations: [{ id: 'static', name: 'Static', fps: 1, frameIds: [frame.id] }],
    frames: [frame],
    metadata: {
      ...project.metadata,
      defaultAnimationId: 'static',
      notes: 'Starter recipe: wide background band with editable horizon and silhouette layers.',
    },
  }
}

function createMountainProject(name: string): SpriteProject {
  const project = createBlankProject({
    name,
    width: 64,
    height: 32,
    assetType: 'background',
    description: 'Editable layered mountain background starter.',
  })
  const frame = makeTemplateFrame({
    id: 'mountain-001',
    name: 'Mountain 001',
    durationMs: 250,
    width: 64,
    height: 32,
    tags: ['background', 'mountain', 'parallax'],
    notes: 'Use the rear ridge, front ridge, snow caps, and foreground band as separate starting shapes.',
    cells: makeMountainCells(),
  })

  return {
    ...project,
    palette: project.palette.map((color) => {
      if (color.id === 'accent') {
        return { ...color, name: 'Pine', hex: '#4d8061' }
      }
      if (color.id === 'mid_gray') {
        return { ...color, name: 'Ridge', hex: '#586779' }
      }
      if (color.id === 'light_gray') {
        return { ...color, name: 'Snow', hex: '#dce8f0' }
      }
      if (color.id === 'shadow') {
        return { ...color, name: 'Deep Ridge', hex: '#1f2937' }
      }
      return color
    }),
    animations: [{ id: 'static', name: 'Static', fps: 1, frameIds: [frame.id] }],
    frames: [frame],
    metadata: {
      ...project.metadata,
      defaultAnimationId: 'static',
      notes: 'Starter recipe: one-frame mountain background with calm editable bands.',
    },
  }
}

function createEffectBurstProject(name: string): SpriteProject {
  const project = createBlankProject({
    name,
    width: 32,
    height: 32,
    assetType: 'effect',
    description: 'Editable four-frame burst animation for impact, sparkle, and magic effects.',
  })
  const frames = [0, 1, 2, 3].map((step) =>
    makeTemplateFrame({
      id: `burst-${step + 1}`,
      name: `Burst ${step + 1}`,
      durationMs: 90,
      width: 32,
      height: 32,
      tags: ['effect', 'burst'],
      notes: 'Expand outward, then leave transparent space so the effect can dissipate cleanly.',
      cells: makeBurstCells(step),
    }),
  )

  return {
    ...project,
    animations: [{ id: 'burst', name: 'Burst', fps: 12, frameIds: frames.map((frame) => frame.id) }],
    frames,
    metadata: {
      ...project.metadata,
      defaultAnimationId: 'burst',
      notes: 'Starter recipe: four-frame effect burst with transparent dissipation.',
    },
  }
}

function makeTemplateFrame({
  id,
  name,
  durationMs,
  width,
  height,
  tags,
  notes,
  cells,
}: {
  id: string
  name: string
  durationMs: number
  width: number
  height: number
  tags: string[]
  notes: string
  cells: Record<string, string>
}): SpriteFrame {
  return {
    id,
    name,
    durationMs,
    notes,
    tags,
    anchor: { x: Math.floor(width / 2), y: height - 1 },
    layers: [
      {
        id: 'base',
        name: 'Base',
        visible: true,
        exportable: true,
        editable: true,
        opacity: 1,
        blendMode: 'normal',
        cells,
      },
    ],
  }
}

function makeCoinCells(step: number): Record<string, string> {
  const cells: Record<string, string> = {}
  const centerX = 16
  const centerY = 15
  const radiusX = [8, 5, 2, 5][step] ?? 8
  const radiusY = 9

  rect(cells, 10, 25, 13, 2, 'shadow')

  for (let y = centerY - radiusY; y <= centerY + radiusY; y += 1) {
    for (let x = centerX - radiusX; x <= centerX + radiusX; x += 1) {
      const dx = radiusX <= 2 ? Math.abs(x - centerX) / 2 : (x - centerX) / radiusX
      const dy = (y - centerY) / radiusY
      const distance = dx * dx + dy * dy
      if (distance > 1) {
        continue
      }

      if (distance > 0.78 || x === centerX - radiusX || x === centerX + radiusX) {
        set(cells, x, y, 'shadow')
      } else if (x <= centerX - Math.max(1, Math.floor(radiusX / 3)) && y < centerY + 3) {
        set(cells, x, y, 'light_gray')
      } else if (y >= centerY + 5 || x >= centerX + Math.max(1, Math.floor(radiusX / 2))) {
        set(cells, x, y, 'mid_gray')
      } else {
        set(cells, x, y, 'accent')
      }
    }
  }

  if (radiusX >= 5) {
    rect(cells, centerX - 1, centerY - 5, 2, 10, 'mid_gray')
    rect(cells, centerX - 3, centerY - 1, 6, 2, 'light_gray')
  } else {
    rect(cells, centerX, centerY - 7, 1, 14, 'light_gray')
  }

  return cells
}

function makeGrassTileCells(variant: number): Record<string, string> {
  const cells: Record<string, string> = {}
  rect(cells, 0, 24, 32, 8, 'shadow')
  rect(cells, 0, 22, 32, 3, 'accent')
  rect(cells, 0, 25, 32, 1, 'charcoal')

  for (let x = 1 + variant; x < 32; x += 4) {
    const bladeHeight = 2 + ((x + variant) % 4)
    rect(cells, x, 22 - bladeHeight, 1, bladeHeight, 'accent')
    if ((x + variant) % 3 === 0 && x + 1 < 32) {
      set(cells, x + 1, 21 - bladeHeight, 'light_gray')
    }
  }

  return cells
}

function makeMountainCells(): Record<string, string> {
  const cells: Record<string, string> = {}
  rect(cells, 0, 26, 64, 6, 'shadow')
  rect(cells, 0, 24, 64, 2, 'accent')

  drawMountainRidge(cells, 15, 13, 27, 0.95, 'charcoal', 'mid_gray')
  drawMountainRidge(cells, 36, 7, 27, 0.72, 'shadow', 'mid_gray')
  drawMountainRidge(cells, 51, 15, 27, 0.9, 'charcoal', 'mid_gray')

  rect(cells, 0, 27, 64, 1, 'accent')
  for (let x = 4; x < 62; x += 9) {
    rect(cells, x, 22, 2, 5, 'charcoal')
    rect(cells, x - 1, 24, 4, 2, 'accent')
  }

  return cells
}

function drawMountainRidge(
  cells: Record<string, string>,
  peakX: number,
  peakY: number,
  baseY: number,
  slope: number,
  outlineColor: string,
  fillColor: string,
) {
  for (let x = 0; x < 64; x += 1) {
    const ridgeY = Math.min(baseY, Math.round(peakY + Math.abs(x - peakX) * slope))
    if (ridgeY >= baseY) {
      continue
    }

    for (let y = ridgeY; y <= baseY; y += 1) {
      if (y === ridgeY || y === baseY) {
        set(cells, x, y, outlineColor)
      } else if (Math.abs(x - peakX) < 7 && y - ridgeY < 4) {
        set(cells, x, y, 'light_gray')
      } else if (x > peakX && y - ridgeY < 7) {
        set(cells, x, y, 'shadow')
      } else {
        set(cells, x, y, fillColor)
      }
    }
  }
}

function makeTerrainTilesetCells(outsideEdges: TerrainEdge[]): Record<string, string> {
  const cells: Record<string, string> = {}
  const outside = new Set(outsideEdges)

  for (let y = 0; y < 32; y += 1) {
    for (let x = 0; x < 32; x += 1) {
      if (!isTerrainCell(x, y, outside)) {
        continue
      }

      const border = [
        [x, y - 1],
        [x + 1, y],
        [x, y + 1],
        [x - 1, y],
      ].some(([neighborX, neighborY]) => !isTerrainCell(neighborX, neighborY, outside))

      if (border) {
        set(cells, x, y, outside.has('south') && y > 24 ? 'shadow' : 'charcoal')
      } else if ((x + y) % 11 === 0 && y < 22) {
        set(cells, x, y, 'light_gray')
      } else if (y > 23 || (x * 3 + y) % 17 === 0) {
        set(cells, x, y, 'mid_gray')
      } else {
        set(cells, x, y, 'accent')
      }
    }
  }

  return cells
}

function isTerrainCell(x: number, y: number, outside: Set<TerrainEdge>): boolean {
  if (x < 0 || y < 0 || x >= 32 || y >= 32) {
    return false
  }

  const margin = 7
  if (outside.has('north') && y < margin) {
    return false
  }
  if (outside.has('south') && y >= 32 - margin) {
    return false
  }
  if (outside.has('west') && x < margin) {
    return false
  }
  if (outside.has('east') && x >= 32 - margin) {
    return false
  }

  if (outside.has('north') && outside.has('west') && x + y < margin * 2 + 2) {
    return false
  }
  if (outside.has('north') && outside.has('east') && 31 - x + y < margin * 2 + 2) {
    return false
  }
  if (outside.has('south') && outside.has('west') && x + (31 - y) < margin * 2 + 2) {
    return false
  }
  if (outside.has('south') && outside.has('east') && 31 - x + (31 - y) < margin * 2 + 2) {
    return false
  }

  return true
}

function makeWallFloorTileCells(kind: WallFloorTileKind): Record<string, string> {
  const cells: Record<string, string> = {}

  if (kind === 'floor' || kind === 'floor-edge') {
    rect(cells, 0, kind === 'floor' ? 0 : 10, 32, kind === 'floor' ? 32 : 22, 'mid_gray')
    rect(cells, 0, kind === 'floor' ? 0 : 10, 32, 2, 'light_gray')
    rect(cells, 0, 30, 32, 2, 'shadow')
    for (let y = kind === 'floor' ? 3 : 13; y < 30; y += 5) {
      for (let x = (y / 5) % 2 === 0 ? 1 : 5; x <= 28; x += 8) {
        rect(cells, x, y, 4, 1, 'charcoal')
      }
    }
    if (kind === 'floor-edge') {
      rect(cells, 0, 10, 32, 1, 'charcoal')
      rect(cells, 0, 11, 32, 2, 'accent')
    }
    return cells
  }

  rect(cells, 0, 0, 32, 32, kind === 'wall-top' ? 'accent' : 'mid_gray')
  rect(cells, 0, 0, 32, 2, 'light_gray')
  rect(cells, 0, 30, 32, 2, 'shadow')

  for (let y = 5; y < 30; y += 6) {
    rect(cells, 0, y, 32, 1, 'charcoal')
    for (let x = y % 12 === 5 ? 7 : 3; x < 32; x += 10) {
      rect(cells, x, y - 4, 1, 4, 'charcoal')
    }
  }

  if (kind === 'wall-top') {
    rect(cells, 0, 12, 32, 2, 'charcoal')
    rect(cells, 0, 14, 32, 18, 'mid_gray')
    rect(cells, 2, 4, 28, 3, 'light_gray')
  }

  if (kind === 'wall-corner') {
    rect(cells, 0, 0, 2, 32, 'light_gray')
    rect(cells, 30, 0, 2, 32, 'shadow')
    rect(cells, 0, 12, 32, 2, 'charcoal')
    rect(cells, 14, 14, 2, 16, 'charcoal')
  }

  if (kind === 'stair-step') {
    Object.keys(cells).forEach((key) => {
      delete cells[key]
    })
    ;[
      [0, 24, 32, 8],
      [6, 18, 26, 6],
      [12, 12, 20, 6],
      [18, 6, 14, 6],
    ].forEach(([x, y, width, height]) => {
      rect(cells, x, y, width, height, 'mid_gray')
      rect(cells, x, y, width, 1, 'light_gray')
      rect(cells, x, y + height - 1, width, 1, 'shadow')
      rect(cells, x, y, 1, height, 'charcoal')
    })
  }

  return cells
}

function makeCrateCells(): Record<string, string> {
  const cells: Record<string, string> = {}
  rect(cells, 8, 9, 17, 16, 'charcoal')
  rect(cells, 9, 10, 15, 14, 'mid_gray')
  rect(cells, 10, 11, 13, 2, 'light_gray')
  rect(cells, 10, 22, 13, 1, 'shadow')
  rect(cells, 10, 14, 13, 1, 'charcoal')
  rect(cells, 10, 19, 13, 1, 'charcoal')
  for (let offset = 0; offset < 11; offset += 1) {
    set(cells, 10 + offset, 13 + offset, 'charcoal')
    set(cells, 22 - offset, 13 + offset, 'charcoal')
  }
  rect(cells, 6, 25, 21, 2, 'shadow')
  return cells
}

function makeBackgroundBandCells(): Record<string, string> {
  const cells: Record<string, string> = {}
  rect(cells, 0, 24, 64, 8, 'shadow')
  rect(cells, 0, 22, 64, 2, 'charcoal')
  rect(cells, 0, 18, 64, 1, 'mid_gray')
  rect(cells, 4, 15, 10, 3, 'mid_gray')
  rect(cells, 18, 13, 12, 5, 'mid_gray')
  rect(cells, 36, 14, 16, 4, 'mid_gray')
  rect(cells, 52, 16, 8, 2, 'mid_gray')
  rect(cells, 7, 8, 4, 1, 'white')
  rect(cells, 48, 6, 5, 1, 'white')
  rect(cells, 0, 26, 64, 1, 'accent')
  return cells
}

function makeBurstCells(step: number): Record<string, string> {
  const cells: Record<string, string> = {}
  const center = 16
  const radius = 2 + step * 3
  rect(cells, center - 1, center - 1, 3, 3, step < 2 ? 'white' : 'light_gray')

  const rays = [
    [0, -1],
    [1, -1],
    [1, 0],
    [1, 1],
    [0, 1],
    [-1, 1],
    [-1, 0],
    [-1, -1],
  ]

  rays.forEach(([dx, dy], index) => {
    const length = Math.max(1, radius - (index % 2))
    for (let distance = 3; distance <= length + 3; distance += 1) {
      const colorId = distance % 2 === 0 ? 'accent' : 'white'
      const x = center + dx * distance
      const y = center + dy * distance
      if (x >= 0 && y >= 0 && x < 32 && y < 32) {
        set(cells, x, y, colorId)
      }
    }
  })

  if (step === 3) {
    Object.keys(cells).forEach((key) => {
      if (key !== cellKey(center, center)) {
        cells[key] = cells[key] === 'white' ? 'light_gray' : 'accent'
      }
    })
  }

  return cells
}

function rect(cells: Record<string, string>, x: number, y: number, width: number, height: number, colorId: string) {
  for (let row = 0; row < height; row += 1) {
    for (let column = 0; column < width; column += 1) {
      set(cells, x + column, y + row, colorId)
    }
  }
}

function set(cells: Record<string, string>, x: number, y: number, colorId: string) {
  cells[cellKey(x, y)] = colorId
}
