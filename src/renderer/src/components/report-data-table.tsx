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
  Columns3,
  Filter,
  Plus
} from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'

export type ReportRow = { id: string }

export type ReportColumn<TData extends ReportRow> = ColumnDef<TData> & {
  filterLabel?: string
  filterable?: boolean
}

type ReportDataTableProps<TData extends ReportRow> = {
  title?: string
  description?: string
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
  title = 'Report entries',
  description = 'Review and manage entries for this report.',
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
  const [columnVisibility, setColumnVisibility] = React.useState<Record<string, boolean>>({})

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

  const table = useReactTable({
    data,
    columns: tableColumns,
    state: { sorting, columnFilters, globalFilter, rowSelection, columnVisibility },
    enableRowSelection: true,
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    onGlobalFilterChange: setGlobalFilter,
    onRowSelectionChange: setRowSelection,
    onColumnVisibilityChange: setColumnVisibility,
    getRowId: (row) => row.id,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: { pagination: { pageSize: 50 } }
  })

  const filterableColumns = columns.filter(
    (column): column is ReportColumn<TData> & { accessorKey: string } =>
      column.filterable === true &&
      'accessorKey' in column &&
      typeof column.accessorKey === 'string'
  )
  const hideableColumns = table.getAllLeafColumns().filter((column) => column.getCanHide())
  const filteredRowCount = table.getFilteredRowModel().rows.length
  const pageIndex = table.getState().pagination.pageIndex
  const pageSize = table.getState().pagination.pageSize
  const firstVisibleRow = filteredRowCount === 0 ? 0 : pageIndex * pageSize + 1
  const lastVisibleRow = Math.min((pageIndex + 1) * pageSize, filteredRowCount)

  return (
    <Card className="overflow-visible shadow-sm">
      <CardHeader className="border-b bg-muted/20 px-4 py-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <CardTitle className="text-base">{title}</CardTitle>
            <CardDescription className="mt-1">{description}</CardDescription>
          </div>
          {onAddEntry && (
            <Button type="button" size="sm" onClick={onAddEntry}>
              <Plus data-icon="inline-start" aria-hidden="true" />
              {addEntryLabel}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-muted/20 p-2">
          <Input
            aria-label="Filter all columns"
            className="h-8 min-w-52 flex-1 bg-background sm:max-w-xs"
            placeholder={filterPlaceholder}
            value={globalFilter}
            onChange={(event) => setGlobalFilter(event.target.value)}
          />
          <Popover>
            <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
              <Filter data-icon="inline-start" aria-hidden="true" />
              Filter
            </PopoverTrigger>
            <PopoverContent align="start" className="max-h-80 overflow-y-auto">
              {filterableColumns.map((column) => {
                const key = column.accessorKey
                const tableColumn = table.getColumn(key)
                if (!tableColumn) return null
                const filterValue = (tableColumn.getFilterValue() as string) ?? ''
                const filterOptions = Array.from(
                  new Set(data.map((row) => String(row[key as keyof TData] ?? '')))
                )
                  .filter(Boolean)
                  .sort()
                return (
                  <div key={key} className="flex flex-col gap-1">
                    <span className="px-2 text-xs font-medium text-muted-foreground">
                      {column.filterLabel ?? key}
                    </span>
                    <div role="group" aria-label={`Filter ${column.filterLabel ?? key}`}>
                      <Button
                        type="button"
                        variant={filterValue ? 'secondary' : 'ghost'}
                        size="sm"
                        className="w-full justify-start font-normal"
                        onClick={() => tableColumn.setFilterValue('')}
                      >
                        All
                      </Button>
                      {filterOptions.map((option) => (
                        <Button
                          key={option}
                          type="button"
                          variant={filterValue === option ? 'secondary' : 'ghost'}
                          size="sm"
                          className="w-full justify-start font-normal"
                          onClick={() => tableColumn.setFilterValue(option)}
                        >
                          {option}
                        </Button>
                      ))}
                    </div>
                  </div>
                )
              })}
            </PopoverContent>
          </Popover>
          <Popover>
            <PopoverTrigger render={<Button type="button" variant="outline" size="sm" />}>
              <Columns3 data-icon="inline-start" aria-hidden="true" />
              Columns
            </PopoverTrigger>
            <PopoverContent align="start" className="flex flex-col gap-1">
              {hideableColumns.map((column) => (
                <label
                  key={column.id}
                  className="flex items-center gap-2 rounded-md px-2 py-1 text-sm"
                >
                  <Checkbox
                    checked={column.getIsVisible()}
                    onCheckedChange={(value) => column.toggleVisibility(!!value)}
                  />
                  <span>{column.columnDef.header?.toString() ?? column.id}</span>
                </label>
              ))}
            </PopoverContent>
          </Popover>
        </div>

        <div className="overflow-hidden rounded-lg border">
          <Table>
            <TableHeader className="bg-muted/60">
              {table.getHeaderGroups().map((headerGroup) => (
                <TableRow key={headerGroup.id}>
                  {headerGroup.headers.map((header) => {
                    const column = columns.find(
                      (item) =>
                        item.id === header.column.id ||
                        ('accessorKey' in item && item.accessorKey === header.column.id)
                    )
                    return (
                      <TableHead
                        key={header.id}
                        className={
                          header.column.id === 'select'
                            ? 'w-10'
                            : 'text-xs uppercase tracking-wide text-muted-foreground'
                        }
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
                  <TableRow key={row.id} data-state={row.getIsSelected() ? 'selected' : undefined}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell
                        key={cell.id}
                        className={
                          (cell.column.columnDef.meta as { className?: string } | undefined)
                            ?.className
                        }
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
      </CardContent>

      <TooltipProvider>
        <CardFooter className="flex-wrap justify-between gap-2 px-4 py-3">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <span>Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" aria-label="Rows per page">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[25, 50, 100].map((size) => (
                  <SelectItem key={size} value={String(size)}>
                    {size}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span>
              {firstVisibleRow}–{lastVisibleRow} of {filteredRowCount}
            </span>
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
        </CardFooter>
      </TooltipProvider>
    </Card>
  )
}
