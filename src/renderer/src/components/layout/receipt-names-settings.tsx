import * as React from 'react'
import { ArchiveRestoreIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNotifications } from '@/hooks/use-notifications'
import type { DailyReportReceiptTypeRecord } from '@/../../shared/contracts'

export function ReceiptNamesSettings(): React.JSX.Element {
  const [rows, setRows] = React.useState<DailyReportReceiptTypeRecord[]>([])
  const [name, setName] = React.useState('')
  const [shortName, setShortName] = React.useState('')
  const [error, setError] = React.useState<string>()
  const [isLoading, setIsLoading] = React.useState(true)
  const { notify } = useNotifications()

  const load = React.useCallback(async (): Promise<void> => {
    setIsLoading(true)
    setError(undefined)
    try {
      const response = await window.api.dailyReports.listReceiptTypes()
      setRows(response.rows)
    } catch {
      const message = 'Receipt names could not be loaded.'
      setError(message)
      notify({ type: 'error', title: 'Could not load receipt names.', description: message })
    } finally {
      setIsLoading(false)
    }
  }, [notify])

  React.useEffect(() => {
    void load()
  }, [load])

  const add = async (): Promise<void> => {
    const trimmedName = name.trim()
    const trimmedShortName = shortName.trim()
    if (!trimmedName || !trimmedShortName) {
      const message = 'Enter both a receipt name and short label.'
      setError(message)
      notify({ type: 'warning', title: 'Receipt name needs attention.', description: message })
      return
    }
    setError(undefined)
    try {
      const created = await window.api.dailyReports.createReceiptType({
        name: trimmedName,
        shortName: trimmedShortName
      })
      setRows((current) => [...current, created])
      setName('')
      setShortName('')
    } catch {
      const message = 'That name already exists. Restore it instead if it was retired.'
      setError(message)
      notify({ type: 'error', title: 'Receipt name could not be added.', description: message })
    }
  }

  const retire = async (id: string): Promise<void> => {
    setError(undefined)
    try {
      await window.api.dailyReports.deleteReceiptType({ id })
      setRows((current) =>
        current.map((row) => (row.id === id ? { ...row, isActive: false } : row))
      )
      notify({ type: 'success', title: 'Receipt name retired.' })
    } catch {
      const message = 'Receipt name could not be retired.'
      setError(message)
      notify({ type: 'error', title: 'Could not retire receipt name.', description: message })
    }
  }

  const restore = async (id: string): Promise<void> => {
    setError(undefined)
    try {
      const restored = await window.api.dailyReports.restoreReceiptType({ id })
      setRows((current) => current.map((row) => (row.id === id ? restored : row)))
      notify({ type: 'success', title: 'Receipt name restored.' })
    } catch {
      const message = 'Receipt name could not be restored.'
      setError(message)
      notify({ type: 'error', title: 'Could not restore receipt name.', description: message })
    }
  }

  const activeRows = rows.filter((row) => row.isActive)
  const retiredRows = rows.filter((row) => !row.isActive)

  return (
    <section className="flex flex-col gap-4 border-t pt-4">
      <div className="flex flex-col gap-1">
        <p className="text-sm font-medium tracking-tight">Receipt names</p>
        <p className="text-xs leading-5 text-muted-foreground">
          Available to new drafts. Retired names remain on the reports that used them.
        </p>
      </div>
      <div className="grid grid-cols-[minmax(0,1fr)_7rem_auto] gap-2">
        <Input
          aria-label="Receipt name"
          placeholder="Receipt name"
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <Input
          aria-label="Short receipt label"
          placeholder="Short label"
          maxLength={7}
          value={shortName}
          onChange={(event) => setShortName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') void add()
          }}
        />
        <Button type="button" size="sm" onClick={() => void add()}>
          <PlusIcon data-icon="inline-start" />
          Add
        </Button>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="overflow-hidden rounded-lg border">
        <div className="grid grid-cols-[minmax(0,1fr)_5rem_auto] gap-3 border-b bg-muted/40 px-3 py-2 text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
          <span>Name</span>
          <span>Label</span>
          <span className="sr-only">Action</span>
        </div>
        {isLoading ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">Loading receipt names…</p>
        ) : activeRows.length === 0 ? (
          <p className="px-3 py-4 text-xs text-muted-foreground">No active custom receipt names.</p>
        ) : (
          activeRows.map((row) => (
            <div
              key={row.id}
              className="grid grid-cols-[minmax(0,1fr)_5rem_auto] items-center gap-3 border-b px-3 py-2 last:border-b-0"
            >
              <span className="truncate text-sm">{row.name}</span>
              <span className="font-mono text-xs text-muted-foreground">{row.shortName}</span>
              <Button type="button" variant="ghost" size="xs" onClick={() => void retire(row.id)}>
                <Trash2Icon data-icon="inline-start" />
                Retire
              </Button>
            </div>
          ))
        )}
      </div>
      {retiredRows.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-[10px] font-medium uppercase tracking-[0.12em] text-muted-foreground">
            Retired
          </p>
          {retiredRows.map((row) => (
            <div
              key={row.id}
              className="flex items-center justify-between gap-3 rounded-md border border-dashed px-3 py-2"
            >
              <span className="min-w-0 truncate text-xs text-muted-foreground">
                {row.name} · {row.shortName}
              </span>
              <Button type="button" variant="ghost" size="xs" onClick={() => void restore(row.id)}>
                <ArchiveRestoreIcon data-icon="inline-start" />
                Restore
              </Button>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}
