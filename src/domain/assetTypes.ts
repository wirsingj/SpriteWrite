import type { SpriteAssetType } from './spriteTypes'

export const ASSET_TYPE_OPTIONS: SpriteAssetType[] = [
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

export function formatAssetType(assetType: SpriteAssetType | undefined): string {
  return assetType ? ASSET_TYPE_LABELS[assetType] : ASSET_TYPE_LABELS.custom
}
