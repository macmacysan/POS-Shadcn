import { useState, type FormEvent } from 'react'
import type { AuthenticatedUser } from '@/../../shared/contracts'

import { Button } from '@/components/ui/button'
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

export function LoginForm({
  className,
  onSuccess,
  ...props
}: React.ComponentProps<'div'> & {
  onSuccess?: (branch: Branch, user: AuthenticatedUser) => void
}): React.JSX.Element {
  const [values, setValues] = useState<LoginValues>({
    branch: '',
    username: '',
    password: ''
  })
  const [errors, setErrors] = useState<LoginErrors>({})
  const [submitError, setSubmitError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)

  function updateValue<Key extends keyof LoginValues>(key: Key, value: LoginValues[Key]): void {
    setValues((current) => ({ ...current, [key]: value }))
    setErrors((current) => ({ ...current, [key]: undefined }))
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()

    const nextErrors: LoginErrors = {}

    if (!values.branch) nextErrors.branch = 'Select a branch.'
    if (!values.username.trim()) nextErrors.username = 'Enter your username.'
    if (!values.password) nextErrors.password = 'Enter your password.'

    setErrors(nextErrors)
    const isValid = Object.keys(nextErrors).length === 0
    if (!isValid) return
    setIsSubmitting(true)
    setSubmitError(undefined)
    try {
      const user = await window.api.auth.login({
        branch: values.branch as Branch,
        username: values.username,
        password: values.password
      })
      onSuccess?.(values.branch as Branch, user)
    } catch {
      setSubmitError('Unable to sign in with those credentials.')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className={className} {...props}>
      <form className="flex w-full max-w-sm flex-col gap-8" onSubmit={handleSubmit} noValidate>
        <div className="flex flex-col gap-3">
          <div className="brand-mark size-9 text-xs">CR</div>
          <div className="flex flex-col gap-1">
            <h1 className="text-xl font-semibold tracking-tight">Sign in</h1>
            <p className="text-sm text-muted-foreground">Access your cashier workspace.</p>
          </div>
        </div>

        <FieldGroup>
          <Field data-invalid={Boolean(errors.branch)}>
            <FieldLabel htmlFor="branch">Branch</FieldLabel>
            <Select
              value={values.branch || null}
              onValueChange={(value) => updateValue('branch', (value ?? '') as Branch | '')}
            >
              <SelectTrigger id="branch" aria-invalid={Boolean(errors.branch)} className="w-full">
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
            />
            {errors.password && <FieldError>{errors.password}</FieldError>}
          </Field>

          <Button type="submit" className="w-full">
            {isSubmitting ? 'Signing in…' : 'Continue'}
          </Button>
          {submitError && <FieldError>{submitError}</FieldError>}
        </FieldGroup>
      </form>
    </div>
  )
}
