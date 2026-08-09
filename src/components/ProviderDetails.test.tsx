// @vitest-environment jsdom

import { act } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ProviderDetails } from './ProviderDetails'

describe('ProviderDetails', () => {
  let container: HTMLDivElement
  let root: Root

  beforeEach(() => {
    ;(globalThis as typeof globalThis & { IS_REACT_ACT_ENVIRONMENT: boolean }).IS_REACT_ACT_ENVIRONMENT = true
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

  it('copies the full provider details payload', async () => {
    const writeText = vi.fn().mockResolvedValue(undefined)
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    })
    const details = 'Ollama animation draft staged\n\n{"attempt":4,"draft":{"frames":[1,2,3]}}'

    act(() => {
      root.render(<ProviderDetails details={details} />)
    })

    const copyButton = Array.from(container.querySelectorAll('button')).find(
      (button) => button.textContent === 'Copy All',
    )
    if (!copyButton) {
      throw new Error('Missing Copy All button.')
    }

    await act(async () => {
      copyButton.click()
    })

    expect(writeText).toHaveBeenCalledWith(details)
    expect(container.textContent).toContain('Copied provider details.')
  })
})
