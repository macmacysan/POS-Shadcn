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
import { FileText, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'

export type ReportRow = { id: string; source?: 'local' | 'google-cache' }

export type ReportColumn<TData extends ReportRow> = ColumnDef<TData>

const reportPaginationSizes = [50, 100]

type ReportDataTableProps<TData extends ReportRow> = {
  columns: ReportColumn<TData>[]
  data: TData[]
  filterPlaceholder?: string
  onAddEntry?: () => void
  addEntryLabel?: string
  getRowActions?: (row: TData) => readonly RowActionItem[]
  onDefaultAction?: (row: TData) => void
  onVoidSelected?: (rows: TData[]) => boolean | Promise<boolean>
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
  additionalFilterFields?: ShadcnFilterField[]
  toolbarContent?: React.ReactNode
  emptyStateFooter?: React.ReactNode
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
  onVoidSelected,
  isLoading,
  loadError,
  onRetry,
  globalFilterValue,
  onGlobalFilterValueChange,
  serverState,
  filterOptions,
  additionalFilterFields,
  toolbarContent,
  emptyStateFooter
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
      ...(columns.map((column) => {
        const headerTitle = getHeaderTitle(column)
        const legacyMeta = column.meta as { className?: string } | undefined

        return {
          ...column,
          header: headerTitle,
          meta: {
            ...column.meta,
            headerTitle,
            headerClassName: cn('text-xs font-medium text-muted-foreground', legacyMeta?.className),
            cellClassName: cn('align-middle text-xs', legacyMeta?.className)
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
    enableRowSelection: (row) => row.original.source !== 'google-cache',
    onSortingChange: serverState?.onSortingChange ?? setSorting,
    onColumnFiltersChange: serverState?.onColumnFiltersChange ?? setColumnFilters,
    onGlobalFilterChange:
      serverState?.onGlobalFilterChange ??
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
  const shadcnFilterFields = React.useMemo<ShadcnFilterField[]>(
    () => [
      {
        key: 'search',
        label: 'Search entries',
        type: 'text',
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
          options: options.map((value) => ({ value, label: value }))
        }
      }),
      ...(additionalFilterFields ?? [])
    ],
    [additionalFilterFields, data, filterOptions, filterPlaceholder, filterableColumns]
  )

  const handleShadcnFiltersChange = (
    next: Array<{ field: string; value: string }>
  ): void => {
    table.setGlobalFilter(next.find((filter) => filter.field === 'search')?.value ?? '')
    table.setColumnFilters(
      next
        .filter((filter) => filter.field !== 'search')
        .map(({ field, value }) => ({ id: field, value }))
    )
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 basis-0 flex-col">
      <TableToolbar className="flex-wrap gap-3 border-b-0 bg-transparent px-4 py-3">
        <ShadcnTableFilters
          fields={shadcnFilterFields}
          filters={[
            ...(currentGlobalFilter ? [{ field: 'search', value: currentGlobalFilter }] : []),
            ...currentColumnFilters.flatMap((item) =>
              typeof item.value === 'string' && item.value
                ? [{ field: item.id, value: item.value }]
                : []
            )
          ]}
          onChange={handleShadcnFiltersChange}
          className="shrink-0"
        />
        <div className="ml-auto flex max-w-full flex-wrap items-center justify-end gap-2">
          {toolbarContent}
          {onVoidSelected && selectedRows.length > 0 && (
            <Button
              type="button"
              variant="destructive"
              size="sm"
              onClick={async () => {
                if (await onVoidSelected(selectedRows)) setRowSelection({})
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

      <div
        className={cn(
          'mx-4 flex min-h-0 min-w-0 flex-1 basis-0 flex-col overflow-hidden rounded-lg border border-border/70 bg-card'
        )}
      >
        <UniversalDataTable
          table={table}
          recordCount={filteredRowCount}
          isLoading={serverState?.loading ?? isLoading}
          error={serverState?.error ?? (data.length === 0 ? loadError : undefined)}
          onRetry={serverState?.refresh ?? onRetry}
          onRowDoubleClick={onDefaultAction}
          onRowContextMenu={getRowActions ? handleRowContextMenu : undefined}
          emptyMessage="No matching entries."
          paginationSizes={reportPaginationSizes}
          paginationInfo="{from}-{to} of {count} entries"
          paginationClassName="px-4"
        />
        {emptyStateFooter && data.length > 0 && data.length < 5 && (
          <div className="flex flex-col items-center justify-center px-4 py-10 text-center">
          <div className="h-9 w-9 rounded-full border border-border bg-muted flex items-center justify-center mb-2.5">
            <FileText size={15} className="text-muted-foreground" />
          </div>
          <p className="text-[13px] font-medium text-muted-foreground">{emptyStateFooter}</p>
          <p className="text-[12px] text-muted-foreground mt-0.5">
            New entries you add will show up above this line.
          </p>
          </div>
        )}
      </div>
    </div>
  )
}
