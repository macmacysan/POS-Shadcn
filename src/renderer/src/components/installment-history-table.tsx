import * as React from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Search } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { Skeleton } from '@/components/ui/skeleton'
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
  isLoading?: boolean
}

type SortDirection = 'asc' | 'desc'

const actionOptions: Array<InstallmentHistoryAction | 'all'> = ['all', 'new', 'edited', 'deleted']
const sourceOptions: Array<InstallmentHistorySource | 'all'> = ['all', 'in-house', 'home-credit']

function ActionBadge({ action }: { action: InstallmentHistoryAction }): React.JSX.Element {
  return (
    <Badge
      variant={action === 'deleted' ? 'destructive' : action === 'edited' ? 'outline' : 'secondary'}
    >
      {actionLabels[action]}
    </Badge>
  )
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
        <TooltipTrigger render={<span className={`block truncate ${className ?? ''}`} />}>
          {value}
        </TooltipTrigger>
        <TooltipContent className="max-w-80">{value}</TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}

function LoadingRows(): React.JSX.Element {
  return (
    <>
      {Array.from({ length: 6 }, (_, index) => (
        <TableRow key={`loading-${index}`} className="h-12">
          {Array.from({ length: 7 }, (_, cellIndex) => (
            <TableCell key={`loading-${index}-${cellIndex}`}>
              <Skeleton className="h-4 w-full" />
            </TableCell>
          ))}
        </TableRow>
      ))}
    </>
  )
}

export function InstallmentHistoryTable({
  records,
  selectedId,
  onSelect,
  isLoading = false
}: InstallmentHistoryTableProps): React.JSX.Element {
  const [search, setSearch] = React.useState('')
  const [action, setAction] = React.useState<InstallmentHistoryAction | 'all'>('all')
  const [source, setSource] = React.useState<InstallmentHistorySource | 'all'>('all')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')

  const visibleRecords = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return records
      .filter((record) => action === 'all' || record.action === action)
      .filter((record) => source === 'all' || record.source === source)
      .filter(
        (record) =>
          !query ||
          `${record.accountName} ${record.activity} ${record.reference ?? ''}`
            .toLowerCase()
            .includes(query)
      )
      .sort((left, right) => {
        const difference = left.occurredAt.localeCompare(right.occurredAt)
        return sortDirection === 'desc' ? -difference : difference
      })
  }, [action, records, search, sortDirection, source])

  const selectAt = (index: number): void => {
    const nextRecord = visibleRecords[index]
    if (nextRecord) onSelect(nextRecord)
  }

  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
        <div className="relative min-w-52 max-w-md flex-1">
          <Search
            className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search account or activity..."
            aria-label="Search account or activity"
            className="h-8 pl-8 text-xs"
          />
        </div>
        <Select
          value={action}
          onValueChange={(value) => setAction(value as InstallmentHistoryAction | 'all')}
        >
          <SelectTrigger size="sm" className="w-28" aria-label="Filter by action">
            <SelectValue placeholder="Action" />
          </SelectTrigger>
          <SelectContent>
            {actionOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option === 'all' ? 'All actions' : actionLabels[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select
          value={source}
          onValueChange={(value) => setSource(value as InstallmentHistorySource | 'all')}
        >
          <SelectTrigger size="sm" className="w-32" aria-label="Filter by source">
            <SelectValue placeholder="Source" />
          </SelectTrigger>
          <SelectContent>
            {sourceOptions.map((option) => (
              <SelectItem key={option} value={option}>
                {option === 'all' ? 'All sources' : sourceLabels[option]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
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
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-auto [scrollbar-color:var(colors.border)_transparent] [scrollbar-width:thin]">
        <Table className="min-w-[760px] table-fixed">
          <TableHeader className="sticky top-0 z-10 bg-muted/95 backdrop-blur-sm">
            <TableRow className="h-9 hover:bg-transparent">
              <TableHead className="w-[16%] text-[11px] uppercase tracking-wide text-muted-foreground">
                DATE &amp; TIME
              </TableHead>
              <TableHead className="w-[10%] text-[11px] uppercase tracking-wide text-muted-foreground">
                ACTION
              </TableHead>
              <TableHead className="w-[11%] text-[11px] uppercase tracking-wide text-muted-foreground">
                SOURCE
              </TableHead>
              <TableHead className="w-[20%] text-[11px] uppercase tracking-wide text-muted-foreground">
                ACCOUNT
              </TableHead>
              <TableHead className="w-[22%] text-[11px] uppercase tracking-wide text-muted-foreground">
                ACTIVITY
              </TableHead>
              <TableHead className="w-[11%] text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                AMOUNT
              </TableHead>
              <TableHead className="w-[10%] text-right text-[11px] uppercase tracking-wide text-muted-foreground">
                BALANCE
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <LoadingRows />
            ) : visibleRecords.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="p-4">
                  <Empty className="min-h-64 border-0 p-8">
                    <EmptyHeader>
                      <EmptyTitle className="text-base">
                        {records.length === 0
                          ? 'No installment history yet'
                          : 'No matching history'}
                      </EmptyTitle>
                      <EmptyDescription>
                        {records.length === 0
                          ? 'New, edited, and deleted installment activity will appear here.'
                          : 'Try changing the search or filters.'}
                      </EmptyDescription>
                    </EmptyHeader>
                  </Empty>
                </TableCell>
              </TableRow>
            ) : (
              visibleRecords.map((record, index) => (
                <TableRow
                  key={record.id}
                  tabIndex={0}
                  aria-selected={record.id === selectedId}
                  data-state={record.id === selectedId ? 'selected' : undefined}
                  className="h-12 cursor-pointer focus-visible:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                  onClick={() => onSelect(record)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault()
                      onSelect(record)
                    }
                    if (event.key === 'ArrowDown') {
                      event.preventDefault()
                      selectAt(Math.min(index + 1, visibleRecords.length - 1))
                    }
                    if (event.key === 'ArrowUp') {
                      event.preventDefault()
                      selectAt(Math.max(index - 1, 0))
                    }
                  }}
                >
                  <TableCell className="truncate px-3 py-1 text-xs">
                    {formatHistoryDateTime(record.occurredAt)}
                  </TableCell>
                  <TableCell className="px-3 py-1">
                    <ActionBadge action={record.action} />
                  </TableCell>
                  <TableCell className="truncate px-3 py-1 text-xs">
                    {sourceLabels[record.source]}
                  </TableCell>
                  <TableCell className="min-w-0 px-3 py-1">
                    <TruncatedText value={record.accountName} className="text-xs font-medium" />
                    {record.reference && (
                      <span className="block truncate text-[11px] text-muted-foreground">
                        {record.reference}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="min-w-0 px-3 py-1">
                    <TruncatedText value={record.activity} className="text-xs" />
                  </TableCell>
                  <TableCell className="px-3 py-1 text-right text-xs tabular-nums">
                    {formatHistoryMoney(record.amount)}
                  </TableCell>
                  <TableCell className="px-3 py-1 text-right text-xs font-medium tabular-nums">
                    {formatHistoryMoney(record.balance)}
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
      <div className="flex min-h-10 shrink-0 items-center justify-between border-t bg-muted/30 px-3 text-xs text-muted-foreground">
        <span>
          {visibleRecords.length} record{visibleRecords.length === 1 ? '' : 's'}
        </span>
        <span>Newest first</span>
      </div>
    </div>
  )
}
