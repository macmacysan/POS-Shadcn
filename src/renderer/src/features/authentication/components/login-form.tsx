import { useState, type FormEvent } from 'react'
import { ArrowRight, LockKeyhole, Store } from 'lucide-react'

import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'

const branches = ['Goa', 'Lagonoy', 'Tigaon', 'Tinambac'] as const

type Branch = (typeof branches)[number]

type LoginValues = {
  branch: Branch | ''
  username: string
  password: string
}

type LoginErrors = Partial<Record<keyof LoginValues, string>>

export function LoginForm({ className, onSuccess, ...props }: React.ComponentProps<'div'> & { onSuccess?: () => void }): React.JSX.Element {
  const [values, setValues] = useState<LoginValues>({
    branch: '',
    username: '',
    password: ''
  })
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitted, setSubmitted] = useState(false)

  function updateValue<Key extends keyof LoginValues>(key: Key, value: LoginValues[Key]): void {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
    setSubmitted(false)
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault()

    const nextErrors: LoginErrors = {}

    if (!values.branch) nextErrors.branch = 'Select a branch.'
    if (!values.username.trim()) nextErrors.username = 'Enter your username.'
    if (!values.password) nextErrors.password = 'Enter your password.'

    setErrors(nextErrors)
    const isValid = Object.keys(nextErrors).length === 0
    setSubmitted(isValid)
    if (isValid) onSuccess?.()
  }

  return (
    <div className={cn('flex w-full max-w-4xl flex-col gap-6', className)} {...props}>
      <Card className="overflow-hidden p-0 shadow-xl shadow-primary/5">
        <CardContent className="grid p-0 md:grid-cols-2">
          <form className="p-6 sm:p-8" onSubmit={handleSubmit} noValidate>
            <FieldGroup>
              <div className="flex flex-col gap-2 text-center">
                <p className="text-sm font-medium text-primary">Cashiers Report</p>
                <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
                <p className="text-balance text-sm text-muted-foreground">
                  Sign in to continue to your cashier workspace.
                </p>
              </div>

              <Field data-invalid={Boolean(errors.branch)}>
                <FieldLabel htmlFor="branch">Branch</FieldLabel>
                <Select
                  value={values.branch || null}
                  onValueChange={(value) => updateValue('branch', (value ?? '') as Branch | '')}
                >
                  <SelectTrigger
                    id="branch"
                    aria-invalid={Boolean(errors.branch)}
                    className="h-11 w-full bg-background"
                  >
                    <Store data-icon="inline-start" className="text-muted-foreground" />
                    <SelectValue placeholder="Select a branch" />
                  </SelectTrigger>
                  <SelectContent>
                    {branches.map((branch) => (
                      <SelectItem key={branch} value={branch}>
                        {branch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.branch && <FieldError>{errors.branch}</FieldError>}
              </Field>

              <Field data-invalid={Boolean(errors.username)}>
                <FieldLabel htmlFor="username">Username</FieldLabel>
                <Input
                  id="username"
                  autoComplete="username"
                  placeholder="Enter your username"
                  value={values.username}
                  aria-invalid={Boolean(errors.username)}
                  onChange={(event) => updateValue('username', event.target.value)}
                  className="h-11 bg-background"
                />
                {errors.username && <FieldError>{errors.username}</FieldError>}
              </Field>

              <Field data-invalid={Boolean(errors.password)}>
                <FieldLabel htmlFor="password">Password</FieldLabel>
                <Input
                  id="password"
                  type="password"
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={values.password}
                  aria-invalid={Boolean(errors.password)}
                  onChange={(event) => updateValue('password', event.target.value)}
                  className="h-11 bg-background"
                />
                {errors.password && <FieldError>{errors.password}</FieldError>}
              </Field>

              <Field>
                <Button type="submit" className="h-11 w-full">
                  Sign in
                  <ArrowRight data-icon="inline-end" />
                </Button>
              </Field>

              {submitted && (
                <p role="status" className="text-center text-sm text-muted-foreground">
                  Login submitted.
                </p>
              )}
            </FieldGroup>
          </form>

          <div className="relative hidden min-h-96 overflow-hidden bg-primary p-8 text-primary-foreground md:flex md:flex-col md:justify-between">
            <div className="absolute -right-24 -top-24 size-72 rounded-full border border-primary-foreground/10" />
            <div className="absolute -bottom-40 -left-24 size-96 rounded-full border border-primary-foreground/10" />

            <div className="relative flex size-11 items-center justify-center rounded-2xl bg-primary-foreground/10 text-lg font-semibold tracking-tight ring-1 ring-primary-foreground/15">
              CR
            </div>
            <div className="relative flex flex-col gap-4">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-primary-foreground/55">
                Built for clarity
              </p>
              <h2 className="text-3xl font-semibold leading-tight tracking-[-0.04em]">
                Close the books with confidence.
              </h2>
              <p className="text-sm leading-6 text-primary-foreground/65">
                Keep every branch, cashier, and daily reconciliation moving in one calm, reliable
                workspace.
              </p>
            </div>
            <div className="relative flex items-center gap-2 border-t border-primary-foreground/15 pt-4 text-xs text-primary-foreground/60">
              <LockKeyhole data-icon="inline-start" />
              Secure local workspace
            </div>
          </div>
        </CardContent>
      </Card>

      <p className="px-6 text-center text-xs text-muted-foreground">
        Your activity stays on this device.
      </p>
    </div>
  )
}
