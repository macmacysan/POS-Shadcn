import * as React from 'react'
import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  useReactTable
} from '@tanstack/react-table'
import { Filter, Plus, Search } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
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
import { DataGrid, DataGridContainer } from '@/components/reui/data-grid/data-grid'
import { DataGridColumnHeader } from '@/components/reui/data-grid/data-grid-column-header'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import {
  DataGridTable,
  DataGridTableRowSelect,
  DataGridTableRowSelectAll
} from '@/components/reui/data-grid/data-grid-table'
import { cn } from '@/lib/utils'

export type ReportRow = { id: string }

export type ReportColumn<TData extends ReportRow> = ColumnDef<TData>

type ReportDataTableProps<TData extends ReportRow> = {
  columns: ReportColumn<TData>[]
  data: TData[]
  filterPlaceholder?: string
  onAddEntry?: () => void
  addEntryLabel?: string
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
  addEntryLabel = 'Add Entry'
}: ReportDataTableProps<TData>): React.JSX.Element {
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [rowSelection, setRowSelection] = React.useState({})

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
          headerClassName: 'w-10',
          cellClassName: 'w-10'
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
      }) as ColumnDef<TData>[])
    ],
    [columns]
  )

  // eslint-disable-next-line react-hooks/incompatible-library -- TanStack Table manages reactive table state internally.
  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, columnFilters, globalFilter, rowSelection },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } }
  })

  const filteredRowCount = table.getFilteredRowModel().rows.length
  const filterableColumns = columns.filter(
    (column): column is ReportColumn<TData> & { accessorKey: string } =>
      'accessorKey' in column && typeof column.accessorKey === 'string'
  )
  const activeFilterCount = filterableColumns.reduce((count, column) => {
    const value = table.getColumn(column.accessorKey)?.getFilterValue()
    return count + (value ? 1 : 0)
  }, 0)

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex min-h-12 shrink-0 flex-wrap items-center gap-2 border-b bg-card px-4 py-2 min-[901px]:flex-nowrap">
        <InputGroup className="min-w-0 max-w-105 flex-1 max-[900px]:basis-full">
          <InputGroupAddon align="inline-start">
            <Search aria-hidden="true" />
          </InputGroupAddon>
          <InputGroupInput
            aria-label="Filter all columns"
            placeholder={filterPlaceholder}
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
          />
          {globalFilter.trim() && (
            <InputGroupAddon align="inline-end">
              <InputGroupText>{filteredRowCount} results</InputGroupText>
            </InputGroupAddon>
          )}
        </InputGroup>
        <div className="ml-auto flex shrink-0 items-center gap-2">
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
                      const options = Array.from(
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
      </div>

      <DataGrid
        table={table}
        recordCount={filteredRowCount}
        emptyMessage="No matching entries."
        className="flex min-h-0 min-w-0 flex-1 flex-col"
        tableLayout={{
          dense: true,
          headerSticky: true,
          columnsResizable: true,
          width: 'fixed'
        }}
      >
        <DataGridContainer className="min-h-0 min-w-0 flex-1">
          <DataGridScrollArea className="h-full min-h-0" orientation="both">
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
        <DataGridPagination
          sizes={[15, 25, 50, 100]}
          info="{from}-{to} of {count} entries"
          className="h-11 min-h-11 grow-0 shrink-0 flex-row flex-nowrap border-t bg-muted/30 px-4 py-0 text-xs [&>div]:py-0 [&>div]:pt-0 [&>div]:pb-0"
        />
      </DataGrid>
    </div>
  )
}
