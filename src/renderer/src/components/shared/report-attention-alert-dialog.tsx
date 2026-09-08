import * as React from 'react'
import { format, parseISO } from 'date-fns'
import { Send, TriangleAlert } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { formatCentavos } from '@/lib/currency'
import type { LoginBranch } from '@/../../shared/contracts'

export function ReportAttentionAlertDialog({
  branch,
  enabled,
  onNext
}: {
  branch: LoginBranch
  enabled: boolean
  onNext: (reportId: string) => void
}): React.JSX.Element | null {
  const [rows, setRows] =
    React.useState<{ reportId: string; businessDate: string; cashVarianceCentavos: number }[]>()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    if (!enabled) return
    let cancelled = false
    setRows(undefined)
    void window.api.dailyReports
      .getAttention({ branch })
      .then((nextRows) => {
        if (cancelled) return
        setRows(nextRows.rows)
        setOpen(nextRows.rows.length > 0)
      })
      .catch(() => {
        if (!cancelled) setRows([])
      })
    return () => {
      cancelled = true
    }
  }, [branch, enabled])

  if (!rows?.length) return null
  const first = rows[0]

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="gap-6 p-8 sm:max-w-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert aria-hidden="true" />
          </div>
          <AlertDialogTitle>Report delivery and cash variance need attention</AlertDialogTitle>
          <AlertDialogDescription className="max-w-md">
            {rows.length} report{rows.length === 1 ? '' : 's'} were not sent to Telegram and have a
            cash shortfall.
          </AlertDialogDescription>
        </div>

        <ScrollArea className="max-h-72 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Delivery</TableHead>
                <TableHead className="text-right">Cash variance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.slice(0, 5).map((row) => (
                <TableRow key={row.reportId}>
                  <TableCell className="font-medium">
                    {format(parseISO(row.businessDate), 'MMM d, yyyy')}
                  </TableCell>
                  <TableCell className="text-destructive">
                    <span className="flex items-center gap-2">
                      <Send className="size-3" />
                      Not sent
                    </span>
                  </TableCell>
                  <TableCell className="text-right font-medium tabular-nums text-destructive">
                    {formatCentavos(row.cashVarianceCentavos)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <AlertDialogFooter className="-mx-8 -mb-8 px-8">
          <Button
            className="w-full sm:w-full"
            onClick={() => {
              setOpen(false)
              onNext(first.reportId)
            }}
          >
            Next
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
