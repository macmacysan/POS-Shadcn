import * as React from 'react'
import { Toaster as Sonner } from 'sonner'

export function Toaster({ theme }: { theme: 'light' | 'dark' }): React.JSX.Element {
  return (
    <Sonner
      theme={theme}
      position="top-center"
      visibleToasts={3}
      closeButton
      offset="max(1rem, env(safe-area-inset-top))"
      toastOptions={{
        classNames: {
          toast:
            'group toast group-[.toaster]:bg-popover group-[.toaster]:text-popover-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg',
          description: 'group-[.toast]:text-muted-foreground'
        }
      }}
    />
  )
}
