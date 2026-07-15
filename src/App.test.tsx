// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { createBlankProject } from './domain/spriteData'

describe('App shell', () => {
  const originalCreateElement = document.createElement.bind(document)
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    window.localStorage.clear()
    container = document.createElement('div')
    document.body.appendChild(container)
    root = createRoot(container)
  })

  afterEach(() => {
    act(() => {
      root.unmount()
    })
    vi.restoreAllMocks()
    container.remove()
  })

  it('renders the start screen with project templates', () => {
    act(() => {
      root.render(<App />)
    })

    expect(container.textContent).toContain('SpriteWrite')
    expect(container.textContent).toContain('Blank 64x64')
    expect(container.textContent).toContain('Ooze 32x32 Demo')
  })

  it('creates a blank 64x64 project and enters the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Blank 64x64')
    clickButton('New Project')

    expect(container.textContent).toContain('64x64 cells')
    expect(container.textContent).toContain('Export scale')
  })

  it('returns home and reopens the current editable project', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    expect(container.textContent).toContain('Patch Assistant')

    clickButton('Home')

    expect(container.textContent).toContain('Browser Draft')
    expect(container.textContent).toContain('This is a convenience, not a project library.')
    expect(container.textContent).toContain('Project JSON is the editable source artifact.')

    clickButton('Open Current Project')

    expect(container.textContent).toContain('Patch Assistant')
    expect(container.textContent).toContain('Project JSON export is current.')
  })

  it('warns before page unload when editable work is unsaved', () => {
    act(() => {
      root.render(<App />)
    })

    const cleanUnload = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(cleanUnload)).toBe(true)

    clickButton('New Project')

    const dirtyUnload = new Event('beforeunload', { cancelable: true })
    expect(window.dispatchEvent(dirtyUnload)).toBe(false)
  })

  it('does not replace a dirty project when the user cancels the warning', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')
    clickButton('Home')
    clickButton('Blank 64x64')

    vi.spyOn(window, 'confirm').mockReturnValue(false)
    clickButton('New Project')

    expect(container.textContent).toContain('New From Template')
    clickButton('Open Current Project')
    expect(container.textContent).toContain('32x32 cells')
    expect(getPixelCellByTitle('0,0 ink')).toBeTruthy()
  })

  it('restores the last valid browser draft on a fresh app load', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Blank 64x64')
    clickButton('New Project')

    act(() => {
      root.unmount()
    })
    root = createRoot(container)
    act(() => {
      root.render(<App />)
    })

    clickButton('Open Current Project')

    expect(container.textContent).toContain('64x64 cells')
    expect(container.textContent).toContain('Browser draft autosaves locally.')
  })

  it('opens the ooze demo with multiple frames', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Open Ooze Demo')

    expect(container.textContent).toContain('Ooze Sprite Starter')
    expect(container.textContent).toContain('Frames: 2')
  })

  it('switches paint and erase tools with keyboard shortcuts', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }))
    })
    expect(container.textContent).toContain('Eraser')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }))
    })
    expect(container.textContent).toContain('Ink')
  })

  it('allows paint and erase shortcut keys to be changed', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }))
    })
    expect(container.textContent).toContain('Eraser')

    const shortcutInputs = getRequiredElement('.shortcut-settings').querySelectorAll('input')
    setInputValue(shortcutInputs[0], 'b')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }))
    })
    expect(container.textContent).toContain('Eraser')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    })
    expect(container.textContent).toContain('Ink')
    expect(container.textContent).toContain('Updated paint shortcut to "B".')

    act(() => {
      root.unmount()
    })
    root = createRoot(container)
    act(() => {
      root.render(<App />)
    })
    clickButton('New Project')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }))
    })
    expect(container.textContent).toContain('Eraser')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'b' }))
    })
    expect(container.textContent).toContain('Ink')

    clickButton('Reset Shortcuts')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'e' }))
    })
    expect(container.textContent).toContain('Eraser')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'p' }))
    })
    expect(container.textContent).toContain('Ink')
  })

  it('does not run editor shortcuts while typing in fields', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    expect(getRequiredElement('.palette-selected strong').textContent).toBe('Ink')

    const colorNameInput = getRequiredElement('.palette-inspector').querySelector<HTMLInputElement>('input')
    if (!colorNameInput) {
      throw new Error('Missing palette color name input.')
    }

    act(() => {
      colorNameInput.dispatchEvent(new KeyboardEvent('keydown', { key: 'e', bubbles: true }))
    })

    expect(getRequiredElement('.palette-selected strong').textContent).toBe('Ink')
  })

  it('moves between frames with arrow keyboard shortcuts', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')

    expect(getRequiredElement('.timeline button.active span').textContent).toBe('2')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }))
    })
    expect(getRequiredElement('.timeline button.active span').textContent).toBe('1')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }))
    })
    expect(getRequiredElement('.timeline button.active span').textContent).toBe('2')
  })

  it('opens and filters the command palette', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    })
    expect(container.textContent).toContain('Find editor actions')

    const commandSearch = container.querySelector<HTMLInputElement>('.command-palette input')
    if (!commandSearch) {
      throw new Error('Missing command palette search input.')
    }

    setInputValue(commandSearch, 'metadata')

    expect(container.textContent).toContain('Export Animation Metadata JSON')
    expect(container.textContent).not.toContain('Add layer')
  })

  it('runs editor actions from the command palette', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    })

    const commandSearch = container.querySelector<HTMLInputElement>('.command-palette input')
    if (!commandSearch) {
      throw new Error('Missing command palette search input.')
    }

    setInputValue(commandSearch, 'add layer')

    act(() => {
      commandSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })

    expect(container.textContent).toContain('Layer 2')
    expect(container.textContent).not.toContain('Find editor actions')
  })

  it('adds, duplicates, and deletes frames from the timeline controls', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    expect(container.textContent).toContain('Frames: 1')

    clickButton('Add Frame')
    expect(container.textContent).toContain('Frames: 2')

    clickButton('Duplicate Frame')
    expect(container.textContent).toContain('Frames: 3')

    clickButton('Delete Frame')
    expect(container.textContent).toContain('Frames: 2')
  })

  it('adds a blank frame after the selected frame', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')
    clickButton('Add Frame')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; frameIds: string[] }>
      frames: Array<{ id: string; layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    const idleFrameIds = exported.animations.find((animation) => animation.id === 'idle')?.frameIds ?? []
    const addedFrame = exported.frames.find((frame) => frame.id === idleFrameIds[1])

    expect(idleFrameIds).toHaveLength(2)
    expect(addedFrame?.layers[0].cells).toEqual({})
  })

  it('duplicates the selected frame with its cell data', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')
    clickButton('Duplicate Frame')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ id: string; frameIds: string[] }>
      frames: Array<{ id: string; layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    const idleFrameIds = exported.animations.find((animation) => animation.id === 'idle')?.frameIds ?? []
    const duplicatedFrame = exported.frames.find((frame) => frame.id === idleFrameIds[1])

    expect(idleFrameIds).toHaveLength(2)
    expect(duplicatedFrame?.layers[0].cells['0,0']).toBe('ink')
  })

  it('keeps final/default delete controls disabled', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    expect(getButtonWithin('.frame-actions', 'Delete Frame').disabled).toBe(true)
    expect(getButtonWithin('.animation-controls', 'Delete').disabled).toBe(true)
    expect(getButtonWithin('.layer-actions', 'Delete').disabled).toBe(true)
  })

  it('undoes and redoes a painted cell from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    paintCellByTitle('0,0')
    expect(getPixelCellByTitle('0,0 ink')).toBeTruthy()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })
    expect(getPixelCellByTitle('0,0')).toBeTruthy()

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))
    })
    expect(getPixelCellByTitle('0,0 ink')).toBeTruthy()
  })

  it('clears redo history after a new edit following undo', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    paintCellByTitle('0,0')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })
    paintCellByTitle('1,0')
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'y', ctrlKey: true }))
    })

    expect(getPixelCellByTitle('0,0')).toBeTruthy()
    expect(getPixelCellByTitle('1,0 ink')).toBeTruthy()
  })

  it('undoes an accepted patch apply from the editor', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    await clickButtonAsync('Generate Mock Patch')
    clickButton('Apply Patch')

    const afterApply = setupDownloadCapture()
    clickButton('Export Project JSON')
    const appliedProject = JSON.parse((await afterApply.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    expect(Object.keys(appliedProject.frames[0].layers[0].cells)).toHaveLength(5)

    vi.restoreAllMocks()
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })

    const afterUndo = setupDownloadCapture()
    clickButton('Export Project JSON')
    const undoneProject = JSON.parse((await afterUndo.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; cells: Record<string, string> }> }>
    }
    expect(Object.keys(undoneProject.frames[0].layers[0].cells)).toHaveLength(0)
  })

  it('undoes frame add operations from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')
    expect(container.textContent).toContain('Frames: 2')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })

    expect(container.textContent).toContain('Frames: 1')
  })

  it('undoes frame duplicate operations from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Duplicate Frame')
    expect(container.textContent).toContain('Frames: 2')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })

    expect(container.textContent).toContain('Frames: 1')
  })

  it('undoes frame delete operations from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButton('Add Frame')
    expect(container.textContent).toContain('Frames: 2')

    clickButton('Delete Frame')
    expect(container.textContent).toContain('Frames: 1')

    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })

    expect(container.textContent).toContain('Frames: 2')
  })

  it('undoes layer visibility changes from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')
    expect(getRequiredElement('.preview-box').querySelectorAll('.mini-pixel')).toHaveLength(1)

    clickButtonWithin('.layer-list', 'Hide')
    expect(getRequiredElement('.preview-box').querySelectorAll('.mini-pixel')).toHaveLength(0)

    undoWithKeyboard()
    expect(getRequiredElement('.preview-box').querySelectorAll('.mini-pixel')).toHaveLength(1)
    expect(container.textContent).toContain('Visible | Editable | Exports | 1 cells')
  })

  it('undoes palette color edits from the editor', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const paletteInputs = getRequiredElement('.palette-inspector').querySelectorAll('input')
    setInputValue(paletteInputs[0], 'Line Art')
    setInputValue(paletteInputs[1], '#112233')
    clickButtonWithin('.palette-inspector', 'Save')
    expect(container.textContent).toContain('Line Art')

    undoWithKeyboard()

    expect(getRequiredElement('.palette-selected strong').textContent).toBe('Ink')
    expect(container.textContent).not.toContain('Line Art')
  })

  it('undoes animation add operations from the editor', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButtonWithin('.animation-controls', 'Add Animation')
    expect(container.textContent).toContain('Animation 2')

    undoWithKeyboard()

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ name: string }>
    }
    expect(exported.animations.map((animation) => animation.name)).toEqual(['Idle'])
    expect(container.textContent).not.toContain('Animation 2')
  })

  it('undoes frame metadata edits from the editor', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const frameInputs = getRequiredElement('.frame-inspector').querySelectorAll('input')
    const frameNotes = getRequiredElement('.frame-inspector').querySelector('textarea')
    if (!frameNotes) {
      throw new Error('Missing frame notes field.')
    }

    setInputValue(frameInputs[0], 'Contact')
    setTextAreaValue(frameNotes, 'Impact frame.')
    setInputValue(frameInputs[4], 'attack, contact')
    clickButtonWithin('.frame-inspector', 'Save')

    const afterSave = setupDownloadCapture()
    clickButton('Export Project JSON')
    const savedProject = JSON.parse((await afterSave.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ id: string; name: string; notes?: string; tags?: string[] }>
    }
    expect(savedProject.frames.find((candidate) => candidate.id === 'idle-001')).toMatchObject({
      name: 'Contact',
      notes: 'Impact frame.',
      tags: ['attack', 'contact'],
    })

    vi.restoreAllMocks()
    undoWithKeyboard()

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ id: string; name: string; notes?: string; tags?: string[] }>
    }
    const frame = exported.frames.find((candidate) => candidate.id === 'idle-001')
    expect(frame).toMatchObject({ name: 'Frame 001', notes: '', tags: [] })
  })

  it('toggles layer PNG export inclusion from the layer inspector', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    runCommandFromPalette('add layer')

    expect(container.textContent).toContain('Layer 2')
    expect(container.textContent).toContain('Exports | 0 cells')

    const exportToggle = getCheckboxByLabel('Include in PNG export')
    act(() => {
      exportToggle.click()
    })

    expect(container.textContent).toContain('No export | 0 cells')
  })

  it('edits the selected layer blend mode from the layer inspector', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const blendModeSelect = getRequiredElement('.layer-inspector').querySelector<HTMLSelectElement>('select')
    if (!blendModeSelect) {
      throw new Error('Missing layer blend mode select.')
    }
    setSelectValue(blendModeSelect, 'screen')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; blendMode?: string }> }>
    }

    expect(exported.frames[0].layers[0]).toMatchObject({ id: 'base', blendMode: 'screen' })
  })

  it('applies layer export presets from the layer inspector', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    clickButtonWithin('.layer-presets', 'Shadow')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ id: string; exportable: boolean; opacity: number; blendMode?: string }> }>
    }

    expect(exported.frames[0].layers[0]).toMatchObject({
      id: 'base',
      exportable: true,
      opacity: 0.55,
      blendMode: 'multiply',
    })
    expect(container.textContent).toContain('Applied Shadow layer preset.')
  })

  it('hides a layer from preview without deleting its cells', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')

    expect(getRequiredElement('.preview-box').querySelectorAll('.mini-pixel')).toHaveLength(1)

    clickButtonWithin('.layer-list', 'Hide')

    expect(getRequiredElement('.preview-box').querySelectorAll('.mini-pixel')).toHaveLength(0)
    expect(getPixelCellByTitle('0,0 ink')).toBeTruthy()

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ layers: Array<{ visible: boolean; cells: Record<string, string> }> }>
    }

    expect(exported.frames[0].layers[0].visible).toBe(false)
    expect(exported.frames[0].layers[0].cells['0,0']).toBe('ink')
  })

  it('adds, reorders, and deletes layers from the layer panel', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    clickButtonWithin('.layer-actions', 'Add')
    clickButtonWithin('.layer-actions', 'Add')
    clickButtonWithin('.layer-actions', 'Up')

    const afterMove = setupDownloadCapture()
    clickButton('Export Project JSON')
    const movedProject = JSON.parse((await afterMove.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ id: string; layers: Array<{ name: string }> }>
    }
    expect(movedProject.frames[0].layers.map((layer) => layer.name)).toEqual([
      'Base',
      'Layer 3',
      'Layer 2',
    ])

    vi.restoreAllMocks()
    clickButtonWithin('.layer-actions', 'Delete')

    const afterDelete = setupDownloadCapture()
    clickButton('Export Project JSON')
    const deletedProject = JSON.parse((await afterDelete.capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ id: string; layers: Array<{ name: string }> }>
    }
    expect(deletedProject.frames[0].layers.map((layer) => layer.name)).toEqual(['Base', 'Layer 2'])
  })

  it('edits the selected palette color name and hex from the palette inspector', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const paletteInputs = getRequiredElement('.palette-inspector').querySelectorAll('input')
    setInputValue(paletteInputs[0], 'Line Art')
    setInputValue(paletteInputs[1], '#112233')
    clickButtonWithin('.palette-inspector', 'Save')

    expect(container.textContent).toContain('Line Art')
    expect(container.textContent).toContain('Updated palette color "ink".')
  })

  it('adds, reorders, and deletes an unused palette color from the palette inspector', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    clickButtonWithin('.palette-inspector', 'Add Color')
    expect(container.textContent).toContain('Color 8')

    clickButtonWithin('.palette-inspector', 'Up')

    const afterMove = setupDownloadCapture()
    clickButton('Export Project JSON')
    const movedProject = JSON.parse((await afterMove.capturedBlob.current?.text()) ?? '{}') as {
      palette: Array<{ name: string }>
    }
    expect(movedProject.palette.map((color) => color.name).slice(-2)).toEqual(['Color 8', 'Shadow'])

    vi.restoreAllMocks()
    clickButtonWithin('.palette-inspector', 'Delete Color')

    const afterDelete = setupDownloadCapture()
    clickButton('Export Project JSON')
    const deletedProject = JSON.parse((await afterDelete.capturedBlob.current?.text()) ?? '{}') as {
      palette: Array<{ name: string }>
    }
    expect(deletedProject.palette.map((color) => color.name)).not.toContain('Color 8')
  })

  it('renames the selected animation from the animation inspector', () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const animationNameInput = getRequiredElement('.animation-inspector').querySelector('input')
    if (!animationNameInput) {
      throw new Error('Missing animation name input.')
    }

    setInputValue(animationNameInput, 'Walk')
    clickButtonWithin('.animation-inspector', 'Save')

    expect(container.textContent).toContain('Walk')
  })

  it('adds, duplicates, and deletes animations from the animation controls', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    clickButtonWithin('.animation-controls', 'Add Animation')
    expect(container.textContent).toContain('Animation 2')

    clickButtonWithin('.animation-controls', 'Duplicate')
    expect(container.textContent).toContain('Animation 2 Copy')

    clickButtonWithin('.animation-controls', 'Delete')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      animations: Array<{ name: string }>
    }

    expect(exported.animations.map((animation) => animation.name)).toEqual(['Idle', 'Animation 2'])
  })

  it('edits frame metadata and preserves it in exported project JSON', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const frameInputs = getRequiredElement('.frame-inspector').querySelectorAll('input')
    const frameNotes = getRequiredElement('.frame-inspector').querySelector('textarea')
    if (!frameNotes) {
      throw new Error('Missing frame notes field.')
    }
    setInputValue(frameInputs[0], 'Contact')
    clickButtonWithin('.frame-inspector', 'Save')
    setInputValue(frameInputs[1], '333')
    setInputValue(frameInputs[2], '3')
    setInputValue(frameInputs[3], '4')
    setTextAreaValue(frameNotes, 'Impact frame for the first readable hit.')
    setInputValue(frameInputs[4], 'attack, contact')
    clickButtonWithin('.frame-inspector', 'Save')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')

    const text = await capturedBlob.current?.text()
    const exported = JSON.parse(text ?? '{}') as {
      frames: Array<{
        id: string
        name: string
        durationMs: number
        notes?: string
        tags?: string[]
        anchor: { x: number; y: number }
      }>
    }
    const frame = exported.frames.find((candidate) => candidate.id === 'idle-001')

    expect(frame).toMatchObject({
      name: 'Contact',
      durationMs: 333,
      notes: 'Impact frame for the first readable hit.',
      tags: ['attack', 'contact'],
      anchor: { x: 3, y: 4 },
    })
  })

  it('edits frame hitbox metadata and preserves it in exported project JSON', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')

    const hitboxToggle = getCheckboxByLabel('Hitbox metadata')
    act(() => {
      hitboxToggle.click()
    })

    const numberInputs = getRequiredElement('.frame-inspector').querySelectorAll<HTMLInputElement>(
      'input[type="number"]',
    )
    setInputValue(numberInputs[3], '2')
    setInputValue(numberInputs[4], '3')
    setInputValue(numberInputs[5], '10')
    setInputValue(numberInputs[6], '11')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exported = JSON.parse((await capturedBlob.current?.text()) ?? '{}') as {
      frames: Array<{ id: string; hitbox?: { x: number; y: number; width: number; height: number } }>
    }
    const frame = exported.frames.find((candidate) => candidate.id === 'idle-001')

    expect(frame?.hitbox).toEqual({ x: 2, y: 3, width: 10, height: 11 })
  })

  it('imports a valid project JSON file and enters the editor', async () => {
    act(() => {
      root.render(<App />)
    })

    const project = createBlankProject({
      name: 'Imported Button',
      width: 64,
      height: 24,
      assetType: 'button',
    })

    await importProjectFile(new File([JSON.stringify(project)], 'button.spritewrite.json', {
      type: 'application/json',
    }))

    expect(container.textContent).toContain('Imported Button')
    expect(container.textContent).toContain('64x24 cells')
    expect(container.textContent).toContain('Project JSON export is current.')
  })

  it('rejects invalid project JSON without replacing the current project', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('Blank 64x64')
    clickButton('New Project')

    await importProjectFile(new File(['{"name":"Broken"}'], 'broken.spritewrite.json', {
      type: 'application/json',
    }))

    expect(container.textContent).toContain('64x64 cells')
    expect(container.textContent).toContain('Project id must be a non-empty string.')
    expect(container.textContent).toContain('Import rejected.')
  })

  it('exports project JSON from the editor and clears the dirty indicator', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    expect(container.textContent).toContain('Unsaved editable changes')

    const { anchor, capturedBlob } = setupDownloadCapture()

    clickButton('Export Project JSON')

    expect(anchor.download).toBe('untitled-sprite.spritewrite.json')
    expect(container.textContent).toContain('Project JSON export is current.')

    const text = await capturedBlob.current?.text()
    expect(text).toContain('"name": "Untitled Sprite"')
    expect(text).toContain('"canvas"')
  })

  it('re-imports exported project JSON through the UI', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    paintCellByTitle('0,0')

    const { capturedBlob } = setupDownloadCapture()
    clickButton('Export Project JSON')
    const exportedText = await capturedBlob.current?.text()
    if (!exportedText) {
      throw new Error('Missing exported project JSON.')
    }

    vi.restoreAllMocks()
    await importProjectFile(new File([exportedText], 'roundtrip.spritewrite.json', {
      type: 'application/json',
    }))

    expect(container.textContent).toContain('Project JSON export is current.')
    expect(getPixelCellByTitle('0,0 ink')).toBeTruthy()
  })

  it('exports animation metadata JSON from the editor', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    const { anchor, capturedBlob } = setupDownloadCapture()

    clickButton('Export Metadata JSON')

    expect(anchor.download).toBe('idle-metadata@1x.json')
    const text = await capturedBlob.current?.text()
    expect(text).toContain('"formatName": "SpriteWrite"')
    expect(text).toContain('"frameCount": 1')
    expect(text).toContain('"sheetWidth": 32')
    expect(text).toContain('"layers"')
  })

  it('exports current frame PNG from the editor through a crisp canvas path', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    const { anchor, canvas, context, capturedBlob } = setupPngDownloadCapture()

    await clickButtonAsync('Export Frame PNG')

    expect(anchor.download).toBe('idle-001@1x.png')
    expect(canvas.width).toBe(32)
    expect(canvas.height).toBe(32)
    expect(context.imageSmoothingEnabled).toBe(false)
    expect(context.putImageData).toHaveBeenCalled()
    expect(capturedBlob.current?.type).toBe('image/png')
  })

  it('exports animation spritesheet PNG from the editor through a crisp canvas path', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    const { anchor, canvas, context, capturedBlob } = setupPngDownloadCapture()

    await clickButtonAsync('Export Spritesheet PNG')

    expect(anchor.download).toBe('idle-spritesheet@1x.png')
    expect(canvas.width).toBe(32)
    expect(canvas.height).toBe(32)
    expect(context.imageSmoothingEnabled).toBe(false)
    expect(context.putImageData).toHaveBeenCalled()
    expect(capturedBlob.current?.type).toBe('image/png')
  })

  it('can exclude a proposed patch operation before apply', async () => {
    act(() => {
      root.render(<App />)
    })

    clickButton('New Project')
    await clickButtonAsync('Generate Mock Patch')

    expect(container.textContent).toContain('5/5 enabled')
    expect(container.textContent).toContain('Current frame')
    expect(container.textContent).toContain('Proposed patch')
    expect(container.textContent).toContain('Cells 5')
    expect(container.textContent).toContain('Bounds')
    expect(container.textContent).toContain('ink 5')
    expect(container.querySelectorAll('.mini-highlight')).toHaveLength(10)

    clickButton('Exclude')

    expect(container.textContent).toContain('4/5 enabled')
    expect(container.textContent).toContain('Cells 4')
    expect(container.textContent).toContain('ink 4')
    expect(container.textContent).toContain('1 operation(s) excluded from apply.')
    expect(container.querySelectorAll('.mini-highlight')).toHaveLength(8)
  })

  function setInputValue(input: HTMLInputElement, value: string) {
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set
      valueSetter?.call(input, value)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function setTextAreaValue(textarea: HTMLTextAreaElement, value: string) {
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set
      valueSetter?.call(textarea, value)
      textarea.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  function setSelectValue(select: HTMLSelectElement, value: string) {
    act(() => {
      const valueSetter = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, 'value')?.set
      valueSetter?.call(select, value)
      select.dispatchEvent(new Event('change', { bubbles: true }))
    })
  }

  function undoWithKeyboard() {
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }))
    })
  }

  function runCommandFromPalette(query: string) {
    act(() => {
      window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true }))
    })

    const commandSearch = container.querySelector<HTMLInputElement>('.command-palette input')
    if (!commandSearch) {
      throw new Error('Missing command palette search input.')
    }

    setInputValue(commandSearch, query)

    act(() => {
      commandSearch.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
    })
  }

  function getCheckboxByLabel(label: string): HTMLInputElement {
    const labelElement = Array.from(container.querySelectorAll('label')).find((candidate) =>
      candidate.textContent?.includes(label),
    )
    const input = labelElement?.querySelector<HTMLInputElement>('input[type="checkbox"]')
    if (!input) {
      throw new Error(`Missing checkbox "${label}".`)
    }
    return input
  }

  function getRequiredElement(selector: string): HTMLElement {
    const element = container.querySelector<HTMLElement>(selector)
    if (!element) {
      throw new Error(`Missing element "${selector}".`)
    }
    return element
  }

  function clickButtonWithin(selector: string, label: string) {
    const button = getButtonWithin(selector, label)

    act(() => {
      button.click()
    })
  }

  function getButtonWithin(selector: string, label: string): HTMLButtonElement {
    const button = Array.from(getRequiredElement(selector).querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(label),
    )
    if (!button) {
      throw new Error(`Missing button "${label}" inside "${selector}".`)
    }

    return button
  }

  function getPixelCellByTitle(title: string): HTMLButtonElement | null {
    return container.querySelector<HTMLButtonElement>(`.pixel-cell[title="${title}"]`)
  }

  function paintCellByTitle(title: string) {
    const cell = getPixelCellByTitle(title)
    if (!cell) {
      throw new Error(`Missing pixel cell "${title}".`)
    }

    act(() => {
      cell.dispatchEvent(new Event('pointerdown', { bubbles: true, cancelable: true }))
      window.dispatchEvent(new Event('pointerup', { bubbles: true }))
    })
  }

  function clickButton(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(label),
    )
    if (!button) {
      throw new Error(`Missing button "${label}".`)
    }

    act(() => {
      button.click()
    })
  }

  async function clickButtonAsync(label: string) {
    const button = Array.from(container.querySelectorAll('button')).find((candidate) =>
      candidate.textContent?.includes(label),
    )
    if (!button) {
      throw new Error(`Missing button "${label}".`)
    }

    await act(async () => {
      button.click()
      await Promise.resolve()
    })
  }

  async function importProjectFile(file: File) {
    const input = container.querySelector<HTMLInputElement>('input[type="file"]')
    if (!input) {
      throw new Error('Missing project import input.')
    }

    Object.defineProperty(input, 'files', {
      configurable: true,
      value: [file],
    })

    await act(async () => {
      input.dispatchEvent(new Event('change', { bubbles: true }))
      await Promise.resolve()
      await Promise.resolve()
    })
  }

  function setupDownloadCapture() {
    const anchor = originalCreateElement('a')
    anchor.click = vi.fn()
    anchor.remove = vi.fn()
    const capturedBlob: { current?: Blob } = {}

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn((blob: Blob | MediaSource) => {
        if (blob instanceof Blob) {
          capturedBlob.current = blob
        }
        return 'blob:app-export'
      }),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    vi.spyOn(document.body, 'append').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return anchor
      }
      return originalCreateElement(tagName)
    })

    return { anchor, capturedBlob }
  }

  function setupPngDownloadCapture() {
    const anchor = originalCreateElement('a')
    anchor.click = vi.fn()
    anchor.remove = vi.fn()
    const capturedBlob: { current?: Blob } = {}
    const context = {
      imageSmoothingEnabled: true,
      createImageData: vi.fn((width: number, height: number) => ({
        data: new Uint8ClampedArray(width * height * 4),
      })),
      putImageData: vi.fn(),
    } as unknown as CanvasRenderingContext2D
    const canvas = {
      width: 0,
      height: 0,
      getContext: vi.fn(() => context),
      toBlob: vi.fn((callback: BlobCallback, type?: string) => {
        const blob = new Blob(['png'], { type })
        capturedBlob.current = blob
        callback(blob)
      }),
    } as unknown as HTMLCanvasElement

    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn(() => 'blob:frame-png'),
    })
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    })
    vi.spyOn(document.body, 'append').mockImplementation(() => undefined)
    vi.spyOn(document, 'createElement').mockImplementation((tagName) => {
      if (tagName === 'a') {
        return anchor
      }
      if (tagName === 'canvas') {
        return canvas
      }
      return originalCreateElement(tagName)
    })

    return { anchor, canvas, context, capturedBlob }
  }
})
