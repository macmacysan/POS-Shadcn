import * as React from 'react'
import { ArchiveRestoreIcon, PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useNotifications } from '@/hooks/use-notifications'
import type { CatalogOptionKind, CatalogOptionRecord } from '@/../../shared/contracts'

const groups: readonly {
  kind: CatalogOptionKind
  title: string
  description: string
  placeholder: string
}[] = [
  {
    kind: 'CASHIER_EXPENSE_TYPE',
    title: 'Expense types',
    description: 'Available to new cashier-report expenses.',
    placeholder: 'Expense type'
  },
  {
    kind: 'CASHIER_PAYMENT_TYPE',
    title: 'Payment types',
    description: 'Available to new cashier-report payments.',
    placeholder: 'Payment type'
  },
  {
    kind: 'IN_HOUSE_AGENT',
    title: 'Agents',
    description: 'Available to new in-house accounts.',
    placeholder: 'Agent name'
  },
  {
    kind: 'IN_HOUSE_LOAN_TERM',
    title: 'Loan terms',
    description: 'Whole months, from 1 to 12.',
    placeholder: 'Months'
  },
  {
    kind: 'FINANCE_TYPE',
    title: 'Finance types',
    description: 'Available to new finance accounts.',
    placeholder: 'Finance type'
  },
  {
    kind: 'FINANCE_TERM',
    title: 'Finance terms',
    description: 'Whole months, from 1 to 24.',
    placeholder: 'Months'
  }
]

export function CatalogOptionsSettings(): React.JSX.Element {
  const [rows, setRows] = React.useState<CatalogOptionRecord[]>([])
  const [values, setValues] = React.useState<Record<string, string>>({})
  const [error, setError] = React.useState<string>()
  const { notify } = useNotifications()

  const load = React.useCallback(async (): Promise<void> => {
    try {
      setRows((await window.api.catalogOptions.list()).rows)
    } catch {
      const message = 'Catalog options could not be loaded.'
      setError(message)
      notify({ type: 'error', title: 'Could not load catalog options.', description: message })
    }
  }, [notify])
  React.useEffect(() => {
    void load()
  }, [load])
  const change = (id: string, patch: Partial<CatalogOptionRecord>): void =>
    setRows((current) => current.map((row) => (row.id === id ? { ...row, ...patch } : row)))
  const add = async (kind: CatalogOptionKind): Promise<void> => {
    const value = values[kind]?.trim()
    if (!value) return
    try {
      const row = await window.api.catalogOptions.create({ kind, value })
      setRows((current) => [...current, row])
      setValues((current) => ({ ...current, [kind]: '' }))
    } catch {
      const message = 'That option already exists, or its value is invalid.'
      setError(message)
      notify({ type: 'error', title: 'Catalog option could not be added.', description: message })
    }
  }
  const rename = async (row: CatalogOptionRecord): Promise<void> => {
    const value = window.prompt(`Rename ${row.value}`, row.value)?.trim()
    if (!value || value === row.value) return
    try {
      change(row.id, await window.api.catalogOptions.rename({ id: row.id, value }))
    } catch {
      const message = 'That option could not be renamed.'
      setError(message)
      notify({ type: 'error', title: 'Catalog option could not be renamed.', description: message })
    }
  }
  const setActive = async (row: CatalogOptionRecord, isActive: boolean): Promise<void> => {
    try {
      if (isActive) change(row.id, await window.api.catalogOptions.restore({ id: row.id }))
      else {
        await window.api.catalogOptions.retire({ id: row.id })
        change(row.id, { isActive: false })
      }
      notify({
        type: 'success',
        title: isActive ? 'Catalog option restored.' : 'Catalog option retired.'
      })
    } catch {
      const message = 'That option could not be updated.'
      setError(message)
      notify({ type: 'error', title: 'Catalog option could not be updated.', description: message })
    }
  }

  return (
    <section className="flex flex-col gap-4 border-t pt-4">
      <div>
        <p className="text-sm font-medium tracking-tight">Catalog options</p>
        <p className="text-xs leading-5 text-muted-foreground">
          Retired values stay on existing records and can be restored.
        </p>
      </div>
      {error && (
        <p className="text-xs text-destructive" role="alert">
          {error}
        </p>
      )}
      <div className="grid gap-5 md:grid-cols-2">
        {groups.map((group) => {
          const groupRows = rows.filter((row) => row.kind === group.kind)
          return (
            <div key={group.kind} className="flex min-w-0 flex-col gap-2">
              <p className="text-xs font-medium">{group.title}</p>
              <div className="flex gap-2">
                <Input
                  aria-label={group.title}
                  placeholder={group.placeholder}
                  value={values[group.kind] ?? ''}
                  onChange={(event) =>
                    setValues((current) => ({ ...current, [group.kind]: event.target.value }))
                  }
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') void add(group.kind)
                  }}
                />
                <Button type="button" size="sm" onClick={() => void add(group.kind)}>
                  <PlusIcon data-icon="inline-start" />
                  Add
                </Button>
              </div>
              {group.description && (
                <p className="text-xs text-muted-foreground">{group.description}</p>
              )}
              <div className="overflow-hidden rounded-lg border">
                {groupRows.length === 0 ? (
                  <p className="px-3 py-3 text-xs text-muted-foreground">No options.</p>
                ) : (
                  groupRows.map((row) => (
                    <div
                      key={row.id}
                      className="flex items-center justify-between gap-3 border-b px-3 py-2 last:border-b-0"
                    >
                      <span className={row.isActive ? 'text-sm' : 'text-sm text-muted-foreground'}>
                        {row.value}
                      </span>
                      <div className="flex gap-1">
                        {row.isActive ? (
                          <>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => void rename(row)}
                            >
                              <PencilIcon data-icon="inline-start" />
                              Rename
                            </Button>
                            <Button
                              type="button"
                              variant="ghost"
                              size="xs"
                              onClick={() => void setActive(row, false)}
                            >
                              <Trash2Icon data-icon="inline-start" />
                              Retire
                            </Button>
                          </>
                        ) : (
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            onClick={() => void setActive(row, true)}
                          >
                            <ArchiveRestoreIcon data-icon="inline-start" />
                            Restore
                          </Button>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
