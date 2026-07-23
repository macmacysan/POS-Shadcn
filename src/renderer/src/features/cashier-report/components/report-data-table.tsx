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
import { Filter, Plus, Search, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  createRowActionsColumn,
  type RowActionItem
} from '@/components/shared/data-table/row-actions'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { ScrollArea } from '@/components/ui/scroll-area'
import { DataGridColumnHeader } from '@/components/ui/reui/data-grid/data-grid-column-header'
import {
  DataGridTableRowSelect,
  DataGridTableRowSelectAll
} from '@/components/ui/reui/data-grid/data-grid-table'
import { UniversalDataTable } from '@/components/shared/data-table/universal-data-table'
import { ActiveFilterChip, TableToolbar } from '@/components/shared/data-table/table-toolbar'
import { cn } from '@/lib/utils'

export type ReportRow = { id: string }

export type ReportColumn<TData extends ReportRow> = ColumnDef<TData>

const reportPaginationSizes = [15, 25, 50, 100]
const reportTableLayout = { columnsResizable: true } as const

type ReportDataTableProps<TData extends ReportRow> = {
  columns: ReportColumn<TData>[]
  data: TData[]
  filterPlaceholder?: string
  onAddEntry?: () => void
  addEntryLabel?: string
  getRowActions?: (row: TData) => readonly RowActionItem[]
  onDefaultAction?: (row: TData) => void
  onDeleteSelected?: (rows: TData[]) => boolean | Promise<boolean>
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

export function ReportDataTable<TData extends ReportRow>({
  columns,
  data,
  filterPlaceholder = 'Filter rows...',
  onAddEntry,
  addEntryLabel = 'Add Entry',
  getRowActions,
  onDefaultAction,
  onDeleteSelected,
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
            headerClassName: cn(
              'text-xs uppercase tracking-wide text-muted-foreground',
              legacyMeta?.className
            ),
            cellClassName: cn('max-w-72 truncate align-middle', legacyMeta?.className)
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
      globalFilter: serverState?.globalFilter ?? globalFilter,
      rowSelection,
      ...(serverState ? { pagination: serverState.pagination } : {})
    },
    enableRowSelection: true,
    onSortingChange: serverState?.onSortingChange ?? setSorting,
    onColumnFiltersChange: serverState?.onColumnFiltersChange ?? setColumnFilters,
    onGlobalFilterChange: serverState?.onGlobalFilterChange ?? setGlobalFilter,
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
  const activeFilterCount = filterableColumns.reduce((count, column) => {
    const value = table.getColumn(column.accessorKey)?.getFilterValue()
    return count + (value ? 1 : 0)
  }, 0)
  const selectedRows = table.getSelectedRowModel().rows.map((row) => row.original)
  const filteredRowCount = serverState?.totalRows ?? table.getFilteredRowModel().rows.length
  const currentGlobalFilter = serverState?.globalFilter ?? globalFilter

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <TableToolbar className="px-4 min-[901px]:flex-nowrap">
        <InputGroup className="min-w-0 max-w-105 flex-1 max-[900px]:basis-full">
          <InputGroupAddon align="inline-start">
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Filter all columns"
            placeholder={filterPlaceholder}
            value={currentGlobalFilter}
            onChange={(event) => table.setGlobalFilter(event.target.value)}
          />
          {currentGlobalFilter.trim() && (
            <InputGroupAddon align="inline-end">
              <InputGroupText>{filteredRowCount} results</InputGroupText>
            </InputGroupAddon>
          )}
        </InputGroup>
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
          {filterableColumns.length > 0 && (
            <Popover>
              <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
                <Filter data-icon="inline-start" aria-hidden="true" />
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </PopoverTrigger>
              <PopoverContent
                align="end"
                side="bottom"
                className="h-[min(70vh,32rem)] overflow-hidden p-0"
              >
                <ScrollArea className="h-full">
                  <div className="flex flex-col gap-3 p-4">
                    <div>
                      <p className="text-sm font-medium">Filter entries</p>
                      <p className="text-xs text-muted-foreground">
                        Narrow the table by one or more fields.
                      </p>
                    </div>
                    {filterableColumns.map((column) => {
                      const key = column.accessorKey
                      const tableColumn = table.getColumn(key)
                      if (!tableColumn) return null
                      const options = filterOptions?.[key]
                        ? [...filterOptions[key]].sort()
                        : Array.from(
                            new Set(data.map((row) => String(row[key as keyof TData] ?? '')))
                          )
                            .filter(Boolean)
                            .sort()
                      const filterValue = (tableColumn.getFilterValue() as string) ?? ''
                      const label = key
                        .replace(/([A-Z])/g, ' $1')
                        .replace(/^./, (value) => value.toUpperCase())

                      return (
                        <div key={key} className="flex flex-col gap-1.5">
                          <Label htmlFor={`filter-${key}`}>{label}</Label>
                          <Select
                            value={filterValue || '__all__'}
                            onValueChange={(value) =>
                              tableColumn.setFilterValue(value === '__all__' ? undefined : value)
                            }
                          >
                            <SelectTrigger id={`filter-${key}`} size="sm" className="w-full">
                              <SelectValue placeholder={`All ${label.toLowerCase()}`} />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="__all__">All</SelectItem>
                              {options.map((option) => (
                                <SelectItem key={option} value={option}>
                                  {option}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )
                    })}
                    {activeFilterCount > 0 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => table.resetColumnFilters()}
                      >
                        Clear filters
                      </Button>
                    )}
                  </div>
                </ScrollArea>
              </PopoverContent>
            </Popover>
          )}
          {onAddEntry && (
            <Button type="button" size="sm" className="shrink-0" onClick={onAddEntry}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              {addEntryLabel}
            </Button>
          )}
        </div>
        {activeFilterCount > 0 && (
          <div className="basis-full flex flex-wrap items-center gap-1.5 border-t border-border/60 pt-1">
            {filterableColumns.map((column) => {
              const key = column.accessorKey
              const value = table.getColumn(key)?.getFilterValue()
              if (!value) return null
              const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, (v) => v.toUpperCase())
              return (
                <ActiveFilterChip
                  key={key}
                  label={`${label}: ${String(value)}`}
                  onClear={() => table.getColumn(key)?.setFilterValue(undefined)}
                />
              )
            })}
          </div>
        )}
      </TableToolbar>

      <UniversalDataTable
        table={table}
        recordCount={filteredRowCount}
        isLoading={serverState?.loading}
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
