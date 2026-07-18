import type { SpriteAssetType } from '../domain/spriteTypes'
import { SPRITE_PROJECT_TEMPLATES } from '../domain/projectTemplates'
import { ASSET_TYPE_OPTIONS, formatAssetType } from '../domain/assetTypes'

export function StartScreen({
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
