import * as React from 'react'
import { TriangleAlert } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import type {
  InstallmentAttentionItem,
  InstallmentAttentionSummary,
  LoginBranch
} from '@/../../shared/contracts'
import { formatHistoryDate } from '@/lib/installment-history'

type AttentionRow = InstallmentAttentionItem & { status: 'Overdue' | 'Near due' }

function attentionLabel(item: InstallmentAttentionItem): string {
  if (item.daysFromToday < 0) {
    const days = Math.abs(item.daysFromToday)
    return `${days} day${days === 1 ? '' : 's'} overdue`
  }
  return item.daysFromToday === 0 ? 'Due today' : `Due in ${item.daysFromToday} days`
}

export function InstallmentAttentionAlertDialog({
  branch
}: {
  branch: LoginBranch
}): React.JSX.Element | null {
  const [summary, setSummary] = React.useState<InstallmentAttentionSummary>()
  const [open, setOpen] = React.useState(false)

  React.useEffect(() => {
    let cancelled = false
    void window.api.installments
      .getAttentionSummary({ ...(branch === 'All Branch' ? {} : { branch }) })
      .then((nextSummary) => {
        if (cancelled || (nextSummary.overdueCount === 0 && nextSummary.nearDueCount === 0)) return
        setSummary(nextSummary)
        setOpen(true)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [branch])

  if (!summary) return null

  const rows: AttentionRow[] = [
    ...summary.overdue.map((item) => ({ ...item, status: 'Overdue' as const })),
    ...summary.nearDue.map((item) => ({ ...item, status: 'Near due' as const }))
  ].slice(0, 5)

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogContent className="gap-6 p-8 sm:max-w-2xl">
        <div className="flex flex-col items-center gap-2 text-center">
          <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <TriangleAlert aria-hidden="true" />
            {' '}
          </div>
          <AlertDialogTitle>Installment accounts need attention</AlertDialogTitle>
          <AlertDialogDescription className="max-w-md">
            Review the overdue and near-due accounts below.
          </AlertDialogDescription>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-destructive/10 p-4">
            <p className="text-xs font-medium text-muted-foreground">Overdue accounts</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums text-destructive">
              {summary.overdueCount}
            </p>
          </div>
          <div className="rounded-xl bg-muted/60 p-4">
            <p className="text-xs font-medium text-muted-foreground">Near due accounts</p>
            <p className="mt-1 text-2xl font-semibold tabular-nums">{summary.nearDueCount}</p>
          </div>
        </div>

        <ScrollArea className="max-h-72 rounded-xl border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Account</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Due date</TableHead>
                <TableHead className="text-right">Schedule</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((item) => (
                <TableRow key={item.accountId}>
                  <TableCell className="font-medium">{item.accountName}</TableCell>
                  <TableCell
                    className={
                      item.status === 'Overdue' ? 'text-destructive' : 'text-warning-foreground'
                    }
                  >
                    {item.status}
                  </TableCell>
                  <TableCell>{formatHistoryDate(item.nextDue)}</TableCell>
                  <TableCell className="text-right tabular-nums">{attentionLabel(item)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>

        <AlertDialogFooter className="-mx-8 -mb-8 px-8">
          <AlertDialogCancel className="w-full sm:w-full">Okay</AlertDialogCancel>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
