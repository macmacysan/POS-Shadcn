import * as React from 'react'
import { KeyRound, Pencil, Plus, Trash2, X } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Field, FieldGroup, FieldLabel, FieldLegend, FieldSet } from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { useNotifications } from '@/hooks/use-notifications'
import { AccountBranchBadge } from '@/features/in-house-accounts'
import type { UserProfileRecord } from '@/../../shared/contracts'

const branches = ['Goa', 'Lagonoy', 'Tigaon', 'Tinambac'] as const
type Branch = (typeof branches)[number]
type ProfileForm = {
  firstName: string
  lastName: string
  username: string
  password: string
  role: 'ADMIN' | 'CASHIER'
  branches: Branch[]
  isActive: boolean
}

const blank: ProfileForm = {
  firstName: '',
  lastName: '',
  username: '',
  password: '',
  role: 'CASHIER',
  branches: ['Goa'],
  isActive: true
}

function formFromProfile(profile: UserProfileRecord): ProfileForm {
  return {
    firstName: profile.firstName,
    lastName: profile.lastName,
    username: profile.username,
    password: '',
    role: profile.role,
    branches: [
      profile.branch,
      ...profile.branches.filter((branch) => branch !== profile.branch)
    ] as Branch[],
    isActive: profile.isActive
  }
}

