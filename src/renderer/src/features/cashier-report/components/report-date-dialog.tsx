import * as React from 'react'
import {
  addDays,
  addMonths,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths
} from 'date-fns'
import {
  AlertCircle,
  CalendarIcon,
  CircleAlert,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  FileText,
  RefreshCw,
  Send
} from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { Textarea } from '@/components/ui/textarea'
import { Badge as ReuiBadge } from '@/components/ui/reui/badge'
import { formatCentavos } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { DailyReportCalendarDay, DailyReportStatus } from '@/../../shared/contracts'

type ReportDateDialogProps = {
  branchId: string
  cashierUserId: string
  date: Date | undefined
  reportId?: string
  cashVarianceCentavos?: number
  disabled?: boolean
  readOnly?: boolean
  onSelect: (date: Date) => void
}
const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

function isUnsubmitted(status: DailyReportStatus): boolean {
  return status === 'DRAFT' || status === 'REOPENED'
}
function statusLabel(status: DailyReportStatus | undefined): string {
  if (!status) return 'No report started'
  if (status === 'DRAFT') return 'Draft · not submitted'
  if (status === 'REOPENED') return 'Reopened · not submitted'
  return status === 'SUBMITTED' ? 'Submitted' : status === 'APPROVED' ? 'Approved' : 'Voided'
}
function varianceLabel(value: number): string {
  return value === 0
    ? 'Balanced'
    : `${formatCentavos(Math.abs(value))} ${value > 0 ? 'over' : 'short'}`
}
function updatedLabel(value: string): string {
  return format(parseISO(value), 'MMM d, yyyy · h:mm a')
}

function ExceptionRow({
  day,
  label,
  cashVarianceCentavos = day.cashVarianceCentavos,
  onSelect
}: {
  day: DailyReportCalendarDay
  label: string
  cashVarianceCentavos?: number
  onSelect: () => void
}): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={onSelect}
      className="flex w-full flex-col gap-1.5 rounded-sm border border-border/60 bg-background/80 p-2.5 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-semibold">
          {format(parseISO(day.businessDate), 'EEE, MMM d')}
        </span>
        <Badge
          variant={label === 'Variance' ? 'amber' : 'outline'}
          className="px-1.5 py-0 text-[10px]"
        >
          {label}
        </Badge>
      </div>
      <div className="mt-0.5 flex items-center justify-between gap-2 border-t border-border/50 pt-1.5 text-xs">
        <span className="text-[10px] text-muted-foreground">
          {label === 'Variance' ? 'Variance' : 'Status'}
        </span>
        <span
          className={cn(
            'text-right font-medium tabular-nums',
            label === 'Variance' && 'text-destructive'
          )}
        >
          {label === 'Variance' ? varianceLabel(cashVarianceCentavos) : statusLabel(day.status)}
        </span>
      </div>
      <div className="space-y-0.5 border-t border-border/50 pt-1.5 text-[10px] leading-tight text-muted-foreground">
        <span className="block">Updated</span>
        <span className="block truncate text-right">{updatedLabel(day.updatedAt)}</span>
        <span className="block pt-0.5">By</span>
        <span className="block truncate text-right">{day.updatedByName || 'Unknown'}</span>
      </div>
      <div className="flex items-center justify-between gap-2 border-t border-border/50 pt-1.5 text-[10px] text-muted-foreground">
        <span>{day.note ? 'Note added' : 'No note'}</span>
        <span className="truncate text-right">
          {formatCentavos(day.expectedCashCentavos)} expected ·{' '}
          {formatCentavos(day.physicalCashCentavos)} counted
        </span>
      </div>
    </button>
  )
}

