import * as React from 'react'
import { format, startOfDay } from 'date-fns'
import { CalendarIcon, FileText, StickyNote } from 'lucide-react'
import type { DayButton } from 'react-day-picker'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Calendar, CalendarDayButton } from '@/components/ui/calendar'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger
} from '@/components/ui/dialog'
import { Separator } from '@/components/ui/separator'
import { formatCentavos } from '@/lib/currency'
import { cn } from '@/lib/utils'
import type { DailyReportCalendarDay, DailyReportStatus } from '@/../../shared/contracts'

type ReportDateDialogProps = {
  branchId: string
  cashierUserId: string
  date: Date | undefined
  disabled?: boolean
  onSelect: (date: Date) => void
}

function isUnsubmitted(status: DailyReportStatus): boolean {
  return status === 'DRAFT' || status === 'REOPENED'
}

function statusLabel(status: DailyReportStatus | undefined): string {
  if (!status) return 'No report started'
  if (isUnsubmitted(status)) return 'Draft · not submitted'
  return status[0] + status.slice(1).toLowerCase()
}

function varianceLabel(varianceCentavos: number): string {
  if (varianceCentavos === 0) return 'Balanced'
  return `${formatCentavos(Math.abs(varianceCentavos))} ${varianceCentavos > 0 ? 'over' : 'short'}`
}

export function ReportDateDialog({
  branchId,
  cashierUserId,
  date,
  disabled,
  onSelect
}: ReportDateDialogProps): React.JSX.Element {
  const initialDate = startOfDay(date ?? new Date())
  const [open, setOpen] = React.useState(false)
  const [selectedDate, setSelectedDate] = React.useState(initialDate)
  const [month, setMonth] = React.useState(initialDate)
  const [days, setDays] = React.useState<DailyReportCalendarDay[]>([])
  const [loadError, setLoadError] = React.useState(false)
  const monthKey = format(month, 'yyyy-MM')

  React.useEffect(() => {
    if (!open) return
    let active = true
    void window.api.dailyReports
      .listCalendar({ branchId, cashierUserId, month: monthKey })
      .then(({ rows }) => {
        if (active) {
          setDays(rows)
          setLoadError(false)
        }
      })
      .catch(() => {
        if (active) setDays([])
        if (active) setLoadError(true)
      })
    return () => {
      active = false
    }
  }, [branchId, cashierUserId, monthKey, open])

  const daysByDate = React.useMemo(
    () => new Map(days.map((day) => [day.businessDate, day])),
    [days]
  )
  const selectedStatus = daysByDate.get(format(selectedDate, 'yyyy-MM-dd'))
  const StatusDayButton = React.useCallback(
    (props: React.ComponentProps<typeof DayButton>) => {
      const status = daysByDate.get(format(props.day.date, 'yyyy-MM-dd'))
      const hasVariance = status
        ? !isUnsubmitted(status.status) && status.cashVarianceCentavos !== 0
        : false
      const hasNotes = Boolean(status?.noteCount)
      const dayLabel = status
        ? `${format(props.day.date, 'EEEE, MMMM d')}, ${statusLabel(status.status)}${
            hasVariance ? `, ${varianceLabel(status.cashVarianceCentavos)}` : ''
          }${hasNotes ? `, ${status.noteCount} note${status.noteCount === 1 ? '' : 's'}` : ''}`
        : format(props.day.date, 'EEEE, MMMM d')

      return (
        <CalendarDayButton
          {...props}
          aria-label={dayLabel}
          className={cn(
            props.className,
            isUnsubmitted(status?.status ?? 'SUBMITTED') && 'border border-status-warning/60'
          )}
        >
          {props.children}
          {isUnsubmitted(status?.status ?? 'SUBMITTED') && (
            <span
              aria-hidden="true"
              className="absolute top-1 right-1 size-1 rounded-sm bg-status-warning"
            />
          )}
          {(hasVariance || hasNotes) && (
            <span aria-hidden="true" className="absolute bottom-1 flex items-center gap-0.5">
              {hasVariance && <span className="size-1.5 rounded-full bg-destructive" />}
              {hasNotes && <span className="size-1.5 rounded-full bg-muted-foreground" />}
            </span>
          )}
        </CalendarDayButton>
      )
    },
    [daysByDate]
  )

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen)
        if (nextOpen) {
          const nextDate = startOfDay(date ?? new Date())
          setSelectedDate(nextDate)
          setMonth(nextDate)
        }
      }}
    >
      <DialogTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 min-w-0 justify-start gap-1.5 px-2 text-xs font-medium tabular-nums"
            aria-label={`Change business date, ${format(initialDate, 'EEEE, MMMM d, yyyy')}`}
            disabled={disabled}
          />
        }
      >
        <CalendarIcon data-icon="inline-start" aria-hidden="true" />
        {format(initialDate, 'MMM d, yyyy')}
      </DialogTrigger>
      <DialogContent
        className="w-full max-w-[calc(100%-2rem)] gap-0 overflow-hidden p-0 sm:w-[920px] sm:max-w-[calc(100vw-2rem)]"
        showCloseButton
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Select business date</DialogTitle>
          <DialogDescription>Review report status and select a business date.</DialogDescription>
        </DialogHeader>
        <div className="grid min-h-[26rem] grid-cols-[15rem_minmax(0,1fr)]">
          <aside className="flex flex-col gap-4 bg-muted/30 p-5">
            <div className="flex flex-col gap-1">
              <p className="text-xs text-muted-foreground">Selected day</p>
              <p className="font-heading text-base leading-tight font-medium">
                {format(selectedDate, 'EEE, MMM d')}
              </p>
            </div>
            <Badge
              variant={
                selectedStatus && isUnsubmitted(selectedStatus.status) ? 'outline' : 'secondary'
              }
            >
              {statusLabel(selectedStatus?.status)}
            </Badge>
            {selectedStatus && selectedStatus.cashVarianceCentavos !== 0 && (
              <div className="flex flex-col gap-1">
                <p className="text-xs text-muted-foreground">Cash variance</p>
                <p className="text-sm font-medium tabular-nums text-destructive">
                  {varianceLabel(selectedStatus.cashVarianceCentavos)}
                </p>
              </div>
            )}
            {selectedStatus?.noteCount ? (
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <StickyNote aria-hidden="true" />
                {selectedStatus.noteCount} note{selectedStatus.noteCount === 1 ? '' : 's'}
              </div>
            ) : null}
            <div className="mt-auto flex flex-col gap-3">
              <Separator />
              <div className="flex flex-col gap-2 text-[10px] text-muted-foreground">
                <p className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-destructive" />
                  Variance
                </p>
                <p className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1 rounded-sm bg-status-warning" />
                  Draft
                </p>
                <p className="flex items-center gap-1.5">
                  <span aria-hidden="true" className="size-1.5 rounded-full bg-muted-foreground" />
                  Notes
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
          <div className="flex min-w-0 items-center justify-center p-5">
            {loadError ? (
              <p role="alert" className="text-sm text-destructive">
                Calendar status could not be loaded.
              </p>
            ) : (
              <Calendar
                mode="single"
                selected={selectedDate}
                month={month}
                onMonthChange={setMonth}
                onSelect={(nextDate) => nextDate && setSelectedDate(startOfDay(nextDate))}
                disabled={{ after: startOfDay(new Date()) }}
                fixedWeeks
                components={{ DayButton: StatusDayButton }}
                classNames={{
                  day: 'flex-1 basis-0 min-w-0',
                  weekdays: 'gap-2',
                  week: 'mt-3 gap-2'
                }}
                className="p-0 [--cell-size:--spacing(14)]"
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
