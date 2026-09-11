import * as React from 'react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnDef,
  type SortingState
} from '@tanstack/react-table'
import { Trash2 } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  createRowActionsColumn,
  type RowActionItem
} from '@/components/shared/data-table/row-actions'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { TableToolbar } from '@/components/shared/data-table/table-toolbar'
import {
  ShadcnTableFilters,
  type ShadcnFilterField
} from '@/components/shared/data-table/shadcn-table-filters'
import { VoidEntryDialog } from '@/components/shared/void-entry-dialog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  formatHistoryDateTime,
  formatHistoryMoney,
  historyActionLabel,
  sourceLabels,
  type InstallmentHistoryRecord,
  type InstallmentHistorySource
} from '@/lib/installment-history'

type InstallmentHistoryTableProps = {
  records: InstallmentHistoryRecord[]
  selectedId?: string
  onSelect: (record: InstallmentHistoryRecord) => void
  onDoubleClick: (record: InstallmentHistoryRecord) => void
  isLoading?: boolean
  selectedBranch?: string
  dateFrom?: string
  dateTo?: string
  onVisibleRecordCountChange?: (count: number) => void
  afterFiltersContent?: React.ReactNode
  trailingToolbarContent?: React.ReactNode
  onVoidSelected: (records: InstallmentHistoryRecord[], reason: string) => Promise<void>
}

const sourceOptions: Array<InstallmentHistorySource | 'all'> = [
  'all',
  'in-house',
  'home-credit',
  'finance'
]
const historyPaginationSizes = [50, 100]

