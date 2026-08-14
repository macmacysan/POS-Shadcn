import { type MouseEvent, type ReactNode } from 'react'
import { flexRender, type Column, type Table as TanStackTable } from '@tanstack/react-table'
import { ChevronLeft, ChevronRight, ChevronsUpDown, ArrowDown, ArrowUp } from 'lucide-react'

import {
  Table,
  TableBody,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

type UniversalDataTableProps<TData extends object> = {
  table: TanStackTable<TData>
  recordCount: number
  isLoading?: boolean
  error?: ReactNode | string
  onRetry?: () => void
  emptyMessage?: ReactNode | string
  onRowClick?: (row: TData) => void
  onRowDoubleClick?: (row: TData) => void
  onRowContextMenu?: (row: TData, event: MouseEvent<HTMLTableRowElement>) => void
  paginationSizes?: number[]
  paginationInfo?: string
  paginationClassName?: string
  showPagination?: boolean
  className?: string
  tableLayout?: unknown
  tableClassNames?: unknown
  footerContent?: ReactNode
}

type ColumnMeta = {
  headerTitle?: string
  headerClassName?: string
  cellClassName?: string
  autoSize?: boolean
}

function getColumnMeta<TData>(column: Column<TData, unknown>): ColumnMeta {
  return (column.columnDef.meta ?? {}) as ColumnMeta
}

function getNarrowColumnClassName(id: string): string | undefined {
  return id === 'select' || id === 'branch' ? 'px-0 text-center' : undefined
}

function getColumnLabel<TData>(column: Column<TData, unknown>): string {
  const meta = getColumnMeta(column)
  if (meta.headerTitle) return meta.headerTitle
  if (typeof column.columnDef.header === 'string') return column.columnDef.header
  return column.id.replace(/([A-Z])/g, ' $1').replace(/^./, (value) => value.toUpperCase())
}

function TableColumnHeader<TData>({
  column,
  table,
  isLoading
}: {
  column: Column<TData, unknown>
  table: TanStackTable<TData>
  isLoading: boolean
}): React.JSX.Element {
  if (column.id === 'select') {
    const isAllSelected = table.getIsAllPageRowsSelected()
    const isSomeSelected = table.getIsSomePageRowsSelected()
    return (
      <Checkbox
        checked={isAllSelected}
        indeterminate={isSomeSelected && !isAllSelected}
        disabled={isLoading || table.getRowModel().rows.length === 0}
        onCheckedChange={(value) => table.toggleAllPageRowsSelected(!!value)}
        className="mx-auto align-[inherit]"
        aria-label="Select all"
      />
    )
  }

  if (column.id === 'actions') return <span className="sr-only">Actions</span>

  const isSorted = column.getIsSorted()
  const label = getColumnLabel(column)
  if (!column.getCanSort()) return <>{label}</>

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="group/header -ml-2 h-5 px-2 text-xs font-normal"
      onClick={() => column.toggleSorting(isSorted === 'asc')}
      disabled={isLoading || table.getRowModel().rows.length === 0}
      aria-label={`Sort ${label}`}
    >
      {label}
      {isSorted === 'asc' ? (
        <ArrowUp data-icon="inline-end" aria-hidden="true" />
      ) : isSorted === 'desc' ? (
        <ArrowDown data-icon="inline-end" aria-hidden="true" />
      ) : (
        <ChevronsUpDown
          data-icon="inline-end"
          aria-hidden="true"
          className="opacity-0 group-hover/header:opacity-100 group-focus-visible/header:opacity-100"
        />
      )}
    </Button>
  )
}

