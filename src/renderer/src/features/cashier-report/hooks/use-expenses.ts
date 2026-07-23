import * as React from 'react'
import type {
  ColumnFiltersState,
  OnChangeFn,
  PaginationState,
  SortingState
} from '@tanstack/react-table'

import {
  amountFromCentavos,
  expensePageSizes,
  type ExpenseCreateInput,
  type ExpenseListRequest,
  type ExpenseRecord,
  type ExpenseSummaryTotals,
  type ExpenseUpdateInput
} from '@/../../shared/contracts'
import { useActiveReport } from '@/contexts/active-report-context'

const sortFieldByColumn: Record<string, ExpenseListRequest['sorting'][number]['field']> = {
  type: 'type',
  description: 'description',
  category: 'category',
  receiptNo: 'receiptNo',
  vat: 'vat',
  amount: 'amountCentavos'
}

export type ExpenseTableRow = ExpenseRecord & {
  amount: number
}

function toTableRow(record: ExpenseRecord): ExpenseTableRow {
  return { ...record, amount: amountFromCentavos(record.amountCentavos) }
}

function errorMessage(error: unknown): string {
  if (error && typeof error === 'object' && 'message' in error) {
    const message = (error as { message?: unknown }).message
    if (typeof message === 'string') return message
  }
  return 'Unable to load expenses.'
}

function resolveUpdater<T>(updater: T | ((current: T) => T), current: T): T {
  return typeof updater === 'function' ? (updater as (current: T) => T)(current) : updater
}

