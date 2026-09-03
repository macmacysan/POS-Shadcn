import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { CircleAlert, CircleCheck, Eye, EyeOff, LoaderCircle, RefreshCw } from 'lucide-react'
import type { AuthenticatedUser, FinanceBranch, GoogleSyncProgress } from '@/../../shared/contracts'

import { Frame, FramePanel } from '@/../../components/reui/frame'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput
} from '@/components/ui/input-group'
import { useNotifications } from '@/hooks/use-notifications'

type LoginValues = {
  username: string
  password: string
}

function progressKey(progress: Pick<GoogleSyncProgress, 'branch' | 'sheet'>): string {
  return `${progress.branch}:${progress.sheet}`
}

function DownloadProgress({
  progress
}: {
  progress: readonly GoogleSyncProgress[]
}): React.JSX.Element {
  const groups = Object.values(
    progress.reduce<Record<string, GoogleSyncProgress[]>>((result, item) => {
      const group = result[item.branch] ?? []
      group.push(item)
      result[item.branch] = group
      return result
    }, {})
  )

  if (!groups.length) {
    return (
      <Alert>
        <LoaderCircle data-icon="inline-start" className="animate-spin" />
        <AlertTitle>Preparing download</AlertTitle>
        <AlertDescription>Checking your branch data before opening the workspace.</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="flex flex-col gap-5" aria-live="polite">
      {groups.map((items) => {
        const latest = items.reduce((current, item) =>
          item.completed >= current.completed ? item : current
        )
        const percent = Math.round((latest.completed / latest.total) * 100)
        return (
          <section key={latest.branch} className="flex flex-col gap-3">
            <div className="flex items-center justify-between text-sm font-medium">
              <span>Downloading {latest.branch} data</span>
              <span className="tabular-nums text-muted-foreground">{percent}%</span>
            </div>
            <Progress value={percent} aria-label={`Downloaded ${percent}% for ${latest.branch}`} />
            <div
              className="flex flex-col gap-2"
              role="list"
              aria-label={`${latest.branch} Drive snapshot`}
            >
              {items.map((item) => {
                const isFailed = item.phase === 'failed'
                const isWorking =
                  item.phase === 'downloading' ||
                  item.phase === 'retrying' ||
                  item.phase === 'importing' ||
                  item.phase === 'validating' ||
                  item.phase === 'uploading'
                return (
                  <div
                    key={progressKey(item)}
                    role="listitem"
                    className="flex items-center gap-2 text-sm"
                  >
                    {isFailed ? (
                      <CircleAlert className="text-destructive" aria-hidden="true" />
                    ) : isWorking ? (
                      <LoaderCircle
                        className="animate-spin text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : (
                      <CircleCheck className="text-primary" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 truncate">{item.sheet}</span>
                    <span className="text-xs text-muted-foreground">
                      {isFailed
                        ? item.message
                        : item.phase === 'retrying'
                          ? 'Retrying…'
                          : isWorking
                            ? item.phase === 'importing'
                              ? 'Importing…'
                              : item.phase === 'validating'
                                ? 'Validating…'
                                : item.phase === 'uploading'
                                  ? 'Uploading…'
                                  : 'Downloading…'
                            : `${item.rowCount ?? 0} rows`}
                    </span>
                  </div>
                )
              })}
            </div>
          </section>
        )
      })}
    </div>
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
    <div className={className} {...props}>
      <Frame className="w-full max-w-3xl" dense>
        <FramePanel className="p-0">
          <div className="grid min-h-112 lg:grid-cols-2">
            <section className="flex flex-col justify-between gap-10 bg-muted/50 p-7 sm:p-10">
              <div className="flex flex-col gap-8">
                <div className="flex items-center gap-3 text-sm font-medium tracking-tight">
                  <span className="brand-mark" aria-hidden="true">
                    NC
                  </span>
                  Nueva Camsur Home Furnishing
                </div>
                <div className="flex flex-col gap-3">
                  <p className="text-xs font-medium tracking-widest text-muted-foreground uppercase">
                    Cashiers report
                  </p>
                  <h1 className="font-heading text-3xl leading-tight font-semibold tracking-tight">
                    Start the day with the numbers in order.
                  </h1>
                  <p className="max-w-sm text-sm leading-6 text-muted-foreground">
                    Sign in to reconcile collections, track payments, and keep your branch report
                    current.
                  </p>
                </div>
              </div>
              <div className="flex flex-col gap-2 border-t pt-5 text-sm">
                <span className="text-muted-foreground">
                  {cashierLoginBranch ? 'Cashier login branch' : 'Loading cashier branch'}
                </span>
                <span className="font-medium">{cashierLoginBranch ?? '…'}</span>
              </div>
            </section>

            <section className="flex flex-col justify-center p-7 sm:p-10">
              <div className="flex flex-col gap-7">
                <header className="flex flex-col gap-2">
                  <p className="text-sm font-medium">Workspace access</p>
                  <p className="text-sm text-muted-foreground">
                    Use the username and password provided by your administrator.
                  </p>
                </header>
                <Separator />
                <form
                  className="flex flex-col gap-6"
                  onSubmit={(event) => void submit(event)}
                  noValidate
                >
                  {isSubmitting ? (
                    <DownloadProgress progress={Object.values(syncProgress)} />
                  ) : (
                    <FieldGroup>
                      <Field data-invalid={Boolean(error)}>
                        <FieldLabel htmlFor="username">Username</FieldLabel>
                        <Input
                          id="username"
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
                  )}
                  <Button type="submit" className="w-full" disabled={isSubmitting}>
                    {isSubmitting ? (
                      <>
                        <RefreshCw data-icon="inline-start" className="animate-spin" />
                        Downloading data…
                      </>
                    ) : (
                      'Sign in to workspace'
                    )}
                  </Button>
                </form>
              </div>
            </section>
          </div>
        </FramePanel>
      </Frame>
    </div>
  )
}
