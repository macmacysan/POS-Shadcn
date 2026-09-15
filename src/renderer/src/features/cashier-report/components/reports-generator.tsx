import * as React from 'react'
import * as XLSX from 'xlsx'
import { format, parseISO } from 'date-fns'
import { Check, CircleAlert, FileDown, SlidersHorizontal } from 'lucide-react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Spinner } from '@/components/ui/spinner'
import { Textarea } from '@/components/ui/textarea'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'
import { isVisibleInstallmentHistoryRecord } from '@/lib/installment-history'
import type {
  DailyReportSnapshotResponse,
  ExpenseRecord,
  FinanceAccountRecord,
  InstallmentAccountRecord,
  LoginBranch
} from '@/../../shared/contracts'
import {
  cashierReportPdfHtml,
  type CashierReportSection
} from '@/features/cashier-report/lib/cashier-report-pdf'

type ExcelCell = string | number | null
type ExcelSheetRows = Record<string, ExcelCell>[]
type PdfProgressStepId = 'save' | 'sheets' | 'telegram'
type PdfProgressStatus = 'pending' | 'processing' | 'done' | 'failed'
type PdfProgressStep = {
  id: PdfProgressStepId
  label: string
  status: PdfProgressStatus
  error?: string
  attempts: number
}
type PdfReviewRequest = {
  mode: 'day' | 'range'
  sections: readonly CashierReportSection[]
  filters?: { branch: LoginBranch; dateFrom?: string; dateTo?: string; accountType?: string }
}

const reportSectionOptions = [
  'Cash Summary',
  'Total Cash Receipts',
  'Expenses',
  'Income',
  'Payment',
  'Activity History',
  'Records',
  'Active',
  'Closed',
  'Blacklisted',
  'Finance Accounts'
] as const satisfies readonly CashierReportSection[]

const dailyReportSections = [
  'Cash Summary',
  'Expenses',
  'Income',
  'Payment',
  'Activity History'
] as const satisfies readonly CashierReportSection[]

const initialPdfProgress: PdfProgressStep[] = [
  { id: 'save', label: 'Save to Documents', status: 'pending', attempts: 0 },
  { id: 'sheets', label: 'Upload encrypted Drive snapshot', status: 'pending', attempts: 0 },
  { id: 'telegram', label: 'Send to Telegram', status: 'pending', attempts: 0 }
]

function flattenExcelRecord(value: unknown, prefix = ''): Record<string, ExcelCell> {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    return {
      [prefix || 'Value']: Array.isArray(value) ? JSON.stringify(value) : String(value ?? '')
    }
  const result: Record<string, ExcelCell> = {}
  for (const [key, nested] of Object.entries(value)) {
    const name = prefix ? `${prefix}.${key}` : key
    if (nested && typeof nested === 'object' && !Array.isArray(nested))
      Object.assign(result, flattenExcelRecord(nested, name))
    else if (Array.isArray(nested)) result[name] = JSON.stringify(nested)
    else if (nested == null || (typeof nested === 'number' && !Number.isFinite(nested)))
      result[name] = null
    else
      result[name] =
        typeof nested === 'boolean' ? (nested ? 'TRUE' : 'FALSE') : (nested as ExcelCell)
  }
  return result
}

function installmentAccountRow(item: InstallmentAccountRecord): Record<string, ExcelCell> {
  return { id: item.contractId || item.loan.id || item.account.id, ...flattenExcelRecord(item) }
}

function workbookBase64(sheets: Record<string, ExcelSheetRows>): string {
  const workbook = XLSX.utils.book_new()
  for (const [name, rows] of Object.entries(sheets)) {
    const worksheet = XLSX.utils.json_to_sheet(rows)
    worksheet['!freeze'] = { xSplit: 0, ySplit: 1 }
    XLSX.utils.book_append_sheet(workbook, worksheet, name.slice(0, 31))
  }
  return XLSX.write(workbook, { type: 'base64', bookType: 'xlsx' })
}

function filenameName(value: string): string {
  const parts = value.trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'Report'
  const lastName = parts.pop()!
  return [...parts, lastName.charAt(0)].join(' ').replace(/[^A-Za-z0-9 ]/g, '') || 'Report'
}

type ReportsGeneratorPageProps = {
  reportDate: string
  onReportDateChange: (value: string) => void
  onOpenDateRangeReport: () => void
  isReviewing: boolean
  onReviewDailyReport: () => void
  exportError?: string
  pdfPreview?: { pdfBase64: string; note: string }
  pdfNote: string
  onPdfNoteChange: (value: string) => void
  telegramNote: string
  onTelegramNoteChange: (value: string) => void
  isProcessing: boolean
  hasStartedDelivery: boolean
  onDeliver: () => void
  onUpdatePreview: () => void
  deliveryProgressDialog: React.ReactNode
}

