import { createBlankProject, createHeroDemoProject, createOozeDemoProject } from './spriteData'
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
