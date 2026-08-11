import { Copy, Minus, Square, X } from 'lucide-react'
import { useEffect, useState } from 'react'

export function WindowTitleBar(): React.JSX.Element | null {
  const controls = window.windowControls
  const [isMaximized, setIsMaximized] = useState(false)

  useEffect(() => {
    if (!controls) return
    void controls.isMaximized().then(setIsMaximized)
    return controls.onMaximizedChange(setIsMaximized)
  }, [controls])

  if (!controls) return null

  return (
    <header className="flex h-9 shrink-0 bg-background text-foreground">
      <div
        className="window-drag-region sidebar-always-dark flex w-52 shrink-0 items-center bg-sidebar px-3 text-sidebar-foreground"
        onContextMenu={(event) => {
          event.preventDefault()
          void controls.showSystemMenu()
        }}
        onDoubleClick={() => void controls.toggleMaximize()}
      />
      <div
        className="window-drag-region min-w-0 flex-1"
        onContextMenu={(event) => {
          event.preventDefault()
          void controls.showSystemMenu()
        }}
        onDoubleClick={() => void controls.toggleMaximize()}
      />
      <div className="window-no-drag flex shrink-0">
        <button
          aria-label="Minimize window"
          className="grid h-9 w-[46px] place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void controls.minimize()}
          type="button"
        >
          <Minus aria-hidden="true" className="size-3.5" strokeWidth={2} />
        </button>
        <button
          aria-label={isMaximized ? 'Restore window' : 'Maximize window'}
          className="grid h-9 w-[46px] place-items-center text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void controls.toggleMaximize()}
          type="button"
        >
          {isMaximized ? (
            <Copy aria-hidden="true" className="size-3" strokeWidth={2} />
          ) : (
            <Square aria-hidden="true" className="size-3" strokeWidth={2} />
          )}
        </button>
        <button
          aria-label="Close window"
          className="grid h-9 w-[46px] place-items-center text-muted-foreground transition-colors hover:bg-destructive hover:text-destructive-foreground focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => void controls.close()}
          type="button"
        >
          <X aria-hidden="true" className="size-3.5" strokeWidth={2} />
        </button>
      </div>
    </header>
  )
}
