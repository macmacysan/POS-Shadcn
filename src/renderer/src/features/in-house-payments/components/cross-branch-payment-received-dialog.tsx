import { format } from 'date-fns'
import * as React from 'react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { formatPhilippinePeso } from '@/lib/currency'
import type { CrossBranchPaymentReceipt } from '../../../../../shared/contracts'

function Detail({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="min-w-0 space-y-1">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="break-words text-sm font-medium">{value || '—'}</dd>
    </div>
  )
}

function dateLabel(value?: string): string {
  return value ? format(new Date(`${value}T00:00:00`), 'MMM d, yyyy') : '—'
}

export function CrossBranchPaymentReceivedDialog({
  receipt,
  onDismiss
}: {
  receipt?: CrossBranchPaymentReceipt
  onDismiss: () => void
}): React.JSX.Element {
  return (
    <Dialog open={Boolean(receipt)} onOpenChange={(open) => !open && onDismiss()}>
      <DialogContent className="max-h-[min(85vh,42rem)] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Cross-branch payment received</DialogTitle>
          <DialogDescription>
            {receipt
              ? `${receipt.accountName} · ${receipt.contractNumber} · received from ${receipt.collectingBranch}.`
              : 'Payment details'}
          </DialogDescription>
        </DialogHeader>
        {receipt && (
          <>
            <dl className="grid grid-cols-2 gap-x-6 gap-y-4 py-2">
              <Detail label="Account" value={receipt.accountName} />
              <Detail label="Contract" value={receipt.contractNumber} />
              <Detail label="Cashier" value={receipt.cashierName ?? '—'} />
              <Detail label="Collection branch" value={receipt.collectingBranch} />
              <Detail label="Owner branch" value={receipt.ownerBranch} />
              <Detail
                label="Installment"
                value={receipt.scheduleNumber ? `#${receipt.scheduleNumber}` : '—'}
              />
              <Detail label="Scheduled due" value={dateLabel(receipt.scheduledDueDate)} />
              <Detail label="Payment date" value={dateLabel(receipt.paymentDate)} />
              <Detail label="Payment method" value={receipt.paymentMethod} />
              <Detail
                label="Amount received"
                value={formatPhilippinePeso(receipt.amountCentavos / 100)}
              />
              <Detail label="Penalty" value={formatPhilippinePeso(receipt.penaltyCentavos / 100)} />
              <Detail label="OR / reference number" value={receipt.referenceNumber ?? '—'} />
              <div className="space-y-1">
                <dt className="text-xs text-muted-foreground">Status</dt>
                <dd>
                  <Badge variant={receipt.state === 'APPLIED' ? 'emerald' : 'amber'}>
                    {receipt.state}
                  </Badge>
                </dd>
              </div>
              <div className="col-span-2 space-y-1">
                <dt className="text-xs text-muted-foreground">Remarks</dt>
                <dd className="break-words text-sm">{receipt.remarks || '—'}</dd>
              </div>
              {receipt.message && (
                <div className="col-span-2 rounded-md border border-border bg-muted/50 p-3 text-sm text-muted-foreground">
                  {receipt.message}
                </div>
              )}
            </dl>
            <DialogFooter>
              <Button onClick={onDismiss}>Done</Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  )
}
