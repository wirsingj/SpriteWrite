import { useEffect, useRef } from 'react'

export type CommandItem = {
  id: string
  label: string
  description: string
  shortcut?: string
  disabled?: boolean
  run: () => void | Promise<void>
}

export function CommandPalette({
  commands,
  isOpen,
  query,
  onClose,
  onQueryChange,
  onRunCommand,
}: {
  commands: CommandItem[]
  isOpen: boolean
  query: string
  onClose: () => void
  onQueryChange: (query: string) => void
  onRunCommand: (command: CommandItem) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const normalizedQuery = query.trim().toLowerCase()
  const filteredCommands = commands.filter((command) => {
    const haystack = `${command.label} ${command.description} ${command.shortcut ?? ''}`.toLowerCase()
    return haystack.includes(normalizedQuery)
  })

  useEffect(() => {
    if (isOpen) {
      window.setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [isOpen])

  if (!isOpen) {
    return null
  }

  return (
    <div className="command-palette-backdrop" role="presentation" onMouseDown={onClose}>
      <section
        className="command-palette"
        role="dialog"
        aria-modal="true"
        aria-label="Command palette"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="command-palette-header">
          <div>
            <h2>Commands</h2>
            <p>Find editor actions, exports, frames, layers, and edit commands.</p>
          </div>
          <button type="button" onClick={onClose}>
            Close
          </button>
        </div>
        <input
          ref={inputRef}
          value={query}
          placeholder="Search commands..."
          onChange={(event) => onQueryChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Escape') {
              event.preventDefault()
              onClose()
            }

            if (event.key === 'Enter') {
              const firstEnabledCommand = filteredCommands.find((command) => !command.disabled)
              if (firstEnabledCommand) {
                event.preventDefault()
                onRunCommand(firstEnabledCommand)
              }
            }
          }}
        />
        <div className="command-list">
          {filteredCommands.length ? (
            filteredCommands.map((command) => (
              <button
                key={command.id}
                type="button"
                className="command-item"
                onClick={() => onRunCommand(command)}
                disabled={command.disabled}
              >
                <span>
                  <strong>{command.label}</strong>
                  <small>{command.description}</small>
                </span>
                {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
              </button>
            ))
          ) : (
            <p className="empty-state">No matching command.</p>
          )}
        </div>
      </section>
    </div>
  )
}
