import { describe, expect, it } from 'vitest'
import { createSpriteSheetExportMetadata } from './exportPlanning'
import { getProjectTemplate, SPRITE_PROJECT_TEMPLATES } from './projectTemplates'
import { validateProject } from './spriteData'

describe('project templates', () => {
  it('creates valid projects from every template', () => {
    SPRITE_PROJECT_TEMPLATES.forEach((template) => {
      const project = template.createProject({ name: template.name })
      expect(validateProject(project).valid).toBe(true)
    })
  })

  it('creates a valid blank 32x32 project', () => {
    const project = getProjectTemplate('blank-32').createProject({ name: 'Icon Draft' })

    expect(project.name).toBe('Icon Draft')
    expect(project.canvas).toEqual({ width: 32, height: 32 })
    expect(project.frames[0].layers[0].cells).toEqual({})
    expect(validateProject(project).valid).toBe(true)
  })

  it('creates a valid blank 64x64 project', () => {
    const project = getProjectTemplate('blank-64').createProject({ name: 'Enemy Draft' })

    expect(project.canvas).toEqual({ width: 64, height: 64 })
    expect(project.frames[0].layers[0].cells).toEqual({})
    expect(validateProject(project).valid).toBe(true)
  })

  it('uses a generic non-ooze palette for blank templates', () => {
    const project = getProjectTemplate('blank-32').createProject({ name: 'Generic Draft' })
    const paletteIds = project.palette.map((color) => color.id)
    const paletteNames = project.palette.map((color) => color.name).join(' ')

    expect(paletteIds).toContain('ink')
    expect(paletteIds).toContain('accent')
    expect(paletteIds).not.toContain('slime_mid')
    expect(paletteNames).not.toMatch(/slime/i)
  })

  it('creates icon and button templates with non-ooze identities', () => {
    const icon = getProjectTemplate('icon-32').createProject({ name: 'Save Icon' })
    const button = getProjectTemplate('button-64x24').createProject({ name: 'Start Button' })

    expect(icon.assetType).toBe('icon')
    expect(icon.canvas).toEqual({ width: 32, height: 32 })
    expect(button.assetType).toBe('button')
    expect(button.canvas).toEqual({ width: 64, height: 24 })
    expect(icon.palette.map((color) => color.id)).not.toContain('slime_mid')
    expect(button.palette.map((color) => color.id)).not.toContain('slime_mid')
  })

  it('creates an ooze demo with animation and frame data', () => {
    const project = getProjectTemplate('ooze-32-demo').createProject({ name: 'Ooze Friend' })

    expect(project.assetType).toBe('ooze')
    expect(project.animations[0].frameIds).toHaveLength(2)
    expect(Object.keys(project.frames[0].layers[0].cells).length).toBeGreaterThan(0)
    expect(project.palette.map((color) => color.id)).toContain('slime_mid')
    expect(validateProject(project).valid).toBe(true)
  })

  it('includes project identity in export metadata', () => {
    const project = getProjectTemplate('blank-32').createProject({
      name: 'Button Draft',
      assetType: 'button',
    })
    project.description = 'A test button asset.'

    const metadata = createSpriteSheetExportMetadata(project, 'idle')

    expect(metadata.projectName).toBe('Button Draft')
    expect(metadata.projectDescription).toBe('A test button asset.')
    expect(metadata.assetType).toBe('button')
  })
})
