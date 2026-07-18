import * as React from 'react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  createRowActionsColumn,
  type RowActionItem
} from '@/components/shared/data-table/row-actions'
import { DataGridColumnHeader } from '@/components/ui/reui/data-grid/data-grid-column-header'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { cn } from '@/lib/utils'
import {
  actionLabels,
  formatHistoryDateTime,
  formatHistoryMoney,
  sourceLabels,
  type InstallmentHistoryAction,
  type InstallmentHistoryRecord,
  type InstallmentHistorySource
} from '@/lib/installment-history'

type InstallmentHistoryTableProps = {
  records: InstallmentHistoryRecord[]
  selectedId?: string
  onSelect: (record: InstallmentHistoryRecord) => void
  onDoubleClick: (record: InstallmentHistoryRecord) => void
  isLoading?: boolean
}

type SortDirection = 'asc' | 'desc'

const actionOptions: Array<InstallmentHistoryAction | 'all'> = ['all', 'new', 'edited', 'deleted']
const sourceOptions: Array<InstallmentHistorySource | 'all'> = ['all', 'in-house', 'home-credit']

function ActionBadge({ action }: { action: InstallmentHistoryAction }): React.JSX.Element {
  return (
    <Badge
      variant={action === 'deleted' ? 'destructive' : action === 'edited' ? 'outline' : 'secondary'}
    >
      {actionLabels[action]}
    </Badge>
  )
}

