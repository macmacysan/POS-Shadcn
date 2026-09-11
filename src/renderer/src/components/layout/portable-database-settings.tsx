import * as React from 'react'
import { CircleAlertIcon, DownloadIcon, UploadIcon } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { DestructiveAlertDialog } from '@/components/shared/destructive-alert-dialog'
import { useNotifications } from '@/hooks/use-notifications'

type PortableImport = { token: string; fileName: string; schemaVersion: number }

function errorMessage(error: unknown): string | undefined {
  return error instanceof Error ? error.message : undefined
}

export function PortableDatabaseSettings(): React.JSX.Element {
  const [isBusy, setIsBusy] = React.useState(false)
  const [isImporting, setIsImporting] = React.useState(false)
  const [pendingImport, setPendingImport] = React.useState<PortableImport>()
  const confirming = React.useRef(false)
  const { notify } = useNotifications()

  const exportDatabase = async (): Promise<void> => {
    setIsBusy(true)
    try {
      const exported = await window.api.backups.exportPortable()
      if (exported)
        notify({
          type: 'success',
          title: 'Whole database exported.',
          description: `${exported.fileName} is a standalone file with no WAL or SHM sidecars.`
        })
    } catch {
      notify({ type: 'error', title: 'Whole database could not be exported.' })
    } finally {
      setIsBusy(false)
    }
  }

  const selectImport = async (): Promise<void> => {
    setIsBusy(true)
    try {
      const selected = await window.api.backups.selectPortableImport()
      if (selected) setPendingImport(selected)
    } catch (error) {
      notify({
        type: 'error',
        title: 'Database file could not be imported.',
        description: errorMessage(error)
      })
    } finally {
      setIsBusy(false)
    }
  }

  const cancelImport = async (): Promise<void> => {
    const pending = pendingImport
    setPendingImport(undefined)
    if (!pending || confirming.current) return
    try {
      await window.api.backups.cancelPortableImport({ token: pending.token })
    } catch {
      // The staged file may already have expired; it is safe to leave the confirmation closed.
    }
  }

  const confirmImport = async (): Promise<void> => {
    if (!pendingImport) return
    confirming.current = true
    setIsImporting(true)
    try {
      await window.api.backups.confirmPortableImport({ token: pendingImport.token })
    } catch {
      confirming.current = false
      setIsImporting(false)
      setPendingImport(undefined)
      notify({ type: 'error', title: 'Database could not be replaced.' })
    }
  }

  const disabled = isBusy || isImporting || Boolean(pendingImport)

  return (
    <section className="flex max-w-2xl flex-col gap-3">
      <div>
        <h3 className="text-sm font-medium">Database</h3>
        <p className="text-sm text-muted-foreground">
          Export or replace the complete local Cashiers Report database. Import only a standalone
          .db created with Export Whole Database; do not select a live database with a WAL file.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => void exportDatabase()}
          disabled={disabled}
        >
          <DownloadIcon data-icon="inline-start" />
          Export Whole Database
        </Button>
        <Button
          type="button"
          variant="destructive"
          onClick={() => void selectImport()}
          disabled={disabled}
        >
          <UploadIcon data-icon="inline-start" />
          Import Whole Database
        </Button>
      </div>
      {isImporting && (
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Importing database and restarting…
        </p>
      )}
      <DestructiveAlertDialog
        open={Boolean(pendingImport)}
        onOpenChange={(open) => {
          if (!open) void cancelImport()
        }}
        title="Replace the whole database?"
        description={
          <>
            {pendingImport?.fileName} will replace the entire local database, including users,
            reports, installments, finance records, settings, and other local business data. The
            current database is kept as a recovery copy, then the app restarts.
          </>
        }
        actionLabel="Replace and restart"
        cancelLabel="Keep current database"
        actionDisabled={isImporting}
        icon={<CircleAlertIcon />}
        onConfirm={() => void confirmImport()}
      />
    </section>
  )
}
