import * as React from 'react'

import { DestructiveAlertDialog } from '@/components/shared/destructive-alert-dialog'
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
    <DestructiveAlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setReason('')
        onOpenChange(nextOpen)
      }}
      title={`Void ${label}?`}
      description="This entry will be voided and preserved in the report history."
      actionLabel="Void entry"
      actionDisabled={!valid}
      onConfirm={() => onConfirm(reason.trim())}
    >
      <Textarea
        value={reason}
        onChange={(event) => setReason(event.target.value)}
        placeholder="Reason for voiding"
        aria-label="Void reason"
        autoFocus
      />
    </DestructiveAlertDialog>
  )
}
