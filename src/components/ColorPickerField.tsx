import { useState } from 'react'

export type ColorPickerFieldProps = {
  label: string
  value: string
  onChange: (value: string) => void
  disabled?: boolean
  initialOpen?: boolean
  onClose?: () => void
}

export function ColorPickerField({
  label,
  value,
  onChange,
  disabled = false,
  initialOpen = false,
  onClose,
}: ColorPickerFieldProps) {
  const [isOpen, setIsOpen] = useState(initialOpen)
  const [draftColor, setDraftColor] = useState(value)
  const normalizedColor = /^#[0-9a-f]{6}$/i.test(draftColor) ? draftColor : value
  const swatches = ['#0f1117', '#1d2028', '#2f3542', '#f5f5f7', '#ffcc33', '#ff7a45', '#7ddc84', '#4fb3ff', '#b48cff', '#ff6fae']


  function closePicker() {
    setIsOpen(false)
    onClose?.()
  }

  function applyColor(nextColor = draftColor) {
    if (!/^#[0-9a-f]{6}$/i.test(nextColor)) {
      return
    }
    const normalized = nextColor.toLowerCase()
    onChange(normalized)
    setDraftColor(normalized)
  }

  return (
    <div className="color-picker-field">
      <span>{label}</span>
      <button
        type="button"
        className="color-picker-trigger"
        onClick={() => {
          setDraftColor(value)
          setIsOpen(true)
        }}
        disabled={disabled}
        aria-label={label + ': ' + value}
      >
        <span style={{ background: value }} />
        <strong>{value}</strong>
      </button>
      {isOpen ? (
        <div className="color-picker-backdrop" role="presentation" onMouseDown={() => closePicker()}>
          <section
            className="color-picker-popover"
            role="dialog"
            aria-modal="true"
            aria-label={label}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="color-picker-header">
              <div>
                <h2>{label}</h2>
                <p className="status-line">Pick a display color or enter a hex value.</p>
              </div>
              <button type="button" onClick={() => closePicker()}>
                Close
              </button>
            </div>
            <input
              className="color-picker-native"
              type="color"
              value={normalizedColor}
              onChange={(event) => {
                setDraftColor(event.target.value)
                applyColor(event.target.value)
              }}
            />
            <label>
              Hex
              <input
                value={draftColor}
                spellCheck={false}
                onChange={(event) => setDraftColor(event.target.value)}
                onBlur={() => applyColor()}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    applyColor()
                    closePicker()
                  }
                  if (event.key === 'Escape') {
                    closePicker()
                  }
                }}
              />
            </label>
            <div className="color-swatch-list" aria-label="Suggested colors">
              {swatches.map((swatch) => (
                <button
                  key={swatch}
                  type="button"
                  className={swatch.toLowerCase() === value.toLowerCase() ? 'active' : ''}
                  onClick={() => applyColor(swatch)}
                  aria-label={'Use ' + swatch}
                >
                  <span style={{ background: swatch }} />
                </button>
              ))}
            </div>
            <div className="button-stack">
              <button type="button" onClick={() => applyColor()}>
                Apply Color
              </button>
              <button type="button" onClick={() => closePicker()}>
                Done
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  )
}
