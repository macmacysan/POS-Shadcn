import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  Activity,
  AlertTriangle,
  CalendarDays,
  Check,
  CircleAlert,
  CloudDownload,
  Eye,
  EyeOff,
  Send
} from 'lucide-react'
import {
  addDays,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek
} from 'date-fns'
import type {
  AuthenticatedUser,
  FinanceBranch,
  GoogleSyncProgress,
  LoginPreview
} from '@/../../shared/contracts'
import packageJson from '../../../../../../package.json'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Field, FieldError, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
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

function LoginPreviewCalendar({
  preview
}: {
  preview: LoginPreview | null | undefined
}): React.JSX.Element {
  const month = startOfMonth(preview ? parseISO(`${preview.month}-01`) : new Date())
  const first = startOfWeek(month)
  const last = endOfWeek(endOfMonth(month))
  const daysByDate = new Map(preview?.days.map((day) => [day.businessDate, day]))
  const calendarDays = Array.from(
    { length: Math.ceil((last.getTime() - first.getTime()) / 86400000) + 1 },
    (_, index) => addDays(first, index)
  )
  const kpis = [
    { label: 'Active', value: preview?.activeInstallments ?? 0, icon: Activity, tone: 'text-info' },
    {
      label: 'Overdue',
      value: preview?.overdueInstallments ?? 0,
      icon: AlertTriangle,
      tone: 'text-destructive'
    },
    {
      label: 'Cash variance',
      value: preview?.cashVarianceDays ?? 0,
      icon: CircleAlert,
      tone: 'text-destructive'
    },
    {
      label: 'Not sent',
      value: preview?.reportsNotSent ?? 0,
      icon: Send,
      tone: 'text-destructive'
    }
  ]

  return (
    <section className="flex min-h-0 flex-1 flex-col bg-muted/30 p-6 lg:p-8">
      <header className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium tracking-wide text-muted-foreground">Branch overview</p>
          <h1 className="mt-1 font-heading text-lg font-medium tracking-tight">
            Nueva Camsur Home Furnishing
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {preview === undefined
              ? 'Loading branch status…'
              : preview
                ? `${preview.branch} branch · ${format(month, 'MMMM yyyy')}`
                : 'Set a cashier login branch to view status.'}
          </p>
        </div>
        <CalendarDays className="mt-1 size-5 text-muted-foreground" aria-hidden="true" />
      </header>

      <div className="mt-6 grid grid-cols-2 gap-2 xl:grid-cols-4">
        {kpis.map(({ label, value, icon: Icon, tone }) => (
          <div key={label} className="rounded-xl border border-border/70 bg-background/80 p-3">
            <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>{label}</span>
              <Icon className={cn('size-3.5', tone)} aria-hidden="true" />
            </div>
            <p className="mt-2 font-mono text-lg font-medium tabular-nums">{value}</p>
          </div>
        ))}
      </div>

      <TooltipProvider>
        <div className="mt-7 min-h-0 flex-1">
          <div className="grid grid-cols-7 gap-2 text-center text-xs font-medium text-muted-foreground">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <span key={day}>{day}</span>
            ))}
          </div>
          <div className="mt-2 grid grid-cols-7 gap-2">
            {calendarDays.map((date) => {
              const day = daysByDate.get(format(date, 'yyyy-MM-dd'))
              const currentMonth = isSameMonth(date, month)
              const indicators = [
                day?.hasData && { label: 'Active', icon: Activity, tone: 'text-info' },
                day?.hasCashVariance && {
                  label: 'Cash variance',
                  icon: CircleAlert,
                  tone: 'text-destructive'
                },
                day?.hasData && {
                  label: day.telegramSubmitted ? 'Telegram sent' : 'Telegram not sent',
                  icon: day.telegramSubmitted ? Check : Send,
                  tone: day.telegramSubmitted ? 'text-success' : 'text-destructive'
                }
              ].filter(Boolean) as Array<{ label: string; icon: typeof Activity; tone: string }>

              const cell = (
                <div
                  key={date.toISOString()}
                  tabIndex={0}
                  aria-label={`${format(date, 'EEEE, MMMM d')}${indicators.length ? `, ${indicators.map((item) => item.label).join(', ')}` : ''}`}
                  className={cn(
                    'flex min-h-15 flex-col items-center justify-between rounded-md border border-border/60 bg-background p-2 text-sm outline-none transition hover:-translate-y-0.5 hover:bg-muted/60 focus-visible:ring-2 focus-visible:ring-ring',
                    !currentMonth && 'text-muted-foreground/45',
                    day?.hasData && 'border-foreground/15 bg-foreground/5'
                  )}
                >
                  <span className="font-medium tabular-nums">{format(date, 'd')}</span>
                  <span className="flex min-h-3 items-center gap-1" aria-hidden="true">
                    {day?.hasCashVariance && (
                      <span className="size-2 rounded-full bg-destructive" />
                    )}
                    {day?.hasData && !day.telegramSubmitted && (
                      <Send className="size-3 text-destructive" />
                    )}
                  </span>
                </div>
              )
              if (!indicators.length) return cell
              return (
                <Tooltip key={date.toISOString()}>
                  <TooltipTrigger render={cell} />
                  <TooltipContent className="flex flex-col items-start gap-1">
                    {indicators.map(({ label, icon: Icon, tone }) => (
                      <span key={label} className="flex items-center gap-1.5">
                        <Icon className={cn('size-3', tone)} aria-hidden="true" />
                        {label}
                      </span>
                    ))}
                  </TooltipContent>
                </Tooltip>
              )
            })}
          </div>
        </div>
      </TooltipProvider>
    </section>
  )
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
      className="flex w-full max-w-xs flex-col items-center gap-4 text-center"
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
  const [loginPreview, setLoginPreview] = useState<LoginPreview | null>()
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

  useEffect(() => {
    let active = true
    void window.api.auth
      .getLoginPreview()
      .then((preview) => {
        if (active) setLoginPreview(preview)
      })
      .catch(() => {
        if (active) setLoginPreview(null)
      })
    return () => {
      active = false
    }
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
        'grid w-full max-w-6xl overflow-hidden rounded-2xl border bg-card shadow-sm lg:grid-cols-[minmax(0,1fr)_26rem]',
        className
      )}
      {...props}
    >
      <LoginPreviewCalendar preview={loginPreview} />
      <div className="flex min-h-0 items-center justify-center border-t p-6 lg:border-l lg:border-t-0 lg:p-10">
        {isSubmitting ? (
          <WorkspaceLoading progress={Object.values(syncProgress)} />
        ) : (
          <section className="flex w-full flex-col gap-6">
            <div className="flex items-center justify-between gap-3 py-1">
              <div className="flex min-w-0 items-center gap-2">
                <div className="min-w-0">
                  <p className="font-heading text-base font-medium">Cashiers Report</p>
                </div>
              </div>
              <Badge
                variant="outline"
                className="shrink-0"
                aria-label={`App version ${packageJson.version}`}
              >
                v{packageJson.version}
              </Badge>
            </div>

            <Separator />

            <header className="flex flex-col gap-3">
              <div>
                <h2 className="font-heading text-lg font-medium">Welcome back</h2>
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
            <p className="text-center text-xs text-muted-foreground">
              Your reports stay local to this device.
            </p>
          </section>
        )}
      </div>
    </div>
  )
}
