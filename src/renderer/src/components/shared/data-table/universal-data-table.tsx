import type { MouseEvent, ReactNode } from 'react'
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
import { cn } from '@/lib/utils'

export const dataTableColumnSizes = {
  selection: {
    size: 42,
    minSize: 42,
    maxSize: 42,
    className: 'w-[42px]'
  },
  actions: {
    size: 48,
    minSize: 48,
    maxSize: 48,
    className: 'w-12'
  },
  type: {
    size: 120,
    minSize: 105,
    maxSize: 140,
    className: 'w-30'
  },
  description: {
    size: 300,
    minSize: 220,
    maxSize: 420,
    className: 'w-75',
    mediumClassName: 'w-64',
    wideClassName: 'w-90'
  },
  category: {
    size: 140,
    minSize: 120,
    maxSize: 170,
    className: 'w-35'
  },
  receiptNumber: {
    size: 140,
    minSize: 120,
    maxSize: 160,
    className: 'w-35',
    wideClassName: 'w-48'
  },
  vat: {
    size: 90,
    minSize: 80,
    maxSize: 105,
    className: 'w-24'
  },
  amount: {
    size: 150,
    minSize: 130,
    maxSize: 170,
    compactSize: 128,
    wideSize: 176,
    className: 'w-38',
    narrowClassName: 'w-30'
  },
  date: {
    size: 140,
    minSize: 120,
    maxSize: 170,
    narrowSize: 112,
    compactSize: 128,
    dateTimeSize: 176,
    className: 'w-35'
  },
  status: {
    size: 120,
    minSize: 105,
    maxSize: 150,
    compactSize: 112
  },
  branch: {
    size: 90,
    minSize: 76,
    maxSize: 110,
    compactSize: 76
  },
  account: {
    size: 240,
    minSize: 190,
    maxSize: 320,
    compactSize: 184,
    historySize: 220
  }
} as const

type UniversalDataTableProps<TData extends object> = {
  table: Table<TData>
  recordCount: number
  isLoading?: boolean
  emptyMessage?: ReactNode | string
  onRowClick?: (row: TData) => void
  onRowDoubleClick?: (row: TData) => void
  onRowContextMenu?: (row: TData, event: MouseEvent<HTMLTableRowElement>) => void
  paginationSizes?: number[]
  paginationInfo?: string
  paginationClassName?: string
  className?: string
  tableLayout?: DataGridProps<TData>['tableLayout']
  tableClassNames?: DataGridProps<TData>['tableClassNames']
  virtual?: boolean
  virtualEstimateSize?: number
  virtualOverscan?: number
}

export function UniversalDataTable<TData extends object>({
  table,
  recordCount,
  isLoading = false,
  emptyMessage,
  onRowClick,
  onRowDoubleClick,
  onRowContextMenu,
  paginationSizes = [25, 50, 100],
  paginationInfo = 'Showing {from}-{to} of {count}',
  paginationClassName,
  className,
  tableLayout,
  tableClassNames,
  virtual = false,
  virtualEstimateSize = 48,
  virtualOverscan = 8
}: UniversalDataTableProps<TData>): React.JSX.Element {
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
      tableLayout={{
        dense: true,
        headerSticky: true,
        width: 'fixed',
        ...tableLayout
      }}
      tableClassNames={{
        ...tableClassNames,
        bodyRow: cn('group/row', tableClassNames?.bodyRow)
      }}
    >
      <DataGridContainer className="min-h-0 min-w-0 flex-1">
        <DataGridScrollArea className="h-full min-h-0" orientation="both">
          {virtual ? (
            <DataGridTableVirtual estimateSize={virtualEstimateSize} overscan={virtualOverscan} />
          ) : (
            <DataGridTable />
          )}
        </DataGridScrollArea>
      </DataGridContainer>
      <DataGridPagination
        sizes={paginationSizes}
        info={paginationInfo}
        className={cn(
          'h-11 min-h-11 grow-0 shrink-0 flex-row flex-nowrap border-t bg-muted/30 px-3 py-0 text-xs [&>div]:py-0 [&>div]:pt-0 [&>div]:pb-0',
          paginationClassName
        )}
      />
    </DataGrid>
  )
}
