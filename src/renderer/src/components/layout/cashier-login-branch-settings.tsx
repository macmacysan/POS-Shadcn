import * as React from 'react'
import { CircleAlertIcon } from 'lucide-react'

import {
  financeBranchValues,
  type FinanceBranch,
  type OnlineBackupRevision
} from '@/../../shared/contracts'
import { Button } from '@/components/ui/button'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogTitle
} from '@/components/ui/alert-dialog'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { useNotifications } from '@/hooks/use-notifications'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'

export function CashierLoginBranchSettings(): React.JSX.Element {
  const [branch, setBranch] = React.useState<FinanceBranch>()
  const [isSaving, setIsSaving] = React.useState(false)
  const [initialRecoveryRequired, setInitialRecoveryRequired] = React.useState(false)
  const [isRestoreConfirmationOpen, setIsRestoreConfirmationOpen] = React.useState(false)
  const [revisions, setRevisions] = React.useState<OnlineBackupRevision[]>([])
  const [selectedRevision, setSelectedRevision] = React.useState<OnlineBackupRevision>()
  const [isRevisionRestoreOpen, setIsRevisionRestoreOpen] = React.useState(false)
  const { notify } = useNotifications()

  React.useEffect(() => {
    void window.api.auth
      .getCashierLoginBranch()
      .then(setBranch)
      .catch(() => notify({ type: 'error', title: 'Cashier login branch could not be loaded.' }))
  }, [notify])

  React.useEffect(() => {
    void window.api.auth
      .getInitialRecoveryStatus()
      .then((status) => setInitialRecoveryRequired(status.required))
  }, [])

  const loadRevisions = React.useCallback(
    async (selectedBranch: FinanceBranch): Promise<void> => {
      try {
        setRevisions(await window.api.backups.listOnlineRevisions({ branch: selectedBranch }))
      } catch {
        notify({ type: 'error', title: 'Online backup revisions could not be loaded.' })
      }
    },
    [notify]
  )

  React.useEffect(() => {
    if (branch) void loadRevisions(branch)
  }, [branch, loadRevisions])

  const restoreRevision = async (): Promise<void> => {
    if (!branch || !selectedRevision) return
    setIsSaving(true)
    try {
      await window.api.backups.restoreOnlineRevision({ id: selectedRevision.id, branch })
    } catch {
      setIsSaving(false)
      notify({ type: 'error', title: 'Online backup revision could not be restored.' })
    }
  }

  const restore = async (): Promise<void> => {
    if (!branch) return
    setIsSaving(true)
    try {
      await window.api.auth.restoreInitialBranchSnapshot(branch)
    } catch {
      notify({ type: 'error', title: 'Branch data could not be restored.' })
      setIsSaving(false)
    }
  }

  const save = async (): Promise<void> => {
    if (!branch) return
    if (initialRecoveryRequired) {
      setIsRestoreConfirmationOpen(true)
      return
    }
    setIsSaving(true)
    try {
      setBranch(await window.api.auth.setCashierLoginBranch(branch))
      notify({ type: 'success', title: 'Cashier login branch saved.' })
    } catch {
      notify({ type: 'error', title: 'Cashier login branch could not be saved.' })
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className="mt-6 max-w-xl">
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="cashier-login-branch">
            {initialRecoveryRequired ? 'Default branch data' : 'Cashier login branch'}
          </FieldLabel>
          <Select value={branch} onValueChange={(value) => setBranch(value as FinanceBranch)}>
            <SelectTrigger id="cashier-login-branch">
              <SelectValue placeholder="Select a branch" />
            </SelectTrigger>
            <SelectContent>
              {financeBranchValues.map((value) => (
                <SelectItem key={value} value={value}>
                  {value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FieldDescription>
            {initialRecoveryRequired
              ? 'Restore this branch’s encrypted Google Drive snapshot, or use this empty branch as the cashier default.'
              : 'Every cashier signs into this branch on their next login.'}
          </FieldDescription>
        </Field>
        <div>
          <Button
            type="button"
            variant={initialRecoveryRequired ? 'destructive' : 'default'}
            onClick={() => void save()}
            disabled={!branch || isSaving}
          >
            {isSaving
              ? 'Restoring…'
              : initialRecoveryRequired
                ? 'Restore data or set default branch'
                : 'Save cashier login branch'}
          </Button>
        </div>
      </FieldGroup>
      <AlertDialog open={isRestoreConfirmationOpen} onOpenChange={setIsRestoreConfirmationOpen}>
        <AlertDialogContent className="sm:max-w-[28.8rem]">
          <div className="flex items-start gap-3 py-1">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <CircleAlertIcon className="size-5 text-destructive" />
            </div>
            <div className="flex flex-col justify-center gap-1">
              <AlertDialogTitle className="text-sm font-semibold">
                Restore {branch} branch data?
              </AlertDialogTitle>
              <AlertDialogDescription>
                If a snapshot exists, this replaces the fresh local database with it. Otherwise, this
                branch becomes the cashier default and the app restarts.
              </AlertDialogDescription>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current setup</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={() => void restore()}>
              Restore {branch} data
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <section className="mt-8 flex max-w-3xl flex-col gap-3">
        <div>
          <h3 className="text-sm font-medium">Online backup revisions</h3>
          <p className="text-sm text-muted-foreground">
            Verified encrypted recovery copies for {branch ?? 'the selected branch'}.
          </p>
        </div>
        {revisions.length ? (
          <div className="max-h-64 overflow-auto rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Size</TableHead>
                  <TableHead>Verified</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {revisions.map((revision) => (
                  <TableRow key={revision.id}>
                    <TableCell>{new Date(revision.createdAt).toLocaleString()}</TableCell>
                    <TableCell>{Math.ceil(revision.sizeBytes / 1024)} KB</TableCell>
                    <TableCell>{revision.verified ? 'Verified' : 'Pending'}</TableCell>
                    <TableCell className="text-right">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          setSelectedRevision(revision)
                          setIsRevisionRestoreOpen(true)
                        }}
                      >
                        Restore
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">
            No verified online revisions are available yet.
          </p>
        )}
      </section>
      <AlertDialog open={isRevisionRestoreOpen} onOpenChange={setIsRevisionRestoreOpen}>
        <AlertDialogContent>
          <div className="flex items-start gap-3 py-1">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <CircleAlertIcon className="size-5 text-destructive" />
            </div>
            <div className="flex flex-col justify-center gap-1">
              <AlertDialogTitle className="text-sm font-semibold">
                Restore this online backup revision?
              </AlertDialogTitle>
              <AlertDialogDescription>
                This replaces the local database with the selected verified revision, preserves the
                current database as a dated recovery copy, and restarts the app.
              </AlertDialogDescription>
            </div>
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep current data</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              disabled={isSaving}
              onClick={() => void restoreRevision()}
            >
              Restore revision
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  )
}
