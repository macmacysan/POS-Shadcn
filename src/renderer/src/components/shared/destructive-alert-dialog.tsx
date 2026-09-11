import * as React from 'react'
import { Trash2Icon } from 'lucide-react'

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogMedia,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Field, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type Props = {
  readonly open: boolean
  readonly onOpenChange: (open: boolean) => void
  readonly title: string
  readonly description: React.ReactNode
  readonly actionLabel: string
  readonly cancelLabel?: string
  readonly actionDisabled?: boolean
  readonly confirmationWord?: string
  readonly icon?: React.ReactNode
  readonly children?: React.ReactNode
  readonly onConfirm: () => void
}

export function DestructiveAlertDialog({
  open,
  onOpenChange,
  title,
  description,
  actionLabel,
  cancelLabel = 'Cancel',
  actionDisabled = false,
  confirmationWord,
  icon = <Trash2Icon />,
  children,
  onConfirm
}: Props): React.JSX.Element {
  const [confirmation, setConfirmation] = React.useState('')
  const canConfirm = !actionDisabled && (!confirmationWord || confirmation === confirmationWord)

  return (
    <AlertDialog
      open={open}
      onOpenChange={(nextOpen) => {
        if (!nextOpen) setConfirmation('')
        onOpenChange(nextOpen)
      }}
    >
      <AlertDialogContent size="sm">
        <AlertDialogHeader className="items-center text-center">
          <AlertDialogMedia className="bg-destructive/10 text-destructive">{icon}</AlertDialogMedia>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          <AlertDialogDescription>{description}</AlertDialogDescription>
        </AlertDialogHeader>
        {children && <div className="w-full">{children}</div>}
        {confirmationWord && (
          <Field className="w-full text-center">
            <FieldLabel htmlFor="destructive-confirmation">
              Type {confirmationWord} to continue
            </FieldLabel>
            <Input
              id="destructive-confirmation"
              value={confirmation}
              onChange={(event) => setConfirmation(event.target.value)}
              autoComplete="off"
              autoFocus
            />
          </Field>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel variant="ghost">{cancelLabel}</AlertDialogCancel>
          <AlertDialogAction variant="destructive" disabled={!canConfirm} onClick={onConfirm}>
            {actionLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
