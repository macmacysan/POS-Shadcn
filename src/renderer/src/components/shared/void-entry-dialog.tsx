import * as React from 'react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Textarea } from '@/components/ui/textarea'

type Props = {
  open: boolean
  label: string
  onOpenChange: (open: boolean) => void
  onConfirm: (reason: string) => void
}

export function VoidEntryDialog({
  open,
  label,
  onOpenChange,
  onConfirm
}: Props): React.JSX.Element {
  const [reason, setReason] = React.useState('')
  const valid = reason.trim().length > 0

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setReason('')
        onOpenChange(nextOpen)
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Void {label}?</AlertDialogTitle>
          <AlertDialogDescription>
            This entry will be hidden from normal reports and excluded from totals.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <Textarea
          value={reason}
          onChange={(event) => setReason(event.target.value)}
          placeholder="Reason for voiding"
          aria-label="Void reason"
          autoFocus
        />
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!valid}
            onClick={() => onConfirm(reason.trim())}
          >
            Void entry
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