export function useExpenses(): {
  rows: ExpenseTableRow[]
  page: PaginationState
  pagination: PaginationState
  pageCount: number
  totalRows: number
  sorting: SortingState
  columnFilters: ColumnFiltersState
  globalFilter: string
  loading: boolean
  refreshing: boolean
  error?: string
  selectedId?: string
  setSelectedId: React.Dispatch<React.SetStateAction<string | undefined>>
  onPaginationChange: OnChangeFn<PaginationState>
  onSortingChange: OnChangeFn<SortingState>
  onColumnFiltersChange: OnChangeFn<ColumnFiltersState>
  onGlobalFilterChange: OnChangeFn<string>
  refresh: () => void
  createExpense: (input: ExpenseCreateInput) => Promise<ExpenseRecord>
  updateExpense: (input: ExpenseUpdateInput) => Promise<ExpenseRecord>
  removeExpenses: (ids: string[]) => Promise<void>
  expenseTotals: ExpenseSummaryTotals
} {
  const { reportId } = useActiveReport()
  const [rows, setRows] = React.useState<ExpenseTableRow[]>([])
  const [page, setPage] = React.useState<PaginationState>({ pageIndex: 0, pageSize: 50 })
  const [totalRows, setTotalRows] = React.useState(0)
  const [sorting, setSorting] = React.useState<SortingState>([])
  const [columnFilters, setColumnFilters] = React.useState<ColumnFiltersState>([])
  const [globalFilter, setGlobalFilter] = React.useState('')
  const [debouncedSearch, setDebouncedSearch] = React.useState('')
  const [loading, setLoading] = React.useState(true)
  const [refreshing, setRefreshing] = React.useState(false)
  const [error, setError] = React.useState<string>()
  const [selectedId, setSelectedId] = React.useState<string>()
  const [expenseTotals, setExpenseTotals] = React.useState<ExpenseSummaryTotals>({
    companyExpensesCentavos: 0,
    drawingsCentavos: 0,
    purchasesCentavos: 0,
    receivablesCentavos: 0
  })
  const [refreshToken, setRefreshToken] = React.useState(0)
  const requestSequence = React.useRef(0)

  React.useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedSearch(globalFilter.trim()), 250)
    return () => window.clearTimeout(timeout)
  }, [globalFilter])

  const onPaginationChange: OnChangeFn<PaginationState> = React.useCallback((updater) => {
    setPage((current) => resolveUpdater(updater, current))
  }, [])

  const onSortingChange: OnChangeFn<SortingState> = React.useCallback((updater) => {
    setSorting((current) => resolveUpdater(updater, current))
    setPage((current) => ({ ...current, pageIndex: 0 }))
  }, [])

  const onColumnFiltersChange: OnChangeFn<ColumnFiltersState> = React.useCallback((updater) => {
    setColumnFilters((current) => resolveUpdater(updater, current))
    setPage((current) => ({ ...current, pageIndex: 0 }))
  }, [])

  const onGlobalFilterChange: OnChangeFn<string> = React.useCallback((updater) => {
    setGlobalFilter((current) => resolveUpdater(updater, current))
    setPage((current) => ({ ...current, pageIndex: 0 }))
  }, [])

  React.useEffect(() => {
    const requestId = ++requestSequence.current
    let cancelled = false
    const filters = Object.fromEntries(
      columnFilters
        .filter(({ value }) => typeof value === 'string' && value.length > 0)
        .map(({ id, value }) => [id, value])
    ) as ExpenseListRequest['filters']
    const sortingRequest = sorting[0]
      ? [
          {
            field: sortFieldByColumn[sorting[0].id] ?? 'createdAt',
            direction: (sorting[0].desc ? 'desc' : 'asc') as 'asc' | 'desc'
          }
        ]
      : []
    const request: ExpenseListRequest = {
      reportId,
      pageIndex: page.pageIndex,
      pageSize: expensePageSizes.includes(page.pageSize as (typeof expensePageSizes)[number])
        ? (page.pageSize as ExpenseListRequest['pageSize'])
        : 50,
      search: debouncedSearch,
      sorting: sortingRequest,
      filters
    }

    setLoading(true)
    setRefreshing(true)
    setError(undefined)

    void window.api.reports.expenses
      .list(request)
      .then((result) => {
        if (cancelled || requestId !== requestSequence.current) return

        if (page.pageIndex > 0 && page.pageIndex * page.pageSize >= result.totalRows) {
          setPage((current) => ({
            ...current,
            pageIndex: Math.max(0, Math.ceil(result.totalRows / current.pageSize) - 1)
          }))
          return
        }

        setRows(result.rows.map(toTableRow))
        setTotalRows(result.totalRows)
        setLoading(false)
        setRefreshing(false)
      })
      .catch((requestError: unknown) => {
        if (cancelled || requestId !== requestSequence.current) return
        setError(errorMessage(requestError))
        setLoading(false)
        setRefreshing(false)
      })

    return () => {
      cancelled = true
    }
  }, [columnFilters, debouncedSearch, page, refreshToken, reportId, sorting])

  const refreshSummaryTotals = React.useCallback(() => {
    void window.api.reports.expenses
      .summaryTotals(reportId)
      .then(setExpenseTotals)
      .catch(() => undefined)
  }, [reportId])

  React.useEffect(() => {
    refreshSummaryTotals()
  }, [refreshSummaryTotals])

  const refresh = React.useCallback(() => setRefreshToken((current) => current + 1), [])

  const createExpense = React.useCallback(
    async (input: ExpenseCreateInput): Promise<ExpenseRecord> => {
      const record = await window.api.reports.expenses.create(input)
      refresh()
      refreshSummaryTotals()
      return record
    },
    [refresh, refreshSummaryTotals]
  )

  const updateExpense = React.useCallback(
    async (input: ExpenseUpdateInput): Promise<ExpenseRecord> => {
      const record = await window.api.reports.expenses.update(input)
      refresh()
      refreshSummaryTotals()
      return record
    },
    [refresh, refreshSummaryTotals]
  )

  const removeExpenses = React.useCallback(
    async (ids: string[]): Promise<void> => {
      await window.api.reports.expenses.remove({ ids })
      refresh()
      refreshSummaryTotals()
    },
    [refresh, refreshSummaryTotals]
  )

  return {
    rows,
    page,
    pagination: page,
    pageCount: Math.ceil(totalRows / page.pageSize),
    totalRows,
    sorting,
    columnFilters,
    globalFilter,
    loading,
    refreshing,
    error,
    selectedId,
    setSelectedId,
    onPaginationChange,
    onSortingChange,
    onColumnFiltersChange,
    onGlobalFilterChange,
    refresh,
    createExpense,
    updateExpense,
    removeExpenses,
    expenseTotals
  }
}
