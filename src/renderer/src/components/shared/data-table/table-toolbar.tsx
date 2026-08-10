import * as React from 'react'
import { X } from 'lucide-react'

import { cn } from '@/lib/utils'

export function TableToolbar({
  className,
  children,
  ...props
}: React.ComponentProps<'div'>): React.JSX.Element {
  return (
    <div className={cn('table-toolbar', className)} {...props}>
      {children}
    </div>
  )
}

export function ActiveFilterChip({
  label,
  onClear
}: {
  label: string
  onClear: () => void
}): React.JSX.Element {
  return (
    <span className="filter-chip">
      {label}
      <button
        type="button"
        className="rounded-sm p-0.5 text-current/60 transition-colors hover:bg-black/10 hover:text-current focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        onClick={onClear}
        aria-label={`Clear ${label} filter`}
      >
        <X aria-hidden="true" />
      </button>
    </span>
  )
}
