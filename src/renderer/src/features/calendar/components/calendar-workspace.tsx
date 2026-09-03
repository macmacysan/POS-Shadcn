import * as React from 'react'
import { CaretDownIcon, CaretLeftIcon, CaretRightIcon, PlusIcon } from '@phosphor-icons/react'

import { Badge } from '@/components/ui/reui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle
} from '@/components/ui/dialog'
import { Field, FieldGroup, FieldLabel } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { branchCodeByName } from '@/lib/in-house-account-display'
import type { LoginBranch } from '@/../../shared/contracts'

const taskTypes = ['Note', 'Schedule', 'Delivery', 'Important'] as const
type TaskType = (typeof taskTypes)[number]
type CalendarBranch = keyof typeof branchCodeByName
type CalendarTask = {
  id: string
  title: string
  date: string
  type: TaskType
  branch: CalendarBranch
  cashierName: string
}

const typeVariants: Record<TaskType, React.ComponentProps<typeof Badge>['variant']> = {
  Note: 'info-light',
  Schedule: 'primary-light',
  Delivery: 'success-light',
  Important: 'warning-light'
}

function dateKey(date: Date): string {
  const offset = date.getTimezoneOffset() * 60_000
  return new Date(date.getTime() - offset).toISOString().slice(0, 10)
}

function formatDate(date: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(`${date}T00:00:00`))
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((part) => part[0])
      .join('')
      .slice(0, 2)
      .toUpperCase() || 'U'
  )
}

