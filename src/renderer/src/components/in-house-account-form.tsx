import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSet
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  agentOptions,
  branchLabels,
  branchNames,
  suffixOptions,
  type AccountContact,
  type AccountDraft,
  type AccountEmail,
  type AccountValidationErrors,
  validateAccountDraft
} from '@/lib/in-house-accounts'

type InHouseAccountFormProps = {
  readonly initial?: AccountDraft
  readonly onSave: (draft: AccountDraft) => void
  readonly onCancel: () => void
}

const emptyDraft: AccountDraft = {
  branch: 'goa',
  lastName: '',
  firstName: '',
  middleName: '',
  suffix: '',
  streetSubdivision: '',
  barangay: '',
  cityMunicipality: '',
  province: 'Camarines Sur',
  occupation: '',
  contacts: [{ id: 'new-mobile', kind: 'mobile', value: '', isPrimary: true }],
  emails: [],
  agent: '',
  referredBy: ''
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function ContactRows({
  contacts,
  onChange,
  errors
}: {
  readonly contacts: readonly AccountContact[]
  readonly onChange: (contacts: readonly AccountContact[]) => void
  readonly errors?: string
}): React.JSX.Element {
  const update = (contactId: string, patch: Partial<AccountContact>): void =>
    onChange(
      contacts.map((contact) => (contact.id === contactId ? { ...contact, ...patch } : contact))
    )
  const add = (kind: AccountContact['kind']): void =>
    onChange([...contacts, { id: id(kind), kind, value: '', isPrimary: false }])
  const remove = (contactId: string): void =>
    onChange(contacts.filter((contact) => contact.id !== contactId))
  const mobileCount = contacts.filter((contact) => contact.kind === 'mobile').length
  const telephoneCount = contacts.filter((contact) => contact.kind === 'telephone').length
  return (
    <FieldSet className="gap-3">
      <FieldLegend variant="label">Mobile numbers</FieldLegend>
      {contacts
        .filter((contact) => contact.kind === 'mobile')
        .map((contact) => (
          <div className="flex items-end gap-2" key={contact.id}>
            <Field className="min-w-0 flex-1 gap-1.5">
              <FieldLabel htmlFor={contact.id}>Contact Number</FieldLabel>
              <Input
                id={contact.id}
                value={contact.value}
                placeholder="09XXXXXXXXX"
                onChange={(event) => update(contact.id, { value: event.target.value })}
              />
            </Field>
            <Button
              type="button"
              variant={contact.isPrimary ? 'secondary' : 'outline'}
              size="sm"
              onClick={() =>
                onChange(
                  contacts.map((item) =>
                    item.kind === 'mobile' ? { ...item, isPrimary: item.id === contact.id } : item
                  )
                )
              }
            >
              {contact.isPrimary ? 'Primary' : 'Make primary'}
            </Button>
            {mobileCount > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove contact number"
                onClick={() => remove(contact.id)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => add('mobile')}
      >
        <Plus data-icon="inline-start" />
        Add Contact Number
      </Button>
      {errors && <FieldError>{errors}</FieldError>}
      <FieldLegend variant="label" className="mt-2">
        Telephone numbers
      </FieldLegend>
      {contacts
        .filter((contact) => contact.kind === 'telephone')
        .map((contact) => (
          <div className="flex items-end gap-2" key={contact.id}>
            <Field className="min-w-0 flex-1 gap-1.5">
              <FieldLabel htmlFor={contact.id}>Telephone Number</FieldLabel>
              <Input
                id={contact.id}
                value={contact.value}
                onChange={(event) => update(contact.id, { value: event.target.value })}
              />
            </Field>
            {telephoneCount > 1 && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Remove telephone number"
                onClick={() => remove(contact.id)}
              >
                <Trash2 />
              </Button>
            )}
          </div>
        ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() => add('telephone')}
      >
        <Plus data-icon="inline-start" />
        Add Telephone Number
      </Button>
    </FieldSet>
  )
}

function EmailRows({
  emails,
  onChange,
  error
}: {
  readonly emails: readonly AccountEmail[]
  readonly onChange: (emails: readonly AccountEmail[]) => void
  readonly error?: string
}): React.JSX.Element {
  const update = (emailId: string, patch: Partial<AccountEmail>): void =>
    onChange(emails.map((email) => (email.id === emailId ? { ...email, ...patch } : email)))
  return (
    <FieldSet className="gap-3">
      <FieldLegend variant="label">Email addresses</FieldLegend>
      {emails.map((email) => (
        <div className="flex items-end gap-2" key={email.id}>
          <Field className="min-w-0 flex-1 gap-1.5">
            <FieldLabel htmlFor={email.id}>Email Address</FieldLabel>
            <Input
              id={email.id}
              type="email"
              value={email.value}
              onChange={(event) => update(email.id, { value: event.target.value })}
            />
          </Field>
          <Button
            type="button"
            variant={email.isPrimary ? 'secondary' : 'outline'}
            size="sm"
            onClick={() =>
              onChange(emails.map((item) => ({ ...item, isPrimary: item.id === email.id })))
            }
          >
            {email.isPrimary ? 'Primary' : 'Make primary'}
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="Remove email address"
            onClick={() => onChange(emails.filter((item) => item.id !== email.id))}
          >
            <Trash2 />
          </Button>
        </div>
      ))}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="w-fit"
        onClick={() =>
          onChange([...emails, { id: id('email'), value: '', isPrimary: emails.length === 0 }])
        }
      >
        <Plus data-icon="inline-start" />
        Add Email Address
      </Button>
      {error && <FieldError>{error}</FieldError>}
    </FieldSet>
  )
}

export function InHouseAccountForm({
  initial,
  onSave,
  onCancel
}: InHouseAccountFormProps): React.JSX.Element {
  const [draft, setDraft] = React.useState<AccountDraft>(initial ?? emptyDraft)
  const [errors, setErrors] = React.useState<AccountValidationErrors>({})
  const set = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]): void =>
    setDraft((current) => ({ ...current, [key]: value }))
  const submit = (event: React.FormEvent<HTMLFormElement>): void => {
    event.preventDefault()
    const nextErrors = validateAccountDraft(draft)
    setErrors(nextErrors)
    if (!Object.keys(nextErrors).length) onSave(draft)
  }
  return (
    <form className="flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <div className="min-h-0 flex-1 overflow-y-auto p-4">
        <FieldGroup className="gap-5">
          <FieldSet className="gap-3">
            <FieldLegend>Account classification</FieldLegend>
            <Field data-invalid={Boolean(errors.branch)}>
              <FieldLabel htmlFor="account-branch">Branch</FieldLabel>
              <Select
                value={draft.branch}
                onValueChange={(value) => set('branch', value as AccountDraft['branch'])}
              >
                <SelectTrigger id="account-branch" aria-invalid={Boolean(errors.branch)}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {branchNames.map((branch) => (
                    <SelectItem key={branch} value={branch}>
                      {branchLabels[branch]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <FieldError>{errors.branch}</FieldError>
            </Field>
          </FieldSet>
          <FieldSet className="gap-3">
            <FieldLegend>Name</FieldLegend>
            <div className="grid grid-cols-2 gap-3">
              <Field data-invalid={Boolean(errors.lastName)}>
                <FieldLabel htmlFor="last-name">Last Name</FieldLabel>
                <Input
                  id="last-name"
                  value={draft.lastName}
                  aria-invalid={Boolean(errors.lastName)}
                  onChange={(event) => set('lastName', event.target.value)}
                />
                <FieldError>{errors.lastName}</FieldError>
              </Field>
              <Field data-invalid={Boolean(errors.firstName)}>
                <FieldLabel htmlFor="first-name">First Name</FieldLabel>
                <Input
                  id="first-name"
                  value={draft.firstName}
                  aria-invalid={Boolean(errors.firstName)}
                  onChange={(event) => set('firstName', event.target.value)}
                />
                <FieldError>{errors.firstName}</FieldError>
              </Field>
              <Field>
                <FieldLabel htmlFor="middle-name">Middle Name</FieldLabel>
                <Input
                  id="middle-name"
                  value={draft.middleName}
                  onChange={(event) => set('middleName', event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="suffix">Suffix</FieldLabel>
                <Input
                  id="suffix"
                  list="suffix-options"
                  value={draft.suffix}
                  onChange={(event) => set('suffix', event.target.value)}
                />
                <datalist id="suffix-options">
                  {suffixOptions.map((suffix) => (
                    <option key={suffix} value={suffix} />
                  ))}
                </datalist>
                <FieldDescription>Choose a common suffix or enter a custom one.</FieldDescription>
              </Field>
            </div>
          </FieldSet>
          <FieldSet className="gap-3">
            <FieldLegend>Address</FieldLegend>
            <Field>
              <FieldLabel htmlFor="street-subdivision">Street / Subdivision</FieldLabel>
              <Input
                id="street-subdivision"
                value={draft.streetSubdivision}
                onChange={(event) => set('streetSubdivision', event.target.value)}
              />
            </Field>
            <div className="grid grid-cols-2 gap-3">
              <Field>
                <FieldLabel htmlFor="barangay">Barangay</FieldLabel>
                <Input
                  id="barangay"
                  value={draft.barangay}
                  onChange={(event) => set('barangay', event.target.value)}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="city-municipality">City / Municipality</FieldLabel>
                <Input
                  id="city-municipality"
                  value={draft.cityMunicipality}
                  onChange={(event) => set('cityMunicipality', event.target.value)}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel htmlFor="province">Province</FieldLabel>
              <Input
                id="province"
                value={draft.province}
                onChange={(event) => set('province', event.target.value)}
              />
            </Field>
          </FieldSet>
          <Field>
            <FieldLabel htmlFor="occupation">Occupation</FieldLabel>
            <Input
              id="occupation"
              value={draft.occupation}
              onChange={(event) => set('occupation', event.target.value)}
            />
          </Field>
          <ContactRows
            contacts={draft.contacts}
            onChange={(contacts) => set('contacts', contacts)}
            errors={errors.contacts}
          />
          <EmailRows
            emails={draft.emails}
            onChange={(emails) => set('emails', emails)}
            error={errors.emails}
          />
          <FieldSet className="gap-3">
            <FieldLegend>Account attribution</FieldLegend>
            <Field>
              <FieldLabel htmlFor="agent">Agent</FieldLabel>
              <Input
                id="agent"
                list="agent-options"
                value={draft.agent}
                onChange={(event) => set('agent', event.target.value)}
              />
              <datalist id="agent-options">
                {agentOptions.map((agent) => (
                  <option key={agent} value={agent} />
                ))}
              </datalist>
            </Field>
            <Field>
              <FieldLabel htmlFor="referred-by">Referred By</FieldLabel>
              <Input
                id="referred-by"
                value={draft.referredBy}
                onChange={(event) => set('referredBy', event.target.value)}
              />
            </Field>
          </FieldSet>
        </FieldGroup>
      </div>
      <div className="flex shrink-0 gap-2 border-t p-3">
        <Button type="submit">Save Account</Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
      </div>
    </form>
  )
}