export function UniversalDataTable<TData extends object>({
  table,
  recordCount,
  isLoading = false,
  error,
  onRetry,
  emptyMessage,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  paginationSizes = [25, 50, 100],
  paginationInfo = 'Showing {from}-{to} of {count}',
  paginationClassName,
  showPagination = true,
  className,
  footerContent
}: UniversalDataTableProps<TData>): React.JSX.Element {
  if (error) {
    return (
      <Empty className={cn('min-h-52 border-0', className)} role="alert">
        <EmptyHeader>
          <EmptyTitle>Unable to load this table</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
        {onRetry && (
          <EmptyContent>
            <Button type="button" variant="outline" size="sm" onClick={onRetry}>
              Retry
            </Button>
          </EmptyContent>
        )}
      </Empty>
    )
  }

  const rows = table.getRowModel().rows
  const fixedWidth = table
    .getVisibleLeafColumns()
    .filter((column) => !getColumnMeta(column).autoSize)
    .reduce((total, column) => total + column.getSize(), 0)
  const pagination = table.getState().pagination
  const pageSize = pagination?.pageSize ?? 50
  const pageIndex = pagination?.pageIndex ?? 0
  const from = recordCount === 0 ? 0 : pageIndex * pageSize + 1
  const to = Math.min((pageIndex + 1) * pageSize, recordCount)
  const pageInfo = paginationInfo
    .replaceAll('{from}', from.toLocaleString('en-PH'))
    .replaceAll('{to}', to.toLocaleString('en-PH'))
    .replaceAll('{count}', recordCount.toLocaleString('en-PH'))

  return (
    <div className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}>
      <div className="min-h-0 min-w-0 flex-1 [&>[data-slot=table-container]]:h-full [&>[data-slot=table-container]]:overflow-auto">
        <Table className="w-full table-fixed text-xs" style={{ minWidth: fixedWidth }}>
          <TableHeader className="sticky top-0 z-10 bg-background">
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => {
                  const meta = getColumnMeta(header.column)
                  return (
                    <TableHead
                      key={header.id}
                      colSpan={header.colSpan}
                      className={cn(
                        'h-7 px-3 text-xs font-medium text-muted-foreground',
                        meta.headerClassName,
                        getNarrowColumnClassName(header.column.id),
                      )}
                      style={meta.autoSize ? undefined : { width: header.getSize() }}
                    >
                      {header.isPlaceholder ? null : (
                        <TableColumnHeader
                          column={header.column}
                          table={table}
                          isLoading={isLoading}
                        />
                      )}
                    </TableHead>
                  )
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {isLoading && rows.length === 0 ? (
              Array.from({ length: 8 }, (_, index) => (
                <TableRow key={`loading-${index}`}>
                  {table.getVisibleLeafColumns().map((column) => (
                    <TableCell
                      key={column.id}
                      className={cn('h-7 px-3 py-1', getNarrowColumnClassName(column.id))}
                    >
                      <Skeleton className="h-3 w-full" />
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : rows.length > 0 ? (
              rows.map((row) => (
                <TableRow
                  key={row.id}
                  data-state={row.getIsSelected() && 'selected'}
                  className={cn(
                    'group/row h-7',
                    (onRowClick || onRowDoubleClick) && 'cursor-pointer'
                  )}
                  onClick={() => onRowClick?.(row.original)}
                  onDoubleClick={() => onRowDoubleClick?.(row.original)}
                  onContextMenu={(event) => onRowContextMenu?.(row.original, event)}
                >
                  {row.getVisibleCells().map((cell) => {
                    const meta = getColumnMeta(cell.column)
                    return (
                      <TableCell
                        key={cell.id}
                        className={cn(
                          'h-7 max-w-72 px-3 py-1',
                          getNarrowColumnClassName(cell.column.id),
                          meta.cellClassName
                        )}
                        style={meta.autoSize ? undefined : { width: cell.column.getSize() }}
                      >
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    )
                  })}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={table.getVisibleLeafColumns().length}
                  className="h-40 text-center text-muted-foreground"
                >
                  {emptyMessage ?? 'No results found.'}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
          {footerContent && <TableFooter>{footerContent}</TableFooter>}
        </Table>
      </div>
      {showPagination && (
        <div
          className={cn(
            'flex h-7 shrink-0 items-center justify-between gap-3 border-t px-3 text-xs',
            paginationClassName
          )}
        >
          <div className="flex items-center gap-2 text-muted-foreground">
            <span>Rows</span>
            <Select
              value={String(pageSize)}
              onValueChange={(value) => table.setPageSize(Number(value))}
            >
              <SelectTrigger size="sm" className="w-16">
                <SelectValue />
              </SelectTrigger>
              <SelectContent side="top">
                <SelectGroup>
                  {paginationSizes.map((size) => (
                    <SelectItem key={size} value={String(size)}>
                      {size}
                    </SelectItem>
                  ))}
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="mr-1 text-muted-foreground">{pageInfo}</span>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
              aria-label="Go to previous page"
            >
              <ChevronLeft aria-hidden="true" />
            </Button>
            <Button
              type="button"
              size="icon-sm"
              variant="ghost"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
              aria-label="Go to next page"
            >
              <ChevronRight aria-hidden="true" />
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