export function CalendarWorkspace({
  cashierName,
  selectedBranch
}: {
  cashierName: string
  selectedBranch: LoginBranch
}): React.JSX.Element {
  const today = React.useMemo(() => new Date(), [])
  const defaultBranch: CalendarBranch = selectedBranch === 'All Branch' ? 'Lagonoy' : selectedBranch
  const [month, setMonth] = React.useState(() => new Date(today.getFullYear(), today.getMonth(), 1))
  const [isDialogOpen, setIsDialogOpen] = React.useState(false)
  const [tasks, setTasks] = React.useState<CalendarTask[]>([])
  const [draft, setDraft] = React.useState({
    title: '',
    date: dateKey(today),
    type: 'Schedule' as TaskType,
    branch: defaultBranch,
    cashierName
  })

  const firstDay = new Date(month.getFullYear(), month.getMonth(), 1)
  const gridStart = new Date(month.getFullYear(), month.getMonth(), 1 - firstDay.getDay())
  const days = Array.from(
    { length: 42 },
    (_, index) =>
      new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + index)
  )
  const tasksByDate = new Map<string, CalendarTask[]>()
  tasks.forEach((task) => tasksByDate.set(task.date, [...(tasksByDate.get(task.date) ?? []), task]))

  const openTaskDialog = (): void => {
    setDraft({
      title: '',
      date: dateKey(today),
      type: 'Schedule',
      branch: defaultBranch,
      cashierName
    })
    setIsDialogOpen(true)
  }

  const addTask = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const title = draft.title.trim()
    if (!title) return
    setTasks((current) => [...current, { ...draft, title, id: crypto.randomUUID() }])
    setIsDialogOpen(false)
  }

  return (
    <main className="flex min-h-0 flex-1 overflow-hidden bg-background">
      <aside className="flex w-80 shrink-0 flex-col border-r bg-card">
        <div className="border-b px-5 py-4">
          <p className="text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
            Tasks
          </p>
          <h1 className="mt-1 font-heading text-lg font-light">Calendar tasks</h1>
        </div>
        <Collapsible defaultOpen className="group/collapsible min-h-0 flex-1 overflow-auto">
          <CollapsibleTrigger className="flex w-full items-center gap-2 border-b px-5 py-2 text-left text-xs font-medium">
            Task list <span className="text-muted-foreground">{tasks.length}</span>
            <CaretDownIcon className="ml-auto size-4 transition-transform group-data-[panel-open]/collapsible:rotate-180" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="grid grid-cols-[1.1fr_0.8fr_0.6fr_0.5fr] gap-2 border-b px-5 py-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
              <span>Date</span>
              <span>Type</span>
              <span>Branch</span>
              <span>Name</span>
            </div>
            {tasks.length ? (
              tasks.map((task) => (
                <div
                  key={task.id}
                  className="grid grid-cols-[1.1fr_0.8fr_0.6fr_0.5fr] gap-2 border-b px-5 py-3 text-xs"
                >
                  <span className="truncate font-medium">{formatDate(task.date)}</span>
                  <Badge variant={typeVariants[task.type]} size="xs">
                    {task.type}
                  </Badge>
                  <span className="font-mono text-muted-foreground">
                    {branchCodeByName[task.branch]}
                  </span>
                  <span className="font-medium text-muted-foreground">
                    {initials(task.cashierName)}
                  </span>
                </div>
              ))
            ) : (
              <p className="px-5 py-8 text-sm text-muted-foreground">
                No tasks yet. Add one to place it on the calendar.
              </p>
            )}
          </CollapsibleContent>
        </Collapsible>
        <div className="border-t p-4">
          <Button className="w-full" onClick={openTaskDialog}>
            <PlusIcon />
            Add Task
          </Button>
        </div>
      </aside>

      <section className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-between border-b px-6 py-4">
          <div>
            <p className="text-xs text-muted-foreground">Custom calendar</p>
            <h2 className="font-heading text-xl font-light">
              {month.toLocaleString(undefined, { month: 'long', year: 'numeric' })}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
            >
              Today
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}
            >
              <CaretLeftIcon />
            </Button>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}
            >
              <CaretRightIcon />
            </Button>
          </div>
        </header>
        <div className="grid grid-cols-7 border-b text-center text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <div key={day} className="py-2">
              {day}
            </div>
          ))}
        </div>
        <div className="grid min-h-0 flex-1 grid-cols-7 grid-rows-6 overflow-auto">
          {days.map((day) => {
            const key = dateKey(day)
            const dayTasks = tasksByDate.get(key) ?? []
            const isCurrentMonth = day.getMonth() === month.getMonth()
            const isToday = key === dateKey(today)
            return (
              <div key={key} className="min-h-28 border-b border-r p-2 last:border-r-0">
                <span
                  className={
                    isToday
                      ? 'inline-flex size-6 items-center justify-center rounded-full bg-primary text-xs font-medium text-primary-foreground'
                      : `inline-flex size-6 items-center justify-center text-xs ${isCurrentMonth ? 'text-foreground' : 'text-muted-foreground'}`
                  }
                >
                  {day.getDate()}
                </span>
                <div className="mt-1 flex flex-col gap-1">
                  {dayTasks.map((task) => (
                    <div
                      key={task.id}
                      className="rounded-md border bg-card px-2 py-1.5 text-xs shadow-xs"
                    >
                      <p className="truncate font-medium">{task.title}</p>
                      <div className="mt-1 flex items-center justify-between gap-1">
                        <Badge variant={typeVariants[task.type]} size="xs">
                          {task.type}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground">
                          {branchCodeByName[task.branch]} · {initials(task.cashierName)}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add task</DialogTitle>
            <DialogDescription>Choose a date and task type for the calendar.</DialogDescription>
          </DialogHeader>
          <form onSubmit={addTask} className="contents">
            <FieldGroup>
              <Field>
                <FieldLabel htmlFor="task-title">Task</FieldLabel>
                <Input
                  id="task-title"
                  value={draft.title}
                  onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                  autoFocus
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="task-date">Date</FieldLabel>
                <DatePickerInput
                  id="task-date"
                  value={draft.date}
                  onValueChange={(date) => setDraft({ ...draft, date })}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="task-type">Type</FieldLabel>
                <Select
                  value={draft.type}
                  onValueChange={(value) => setDraft({ ...draft, type: value as TaskType })}
                >
                  <SelectTrigger id="task-type" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {taskTypes.map((type) => (
                        <SelectItem key={type} value={type}>
                          {type}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="task-branch">Branch</FieldLabel>
                <Select
                  value={draft.branch}
                  onValueChange={(value) => setDraft({ ...draft, branch: value as CalendarBranch })}
                >
                  <SelectTrigger id="task-branch" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectGroup>
                      {Object.entries(branchCodeByName).map(([branch, code]) => (
                        <SelectItem key={branch} value={branch}>
                          {code} · {branch}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="task-cashier">Cashier name</FieldLabel>
                <Input
                  id="task-cashier"
                  value={draft.cashierName}
                  onChange={(event) => setDraft({ ...draft, cashierName: event.target.value })}
                />
              </Field>
            </FieldGroup>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">Add Task</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </main>
  )
}
