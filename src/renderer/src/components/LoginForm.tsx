import { useState, type FormEvent } from 'react'

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

function LoginForm(): React.JSX.Element {
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
    setSubmitted(Object.keys(nextErrors).length === 0)
  }

  return (
    <section className="w-full max-w-md rounded-xl border border-border/70 bg-card/95 p-8 shadow-xl backdrop-blur-sm">
      <div className="mb-8 flex flex-col gap-2">
        <p className="text-sm font-medium text-muted-foreground">Cashiers Report</p>
        <h1 className="text-2xl font-semibold tracking-tight">Login</h1>
        <p className="text-sm text-muted-foreground">Sign in to manage your cashier reports.</p>
      </div>

      <form className="flex flex-col gap-6" onSubmit={handleSubmit} noValidate>
        <FieldGroup>
          <Field data-invalid={Boolean(errors.branch)}>
            <FieldLabel htmlFor="branch">Select Branch</FieldLabel>
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
              value={values.password}
              aria-invalid={Boolean(errors.password)}
              onChange={(event) => updateValue('password', event.target.value)}
            />
            {errors.password && <FieldError>{errors.password}</FieldError>}
          </Field>
        </FieldGroup>

        <Button type="submit" size="lg" className="w-full">
          Login
        </Button>

        {submitted && (
          <p role="status" className="text-center text-sm text-muted-foreground">
            Login submitted.
          </p>
        )}
      </form>
    </section>
  )
}

export default LoginForm
