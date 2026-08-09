import { useState } from 'react'

export function ProviderDetails({ details }: { details: string }) {
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'failed'>('idle')

  if (!details.trim()) {
    return null
  }

  async function copyDetails() {
    try {
      await copyText(details)
      setCopyStatus('copied')
    } catch {
      setCopyStatus('failed')
    }
  }

  return (
    <details className="provider-details">
      <summary>
        <span>Show provider details</span>
        <button
          type="button"
          onClick={(event) => {
            event.preventDefault()
            event.stopPropagation()
            void copyDetails()
          }}
        >
          Copy All
        </button>
      </summary>
      {copyStatus === 'copied' ? <p role="status">Copied provider details.</p> : null}
      {copyStatus === 'failed' ? <p role="status">Copy failed.</p> : null}
      <pre>{details}</pre>
    </details>
  )
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text)
    return
  }

  const textarea = document.createElement('textarea')
  textarea.value = text
  textarea.setAttribute('readonly', '')
  textarea.style.position = 'fixed'
  textarea.style.left = '-9999px'
  document.body.appendChild(textarea)
  textarea.select()

  try {
    if (!document.execCommand('copy')) {
      throw new Error('copy command failed')
    }
  } finally {
    textarea.remove()
  }
}
