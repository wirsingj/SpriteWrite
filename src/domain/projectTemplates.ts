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
