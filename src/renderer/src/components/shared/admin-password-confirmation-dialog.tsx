import * as React from 'react'

import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'

type Props = {
  readonly open: boolean
  readonly title: string
  readonly description: string
  readonly onOpenChange: (open: boolean) => void
  readonly onConfirm: (password: string) => Promise<void>
}

function errorMessage(error: unknown): string {
  return error && typeof error === 'object' && 'message' in error
    ? String(error.message)
    : 'The selected records could not be deleted.'
}

export function AdminPasswordConfirmationDialog({
  open,
  title,
  description,
  onOpenChange,
  onConfirm
}: Props): React.JSX.Element {
  const [password, setPassword] = React.useState('')
  const [error, setError] = React.useState<string>()
  const [isSubmitting, setIsSubmitting] = React.useState(false)

  const handleOpenChange = (nextOpen: boolean): void => {
    if (!nextOpen) {
      setPassword('')
      setError(undefined)
    }
    onOpenChange(nextOpen)
  }

  const submit = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault()
    if (!password) {
      setError('Enter the administrator password.')
      return
    }
    setIsSubmitting(true)
    setError(undefined)
    try {
      await onConfirm(password)
      handleOpenChange(false)
    } catch (caught) {
      setError(errorMessage(caught))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <AlertDialog open={open} onOpenChange={handleOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <form onSubmit={(event) => void submit(event)} noValidate>
          <AlertDialogHeader>
            <AlertDialogTitle>{title}</AlertDialogTitle>
            <AlertDialogDescription>{description}</AlertDialogDescription>
          </AlertDialogHeader>
          <FieldGroup className="py-4">
            <Field data-invalid={Boolean(error)}>
              <FieldLabel htmlFor="admin-password-confirmation">Administrator password</FieldLabel>
              <Input
                id="admin-password-confirmation"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={Boolean(error)}
                autoFocus
              />
              {error && <FieldError>{error}</FieldError>}
            </Field>
          </FieldGroup>
          <AlertDialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting}>
              {isSubmitting ? 'Deleting…' : 'Delete selected'}
            </Button>
          </AlertDialogFooter>
        </form>
      </AlertDialogContent>
    </AlertDialog>
  )
}
