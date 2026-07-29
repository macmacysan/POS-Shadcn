import { useMemo, type MouseEvent, type ReactNode } from 'react'
import type { Table } from '@tanstack/react-table'

import {
  DataGrid,
  DataGridContainer,
  type DataGridProps
} from '@/components/ui/reui/data-grid/data-grid'
import { DataGridPagination } from '@/components/ui/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/ui/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/ui/reui/data-grid/data-grid-table'
import { DataGridTableVirtual } from '@/components/ui/reui/data-grid/data-grid-table-virtual'
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle
} from '@/components/ui/empty'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type UniversalDataTableProps<TData extends object> = {
  table: Table<TData>
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
  tableLayout?: DataGridProps<TData>['tableLayout']
  tableClassNames?: DataGridProps<TData>['tableClassNames']
  footerContent?: ReactNode
  virtual?: boolean
  virtualEstimateSize?: number
  virtualOverscan?: number
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
  tableLayout,
  tableClassNames,
  footerContent,
  virtual = false,
  virtualEstimateSize = 48,
  virtualOverscan = 8
}: UniversalDataTableProps<TData>): React.JSX.Element {
  const resolvedTableLayout = useMemo(
    () => ({
      dense: true,
      headerSticky: true,
      headerBackground: true,
      width: 'fixed' as const,
      ...tableLayout
    }),
    [tableLayout]
  )
  const resolvedTableClassNames = useMemo(
    () => ({
      ...tableClassNames,
      bodyRow: cn('group/row', tableClassNames?.bodyRow)
    }),
    [tableClassNames]
  )

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

  return (
    <DataGrid
      table={table}
      recordCount={recordCount}
      isLoading={isLoading}
      emptyMessage={emptyMessage}
      onRowClick={onRowClick}
      onRowDoubleClick={onRowDoubleClick}
      onRowContextMenu={onRowContextMenu}
      className={cn('flex min-h-0 min-w-0 flex-1 flex-col', className)}
      tableLayout={resolvedTableLayout}
      tableClassNames={resolvedTableClassNames}
    >
      <DataGridContainer className="min-h-0 min-w-0 flex-1">
        <DataGridScrollArea className="h-full min-h-0" orientation="both">
          {virtual ? (
            <DataGridTableVirtual
              estimateSize={virtualEstimateSize}
              overscan={virtualOverscan}
              footerContent={footerContent}
            />
          ) : (
            <DataGridTable footerContent={footerContent} />
          )}
        </DataGridScrollArea>
      </DataGridContainer>
      {showPagination && (
        <DataGridPagination
          sizes={paginationSizes}
          info={paginationInfo}
          className={cn(
            'h-11 min-h-11 grow-0 shrink-0 flex-row flex-nowrap border-t bg-muted/30 px-3 py-0 text-xs [&>div]:py-0 [&>div]:pt-0 [&>div]:pb-0',
            paginationClassName
          )}
        />
      )}
    </DataGrid>
  )
}
