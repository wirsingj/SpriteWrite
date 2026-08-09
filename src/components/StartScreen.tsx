import type { SpriteAssetType, SpriteProject } from '../domain/spriteTypes'
import { SPRITE_PROJECT_TEMPLATES } from '../domain/projectTemplates'
import { ASSET_TYPE_OPTIONS, formatAssetType } from '../domain/assetTypes'
import { MiniSprite } from './MiniSprite'

const QUICK_TEMPLATE_CHOICES = [
  { id: 'background-band-64x32', label: 'Background' },
  { id: 'coin-32', label: 'Coin' },
  { id: 'hero-32-demo', label: 'Hero' },
  { id: 'tile-grass-32', label: 'Grass' },
  { id: 'button-64x24', label: 'Button' },
  { id: 'mountain-64x32', label: 'Mountain' },
]

export function StartScreen({
  importErrors,
  heroDemoProject,
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
  heroDemoProject: SpriteProject
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
  const heroDemoAnimation = heroDemoProject.animations[0]
  const heroDemoFrameId = heroDemoAnimation?.frameIds?.[0]
  const quickTemplates = QUICK_TEMPLATE_CHOICES.map((choice) => ({
    ...choice,
    template: templates.find((template) => template.id === choice.id),
  })).filter((choice): choice is typeof choice & { template: (typeof templates)[number] } => Boolean(choice.template))

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
          <div className="template-list quick-template-list">
            {quickTemplates.map(({ label, template }) => (
              <button
                key={template.id}
                type="button"
                className={newProjectTemplateId === template.id ? 'template-card active' : 'template-card'}
                onClick={() => onSetTemplate(template.id)}
              >
                <strong>{label}</strong>
              </button>
            ))}
          </div>
        </section>

        <section className="panel start-panel">
          <h2>Hero Demo Preview</h2>
          <p className="status-line">A compact first-party sprite sheet demo: 4x32x32 rows.</p>
          {heroDemoFrameId ? (
            <div className="start-demo-preview">
              <MiniSprite
                project={heroDemoProject}
                frameId={heroDemoFrameId}
              />
            </div>
          ) : null}
          <p className="status-line">Open the full sheet to inspect editable animation rows.</p>
          <div className="button-stack">
            <button type="button" onClick={onOpenDemo}>
              Open Hero Demo
            </button>
          </div>
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