function DeliveryProgressDialog({
  open,
  onOpenChange,
  steps,
  isProcessing,
  onRetry
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  steps: readonly PdfProgressStep[]
  isProcessing: boolean
  onRetry: (id: PdfProgressStepId) => void
}): React.JSX.Element {
  const completed = steps.filter(
    (step) => step.status === 'done' || step.status === 'failed'
  ).length
  const birdPosition = steps.findIndex((step) => step.status === 'processing')
  const landingAt = birdPosition >= 0 ? birdPosition : Math.max(0, completed - 1)

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isProcessing && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden p-0">
        <DialogHeader className="border-b bg-muted/30 px-6 py-5 pr-12">
          <DialogTitle>Delivery progress</DialogTitle>
          <DialogDescription>Follow the report as it reaches each destination.</DialogDescription>
        </DialogHeader>
        <div className="p-6">
          <div className="relative mb-6 h-16" aria-label="Report delivery flight path">
            <div className="absolute left-4 right-4 top-8 border-t border-dashed border-border" />
            <div
              className="report-delivery-bird absolute top-1 text-primary"
              style={{ left: `calc(${landingAt * 50}% + ${landingAt === 0 ? '0' : '2px'})` }}
              aria-hidden="true"
            >
              <svg
                viewBox="0 0 32 24"
                className="size-8"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M2 14c5-8 10-8 14 0 4-5 8-5 14 0" />
                <path d="M16 14v6" />
              </svg>
            </div>
            <div className="absolute inset-x-0 top-7 flex justify-between px-4" aria-hidden="true">
              {steps.map((step) => (
                <span
                  key={step.id}
                  className={cn(
                    'size-3 rounded-full border-2 bg-background',
                    step.status === 'done' && 'border-primary bg-primary',
                    step.status === 'failed' && 'border-destructive bg-destructive',
                    step.status === 'processing' && 'border-primary report-delivery-checkpoint'
                  )}
                />
              ))}
            </div>
          </div>
          <Progress
            value={(completed / steps.length) * 100}
            aria-label="Report delivery progress"
          />
          <div className="mt-5 flex flex-col gap-3">
            {steps.map((step) => (
              <div key={step.id} className="flex items-start gap-3 rounded-xl border bg-card p-3">
                {step.status === 'processing' ? (
                  <Spinner />
                ) : step.status === 'done' ? (
                  <Check className="text-primary" />
                ) : step.status === 'failed' ? (
                  <CircleAlert className="text-destructive" />
                ) : (
                  <span className="mt-1 size-4 rounded-full border border-border" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium">{step.label}</p>
                  {step.error && <p className="mt-1 text-xs text-destructive">{step.error}</p>}
                  {step.status === 'failed' && !isProcessing && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      className="mt-2"
                      onClick={() => onRetry(step.id)}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

function DateRangeReportDialog({
  open,
  onOpenChange,
  dateFrom,
  dateTo,
  onDateFromChange,
  onDateToChange,
  selectedSections,
  onSelectedSectionsChange,
  isReviewing,
  onReview
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  dateFrom: string
  dateTo: string
  onDateFromChange: (value: string) => void
  onDateToChange: (value: string) => void
  selectedSections: readonly CashierReportSection[]
  onSelectedSectionsChange: (sections: CashierReportSection[]) => void
  isReviewing: boolean
  onReview: () => void
}): React.JSX.Element {
  const selectedSectionSet = new Set(selectedSections)
  const hasValidDateRange = Boolean(dateFrom && dateTo && dateFrom <= dateTo)

  const toggleSection = (section: CashierReportSection, checked: boolean): void => {
    onSelectedSectionsChange(
      checked
        ? [...selectedSections, section]
        : selectedSections.filter((selectedSection) => selectedSection !== section)
    )
  }

  return (
    <Dialog open={open} onOpenChange={(nextOpen) => !isReviewing && onOpenChange(nextOpen)}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Date range report</DialogTitle>
          <DialogDescription>
            Select the reporting period and the sections to include in the PDF.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label htmlFor="range-report-from" className="text-xs font-medium">
                From
              </label>
              <DatePickerInput
                id="range-report-from"
                value={dateFrom}
                onValueChange={onDateFromChange}
                className="mt-2 w-full"
              />
            </div>
            <div>
              <label htmlFor="range-report-to" className="text-xs font-medium">
                To
              </label>
              <DatePickerInput
                id="range-report-to"
                value={dateTo}
                onValueChange={onDateToChange}
                min={dateFrom}
                className="mt-2 w-full"
              />
            </div>
          </div>
          {!hasValidDateRange && dateFrom && dateTo && (
            <p className="text-xs text-destructive">
              The end date must be on or after the start date.
            </p>
          )}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">PDF contents</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Choose one or more sections for this range report.
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onSelectedSectionsChange([...reportSectionOptions])}
              >
                Select all
              </Button>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
              {reportSectionOptions.map((section) => (
                <label key={section} className="flex min-w-0 items-center gap-2 text-[13px]">
                  <Checkbox
                    checked={selectedSectionSet.has(section)}
                    onCheckedChange={(checked) => toggleSection(section, checked === true)}
                  />
                  <span className="truncate">{section}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button
            type="button"
            variant="outline"
            disabled={isReviewing}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={isReviewing || !hasValidDateRange || selectedSections.length === 0}
            onClick={onReview}
          >
            {isReviewing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <FileDown data-icon="inline-start" />
            )}
            Review range report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

export function ReportsGeneratorPage({
  reportDate,
  onReportDateChange,
  onOpenDateRangeReport,
  isReviewing,
  onReviewDailyReport,
  exportError,
  pdfPreview,
  pdfNote,
  onPdfNoteChange,
  telegramNote,
  onTelegramNoteChange,
  isProcessing,
  hasStartedDelivery,
  onDeliver,
  onUpdatePreview,
  deliveryProgressDialog
}: ReportsGeneratorPageProps): React.JSX.Element {
  return (
    <main className="flex min-h-0 flex-1 flex-col gap-4 overflow-hidden bg-workspace p-4">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-4 rounded-xl border bg-card px-5 py-4">
        <div>
          <h1 className="font-heading text-lg font-medium">Daily cashier report</h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Review the selected business day. Past reports are available when needed.
          </p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <DatePickerInput
            aria-label="Business date"
            value={reportDate}
            onValueChange={onReportDateChange}
            className="w-40"
          />
          <Button type="button" variant="outline" onClick={onOpenDateRangeReport}>
            <SlidersHorizontal data-icon="inline-start" />
            Date range report
          </Button>
          <Button type="button" disabled={isReviewing || !reportDate} onClick={onReviewDailyReport}>
            {isReviewing ? (
              <Spinner data-icon="inline-start" />
            ) : (
              <FileDown data-icon="inline-start" />
            )}
            Review daily report
          </Button>
        </div>
      </header>
      {exportError && (
        <Alert variant="destructive">
          <AlertTitle>Report unavailable</AlertTitle>
          <AlertDescription>{exportError}</AlertDescription>
        </Alert>
      )}
      {pdfPreview ? (
        <div className="grid min-h-0 flex-1 grid-rows-[minmax(18rem,1fr)_auto] overflow-hidden rounded-xl border bg-card lg:grid-cols-[minmax(0,1fr)_22rem] lg:grid-rows-1">
          <section className="flex min-h-0 flex-col bg-muted/30 p-4" aria-label="PDF preview">
            <div className="mb-2 flex items-center justify-between text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <span>PDF preview</span>
              <span>Final document</span>
            </div>
            <iframe
              title="Cashier report PDF preview"
              src={`data:application/pdf;base64,${pdfPreview.pdfBase64}`}
              className="min-h-0 flex-1 rounded-md border bg-background"
            />
          </section>
          <aside className="flex min-h-0 flex-col border-t lg:border-l lg:border-t-0">
            <div className="border-b p-5">
              <p className="text-sm font-semibold">Delivery</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Save a copy and send it when ready.
              </p>
              <Button
                type="button"
                className="mt-4 w-full"
                disabled={isProcessing || pdfPreview.note !== pdfNote}
                onClick={onDeliver}
              >
                {isProcessing ? (
                  <Spinner data-icon="inline-start" />
                ) : (
                  <FileDown data-icon="inline-start" />
                )}
                {hasStartedDelivery ? 'View delivery progress' : 'Deliver report'}
              </Button>
            </div>
            <div className="p-5">
              <label htmlFor="report-page-note" className="text-xs font-medium">
                PDF note
              </label>
              <Textarea
                id="report-page-note"
                value={pdfNote}
                onChange={(event) => onPdfNoteChange(event.target.value)}
                placeholder="Optional note at the end of this PDF"
                maxLength={800}
                rows={4}
                disabled={isProcessing}
                className="mt-2 resize-none text-sm"
              />
              <label htmlFor="report-page-telegram-note" className="mt-4 block text-xs font-medium">
                Telegram note
              </label>
              <Textarea
                id="report-page-telegram-note"
                value={telegramNote}
                onChange={(event) => onTelegramNoteChange(event.target.value)}
                placeholder="Optional note to include with the Telegram delivery"
                maxLength={800}
                rows={2}
                disabled={isProcessing}
                className="mt-2 resize-none text-sm"
              />
              {pdfPreview.note !== pdfNote && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={isReviewing}
                  onClick={onUpdatePreview}
                >
                  Update preview
                </Button>
              )}
            </div>
          </aside>
        </div>
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center rounded-xl border bg-card p-6 text-center">
          <div>
            <FileDown className="mx-auto size-5 text-muted-foreground" />
            <p className="mt-3 text-sm font-medium">Choose a date to create a report</p>
            <p className="mt-1 text-xs text-muted-foreground">
              The completed report will appear here for review.
            </p>
          </div>
        </div>
      )}
      {deliveryProgressDialog}
    </main>
  )
}

function ReportPreviewDialog({
  open,
  onOpenChange,
  preview,
  pdfNote,
  onPdfNoteChange,
  telegramNote,
  onTelegramNoteChange,
  isReviewing,
  isProcessing,
  isExcelExporting,
  hasStartedDelivery,
  onUpdatePreview,
  onViewDeliveryProgress,
  onExportExcel,
  onCancel,
  onDeliver
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preview?: { pdfBase64: string; note: string }
  pdfNote: string
  onPdfNoteChange: (value: string) => void
  telegramNote: string
  onTelegramNoteChange: (value: string) => void
  isReviewing: boolean
  isProcessing: boolean
  isExcelExporting: boolean
  hasStartedDelivery: boolean
  onUpdatePreview: () => void
  onViewDeliveryProgress: () => void
  onExportExcel: () => void
  onCancel: () => void
  onDeliver: () => void
}): React.JSX.Element {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="h-[min(88vh,54rem)] w-[min(96vw,88rem)] max-w-none grid-rows-[auto_minmax(0,1fr)] gap-0 overflow-hidden p-0 sm:max-w-none">
        <DialogHeader className="border-b bg-background px-6 py-4 pr-12 sm:px-7">
          <div className="flex items-center gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              <FileDown className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <DialogTitle className="truncate text-lg tracking-tight">Review Report</DialogTitle>
              <DialogDescription className="mt-0.5">
                Check the PDF, then choose how to deliver it.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>
        <div className="grid min-h-0 grid-rows-[minmax(16rem,1fr)_minmax(21rem,auto)] lg:grid-cols-[minmax(0,7fr)_minmax(20rem,3fr)] lg:grid-rows-1">
          <section
            className="flex min-h-0 flex-col bg-muted/30 p-3 sm:p-4 lg:border-r"
            aria-label="PDF preview"
          >
            <div className="flex items-center justify-between px-1 pb-2.5 text-xs font-medium uppercase tracking-widest text-muted-foreground">
              <span>PDF preview</span>
              <span>Final document</span>
            </div>
            {preview && (
              <iframe
                title="Cashier report PDF preview"
                src={`data:application/pdf;base64,${preview.pdfBase64}`}
                className="min-h-0 flex-1 w-full rounded-md border border-border bg-background shadow-sm"
              />
            )}
          </section>
          <aside className="flex min-h-0 flex-col bg-card lg:border-l-0">
            <div className="shrink-0 border-b bg-muted/20 p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold">Report details</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">
                    Add context before delivery.
                  </p>
                </div>
                <span className="text-xs font-medium uppercase tracking-widest text-muted-foreground">
                  Optional
                </span>
              </div>
              <label
                htmlFor="pdf-report-note"
                className="mt-4 block text-xs font-medium text-muted-foreground"
              >
                PDF note
              </label>
              <Textarea
                id="pdf-report-note"
                value={pdfNote}
                onChange={(event) => onPdfNoteChange(event.target.value)}
                placeholder="Optional note at the end of this PDF"
                maxLength={800}
                rows={3}
                disabled={isProcessing || isReviewing}
                className="mt-2 min-h-20 resize-none text-sm"
              />
              <label
                htmlFor="pdf-report-telegram-note"
                className="mt-4 block text-xs font-medium text-muted-foreground"
              >
                Telegram note
              </label>
              <Textarea
                id="pdf-report-telegram-note"
                value={telegramNote}
                onChange={(event) => onTelegramNoteChange(event.target.value)}
                placeholder="Optional note to include with the Telegram delivery"
                maxLength={800}
                rows={2}
                disabled={isProcessing || isReviewing}
                className="mt-2 resize-none text-sm"
              />
              {preview?.note !== pdfNote && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  disabled={isReviewing}
                  onClick={onUpdatePreview}
                >
                  {isReviewing ? <Spinner data-icon="inline-start" /> : null}
                  Update preview
                </Button>
              )}
            </div>
            <div className="flex flex-1 flex-col justify-center p-5">
              <p className="text-sm font-semibold">Ready to deliver</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Delivery progress opens in a focused window with live checkpoints.
              </p>
              <Button
                type="button"
                variant="outline"
                className="mt-4 self-start"
                onClick={onViewDeliveryProgress}
              >
                View delivery progress
              </Button>
            </div>
            <DialogFooter className="mx-0 mb-0 flex-wrap rounded-none border-t px-4 py-4 sm:px-5">
              <Button
                type="button"
                variant="outline"
                disabled={isProcessing || isExcelExporting}
                onClick={onExportExcel}
              >
                {isExcelExporting ? <Spinner data-icon="inline-start" /> : null}
                Export in Excel
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isProcessing || isExcelExporting}
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={isProcessing || preview?.note !== pdfNote}
                onClick={onDeliver}
              >
                {isProcessing ? <Spinner data-icon="inline-start" /> : null}
                {hasStartedDelivery ? 'Done' : 'Send'}
              </Button>
            </DialogFooter>
          </aside>
        </div>
      </DialogContent>
    </Dialog>
  )
}

type ReportsGeneratorProps = {
  reportPage: boolean
  selectedBranch: LoginBranch
  cashierName: string
  reportId: string
  businessDate: string
  summarySnapshotRef: React.RefObject<DailyReportSnapshotResponse | undefined>
}

export function ReportsGenerator({
  reportPage,
  selectedBranch,
  cashierName,
  reportId,
  businessDate,
  summarySnapshotRef
}: ReportsGeneratorProps): React.JSX.Element {
  const [exportError, setExportError] = React.useState<string>()
  const [isReviewingPdf, setIsReviewingPdf] = React.useState(false)
  const [pdfPreview, setPdfPreview] = React.useState<{
    fileName: string
    pdfBase64: string
    note: string
  }>()
  const [excelSheets, setExcelSheets] = React.useState<Record<string, ExcelSheetRows>>({})
  const [publishContext, setPublishContext] = React.useState<{
    branch: LoginBranch
    businessDate?: string
    tabs: Record<string, ExcelSheetRows>
  }>()
  const [isExcelExporting, setIsExcelExporting] = React.useState(false)
  const [, setExcelExportMessage] = React.useState<string>()
  const [isPdfReviewOpen, setIsPdfReviewOpen] = React.useState(false)
  const [isDeliveryProgressOpen, setIsDeliveryProgressOpen] = React.useState(false)
  const [reportPageDate, setReportPageDate] = React.useState(() => format(new Date(), 'yyyy-MM-dd'))
  const [isRangeReportOpen, setIsRangeReportOpen] = React.useState(false)
  const [rangeReportDateFrom, setRangeReportDateFrom] = React.useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  )
  const [rangeReportDateTo, setRangeReportDateTo] = React.useState(() =>
    format(new Date(), 'yyyy-MM-dd')
  )
  const [rangeReportSections, setRangeReportSections] = React.useState<CashierReportSection[]>([])
  const [pdfProgress, setPdfProgress] = React.useState<PdfProgressStep[]>(initialPdfProgress)
  const [isPdfProcessing, setIsPdfProcessing] = React.useState(false)
  const [pdfNote, setPdfNote] = React.useState('')
  const [pdfReviewRequest, setPdfReviewRequest] = React.useState<PdfReviewRequest>()
  const [telegramNote, setTelegramNote] = React.useState('')

  const updateRangeReportDateFrom = React.useCallback((value: string): void => {
    setRangeReportDateFrom(value)
    setRangeReportDateTo((currentValue) =>
      currentValue && value && currentValue < value ? value : currentValue
    )
  }, [])

  const reviewPdf = async (
    mode: 'day' | 'range',
    sections: readonly CashierReportSection[],
    filters?: { branch: LoginBranch; dateFrom?: string; dateTo?: string; accountType?: string }
  ): Promise<void> => {
    setPdfReviewRequest({ mode, sections, filters })
    setIsReviewingPdf(true)
    setExportError(undefined)
    setIsPdfReviewOpen(false)
    setPdfPreview(undefined)
    try {
      const branchFilter = filters?.branch ?? selectedBranch
      const allExpenses: ExpenseRecord[] = []
      for (let pageIndex = 0; ; pageIndex += 1) {
        const result = await window.api.reports.expenses.list({
          reportId: undefined,
          includeVoided: true,
          branch: branchFilter === 'All Branch' ? undefined : branchFilter,
          dateFrom: filters?.dateFrom,
          dateTo: filters?.dateTo,
          pageIndex,
          pageSize: 100,
          search: '',
          sorting: [],
          filters: {}
        })
        allExpenses.push(...result.rows)
        if (allExpenses.length >= result.totalRows) break
      }
      const [
        snapshot,
        incomeResult,
        paymentResult,
        installmentHistory,
        records,
        active,
        closed,
        blacklisted,
        financeAccounts,
        charts
      ] = await Promise.all([
        mode === 'range'
          ? window.api.dailyReports.getRangeSnapshot({
              branch: branchFilter,
              dateFrom: filters?.dateFrom ?? businessDate,
              dateTo: filters?.dateTo ?? businessDate
            })
          : window.api.dailyReports.getSnapshot({ dailyReportId: reportId }),
        window.api.dailyReports.listIncome({
          branch: branchFilter,
          dateFrom: filters?.dateFrom,
          dateTo: filters?.dateTo,
          includeVoided: true
        }),
        window.api.dailyReports.listPayments({
          branch: branchFilter,
          dateFrom: filters?.dateFrom,
          dateTo: filters?.dateTo,
          includeVoided: true
        }),
        window.api.installments.listHistory({
          dateFrom: filters?.dateFrom,
          dateTo: filters?.dateTo
        }),
        window.api.installments.list({
          view: 'records',
          search: '',
          branch: branchFilter === 'All Branch' ? undefined : branchFilter,
          includeVoided: true
        }),
        window.api.installments.list({
          view: 'active',
          search: '',
          branch: branchFilter === 'All Branch' ? undefined : branchFilter,
          includeVoided: true
        }),
        window.api.installments.list({
          view: 'closed',
          search: '',
          branch: branchFilter === 'All Branch' ? undefined : branchFilter,
          includeVoided: true
        }),
        window.api.installments.list({
          view: 'blacklisted',
          search: '',
          branch: branchFilter === 'All Branch' ? undefined : branchFilter,
          includeVoided: true
        }),
        window.api.financeAccounts.list({
          search: '',
          includeVoided: true,
          ...(branchFilter === 'All Branch' ? {} : { branch: branchFilter })
        }),
        window.api.dashboard.getPdfCharts({
          businessDate: filters?.dateTo ?? businessDate,
          ...(branchFilter === 'All Branch' ? {} : { branch: branchFilter })
        })
      ])
      const postedExpenses = allExpenses.filter(
        (item) => item.source === 'local' && item.status === 'POSTED'
      )
      const postedIncomes = incomeResult.rows.filter(
        (item) => item.source === 'local' && item.status === 'POSTED'
      )
      const postedPayments = paymentResult.rows.filter(
        (item) => item.source === 'local' && item.status === 'POSTED'
      )
      const filteredFinanceAccounts = financeAccounts.rows.filter(
        (item: FinanceAccountRecord) =>
          (!filters?.dateFrom || item.dateReleased >= filters.dateFrom) &&
          (!filters?.dateTo || item.dateReleased <= filters.dateTo) &&
          (!filters?.accountType ||
            filters.accountType === 'All Types' ||
            item.provider === filters.accountType)
      )
      const isWithinDateRange = (date: string): boolean =>
        (!filters?.dateFrom || date >= filters.dateFrom) &&
        (!filters?.dateTo || date <= filters.dateTo)
      const filteredAccountLists = {
        records: records.rows.filter((item) => isWithinDateRange(item.loan.dateReleased)),
        active: active.rows.filter((item) => isWithinDateRange(item.loan.dateReleased)),
        closed: closed.rows.filter((item) => isWithinDateRange(item.loan.dateReleased)),
        blacklisted: blacklisted.rows.filter((item) => isWithinDateRange(item.loan.dateReleased))
      }
      const nextExcelSheets: Record<string, ExcelSheetRows> = {}
      if (sections?.includes('Expenses'))
        nextExcelSheets.Expenses = postedExpenses.map((item) => flattenExcelRecord(item))
      if (sections?.includes('Income'))
        nextExcelSheets.Income = postedIncomes.map((item) => flattenExcelRecord(item))
      if (sections?.includes('Payment'))
        nextExcelSheets.Payment = postedPayments.map((item) => flattenExcelRecord(item))
      if (sections?.includes('Total Cash Receipts')) {
        const totalCashReceiptsCentavos =
          snapshot.receiptTotals.reduce((total, item) => total + item.amountCentavos, 0) +
          snapshot.cashCollectionsCentavos +
          snapshot.otherIncomeCentavos +
          snapshot.financeDownCentavos
        nextExcelSheets['Total Cash Receipts'] = [
          ...snapshot.receiptTotals.map((item) => ({
            Type: item.receiptName,
            Quantity: item.quantity,
            Amount: item.amountCentavos / 100
          })),
          ...[
            { Type: 'Collections', Amount: snapshot.cashCollectionsCentavos },
            { Type: 'Other Income', Amount: snapshot.otherIncomeCentavos },
            { Type: 'Finance Downpayment', Amount: snapshot.financeDownCentavos }
          ]
            .filter((item) => item.Amount > 0)
            .map((item) => ({
              Type: item.Type,
              Quantity: null,
              Amount: item.Amount / 100
            })),
          {
            Type: 'Total Cash Receipts',
            Quantity: snapshot.receiptTotals.reduce((total, item) => total + item.quantity, 0),
            Amount: totalCashReceiptsCentavos / 100
          }
        ]
      }
      if (sections?.includes('Activity History'))
        nextExcelSheets['Activity History'] = installmentHistory
          .filter(
            (item) =>
              isVisibleInstallmentHistoryRecord(item) &&
              (branchFilter === 'All Branch' || item.branch === branchFilter)
          )
          .map((item) => flattenExcelRecord(item))
      if (sections?.includes('Finance Accounts'))
        nextExcelSheets['Finance Accounts'] = filteredFinanceAccounts.map((item) =>
          flattenExcelRecord(item)
        )
      if (sections?.includes('Records'))
        nextExcelSheets.Records = filteredAccountLists.records.map(installmentAccountRow)
      if (sections?.includes('Active'))
        nextExcelSheets.Active = filteredAccountLists.active.map(installmentAccountRow)
      if (sections?.includes('Closed'))
        nextExcelSheets.Closed = filteredAccountLists.closed.map(installmentAccountRow)
      if (sections?.includes('Blacklisted'))
        nextExcelSheets.Blacklisted = filteredAccountLists.blacklisted.map(installmentAccountRow)
      setExcelSheets(nextExcelSheets)
      setPublishContext({
        branch: branchFilter,
        businessDate: filters?.dateFrom === filters?.dateTo ? filters?.dateFrom : undefined,
        tabs: {
          Expenses: allExpenses
            .filter((item) => item.source === 'local')
            .map((item) => flattenExcelRecord(item)),
          Income: incomeResult.rows
            .filter((item) => item.source === 'local')
            .map((item) => flattenExcelRecord(item)),
          Payment: paymentResult.rows
            .filter((item) => item.source === 'local')
            .map((item) => flattenExcelRecord(item)),
          Records: filteredAccountLists.records.map(installmentAccountRow),
          Finance: filteredFinanceAccounts.map((item) => flattenExcelRecord(item))
        }
      })
      setExcelExportMessage(undefined)
      const contributors = [
        ...postedExpenses.map((item) => item.createdByName),
        ...postedIncomes.map((item) => item.createdByName),
        ...postedPayments.map((item) => item.createdByName)
      ].filter((name): name is string => Boolean(name?.trim()))
      const now = new Date()
      const html = cashierReportPdfHtml({
        cashierName: [...new Set(contributors)].join(', ') || cashierName,
        branch: branchFilter,
        businessDate:
          filters?.dateFrom && filters?.dateTo
            ? `${filters.dateFrom} to ${filters.dateTo}`
            : businessDate,
        generatedAt: format(now, 'MMM d, yyyy · h:mm a'),
        note: pdfNote,
        snapshot:
          mode === 'day' && summarySnapshotRef.current?.report.id === reportId
            ? summarySnapshotRef.current
            : snapshot,
        expenses: postedExpenses,
        incomes: postedIncomes,
        payments: postedPayments,
        installmentHistory: installmentHistory.filter(
          (item) => branchFilter === 'All Branch' || item.branch === branchFilter
        ),
        accountCounts: {
          records: filteredAccountLists.records.length,
          active: filteredAccountLists.active.length,
          closed: filteredAccountLists.closed.length,
          blacklisted: filteredAccountLists.blacklisted.length
        },
        charts,
        includeCharts: mode === 'day',
        sections,
        financeAccounts: filteredFinanceAccounts,
        accountLists: filteredAccountLists
      })
      const reportDate = filters?.dateFrom ?? businessDate
      const { pdfBase64 } = await window.api.pdfExport.preview({
        html,
        fileName: `${format(parseISO(reportDate), 'MMMM d, yyyy')} - ${filenameName(cashierName)}.pdf`
      })
      setPdfProgress(initialPdfProgress)
      setTelegramNote('')
      setPdfPreview({
        fileName: `${format(parseISO(reportDate), 'MMMM d, yyyy')} - ${filenameName(cashierName)}.pdf`,
        pdfBase64,
        note: pdfNote
      })
      setIsPdfReviewOpen(true)
    } catch (error) {
      setExportError(
        error &&
          typeof error === 'object' &&
          'message' in error &&
          typeof error.message === 'string'
          ? error.message
          : 'The PDF could not be exported. Please try again.'
      )
    } finally {
      setIsReviewingPdf(false)
    }
  }

  const updatePdfStep = React.useCallback(
    (id: PdfProgressStepId, patch: Partial<PdfProgressStep>): void => {
      setPdfProgress((steps) =>
        steps.map((step) => (step.id === id ? { ...step, ...patch } : step))
      )
    },
    []
  )
  const runPdfStep = React.useCallback(
    async (id: PdfProgressStepId, operation: () => Promise<void>): Promise<void> => {
      let lastError = 'This operation failed.'
      for (let attempt = 1; attempt <= 3; attempt += 1) {
        updatePdfStep(id, { status: 'processing', attempts: attempt, error: undefined })
        try {
          await operation()
          if (id === 'telegram') {
            await window.api.dailyReports.markDelivery({
              dailyReportId: reportId,
              channel: 'TELEGRAM'
            })
            window.dispatchEvent(new Event('daily-report-delivery-updated'))
          }
          updatePdfStep(id, { status: 'done', error: undefined })
          return
        } catch (error) {
          lastError =
            id !== 'save' && error instanceof Error && error.message
              ? error.message
              : 'Saving the report was canceled or failed.'
        }
      }
      updatePdfStep(id, { status: 'failed', error: lastError })
    },
    [reportId, updatePdfStep]
  )
  const pdfOperation = React.useCallback(
    (
      id: PdfProgressStepId,
      preview: { fileName: string; pdfBase64: string }
    ): (() => Promise<void>) => {
      if (id === 'save')
        return async () => {
          const result = await window.api.pdfExport.save(preview)
          if (result.canceled) throw new Error('Save canceled')
        }
      if (id === 'sheets')
        return async () => {
          if (
            !publishContext ||
            publishContext.branch === 'All Branch' ||
            !publishContext.businessDate
          )
            throw new Error('Select one branch and one business date to publish.')
          await window.api.googleSync.sync({ branch: publishContext.branch })
        }
      return () =>
        window.api.pdfExport.sendTelegram({
          ...preview,
          caption: [
            `Date: ${businessDate}`,
            `Time: ${format(new Date(), 'hh:mm a')}`,
            `Branch: ${selectedBranch}`,
            `Name: ${cashierName}`,
            '',
            `Note: ${telegramNote.trim()}`
          ].join('\n')
        })
    },
    [businessDate, cashierName, publishContext, selectedBranch, telegramNote]
  )
  const startPdfExport = React.useCallback(async (): Promise<void> => {
    if (!pdfPreview) return
    setPdfProgress(initialPdfProgress)
    setIsPdfProcessing(true)
    for (const step of initialPdfProgress)
      await runPdfStep(step.id, pdfOperation(step.id, pdfPreview))
    setIsPdfProcessing(false)
  }, [pdfOperation, pdfPreview, runPdfStep])
  const beginPdfExport = React.useCallback((): void => {
    if (pdfPreview) {
      setPdfProgress(initialPdfProgress)
      void startPdfExport()
    }
  }, [pdfPreview, startPdfExport])
  const retryPdfStep = React.useCallback(
    async (id: PdfProgressStepId): Promise<void> => {
      if (!pdfPreview || isPdfProcessing || pdfPreview.note !== pdfNote) return
      setIsPdfProcessing(true)
      await runPdfStep(id, pdfOperation(id, pdfPreview))
      setIsPdfProcessing(false)
    },
    [isPdfProcessing, pdfNote, pdfOperation, pdfPreview, runPdfStep]
  )
  const exportExcel = React.useCallback(async (): Promise<void> => {
    if (!pdfPreview || !Object.keys(excelSheets).length || isExcelExporting) return
    setIsExcelExporting(true)
    setExcelExportMessage(undefined)
    try {
      const result = await window.api.pdfExport.saveExcel({
        workbookBase64: workbookBase64(excelSheets),
        fileName: pdfPreview.fileName.replace(/\.pdf$/i, '.xlsx')
      })
      if (!result.canceled) setExcelExportMessage('Excel workbook saved.')
    } catch {
      setExcelExportMessage('Excel could not be exported. Please try again.')
    } finally {
      setIsExcelExporting(false)
    }
  }, [excelSheets, isExcelExporting, pdfPreview])

  const deliveryProgressDialog = (
    <DeliveryProgressDialog
      open={isDeliveryProgressOpen}
      onOpenChange={setIsDeliveryProgressOpen}
      steps={pdfProgress}
      isProcessing={isPdfProcessing}
      onRetry={(id) => void retryPdfStep(id)}
    />
  )

  if (reportPage) {
    return (
      <>
        <ReportsGeneratorPage
          reportDate={reportPageDate}
          onReportDateChange={setReportPageDate}
          onOpenDateRangeReport={() => setIsRangeReportOpen(true)}
          isReviewing={isReviewingPdf}
          onReviewDailyReport={() =>
            void reviewPdf('day', dailyReportSections, {
              branch: selectedBranch,
              dateFrom: reportPageDate,
              dateTo: reportPageDate
            })
          }
          exportError={exportError}
          pdfPreview={pdfPreview}
          pdfNote={pdfNote}
          onPdfNoteChange={setPdfNote}
          telegramNote={telegramNote}
          onTelegramNoteChange={setTelegramNote}
          isProcessing={isPdfProcessing}
          hasStartedDelivery={pdfProgress.some((step) => step.status !== 'pending')}
          onDeliver={() => {
            setIsDeliveryProgressOpen(true)
            if (pdfProgress.every((step) => step.status === 'pending')) beginPdfExport()
          }}
          onUpdatePreview={() => {
            if (pdfReviewRequest)
              void reviewPdf(
                pdfReviewRequest.mode,
                pdfReviewRequest.sections,
                pdfReviewRequest.filters
              )
          }}
          deliveryProgressDialog={deliveryProgressDialog}
        />
        <DateRangeReportDialog
          open={isRangeReportOpen}
          onOpenChange={setIsRangeReportOpen}
          dateFrom={rangeReportDateFrom}
          dateTo={rangeReportDateTo}
          onDateFromChange={updateRangeReportDateFrom}
          onDateToChange={setRangeReportDateTo}
          selectedSections={rangeReportSections}
          onSelectedSectionsChange={setRangeReportSections}
          isReviewing={isReviewingPdf}
          onReview={() => {
            setIsRangeReportOpen(false)
            void reviewPdf('range', rangeReportSections, {
              branch: selectedBranch,
              dateFrom: rangeReportDateFrom,
              dateTo: rangeReportDateTo
            })
          }}
        />
      </>
    )
  }

  return (
    <>
      <ReportPreviewDialog
        open={Boolean(pdfPreview) && isPdfReviewOpen}
        onOpenChange={(open) => {
          if (!open && !isPdfProcessing) {
            setIsPdfReviewOpen(false)
            setPdfPreview(undefined)
          }
        }}
        preview={pdfPreview}
        pdfNote={pdfNote}
        onPdfNoteChange={setPdfNote}
        telegramNote={telegramNote}
        onTelegramNoteChange={setTelegramNote}
        isReviewing={isReviewingPdf}
        isProcessing={isPdfProcessing}
        isExcelExporting={isExcelExporting}
        hasStartedDelivery={pdfProgress.some((step) => step.status !== 'pending')}
        onUpdatePreview={() => {
          if (pdfReviewRequest)
            void reviewPdf(
              pdfReviewRequest.mode,
              pdfReviewRequest.sections,
              pdfReviewRequest.filters
            )
        }}
        onViewDeliveryProgress={() => setIsDeliveryProgressOpen(true)}
        onExportExcel={() => void exportExcel()}
        onCancel={() => {
          setIsPdfReviewOpen(false)
          setPdfPreview(undefined)
        }}
        onDeliver={() => {
          if (pdfProgress.every((step) => step.status === 'pending')) {
            setIsDeliveryProgressOpen(true)
            beginPdfExport()
          } else {
            setIsPdfReviewOpen(false)
            setPdfPreview(undefined)
          }
        }}
      />
      {deliveryProgressDialog}
    </>
  )
}
