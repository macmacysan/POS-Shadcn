import * as React from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type OnChangeFn,
  type PaginationState,
  type SortingState,
  useReactTable
} from '@tanstack/react-table'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  createRowActionsColumn,
  type RowActionItem
} from '@/components/shared/data-table/row-actions'
import { DataGridColumnHeader } from '@/components/ui/reui/data-grid/data-grid-column-header'
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll
} from '@/components/ui/reui/data-grid/data-grid-table'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { TableToolbar } from '@/components/shared/data-table/table-toolbar'
import { ReuiFilters } from '@/components/shared/data-table/reui-filters'
import type { Filter } from '@/../../components/reui/filters'
import { cn } from '@/lib/utils'

export type ReportRow = { id: string }

export type ReportColumn<TData extends ReportRow> = ColumnDef<TData>

const reportPaginationSizes = [15, 25, 50, 100]
const reportTableLayout = { columnsResizable: true, headerBackground: true } as const

type ReportDataTableProps<TData extends ReportRow> = {
  columns: ReportColumn<TData>[]
  data: TData[]
  filterPlaceholder?: string
  onAddEntry?: () => void
  addEntryLabel?: string
  getRowActions?: (row: TData) => readonly RowActionItem[]
  onDefaultAction?: (row: TData) => void
  onDeleteSelected?: (rows: TData[]) => boolean | Promise<boolean>
  isLoading?: boolean
  loadError?: string
  onRetry?: () => void
  globalFilterValue?: string
  onGlobalFilterValueChange?: (value: string) => void
  serverState?: {
    pagination: PaginationState
    pageCount: number
    sorting: SortingState
    columnFilters: ColumnFiltersState
    globalFilter: string
    onPaginationChange: OnChangeFn<PaginationState>
    onSortingChange: OnChangeFn<SortingState>
    onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
    onGlobalFilterChange: OnChangeFn<string>
    totalRows: number
    loading: boolean
    error?: string
    refresh?: () => void
  }
  filterOptions?: Record<string, readonly string[]>
}

function getHeaderTitle<TData extends ReportRow>(column: ReportColumn<TData>): string {
  if (typeof column.header === 'string') return column.header
  if ('accessorKey' in column && typeof column.accessorKey === 'string') {
    return column.accessorKey
      .replace(/([A-Z])/g, ' $1')
      .replace(/^./, (value) => value.toUpperCase())
  }
  return column.id ?? 'Column'
}

function resolveUpdater<T>(updater: T | ((current: T) => T), current: T): T {
  return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater
}

