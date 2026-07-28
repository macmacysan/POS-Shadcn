/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import type { ColumnDef, Row, RowData } from '@tanstack/react-table'
import { MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useDataGrid } from '@/components/ui/reui/data-grid/data-grid'
import { cn } from '@/lib/utils'

export type RowActionItem = {
  id: string
  label: string
  onSelect: () => void
  destructive?: boolean
  disabled?: boolean
  requiresConfirmation?: boolean
  confirmationMessage?: string
}

type RowActionsProps = {
  label: string
  actions: readonly RowActionItem[]
  className?: string
  openSignal?: number
  onOpen?: () => void
}

type RowActionsColumnOptions<TData extends RowData> = {
  label: string
  getActions: (row: TData) => readonly RowActionItem[]
  getOpenSignal?: (rowId: string) => number | undefined
}

export function RowActions({
  label,
  actions,
  className,
  openSignal,
  onOpen
}: RowActionsProps): React.JSX.Element {
  const [open, setOpen] = React.useState(() => openSignal !== undefined && openSignal > 0)

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) onOpen?.()
      }}
    >
      <DropdownMenuTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label={label}
            className={cn(
              'opacity-100 md:opacity-0 md:group-hover/row:opacity-100 md:focus-visible:opacity-100 md:data-popup-open:opacity-100',
              className
            )}
            onClick={(event) => event.stopPropagation()}
          />
        }
      >
        <MoreHorizontal aria-hidden="true" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuGroup>
          {actions.map((action) => (
            <DropdownMenuItem
              key={action.id}
              disabled={action.disabled}
              variant={action.destructive ? 'destructive' : 'default'}
              onClick={(event) => {
                event.stopPropagation()
                if (action.disabled) return
                if (
                  action.requiresConfirmation &&
                  !window.confirm(action.confirmationMessage ?? `Continue with ${action.label}?`)
                ) {
                  return
                }
                action.onSelect()
              }}
            >
              {action.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ActiveRowActions<TData extends RowData>({
  row,
  ...props
}: RowActionsProps & { row: Row<TData> }): React.JSX.Element {
  const { activateRow } = useDataGrid()

  return <RowActions {...props} onOpen={() => activateRow(row.original, row.id)} />
}

export function createRowActionsColumn<TData extends RowData>({
  label,
  getActions,
  getOpenSignal
}: RowActionsColumnOptions<TData>): ColumnDef<TData> {
  return {
    id: 'actions',
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false,
    size: 48,
    header: () => <span className="sr-only">Actions</span>,
    meta: {
      headerTitle: 'Actions',
      headerClassName: cn('w-8', 'text-right'),
      cellClassName: cn('w-8', 'text-right')
    },
    cell: ({ row }) => {
      const openSignal = getOpenSignal?.(row.id)

      return (
        <div className="flex justify-end">
          <ActiveRowActions
            key={openSignal ?? 'closed'}
            row={row}
            label={label}
            actions={getActions(row.original)}
            className="size-7"
            openSignal={openSignal}
          />
        </div>
      )
    }
  }
}