export function UserProfilesSettings({ currentUserId, onPasswordChanged }: { currentUserId: string; onPasswordChanged: () => void }): React.JSX.Element {
  const [profiles, setProfiles] = React.useState<UserProfileRecord[]>([])
  const [form, setForm] = React.useState<ProfileForm>(blank)
  const [selected, setSelected] = React.useState<UserProfileRecord>()
  const [isSaving, setIsSaving] = React.useState(false)
  const { notify } = useNotifications()

  const load = React.useCallback(async () => {
    try {
      setProfiles(await window.api.userProfiles.list())
    } catch {
      notify({ type: 'error', title: 'User profiles could not be loaded.' })
    }
  }, [notify])

  React.useEffect(() => {
    void load()
  }, [load])

  const startCreate = (): void => {
    setSelected(undefined)
    setForm({ ...blank, branches: [...blank.branches] })
  }

  const startEdit = (profile: UserProfileRecord): void => {
    setSelected(profile)
    setForm(formFromProfile(profile))
  }

  const save = async (event: React.FormEvent): Promise<void> => {
    event.preventDefault()
    if (form.branches.length === 0) {
      notify({ type: 'error', title: 'Select at least one branch.' })
      return
    }
    setIsSaving(true)
    try {
      const request = {
        firstName: form.firstName,
        lastName: form.lastName,
        username: form.username,
        role: form.role,
        branch: form.branches[0],
        branches: form.branches,
        isActive: form.isActive
      }
      if (selected) {
        await window.api.userProfiles.update({ ...request, id: selected.id, ...(form.password ? { password: form.password } : {}) })
      } else {
        await window.api.userProfiles.create({ ...request, password: form.password })
      }
      startCreate()
      await load()
      notify({ type: 'success', title: selected ? 'User profile updated.' : 'User profile created.' })
      if (selected?.id === currentUserId && form.password) onPasswordChanged()
    } catch {
      notify({ type: 'error', title: 'User profile could not be saved.' })
    } finally {
      setIsSaving(false)
    }
  }

  const remove = async (profile: UserProfileRecord): Promise<void> => {
    if (!window.confirm(`Delete ${profile.firstName} ${profile.lastName}? This cannot be undone.`)) return
    try {
      await window.api.userProfiles.delete({ id: profile.id })
      if (selected?.id === profile.id) startCreate()
      await load()
      notify({ type: 'success', title: 'User profile deleted.' })
    } catch {
      notify({ type: 'error', title: 'User profile could not be deleted. Deactivate it instead if it has linked records.' })
    }
  }

  const toggleBranch = (branch: Branch, checked: boolean): void => {
    setForm((current) => ({
      ...current,
      branches: checked
        ? [...new Set([...current.branches, branch])]
        : current.branches.filter((currentBranch) => currentBranch !== branch)
    }))
  }

  return (
    <section className="mt-6 flex max-w-5xl flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium">User Profiles</p>
          <p className="text-xs text-muted-foreground">Manage names, credentials, roles, status, and branch access.</p>
        </div>
        <Button type="button" size="sm" onClick={startCreate}>
          <Plus data-icon="inline-start" />
          Add user
        </Button>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <table className="w-full min-w-[700px] text-sm">
          <thead className="border-b bg-muted/30 text-left text-xs text-muted-foreground">
            <tr>
              <th className="p-3 font-medium">Name</th>
              <th className="p-3 font-medium">Username</th>
              <th className="p-3 font-medium">Role</th>
              <th className="p-3 font-medium">Branches</th>
              <th className="p-3 font-medium">Status</th>
              <th className="p-3 text-right font-medium">Actions</th>
            </tr>
          </thead>
          <tbody>
            {profiles.map((profile) => (
              <tr key={profile.id} className="border-b last:border-0">
                <td className="p-3 font-medium">{profile.firstName} {profile.lastName}</td>
                <td className="p-3 text-muted-foreground">{profile.username}</td>
                <td className="p-3">{profile.role === 'ADMIN' ? 'Admin' : 'Cashier'}</td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-1">
                    {profile.branches.map((branch) => <AccountBranchBadge key={branch} branch={branch} />)}
                  </div>
                </td>
                <td className="p-3">
                  <Badge variant={profile.isActive ? 'emerald' : 'zinc'}>{profile.isActive ? 'Active' : 'Inactive'}</Badge>
                </td>
                <td className="p-3 text-right">
                  <div className="flex justify-end gap-1">
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Edit ${profile.username}`} onClick={() => startEdit(profile)}>
                      <Pencil />
                    </Button>
                    <Button type="button" size="icon-sm" variant="ghost" aria-label={`Delete ${profile.username}`} onClick={() => void remove(profile)}>
                      <Trash2 />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <form onSubmit={(event) => void save(event)} className="rounded-md border p-4">
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <p className="text-sm font-medium">{selected ? 'Edit user' : 'Add user'}</p>
          <p className="text-xs text-muted-foreground">{selected ? 'Leave Password blank to keep the current password.' : 'The password must be at least 6 characters.'}</p>
          </div>
          {selected && (
            <Button type="button" size="icon-sm" variant="ghost" aria-label="Cancel editing" onClick={startCreate}>
              <X />
            </Button>
          )}
        </div>
        <FieldGroup className="grid gap-4 md:grid-cols-2">
          <Field>
            <FieldLabel htmlFor="profile-first-name">First Name</FieldLabel>
            <Input id="profile-first-name" value={form.firstName} onChange={(event) => setForm({ ...form, firstName: event.target.value })} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-last-name">Last Name</FieldLabel>
            <Input id="profile-last-name" value={form.lastName} onChange={(event) => setForm({ ...form, lastName: event.target.value })} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-username">Username</FieldLabel>
            <Input id="profile-username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} required />
          </Field>
          <Field>
            <FieldLabel htmlFor="profile-password">Password</FieldLabel>
            <Input id="profile-password" type="password" value={form.password} onChange={(event) => setForm({ ...form, password: event.target.value })} required={!selected} minLength={6} placeholder={selected ? 'Leave blank to keep current' : undefined} />
          </Field>
          <Field>
            <FieldLabel>Role</FieldLabel>
            <Select value={form.role} onValueChange={(role) => setForm({ ...form, role: role as ProfileForm['role'] })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="CASHIER">Cashier</SelectItem>
                <SelectItem value="ADMIN">Admin</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <FieldLabel>Status</FieldLabel>
            <Select value={form.isActive ? 'ACTIVE' : 'INACTIVE'} onValueChange={(status) => setForm({ ...form, isActive: status === 'ACTIVE' })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="ACTIVE">Active</SelectItem>
                <SelectItem value="INACTIVE">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <FieldSet className="md:col-span-2">
            <FieldLegend variant="label">Branch access</FieldLegend>
            <div className="grid gap-3 sm:grid-cols-4">
              {branches.map((branch) => (
                <Field key={branch} orientation="horizontal">
                  <Checkbox id={`profile-branch-${branch}`} checked={form.branches.includes(branch)} onCheckedChange={(checked) => toggleBranch(branch, checked === true)} />
                  <FieldLabel htmlFor={`profile-branch-${branch}`}>{branch}</FieldLabel>
                </Field>
              ))}
            </div>
          </FieldSet>
        </FieldGroup>
        <div className="mt-4 flex items-center gap-2">
          <Button type="submit" disabled={isSaving || form.branches.length === 0}>
            <KeyRound data-icon="inline-start" />
            {isSaving ? 'Saving...' : selected ? 'Save changes' : 'Create user'}
          </Button>
          {selected && <Button type="button" variant="outline" onClick={startCreate}>Cancel</Button>}
        </div>
      </form>
    </section>
  )
}