const historyBranchColumn: ColumnDef<InstallmentHistoryRecord> = {
  id: 'branch',
  accessorKey: 'branch',
  header: 'Branch',
  enableSorting: true,
  size: 42,
  meta: {
    headerTitle: 'Branch',
    headerClassName: 'text-xs text-muted-foreground',
    cellClassName: 'text-xs text-muted-foreground'
  },
  cell: ({ row }) => row.original.branch
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
  if (record.source === 'in-house' && record.activity.toLowerCase().includes('payment')) {
    return [{ id: 'view', label: 'Open payment in ledger', onSelect: viewDetails }]
  }

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

function canVoidHistoryRecord(record: InstallmentHistoryRecord): boolean {
  if (record.action === 'deleted' || record.source !== 'in-house') return false
  const activity = record.activity.toLowerCase()
  return activity.includes('payment') || activity === 'installment record added'
}

export function InstallmentHistoryTable({
  records,
  onSelect,
  onDoubleClick,
  isLoading = false,
  selectedBranch = 'All Branch',
  dateFrom,
  dateTo,
  onVisibleRecordCountChange,
  afterFiltersContent,
  trailingToolbarContent,
  onVoidSelected
}: InstallmentHistoryTableProps): React.JSX.Element {
  const [action, setAction] = React.useState<string>('all')
  const [branch, setBranch] = React.useState(selectedBranch)
  const [source, setSource] = React.useState<InstallmentHistorySource | 'all'>('all')
  const [date, setDate] = React.useState('all')
  const [sorting, setSorting] = React.useState<SortingState>([{ id: 'occurredAt', desc: true }])
  const [contextMenu, setContextMenu] = React.useState({ rowId: '', signal: 0 })
  const [rowSelection, setRowSelection] = React.useState<Record<string, boolean>>({})
  const [isVoidDialogOpen, setIsVoidDialogOpen] = React.useState(false)
  const filterFields = React.useMemo<ShadcnFilterField[]>(
    () => [
      {
        key: 'action',
        label: 'Action',
        options: [...new Set(records.map((record) => historyActionLabel(record)))]
          .sort()
          .map((value) => ({
            value,
            label: value
          }))
      },
      {
        key: 'source',
        label: 'Source',
        options: sourceOptions
          .filter((option) => option !== 'all')
          .map((option) => ({ value: option, label: sourceLabels[option] }))
      },
      {
        key: 'branch',
        label: 'Branch',
        options: [
          ...new Set([
            ...(selectedBranch === 'All Branch' ? records.map((record) => record.branch) : []),
            selectedBranch
          ])
        ]
          .filter((option) => option !== 'All Branch')
          .sort()
          .map((value) => ({ value, label: value }))
      },
      {
        key: 'date',
        label: 'Date',
        options: [...new Set(records.map((record) => record.occurredAt.slice(0, 10)))]
          .sort()
          .map((value) => ({
            value,
            label: value
          }))
      }
    ],
    [records, selectedBranch]
  )
  const filters = React.useMemo(() => {
    const next: Array<{ field: string; value: string }> = []
    if (action !== 'all') next.push({ field: 'action', value: action })
    if (source !== 'all') next.push({ field: 'source', value: source })
    if (branch !== 'All Branch') next.push({ field: 'branch', value: branch })
    if (date !== 'all') next.push({ field: 'date', value: date })
    return next
  }, [action, branch, date, source])
  const handleFiltersChange = (next: Array<{ field: string; value: string }>): void => {
    setAction(next.find((filter) => filter.field === 'action')?.value ?? 'all')
    setSource(
      (next.find((filter) => filter.field === 'source')?.value as
        InstallmentHistorySource | undefined) ?? 'all'
    )
    setBranch(next.find((filter) => filter.field === 'branch')?.value ?? 'All Branch')
    setDate(next.find((filter) => filter.field === 'date')?.value ?? 'all')
  }
  const handleRowContextMenu = React.useCallback(
    (record: InstallmentHistoryRecord, event: React.MouseEvent<HTMLTableRowElement>) => {
      event.preventDefault()
      setContextMenu((current) => ({
        rowId: record.id,
        signal: current.signal + 1
      }))
    },
    []
  )

  const visibleRecords = React.useMemo(() => {
    return records
      .filter((record) => action === 'all' || historyActionLabel(record) === action)
      .filter((record) => source === 'all' || record.source === source)
      .filter((record) => branch === 'All Branch' || record.branch === branch)
      .filter((record) => date === 'all' || record.occurredAt.slice(0, 10) === date)
      .filter((record) => !dateFrom || record.occurredAt.slice(0, 10) >= dateFrom)
      .filter((record) => !dateTo || record.occurredAt.slice(0, 10) <= dateTo)
  }, [action, date, dateFrom, dateTo, records, branch, source])

  React.useEffect(() => {
    onVisibleRecordCountChange?.(visibleRecords.length)
  }, [onVisibleRecordCountChange, visibleRecords.length])

  const columns = React.useMemo<ColumnDef<InstallmentHistoryRecord>[]>(
    () => [
      ...(selectedBranch === 'All Branch' ? [historyBranchColumn] : []),
      {
        id: 'action',
        accessorKey: 'action',
        header: 'Action',
        enableSorting: true,
        size: 76,
        meta: {
          headerTitle: 'Action',
          headerClassName: 'text-xs text-muted-foreground'
        },
        cell: ({ row }) => (
          <Badge
            variant={historyActionLabel(row.original) === 'Voided' ? 'destructive' : 'secondary'}
          >
            {historyActionLabel(row.original)}
          </Badge>
        )
      },
      {
        id: 'source',
        accessorKey: 'source',
        header: 'Source',
        enableSorting: true,
        size: 86,
        meta: {
          headerTitle: 'Source',
          headerClassName: 'text-xs text-muted-foreground',
          cellClassName: 'text-xs text-muted-foreground'
        },
        cell: ({ row }) => sourceLabels[row.original.source]
      },
      {
        id: 'account',
        accessorKey: 'accountName',
        header: 'Account',
        enableSorting: true,
        size: 200,
        meta: {
          headerTitle: 'Account',
          headerClassName: 'text-xs text-muted-foreground',
          cellClassName: 'min-w-0'
        },
        cell: ({ row }) => (
          <div className="min-w-0">
            <TruncatedText value={row.original.accountName} className="text-xs font-light" />
          </div>
        )
      },
      {
        id: 'activity',
        accessorKey: 'activity',
        header: 'Activity',
        enableSorting: true,
        size: 200,
        meta: {
          headerTitle: 'Activity',
          headerClassName: 'text-xs text-muted-foreground',
          cellClassName: 'min-w-0'
        },
        cell: ({ row }) => (
          <TruncatedText value={row.original.activity} className="text-xs text-muted-foreground" />
        )
      },
      {
        id: 'amount',
        accessorKey: 'amount',
        header: 'Amount',
        enableSorting: true,
        size: 100,
        meta: {
          headerTitle: 'Amount',
          headerClassName: 'text-right text-xs text-foreground',
          cellClassName: 'text-right text-xs font-light tabular-nums text-foreground'
        },
        cell: ({ row }) => formatHistoryMoney(row.original.amount)
      },
      {
        id: 'balance',
        accessorKey: 'balance',
        header: 'Balance',
        enableSorting: true,
        size: 100,
        meta: {
          headerTitle: 'Balance',
          headerClassName: 'text-right text-xs text-foreground',
          cellClassName: 'text-right text-xs font-light tabular-nums text-foreground'
        },
        cell: ({ row }) =>
          formatHistoryMoney(
            row.original.balance ??
              (row.original.balanceCentavos === undefined
                ? undefined
                : row.original.balanceCentavos / 100)
          )
      },
      {
        id: 'penalty',
        accessorKey: 'penaltyCentavos',
        header: 'Penalty',
        enableSorting: true,
        size: 100,
        meta: {
          headerTitle: 'Penalty',
          headerClassName: 'text-right text-xs text-foreground',
          cellClassName: 'text-right text-xs font-light tabular-nums text-foreground'
        },
        cell: ({ row }) => (
          <span
            className={cn(
              row.original.penaltyCentavos === 0 ? 'text-muted-foreground' : 'text-warning'
            )}
          >
            {formatHistoryMoney(
              row.original.penaltyCentavos === undefined
                ? undefined
                : row.original.penaltyCentavos / 100
            )}
          </span>
        )
      },
      {
        id: 'occurredAt',
        accessorKey: 'occurredAt',
        header: 'Date & time',
        enableSorting: true,
        size: 140,
        meta: {
          headerTitle: 'Date & time',
          headerClassName: 'text-xs text-muted-foreground',
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
    [contextMenu, onSelect, selectedBranch]
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages reactive table state internally.
  const table = useReactTable({
    data: visibleRecords,
    columns,
    state: {
      rowSelection,
      sorting
    },
    enableRowSelection: (row) => canVoidHistoryRecord(row.original),
    onRowSelectionChange: setRowSelection,
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: 50 } }
  })

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TableToolbar className="-mt-14 ml-auto w-fit max-w-full flex-nowrap gap-3 border-b-0 bg-transparent px-4 py-3">
        <ShadcnTableFilters
          filters={filters}
          fields={filterFields}
          onChange={handleFiltersChange}
          className="shrink-0"
        />
        {afterFiltersContent}
        {trailingToolbarContent}
        {Object.keys(rowSelection).length > 0 && (
          <Button
            type="button"
            variant="destructive"
            size="sm"
            onClick={() => setIsVoidDialogOpen(true)}
          >
            <Trash2 data-icon="inline-start" aria-hidden="true" />
            Void ({Object.keys(rowSelection).length})
          </Button>
        )}
      </TableToolbar>
      <div className="mx-4 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-background">
        <UniversalDataTable
          table={table}
          recordCount={visibleRecords.length}
          isLoading={isLoading}
          emptyMessage={
            records.length === 0 ? 'No installment history yet' : 'No matching history.'
          }
          onRowDoubleClick={onDoubleClick}
          onRowContextMenu={handleRowContextMenu}
          paginationSizes={historyPaginationSizes}
          paginationInfo="{from}-{to} of {count} records"
          paginationClassName="px-4"
        />
      </div>
      <VoidEntryDialog
        open={isVoidDialogOpen}
        label={`${Object.keys(rowSelection).length} selected payment${Object.keys(rowSelection).length === 1 ? '' : 's'}`}
        onOpenChange={setIsVoidDialogOpen}
        onConfirm={async (reason) => {
          await onVoidSelected(
            records.filter((record) => rowSelection[record.id]),
            reason
          )
          setRowSelection({})
        }}
      />
    </div>
  )
}
