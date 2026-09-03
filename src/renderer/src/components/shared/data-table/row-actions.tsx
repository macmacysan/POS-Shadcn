/* eslint-disable react-refresh/only-export-components */
import * as React from 'react'
import type { ColumnDef, RowData } from '@tanstack/react-table'
import { MoreHorizontal } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { ConfirmationAlertDialog } from '@/components/shared/confirmation-alert-dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
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
  const [pendingAction, setPendingAction] = React.useState<RowActionItem>()

  return (
    <>
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
                'opacity-0 group-hover/row:opacity-100 focus-visible:opacity-100 data-popup-open:opacity-100',
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
                  if (action.requiresConfirmation) setPendingAction(action)
                  else action.onSelect()
                }}
              >
                {action.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
        </DropdownMenuContent>
      </DropdownMenu>
      {pendingAction && (
        <ConfirmationAlertDialog
          open
          title={pendingAction.label}
          description={pendingAction.confirmationMessage ?? `Continue with ${pendingAction.label}?`}
          confirmLabel={pendingAction.label}
          destructive={pendingAction.destructive}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setPendingAction(undefined)
          }}
          onConfirm={() => {
            setPendingAction(undefined)
            pendingAction.onSelect()
          }}
        />
      )}
    </>
  )
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
          <RowActions
            key={openSignal ?? 'closed'}
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

export function createRowSelectionColumn<TData extends RowData>(): ColumnDef<TData> {
  return {
    id: 'select',
    enableSorting: false,
    enableColumnFilter: false,
    enableHiding: false,
    size: 40,
    header: ({ table }) => (
      <Checkbox
        aria-label="Select all rows"
        checked={table.getIsAllPageRowsSelected()}
        indeterminate={table.getIsSomePageRowsSelected()}
        onCheckedChange={(checked) => table.toggleAllPageRowsSelected(checked === true)}
      />
    ),
    cell: ({ row }) => (
      <Checkbox
        aria-label="Select row"
        checked={row.getIsSelected()}
        onCheckedChange={(checked) => row.toggleSelected(checked === true)}
      />
    )
  }
}
