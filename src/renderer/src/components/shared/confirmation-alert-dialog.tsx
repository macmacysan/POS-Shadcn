import * as React from 'react'

import { DestructiveAlertDialog } from '@/components/shared/destructive-alert-dialog'

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

type Props = {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  destructive?: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
}

export function ConfirmationAlertDialog({
  open,
  title,
  description,
  confirmLabel = 'Confirm',
  destructive = false,
  onOpenChange,
  onConfirm
}: Props): React.JSX.Element {
  if (destructive)
    return (
      <DestructiveAlertDialog
        open={open}
        onOpenChange={onOpenChange}
        title={title}
        description={description}
        actionLabel={confirmLabel}
        onConfirm={onConfirm}
      />
    )

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction variant="default" onClick={onConfirm}>
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