function TruncatedText({
  value,
  className
}: {
  value: string
  className?: string
}): React.JSX.Element {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger render={<span className={cn('block truncate', className)} />}>
          {value}
        </TooltipTrigger>
        <TooltipContent className="max-w-80">{value}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function historyRowActions(
  record: InstallmentHistoryRecord,
  viewDetails: () => void
): readonly RowActionItem[] {
  if (record.action === 'deleted') {
    return [{ id: 'view', label: 'View Details', onSelect: viewDetails }]
  }

  return [
    { id: 'view', label: 'View Details', onSelect: viewDetails },
    { id: 'edit', label: 'Edit Record', onSelect: viewDetails },
    {
      id: 'delete',
      label: 'Delete Record',
      onSelect: viewDetails,
      destructive: true,
      requiresConfirmation: true,
      confirmationMessage: 'Delete history record?'
    }
  ]
}

export function InstallmentHistoryTable({
  records,
  selectedId,
  onSelect,
  onDoubleClick,
  isLoading = false
}: InstallmentHistoryTableProps): React.JSX.Element {
  const [search, setSearch] = React.useState('')
  const [action, setAction] = React.useState<InstallmentHistoryAction | 'all'>('all')
  const [source, setSource] = React.useState<InstallmentHistorySource | 'all'>('all')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')
  const [contextMenu, setContextMenu] = React.useState({ rowId: '', signal: 0 })

  const visibleRecords = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return records
      .filter((record) => action === 'all' || record.action === action)
      .filter((record) => source === 'all' || record.source === source)
      .filter(
        (record) =>
          !query ||
          `${record.accountName} ${record.activity} ${record.reference ?? ''}`
            .toLowerCase()
            .includes(query)
      )
      .sort((left, right) => {
        const difference = left.occurredAt.localeCompare(right.occurredAt)
        return sortDirection === 'desc' ? -difference : difference
      })
  }, [action, records, search, sortDirection, source])

  const columns = React.useMemo<ColumnDef<InstallmentHistoryRecord>[]>(
    () => [
      {
        id: 'action',
        accessorKey: 'action',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Action" />,
        enableSorting: false,
        size: 90,
        meta: {
          headerTitle: 'Action',
          headerClassName: 'text-xs uppercase tracking-wide text-muted-foreground'
        },
        cell: ({ row }) => <ActionBadge action={row.original.action} />
      },
      {
        id: 'source',
        accessorKey: 'source',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Source" />,
        enableSorting: false,
        size: 100,
        meta: {
          headerTitle: 'Source',
          headerClassName: 'text-xs uppercase tracking-wide text-muted-foreground',
          cellClassName: 'text-xs text-muted-foreground'
        },
        cell: ({ row }) => sourceLabels[row.original.source]
      },
      {
        id: 'account',
        accessorKey: 'accountName',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Account" />,
        enableSorting: false,
        size: 200,
        meta: {
          headerTitle: 'Account',
          headerClassName: 'text-xs uppercase tracking-wide text-muted-foreground',
          cellClassName: 'min-w-0',
          autoSize: true
        },
        cell: ({ row }) => (
          <div className="min-w-0">
            <TruncatedText value={row.original.accountName} className="text-xs font-medium" />
            {row.original.reference && (
              <span className="block truncate text-[11px] text-muted-foreground">
                {row.original.reference}
              </span>
            )}
          </div>
        )
      },
      {
        id: 'activity',
        accessorKey: 'activity',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Activity" />,
        enableSorting: false,
        size: 200,
        meta: {
          headerTitle: 'Activity',
          headerClassName: 'text-xs uppercase tracking-wide text-muted-foreground',
          cellClassName: 'min-w-0'
        },
        cell: ({ row }) => (
          <TruncatedText value={row.original.activity} className="text-xs text-muted-foreground" />
        )
      },
      {
        id: 'amount',
        accessorKey: 'amount',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Amount" />,
        enableSorting: false,
        size: 100,
        meta: {
          headerTitle: 'Amount',
          headerClassName: 'text-right text-xs uppercase tracking-wide text-foreground',
          cellClassName: 'text-right text-xs font-medium tabular-nums text-foreground'
        },
        cell: ({ row }) => formatHistoryMoney(row.original.amount)
      },
      {
        id: 'balance',
        accessorKey: 'balance',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Balance" />,
        enableSorting: false,
        size: 100,
        meta: {
          headerTitle: 'Balance',
          headerClassName: 'text-right text-xs uppercase tracking-wide text-foreground',
          cellClassName: 'text-right text-xs font-medium tabular-nums text-foreground'
        },
        cell: ({ row }) => formatHistoryMoney(row.original.balance)
      },
      {
        id: 'occurredAt',
        accessorKey: 'occurredAt',
        header: ({ column }) => <DataGridColumnHeader column={column} title="Date & Time" />,
        enableSorting: false,
        size: 176,
        meta: {
          headerTitle: 'Date & Time',
          headerClassName: 'text-xs uppercase tracking-wide text-muted-foreground',
          cellClassName: 'text-xs text-muted-foreground'
        },
        cell: ({ row }) => formatHistoryDateTime(row.original.occurredAt)
      },
      createRowActionsColumn<InstallmentHistoryRecord>({
        label: 'Open history actions',
        getActions: (row) => historyRowActions(row, () => onSelect(row)),
        getOpenSignal: (rowId) => (contextMenu.rowId === rowId ? contextMenu.signal : undefined)
      })
    ],
    [contextMenu, onSelect]
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages reactive table state internally.
  const table = useReactTable({
    data: visibleRecords,
    columns,
    state: {
      rowSelection: selectedId ? { [selectedId]: true } : {}
    },
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: 25 } }
  })

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <div className="relative min-w-52 max-w-md flex-1">
          <Search
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search account or activity..."
            aria-label="Search account or activity"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select
          value={action}
          onValueChange={(value) => setAction(value as InstallmentHistoryAction | 'all')}
        >
          <SelectTrigger size="sm" className="w-28" aria-label="Filter by action">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            {actionOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option === 'all' ? 'All actions' : actionLabels[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={source}
          onValueChange={(value) => setSource(value as InstallmentHistorySource | 'all')}
        >
          <SelectTrigger size="sm" className="w-32" aria-label="Filter by source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            {sourceOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option === 'all' ? 'All sources' : sourceLabels[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <button
          type="button"
          className="ml-auto inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs text-muted-foreground hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          onClick={() => setSortDirection((direction) => (direction === 'desc' ? 'asc' : 'desc'))}
          aria-label={`Sort date and time ${sortDirection === 'desc' ? 'oldest first' : 'newest first'}`}
        >
          {sortDirection === 'desc' ? (
            <ArrowDown aria-hidden="true" />
          ) : (
            <ArrowUp aria-hidden="true" />
          )}{' '}
          Date &amp; time
        </button>
      </div>
      <UniversalDataTable
        table={table}
        recordCount={visibleRecords.length}
        isLoading={isLoading}
        emptyMessage={records.length === 0 ? 'No installment history yet' : 'No matching history.'}
        onRowDoubleClick={onDoubleClick}
        onRowContextMenu={(record, event) => {
          event.preventDefault()
          setContextMenu((current) => ({
            rowId: record.id,
            signal: current.signal + 1
          }))
        }}
        paginationSizes={[15, 25, 50, 100]}
        paginationInfo="{from}-{to} of {count} records"
        tableLayout={{ columnsResizable: true }}
      />
    </div>
  )
}