export function ReportDataTable<TData extends ReportRow>({
  columns,
  data,
  filterPlaceholder = 'Filter rows...',
  onAddEntry,
  addEntryLabel = 'Add Entry',
  getRowActions,
  onDefaultAction,
  onDeleteSelected,
  isLoading,
  loadError,
  onRetry,
  globalFilterValue,
  onGlobalFilterValueChange,
  serverState,
  filterOptions
}: ReportDataTableProps<TData>): React.JSX.Element {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [rowSelection, setRowSelection] = React.useState({})
  const [contextMenu, setContextMenu] = React.useState({ rowId: '', signal: 0 })
  const handleRowContextMenu = React.useCallback(
    (row: TData, event: React.MouseEvent<HTMLTableRowElement>) => {
      event.preventDefault()
      setContextMenu((current) => ({
        rowId: row.id,
        signal: current.signal + 1
      }))
    },
    []
  )

  const tableColumns = React.useMemo<ColumnDef<TData>[]>(
    () => [
      {
        id: 'select',
        enableSorting: false,
        enableColumnFilter: false,
        enableHiding: false,
        size: 42,
        header: () => <DataGridTableRowSelectAll />,
        cell: ({ row }) => <DataGridTableRowSelect row={row} />,
        meta: {
          headerClassName: 'w-[42px]',
          cellClassName: 'w-[42px]'
        }
      },
      ...(columns.map((column) => {
        const headerTitle = getHeaderTitle(column)
        const legacyMeta = column.meta as { className?: string } | undefined

        return {
          ...column,
          header: ({ column: tableColumn }) => (
            <DataGridColumnHeader column={tableColumn} title={headerTitle} />
          ),
          meta: {
            ...column.meta,
            headerTitle,
            headerClassName: cn('text-xs font-medium text-muted-foreground', legacyMeta?.className),
            cellClassName: cn('max-w-72 truncate align-middle text-xs', legacyMeta?.className)
          }
        }
      }) as ColumnDef<TData>[]),
      ...(getRowActions
        ? [
            createRowActionsColumn<TData>({
              label: 'Open row actions',
              getActions: getRowActions,
              getOpenSignal: (rowId) =>
                contextMenu.rowId === rowId ? contextMenu.signal : undefined
            })
          ]
        : [])
    ],
    [columns, contextMenu, getRowActions]
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages reactive table state internally.
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: {
      sorting: serverState?.sorting ?? sorting,
      columnFilters: serverState?.columnFilters ?? columnFilters,
      globalFilter: serverState?.globalFilter ?? globalFilterValue ?? globalFilter,
      rowSelection,
      ...(serverState ? { pagination: serverState.pagination } : {})
    },
    enableRowSelection: true,
    onSortingChange: serverState?.onSortingChange ?? setSorting,
    onColumnFiltersChange: serverState?.onColumnFiltersChange ?? setColumnFilters,
    onGlobalFilterChange: serverState?.onGlobalFilterChange ??
      (onGlobalFilterValueChange
        ? (updater) => {
            const next = resolveUpdater(updater, globalFilterValue ?? globalFilter)
            onGlobalFilterValueChange(next)
          }
        : setGlobalFilter),
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    manualFiltering: Boolean(serverState),
    manualSorting: Boolean(serverState),
    manualPagination: Boolean(serverState),
    pageCount: serverState?.pageCount,
    initialState: { pagination: { pageSize: 50 } }
  })

  const filterableColumns = columns.filter(
    (column): column is ReportColumn<TData> & { accessorKey: string } =>
      'accessorKey' in column &&
      typeof column.accessorKey === 'string' &&
      (!serverState || Boolean(filterOptions?.[column.accessorKey]))
  )
  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original)
  const filteredRowCount = serverState?.totalRows ?? table.getFilteredRowModel().rows.length
  const currentGlobalFilter = serverState?.globalFilter ?? globalFilterValue ?? globalFilter
  const currentColumnFilters = serverState?.columnFilters ?? columnFilters
  const filterFields = React.useMemo(
    () => [
      {
        key: 'global',
        label: 'Search all columns',
        type: 'text' as const,
        placeholder: filterPlaceholder
      },
      ...filterableColumns.map((column) => {
        const key = column.accessorKey
        const options = filterOptions?.[key]
          ? [...filterOptions[key]].sort()
          : Array.from(new Set(data.map((row) => String(row[key as keyof TData] ?? ''))))
              .filter(Boolean)
              .sort()
        return {
          key,
          label: getHeaderTitle(column),
          type: 'select' as const,
          searchable: options.length > 8,
          options: options.map((value) => ({ value, label: value }))
        }
      })
    ],
    [data, filterOptions, filterPlaceholder, filterableColumns]
  )
  const reuiFilters = React.useMemo<Filter<string>[]>(() => {
    const next: Filter<string>[] = []
    if (currentGlobalFilter.trim()) {
      next.push({
        id: 'global-filter',
        field: 'global',
        operator: 'contains',
        values: [currentGlobalFilter]
      })
    }
    for (const item of currentColumnFilters) {
      if (typeof item.value !== 'string' || !item.value) continue
      next.push({
        id: `column-filter-${String(item.id)}`,
        field: String(item.id),
        operator: 'is',
        values: [item.value]
      })
    }
    return next
  }, [currentColumnFilters, currentGlobalFilter])

  const handleReuiFiltersChange = (next: Filter<string>[]): void => {
    const global = next.find((filter) => filter.field === 'global')?.values[0] ?? ''
    const columns = next
      .filter((filter) => filter.field !== 'global' && filter.values[0])
      .map((filter) => ({ id: filter.field, value: filter.values[0] }))
    table.setGlobalFilter(global)
    onGlobalFilterValueChange?.(global)
    table.setColumnFilters(columns)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TableToolbar className="px-4 min-[901px]:flex-nowrap">
        <ReuiFilters
          filters={reuiFilters}
          fields={filterFields}
          onChange={handleReuiFiltersChange}
          className="min-w-0 flex-1"
        />
        <div className="ml-auto flex shrink-0 items-center gap-2">
          {onDeleteSelected && selectedRows.length > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (await onDeleteSelected(selectedRows)) setRowSelection({})
              }}
            >
              <Trash2 data-icon="inline-start" aria-hidden="true" />
              Delete ({selectedRows.length})
            </Button>
          )}
          {onAddEntry && (
            <Button type="button" size="sm" className="shrink-0" onClick={onAddEntry}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              {addEntryLabel}
            </Button>
          )}
        </div>
      </TableToolbar>

      {loadError && data.length > 0 && (
        <div
          role="alert"
          className="flex shrink-0 items-center justify-between gap-3 border-b border-destructive/30 bg-destructive/5 px-4 py-2 text-xs text-destructive"
        >
          <span>{loadError}</span>
          {onRetry && (
            <Button type="button" variant="outline" size="xs" onClick={onRetry}>
              Retry
            </Button>
          )}
        </div>
      )}

      <UniversalDataTable
        table={table}
        recordCount={filteredRowCount}
        isLoading={serverState?.loading ?? isLoading}
        error={serverState?.error ?? (data.length === 0 ? loadError : undefined)}
        onRetry={serverState?.refresh ?? onRetry}
        onRowDoubleClick={onDefaultAction}
        onRowContextMenu={getRowActions ? handleRowContextMenu : undefined}
        emptyMessage="No matching entries."
        tableLayout={reportTableLayout}
        paginationSizes={reportPaginationSizes}
        paginationInfo="{from}-{to} of {count} entries"
        paginationClassName="px-4"
      />
    </div>
  )
}