export function ReportDateDialog({
  branchId,
  cashierUserId,
  date,
  reportId,
  cashVarianceCentavos,
  disabled,
  readOnly = false,
  onSelect
}: ReportDateDialogProps): React.JSX.Element {
  const initialDate = startOfDay(date ?? new Date())
  const today = startOfDay(new Date())
  const [open, setOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState(initialDate)
  const [month, setMonth] = React.useState(startOfMonth(initialDate))
  const [days, setDays] = React.useState<DailyReportCalendarDay[]>([])
  const [loadError, setLoadError] = React.useState(false)
  const [refreshKey, setRefreshKey] = React.useState(0)
  const [noteDraft, setNoteDraft] = React.useState('')
  const [isSavingNote, setIsSavingNote] = React.useState(false)
  const [noteError, setNoteError] = React.useState(false)
  const monthKey = format(month, 'yyyy-MM')
  const initialDateKey = format(initialDate, 'yyyy-MM-dd')
  React.useEffect(() => {
    if (!open) return
    let active = true
    void window.api.dailyReports
      .listCalendar({ branchId, cashierUserId, month: monthKey })
      .then(({ rows }) => {
        if (active) {
          setDays(rows)
          setNoteDraft(rows.find((day) => day.businessDate === initialDateKey)?.note ?? '')
          setLoadError(false)
        }
      })
      .catch(() => {
        if (active) {
          setDays([])
          setLoadError(true)
        }
      })
    return () => {
      active = false
    }
  }, [branchId, cashierUserId, initialDateKey, monthKey, open, refreshKey])
  React.useEffect(() => {
    if (!open) return
    const refresh = (): void => setRefreshKey((value) => value + 1)
    window.addEventListener('daily-report-delivery-updated', refresh)
    return () => window.removeEventListener('daily-report-delivery-updated', refresh)
  }, [open])
  const daysByDate = React.useMemo(
    () => new Map(days.map((day) => [day.businessDate, day])),
    [days]
  )
  const cashVarianceFor = (day: DailyReportCalendarDay): number =>
    day.reportId === reportId && cashVarianceCentavos !== undefined
      ? cashVarianceCentavos
      : day.cashVarianceCentavos
  const selectedStatus = daysByDate.get(format(selectedDate, 'yyyy-MM-dd'))
  const selectedCashVariance = selectedStatus ? cashVarianceFor(selectedStatus) : 0
  const selectedHasReportData = Boolean(selectedStatus?.hasData)
  const calendarDays = React.useMemo(() => {
    const first = startOfWeek(startOfMonth(month))
    const last = endOfWeek(endOfMonth(month))
    return Array.from(
      { length: Math.ceil((last.getTime() - first.getTime()) / 86400000) + 1 },
      (_, index) => addDays(first, index)
    )
  }, [month])
  const varianceDays = days.filter((day) => cashVarianceFor(day) !== 0)
  const unsubmittedDays = days.filter((day) => day.hasData && isUnsubmitted(day.status))
  const canGoNext = startOfMonth(month) < startOfMonth(today)
  const selectDate = (nextDate: Date): void => {
    const normalizedDate = startOfDay(nextDate)
    setSelectedDate(normalizedDate)
    setNoteDraft(daysByDate.get(format(normalizedDate, 'yyyy-MM-dd'))?.note ?? '')
    setNoteError(false)
  }
  const saveNote = async (note = noteDraft): Promise<boolean> => {
    if (!selectedStatus || readOnly) return false
    setIsSavingNote(true)
    setNoteError(false)
    try {
      const updated = await window.api.dailyReports.updateNote({
        dailyReportId: selectedStatus.reportId,
        note: note.trim() || null
      })
      setDays((current) =>
        current.map((day) => (day.reportId === updated.id ? { ...day, note: updated.note } : day))
      )
      return true
    } catch {
      setNoteError(true)
      return false
    } finally {
      setIsSavingNote(false)
    }
  }
  const clearNote = async (): Promise<void> => {
    const previousNote = noteDraft
    setNoteDraft('')
    setNoteError(false)
    if (!(await saveNote(''))) setNoteDraft(previousNote)
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          const nextDate = startOfDay(date ?? new Date())
          setSelectedDate(nextDate)
          setMonth(startOfMonth(nextDate))
          setNoteDraft('')
          setNoteError(false)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 min-w-0 justify-start gap-1.5 px-2.5 text-xs font-semibold tabular-nums shadow-none"
            aria-label={`Change business date, ${format(initialDate, 'EEEE, MMMM d, yyyy')}`}
            disabled={disabled}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" aria-hidden="true" />
        {format(initialDate, 'MMM d, yyyy')}
      </DialogTrigger>
      <DialogContent
        className="w-full max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:w-[min(1200px,calc(100vw-2rem))] sm:max-w-none"
        showCloseButton
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Select business date</DialogTitle>
          <DialogDescription>Review report status and select a business date.</DialogDescription>
        </DialogHeader>
        <div className="grid h-[40rem] min-h-0 min-w-0 max-h-[calc(100vh-2rem)] grid-cols-[17rem_minmax(0,1fr)_23rem]">
          <aside className="flex min-w-0 flex-col gap-5 overflow-y-auto bg-muted/30 p-6">
            <div>
              <p className="text-xs text-muted-foreground">Selected day</p>
              <p className="mt-1 font-heading text-base leading-tight font-medium">
                {format(selectedDate, 'EEE, MMM d')}
              </p>
            </div>
            <Badge
              variant={
                selectedHasReportData && selectedStatus && isUnsubmitted(selectedStatus.status)
                  ? 'amber'
                  : 'secondary'
              }
            >
              {selectedHasReportData && selectedStatus
                ? statusLabel(selectedStatus.status)
                : 'No report data'}
            </Badge>
            {selectedHasReportData && selectedStatus && selectedCashVariance !== 0 && (
              <div>
                <p className="text-xs text-muted-foreground">Cash variance</p>
                <p className="mt-1 text-sm font-medium tabular-nums text-destructive">
                  {varianceLabel(selectedCashVariance)}
                </p>
              </div>
            )}
            {selectedStatus && selectedHasReportData && !selectedStatus.telegramSubmittedAt && (
                <div className="space-y-1.5">
                  <p className="text-xs text-muted-foreground">Not sent</p>
                  <p className="flex items-center gap-2 text-xs text-destructive">
                    <Send className="size-3" />
                    Telegram
                  </p>
                </div>
              )}
            {selectedHasReportData && selectedStatus && (
              <div className="space-y-3 text-xs">
                <div className="space-y-1 text-foreground">
                  <p>{updatedLabel(selectedStatus.updatedAt)}</p>
                  <p className="truncate">{selectedStatus.updatedByName || 'Unknown'}</p>
                </div>
                <Separator />
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Expected</span>
                  <span className="font-medium tabular-nums">
                    {formatCentavos(selectedStatus.expectedCashCentavos)}
                  </span>
                </div>
                <div className="flex justify-between gap-2">
                  <span className="text-muted-foreground">Counted</span>
                  <span className="font-medium tabular-nums">
                    {formatCentavos(selectedStatus.physicalCashCentavos)}
                  </span>
                </div>
                <div className="space-y-1.5">
                  <span className="text-muted-foreground">Notes</span>
                  <Textarea
                    aria-label="Report note"
                    value={noteDraft}
                    onChange={(event) => setNoteDraft(event.target.value)}
                    placeholder="Add note"
                    maxLength={800}
                    rows={3}
                    disabled={!selectedStatus || isSavingNote || readOnly}
                    className="resize-none text-xs"
                  />
                  <div className="flex flex-wrap gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      disabled={!selectedStatus || isSavingNote || readOnly}
                      onClick={() => void saveNote()}
                    >
                      {isSavingNote ? 'Saving…' : noteDraft.trim() ? 'Save note' : 'Add note'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={!noteDraft || isSavingNote || readOnly}
                      onClick={() => void clearNote()}
                    >
                      Clear note
                    </Button>
                  </div>
                  {noteError && (
                    <p className="text-xs text-destructive" role="alert">
                      Note could not be saved.
                    </p>
                  )}
                </div>
              </div>
            )}
            <div className="mt-auto flex flex-col gap-3">
              <Separator />
              <div className="space-y-2 text-[11px] text-muted-foreground">
                <p className="flex items-center gap-2">
                  {selectedHasReportData && selectedCashVariance === 0 ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <span className="size-2 rounded-full bg-destructive" />
                  )}
                  <span
                    className={cn(
                      selectedHasReportData && selectedCashVariance === 0 && 'text-emerald-600'
                    )}
                  >
                    {selectedHasReportData && selectedCashVariance === 0 ? 'Balanced' : 'Cash variance'}
                  </span>
                </p>
                <p className="flex items-center gap-2">
                  {selectedHasReportData && selectedStatus?.telegramSubmittedAt ? (
                    <Check className="size-3 text-emerald-600" />
                  ) : (
                    <Send className="size-3 text-destructive" />
                  )}
                  <span
                    className={cn(
                      selectedHasReportData && selectedStatus?.telegramSubmittedAt && 'text-emerald-600'
                    )}
                  >
                    {selectedHasReportData && selectedStatus?.telegramSubmittedAt
                      ? 'Report Sent'
                      : 'Telegram not sent'}
                  </span>
                </p>
              </div>
              <Button
                type="button"
                className="w-full"
                onClick={() => {
                  onSelect(selectedDate)
                  setOpen(false)
                }}
              >
                <FileText data-icon="inline-start" aria-hidden="true" />
                Open report
              </Button>
            </div>
          </aside>
          <section className="flex min-w-0 flex-col p-5">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Report calendar</p>
                <h2 className="text-lg font-semibold tracking-tight">
                  {format(month, 'MMMM yyyy')}
                </h2>
              </div>
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Refresh report calendar"
                  onClick={() => setRefreshKey((value) => value + 1)}
                >
                  <RefreshCw aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Previous month"
                  onClick={() => setMonth((current) => subMonths(current, 1))}
                >
                  <ChevronLeft aria-hidden="true" />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Next month"
                  disabled={!canGoNext}
                  onClick={() => setMonth((current) => addMonths(current, 1))}
                >
                  <ChevronRight aria-hidden="true" />
                </Button>
              </div>
            </div>
            {loadError ? (
              <div
                role="alert"
                className="flex flex-1 items-center justify-center gap-2 text-sm text-destructive"
              >
                <AlertCircle className="size-4" aria-hidden="true" />
                Calendar status could not be loaded.
              </div>
            ) : (
              <div className="min-w-0">
                <div className="grid grid-cols-7 gap-2 text-center text-[11px] font-medium text-muted-foreground">
                  {weekDays.map((day) => (
                    <span key={day}>{day}</span>
                  ))}
                </div>
                <div className="mt-2 grid grid-cols-7 gap-2">
                  {calendarDays.map((day) => {
                    const status = daysByDate.get(format(day, 'yyyy-MM-dd'))
                    const currentMonth = isSameMonth(day, month)
                    const selected = isSameDay(day, selectedDate)
                    const hasVariance = Boolean(status && cashVarianceFor(status) !== 0)
                    const hasReportData = Boolean(status?.hasData)
                    const telegramSubmitted = Boolean(status?.telegramSubmittedAt)
                    const deliveryLabel = hasReportData
                      ? `, Telegram ${telegramSubmitted ? 'sent' : 'not sent'}`
                      : ''
                    return (
                      <button
                        key={day.toISOString()}
                        type="button"
                        aria-label={`${format(day, 'EEEE, MMMM d')}${status ? `, ${statusLabel(status.status)}${deliveryLabel}` : ', no report data'}`}
                        aria-pressed={selected}
                        disabled={day > today}
                        onClick={() => selectDate(day)}
                        className={cn(
                          'relative flex min-h-16 flex-col items-center justify-between rounded-md border border-border/60 bg-background p-2 text-sm transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:opacity-40',
                          !currentMonth && 'text-muted-foreground/45',
                          hasReportData &&
                            'border-foreground/15 bg-foreground/10 hover:bg-foreground/15',
                          selected && 'border-primary bg-primary/5 ring-1 ring-primary'
                        )}
                      >
                        <span className="font-medium tabular-nums">{format(day, 'd')}</span>
                        <span className="flex min-h-3 items-center gap-1" aria-hidden="true">
                          {hasVariance && <span className="size-2 rounded-full bg-destructive" />}
                          {hasReportData && !telegramSubmitted && (
                            <Send className="size-3 text-destructive" />
                          )}
                          {status?.note && <CircleAlert className="size-3 text-muted-foreground" />}
                        </span>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}
          </section>
          <aside className="flex min-w-0 flex-col overflow-hidden border-l bg-muted/20">
            <div className="border-b p-5">
              <p className="text-xs text-muted-foreground">Review queue</p>
              <h2 className="mt-1 text-lg font-semibold tracking-tight">Needs review</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                {days.length} report{days.length === 1 ? '' : 's'} in this month.
              </p>
            </div>
            <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
              <Collapsible defaultOpen={Boolean(varianceDays.length)} className="space-y-1.5">
                <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-sm border border-border/60 bg-background/70 px-2.5 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Variance
                  </span>
                  <ReuiBadge
                    variant={varianceDays.length ? 'warning-light' : 'outline'}
                    size="sm"
                    aria-label={`${varianceDays.length} variance reports`}
                  >
                    {varianceDays.length}
                  </ReuiBadge>
                  <ChevronDown
                    className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                    aria-hidden="true"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2">
                  {varianceDays.length ? (
                    varianceDays.map((day) => (
                      <ExceptionRow
                        key={`variance-${day.businessDate}`}
                        day={day}
                        label="Variance"
                        cashVarianceCentavos={cashVarianceFor(day)}
                        onSelect={() => selectDate(parseISO(day.businessDate))}
                      />
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      No variance this month.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
              <Collapsible defaultOpen={Boolean(unsubmittedDays.length)} className="space-y-1.5">
                <CollapsibleTrigger className="group flex w-full items-center gap-2 rounded-sm border border-border/60 bg-background/70 px-2.5 py-2 text-left transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
                  <span className="min-w-0 flex-1 text-xs font-semibold uppercase tracking-[0.12em] text-muted-foreground">
                    Not submitted
                  </span>
                  <ReuiBadge
                    variant={unsubmittedDays.length ? 'warning-light' : 'outline'}
                    size="sm"
                    aria-label={`${unsubmittedDays.length} unsubmitted reports`}
                  >
                    {unsubmittedDays.length}
                  </ReuiBadge>
                  <ChevronDown
                    className="size-3.5 text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
                    aria-hidden="true"
                  />
                </CollapsibleTrigger>
                <CollapsibleContent className="space-y-2">
                  {unsubmittedDays.length ? (
                    unsubmittedDays.map((day) => (
                      <ExceptionRow
                        key={`unsubmitted-${day.businessDate}`}
                        day={day}
                        label="Not submitted"
                        onSelect={() => selectDate(parseISO(day.businessDate))}
                      />
                    ))
                  ) : (
                    <p className="rounded-md border border-dashed p-3 text-xs text-muted-foreground">
                      All submitted.
                    </p>
                  )}
                </CollapsibleContent>
              </Collapsible>
            </div>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}
