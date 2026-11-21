import * as React from 'react'
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
