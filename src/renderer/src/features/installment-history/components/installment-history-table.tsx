import * as React from 'react'
import {
  getCoreRowModel,
  getPaginationRowModel,
  useReactTable,
  type ColumnDef
} from '@tanstack/react-table'
import { ArrowDown, ArrowUp } from 'lucide-react'

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  createRowActionsColumn,
  type RowActionItem
} from '@/components/shared/data-table/row-actions'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { TableToolbar } from '@/components/shared/data-table/table-toolbar'
import { ReuiFilters } from '@/components/shared/data-table/reui-filters'
import type { Filter } from '@/../../components/reui/filters'
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
  selectedBranch?: string
  dateFrom?: string
  dateTo?: string
  globalSearch?: string
  onGlobalSearchChange?: (value: string) => void
}

type SortDirection = 'asc' | 'desc'

const actionOptions: Array<InstallmentHistoryAction | 'all'> = ['all', 'new', 'edited', 'deleted']
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
  enableSorting: false,
  size: 90,
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
  isLoading = false,
  selectedBranch = 'All Branch',
  dateFrom,
  dateTo,
  globalSearch,
  onGlobalSearchChange
}: InstallmentHistoryTableProps): React.JSX.Element {
  const [search, setSearch] = React.useState('')
  const searchValue = globalSearch ?? search
  const [action, setAction] = React.useState<InstallmentHistoryAction | 'all'>('all')
  const [source, setSource] = React.useState<InstallmentHistorySource | 'all'>('all')
  const [branch, setBranch] = React.useState('all')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')
  const [contextMenu, setContextMenu] = React.useState({ rowId: '', signal: 0 })
  const filterFields = React.useMemo(
    () => [
      {
        key: 'search',
        label: 'Search history',
        type: 'text' as const,
        placeholder: 'Search account, activity, or reference...'
      },
      {
        key: 'action',
        label: 'Action',
        type: 'select' as const,
        options: actionOptions
          .filter((option) => option !== 'all')
          .map((option) => ({ value: option, label: actionLabels[option] }))
      },
      {
        key: 'source',
        label: 'Source',
        type: 'select' as const,
        options: sourceOptions
          .filter((option) => option !== 'all')
          .map((option) => ({ value: option, label: sourceLabels[option] }))
      },
      ...(selectedBranch === 'All Branch'
        ? [
            {
              key: 'branch',
              label: 'Branch',
              type: 'select' as const,
              options: ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'].map((value) => ({
                value,
                label: value
              }))
            }
          ]
        : [])
    ],
    [selectedBranch]
  )
  const filters = React.useMemo<Filter<string>[]>(() => {
    const next: Filter<string>[] = []
    if (searchValue.trim())
      next.push({
        id: 'history-search',
        field: 'search',
        operator: 'contains',
        values: [searchValue]
      })
    if (action !== 'all')
      next.push({ id: 'history-action', field: 'action', operator: 'is', values: [action] })
    if (source !== 'all')
      next.push({ id: 'history-source', field: 'source', operator: 'is', values: [source] })
    if (branch !== 'all')
      next.push({ id: 'history-branch', field: 'branch', operator: 'is', values: [branch] })
    return next
  }, [action, branch, searchValue, source])
  const handleFiltersChange = (next: Filter<string>[]): void => {
    const nextSearch = next.find((filter) => filter.field === 'search')?.values[0] ?? ''
    setSearch(nextSearch)
    onGlobalSearchChange?.(nextSearch)
    setAction(
      (next.find((filter) => filter.field === 'action')?.values[0] as
        InstallmentHistoryAction | undefined) ?? 'all'
    )
    setSource(
      (next.find((filter) => filter.field === 'source')?.values[0] as
        InstallmentHistorySource | undefined) ?? 'all'
    )
    setBranch(next.find((filter) => filter.field === 'branch')?.values[0] ?? 'all')
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
    const query = searchValue.trim().toLowerCase()
    return records
      .filter((record) => action === 'all' || record.action === action)
      .filter((record) => source === 'all' || record.source === source)
      .filter((record) => selectedBranch === 'All Branch' || record.branch === selectedBranch)
      .filter((record) => branch === 'all' || record.branch === branch)
      .filter((record) => !dateFrom || record.occurredAt.slice(0, 10) >= dateFrom)
      .filter((record) => !dateTo || record.occurredAt.slice(0, 10) <= dateTo)
      .filter(
        (record) =>
          !query ||
          `${record.accountName} ${record.activity} ${record.reference ?? ''} ${sourceLabels[record.source]} ${actionLabels[record.action]} ${record.amount} ${record.balance} ${record.occurredAt}`
            .toLowerCase()
            .includes(query)
      )
      .sort((left, right) => {
        const difference = left.occurredAt.localeCompare(right.occurredAt)
        return sortDirection === 'desc' ? -difference : difference
      })
  }, [
    action,
    branch,
    dateFrom,
    dateTo,
    records,
    searchValue,
    selectedBranch,
    sortDirection,
    source
  ])

  const columns = React.useMemo<ColumnDef<InstallmentHistoryRecord>[]>(
    () => [
      ...(selectedBranch === 'All Branch' ? [historyBranchColumn] : []),
      {
        id: 'action',
        accessorKey: 'action',
        header: 'Action',
        enableSorting: false,
        size: 90,
        meta: {
          headerTitle: 'Action',
          headerClassName: 'text-xs text-muted-foreground'
        },
        cell: ({ row }) => (
          <span className="text-muted-foreground">{actionLabels[row.original.action]}</span>
        )
      },
      {
        id: 'source',
        accessorKey: 'source',
        header: 'Source',
        enableSorting: false,
        size: 100,
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
        enableSorting: false,
        size: 200,
        meta: {
          headerTitle: 'Account',
          headerClassName: 'text-xs text-muted-foreground',
          cellClassName: 'min-w-0',
          autoSize: true
        },
        cell: ({ row }) => (
          <div className="min-w-0">
            <TruncatedText value={row.original.accountName} className="text-xs font-light" />
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
        header: 'Activity',
        enableSorting: false,
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
        enableSorting: false,
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
        enableSorting: false,
        size: 100,
        meta: {
          headerTitle: 'Balance',
          headerClassName: 'text-right text-xs text-foreground',
          cellClassName: 'text-right text-xs font-light tabular-nums text-foreground'
        },
        cell: ({ row }) => formatHistoryMoney(row.original.balance)
      },
      {
        id: 'occurredAt',
        accessorKey: 'occurredAt',
        header: 'Date & time',
        enableSorting: false,
        size: 176,
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
      rowSelection: selectedId ? { [selectedId]: true } : {}
    },
    enableRowSelection: true,
    getCoreRowModel: getCoreRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: { pagination: { pageSize: 50 } }
  })

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TableToolbar>
        <ReuiFilters
          filters={filters}
          fields={filterFields}
          onChange={handleFiltersChange}
          className="min-w-0 flex-1"
        />
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
      </TableToolbar>
      <UniversalDataTable
        table={table}
        recordCount={visibleRecords.length}
        isLoading={isLoading}
        emptyMessage={records.length === 0 ? 'No installment history yet' : 'No matching history.'}
        onRowDoubleClick={onDoubleClick}
        onRowContextMenu={handleRowContextMenu}
        paginationSizes={historyPaginationSizes}
        paginationInfo="{from}-{to} of {count} records"
      />
    </div>
  )
}
