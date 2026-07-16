import * as React from 'react'
import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  type ColumnDef,
  type ColumnFiltersState,
  type SortingState,
  type Table as TableInstance,
  useReactTable
} from '@tanstack/react-table'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  ChevronsLeft,
  ChevronsRight,
  ChevronLeft,
  ChevronRight,
  Filter,
  Plus,
  Search
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'

export type ReportRow = { id: string }

export type ReportColumn<TData extends ReportRow> = ColumnDef<TData>

type ReportDataTableProps<TData extends ReportRow> = {
  columns: ReportColumn<TData>[]
  data: TData[]
  filterPlaceholder?: string
  onAddEntry?: () => void
  addEntryLabel?: string
}

function SortButton<TData extends ReportRow>({
  column,
  children
}: {
  column: ReturnType<TableInstance<TData>['getAllColumns']>[number]
  children: React.ReactNode
}): React.JSX.Element {
  const sorted = column.getIsSorted()
  const Icon = sorted === 'asc' ? ArrowUp : sorted === 'desc' ? ArrowDown : ArrowUpDown

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="group -ml-2 h-7 px-2"
      onClick={() => column.toggleSorting(sorted === 'asc')}
    >
      {children}
      {sorted ? (
        <Icon data-icon="inline-end" aria-hidden="true" />
      ) : (
        <ArrowUpDown
          data-icon="inline-end"
          aria-hidden="true"
          className="opacity-0 transition-opacity group-hover:opacity-100"
        />
      )}
    </Button>
  )
}

function PaginationButton({
  label,
  disabled,
  onClick,
  children
}: {
  label: string
  disabled: boolean
  onClick: () => void
  children: React.ReactNode
}): React.JSX.Element {
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-label={label}
            onClick={onClick}
            disabled={disabled}
          />
        }
      >
        {children}
      </TooltipTrigger>
      <TooltipContent>{label}</TooltipContent>
    </Tooltip>
  )
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
        header: ({ table }) => (
          <Checkbox
            aria-label="Select all rows on this page"
            checked={table.getIsAllPageRowsSelected()}
            onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
          />
        ),
        cell: ({ row }) => (
          <Checkbox
            aria-label={`Select row ${row.index + 1}`}
            checked={row.getIsSelected()}
            onCheckedChange={(value) => row.toggleSelected(!!value)}
          />
        )
      },
      ...columns
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
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const firstVisibleRow = filteredRowCount === 0 ? 0 : pageIndex * pageSize + 1
  const lastVisibleRow = Math.min((pageIndex + 1) * pageSize, filteredRowCount)
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
                className="max-h-[min(70vh,32rem)] overflow-y-auto"
              >
                <div className="flex flex-col gap-3">
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

      <div className="min-h-0 min-w-0 flex-1 overflow-auto [scrollbar-color:var(colors.border)_transparent] [scrollbar-thin]">
        <Table className="min-w-225">
          <TableHeader className="sticky top-0 z-10 bg-muted/30">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow className="h-9" key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const column = columns.find(
                    (item) =>
                      item.id === header.column.id ||
                      ('accessorKey' in item && item.accessorKey === header.column.id)
                  )
                  return (
                    <TableHead
                      key={header.id}
                      className={[
                        header.column.id === 'select'
                          ? 'w-10'
                          : 'text-xs uppercase tracking-wide text-muted-foreground',
                        (header.column.columnDef.meta as { className?: string } | undefined)
                          ?.className
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {header.isPlaceholder ? null : header.column.id === 'select' ? (
                        flexRender(header.column.columnDef.header, header.getContext())
                      ) : column?.enableSorting !== false ? (
                        <SortButton column={header.column}>
                          {flexRender(header.column.columnDef.header, header.getContext())}
                        </SortButton>
                      ) : (
                        flexRender(header.column.columnDef.header, header.getContext())
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  className="h-9"
                  key={row.id}
                  data-state={row.getIsSelected() ? 'selected' : undefined}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell
                      key={cell.id}
                      className={[
                        'max-w-[18rem] truncate px-3 py-1 align-middle',
                        (cell.column.columnDef.meta as { className?: string } | undefined)
                          ?.className
                      ]
                        .filter(Boolean)
                        .join(' ')}
                    >
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={tableColumns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  No matching entries.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      <TooltipProvider>
        <div className="flex min-h-12 shrink-0 items-center justify-between gap-2 border-t bg-muted/30 px-4 py-2">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>
              {firstVisibleRow}–{lastVisibleRow} of {filteredRowCount} entries
            </span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[15, 25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1">
            <span className="px-2 text-xs text-muted-foreground">
              Page {pageIndex + 1} of {Math.max(table.getPageCount(), 1)}
            </span>
            <PaginationButton
              label="First page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.setPageIndex(0)}
            >
              <ChevronsLeft aria-hidden="true" />
            </PaginationButton>
            <PaginationButton
              label="Previous page"
              disabled={!table.getCanPreviousPage()}
              onClick={() => table.previousPage()}
            >
              <ChevronLeft aria-hidden="true" />
            </PaginationButton>
            <PaginationButton
              label="Next page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.nextPage()}
            >
              <ChevronRight aria-hidden="true" />
            </PaginationButton>
            <PaginationButton
              label="Last page"
              disabled={!table.getCanNextPage()}
              onClick={() => table.setPageIndex(table.getPageCount() - 1)}
            >
              <ChevronsRight aria-hidden="true" />
            </PaginationButton>
          </div>
        </div>
      </TooltipProvider>
    </div>
  )
}
