import * as React from 'react'
export function TableToolbar({
  children,
  ...props
}: Omit<React.ComponentProps<'div'>, 'className'>): React.JSX.Element {
  return (
    <div className="table-toolbar" {...props}>
      {children}
    </div>
  )
}
