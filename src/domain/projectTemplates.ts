import { createBlankProject, createOozeDemoProject } from './spriteData'
import type { SpriteAssetType, SpriteProject } from './spriteTypes'

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
    assetType: 'generic',
    width: 32,
    height: 32,
    createProject(input) {
      return createBlankProject({
        name: input.name,
        width: input.width ?? 32,
        height: input.height ?? 32,
        assetType: input.assetType ?? 'generic',
      })
    },
  },
  {
    id: 'blank-64',
    name: 'Blank 64x64',
    description: 'A larger blank sprite grid for characters, enemies, and chunky effects.',
    assetType: 'generic',
    width: 64,
    height: 64,
    createProject(input) {
      return createBlankProject({
        name: input.name,
        width: input.width ?? 64,
        height: input.height ?? 64,
        assetType: input.assetType ?? 'generic',
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
    assetType: 'button',
    width: 64,
    height: 24,
    createProject(input) {
      return createBlankProject({
        name: input.name,
        width: input.width ?? 64,
        height: input.height ?? 24,
        assetType: input.assetType ?? 'button',
      })
    },
  },
  {
    id: 'ooze-32-demo',
    name: 'Ooze 32x32 Demo',
    description: 'The starter ooze with two idle frames, useful as a working reference asset.',
    assetType: 'ooze',
    width: 32,
    height: 32,
    createProject(input) {
      const project = createOozeDemoProject(input.name || 'Ooze Sprite Starter')
      return {
        ...project,
        assetType: input.assetType ?? 'ooze',
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
