import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { CloudDownload, Eye, EyeOff } from 'lucide-react'
import type { AuthenticatedUser, FinanceBranch, GoogleSyncProgress } from '@/../../shared/contracts'
import packageJson from '../../../../../../package.json'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'
import { useNotifications } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'

type LoginValues = {
  username: string
  password: string
}

function progressKey(progress: GoogleSyncProgress): string {
  return `${progress.branch}:${progress.sheet}`
}

function WorkspaceLoading({
  progress
}: {
  progress: readonly GoogleSyncProgress[]
}): React.JSX.Element {
  const latest = progress.reduce<GoogleSyncProgress | undefined>(
    (current, item) => (!current || item.completed >= current.completed ? item : current),
    undefined
  )
  const percent = latest ? Math.round((latest.completed / latest.total) * 100) : undefined

  return (
    <section
      className="flex w-full max-w-xs flex-col items-center gap-4 text-center animate-in fade-in duration-200 motion-reduce:animate-none"
      aria-live="polite"
    >
      <div className="relative grid size-16 place-items-center rounded-2xl border bg-muted text-primary">
        <span className="absolute size-11 rounded-full border border-primary/30 animate-ping motion-reduce:hidden" />
        <CloudDownload className="relative size-6" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="font-heading text-lg font-medium">Loading your workspace</p>
        <p className="text-sm text-muted-foreground">
          {latest ? `${latest.phase} ${latest.sheet}` : 'Preparing today’s report tools.'}
        </p>
      </div>
      {percent !== undefined ? (
        <div className="w-full">
          <Progress value={percent} aria-label={`Downloaded ${percent}% for ${latest?.branch}`} />
          <p className="mt-2 text-xs tabular-nums text-muted-foreground">{percent}%</p>
        </div>
      ) : null}
    </section>
  )
}

export function LoginForm({
  className,
  onSuccess,
  ...props
}: React.ComponentProps<'div'> & {
  onSuccess?: (user: AuthenticatedUser, failedSheets: GoogleSyncProgress[]) => void
}): React.JSX.Element {
  const [values, setValues] = useState<LoginValues>({ username: '', password: '' })
  const [error, setError] = useState<string>()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [cashierLoginBranch, setCashierLoginBranch] = useState<FinanceBranch>()
  const [syncProgress, setSyncProgress] = useState<Record<string, GoogleSyncProgress>>({})
  const syncProgressRef = useRef<Record<string, GoogleSyncProgress>>({})
  const { notify } = useNotifications()

  const receiveProgress = useCallback((progress: GoogleSyncProgress): void => {
    syncProgressRef.current = { ...syncProgressRef.current, [progressKey(progress)]: progress }
    setSyncProgress(syncProgressRef.current)
  }, [])

  useEffect(() => {
    void window.api.auth
      .getCashierLoginBranch()
      .then(setCashierLoginBranch)
      .catch(() => undefined)
  }, [])

  useEffect(() => window.api.googleSync.onProgress(receiveProgress), [receiveProgress])

  const update = <Key extends keyof LoginValues>(key: Key, value: LoginValues[Key]): void => {
    setValues((current) => ({ ...current, [key]: value }))
    setError(undefined)
  }

  async function submit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault()
    if (!values.username.trim() || !values.password) {
      setError('Enter your username and password.')
      return
    }

    setIsSubmitting(true)
    syncProgressRef.current = {}
    setSyncProgress({})
    try {
      const user = await window.api.auth.login({
        username: values.username,
        password: values.password
      })
      notify({ type: 'success', title: 'Signed in successfully.' })
      await new Promise<void>((resolve) => window.setTimeout(resolve, 900))
      onSuccess?.(
        user,
        Object.values(syncProgressRef.current).filter((progress) => progress.phase === 'failed')
      )
    } catch {
      const message = 'Unable to sign in. Check your details or contact an administrator.'
      setError(message)
      notify({ type: 'error', title: 'Sign-in failed.', description: message, id: 'auth:login' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div
      className={cn(
        'relative w-full max-w-md animate-in fade-in slide-in-from-bottom-1 duration-200 motion-reduce:animate-none overflow-hidden rounded-2xl border bg-card shadow-sm',
        className
      )}
      {...props}
    >
      <div className="flex min-h-[28rem] items-center justify-center p-6 sm:p-8">
        {isSubmitting ? (
          <WorkspaceLoading progress={Object.values(syncProgress)} />
        ) : (
          <section className="flex w-full flex-col gap-6 animate-in fade-in duration-200 motion-reduce:animate-none">
            <p className="py-1 font-heading text-base font-medium">Cashiers Report</p>

            <header className="flex flex-col gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-heading text-lg font-medium">Welcome back</h2>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">
                  Sign in to continue to your reports.
                </p>
              </div>
              <Badge
                variant="blue"
                className="h-9 w-full justify-start px-3 text-sm"
                aria-label="Cashier branch"
              >
                {cashierLoginBranch ?? 'Loading…'}
              </Badge>
            </header>

            <form
              className="flex flex-col gap-5"
              onSubmit={(event) => void submit(event)}
              noValidate
            >
              <FieldGroup>
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="username">Username</FieldLabel>
                  <Input
                    id="username"
                    className="normal-case"
                    autoComplete="username"
                    aria-invalid={Boolean(error)}
                    placeholder="Enter username"
                    value={values.username}
                    onChange={(event) => update('username', event.target.value)}
                  />
                </Field>
                <Field data-invalid={Boolean(error)}>
                  <FieldLabel htmlFor="password">Password</FieldLabel>
                  <InputGroup>
                    <InputGroupInput
                      id="password"
                      className="normal-case"
                      type={showPassword ? 'text' : 'password'}
                      autoComplete="current-password"
                      aria-invalid={Boolean(error)}
                      placeholder="Enter password"
                      value={values.password}
                      onChange={(event) => update('password', event.target.value)}
                    />
                    <InputGroupAddon align="inline-end">
                      <InputGroupButton
                        type="button"
                        size="icon-xs"
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        {showPassword ? <EyeOff /> : <Eye />}
                      </InputGroupButton>
                    </InputGroupAddon>
                  </InputGroup>
                  {error ? <FieldError>{error}</FieldError> : null}
                </Field>
              </FieldGroup>
              <Button type="submit" className="w-full">
                Sign in
              </Button>
            </form>
            <Separator />
            <div className="flex items-center justify-between gap-3 text-xs text-muted-foreground">
              <p>Your reports stay local to this device.</p>
              <span aria-label={`App version ${packageJson.version}`}>v{packageJson.version}</span>
            </div>
          </section>
        )}
      </div>
    </div>
  )
}
