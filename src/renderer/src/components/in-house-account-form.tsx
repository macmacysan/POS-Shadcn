import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CardFooter } from '@/components/ui/card'
import {
  Field,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldLegend,
  FieldSeparator,
  FieldSet
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from '@/components/ui/combobox'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  agentOptions,
  branchLabels,
  branchNames,
  suffixOptions,
  type AccountContact,
  type AccountAddressSelection,
  type AccountDraft,
  type AccountEmail,
  type AccountValidationErrors,
  validateAccountDraft
} from '@/lib/in-house-accounts'
import {
  childrenOf,
  findPsgcOption,
  psgcBarangays,
  psgcCitiesMunicipalities,
  psgcProvinces,
  psgcRegions,
  type PsgcOption
} from '@/lib/psgc'

type InHouseAccountFormProps = {
  readonly initial?: AccountDraft
  readonly onSave: (draft: AccountDraft) => void
  readonly onCancel: () => void
}

const emptyDraft: AccountDraft = {
  branch: 'Goa',
  lastName: '',
  firstName: '',
  middleName: '',
  suffix: '',
  streetSubdivision: '',
  regionPsgc: undefined,
  barangay: '',
  barangayPsgc: undefined,
  cityMunicipality: '',
  cityMunicipalityPsgc: undefined,
  province: '',
  provincePsgc: undefined,
  occupation: '',
  contacts: [{ id: 'new-mobile', kind: 'mobile', value: '', isPrimary: true }],
  emails: [],
  agent: '',
  referredBy: ''
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function addressSelection(option: PsgcOption | undefined): AccountAddressSelection | undefined {
  return option ? { code: option.code, name: option.name } : undefined
}

function AddressCombobox({
  id: fieldId,
  label,
  options,
  value,
  disabled,
  emptyMessage,
  onChange
}: {
  readonly id: string
  readonly label: string
  readonly options: readonly PsgcOption[]
  readonly value?: PsgcOption
  readonly disabled?: boolean
  readonly emptyMessage: string
  readonly onChange: (value: PsgcOption | undefined) => void
}): React.JSX.Element {
  return (
    <Field>
      <FieldLabel htmlFor={fieldId}>{label}</FieldLabel>
      <Combobox
        items={options}
        itemToStringLabel={(option) => option.name}
        itemToStringValue={(option) => option.name}
        value={value ?? null}
        autoHighlight
        onValueChange={(option) => onChange(option ?? undefined)}
      >
        <ComboboxInput
          id={fieldId}
          placeholder={`Search ${label.toLowerCase()}...`}
          disabled={disabled}
          showClear
        />
        <ComboboxContent>
          <ComboboxEmpty>{emptyMessage}</ComboboxEmpty>
          <ComboboxList>
            {(option) => (
              <ComboboxItem key={option.code} value={option}>
                {option.name}
              </ComboboxItem>
            )}
          </ComboboxList>
        </ComboboxContent>
      </Combobox>
    </Field>
  )
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
  const remove = (contactId: string): void =>
    onChange(contacts.filter((contact) => contact.id !== contactId))
  const mobileCount = contacts.filter((contact) => contact.kind === 'mobile').length
  return (
    <FieldSet className="gap-3">
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
      {errors && <FieldError>{errors}</FieldError>}
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
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label="Remove telephone number"
              onClick={() => remove(contact.id)}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
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
  const [address, setAddress] = React.useState(() => {
    const province = findPsgcOption(psgcProvinces, initial?.provincePsgc?.code, initial?.province)
    const cityMunicipality =
      findPsgcOption(
        childrenOf(psgcCitiesMunicipalities, province?.code ?? ''),
        initial?.cityMunicipalityPsgc?.code,
        initial?.cityMunicipality
      ) ??
      findPsgcOption(
        psgcCitiesMunicipalities,
        initial?.cityMunicipalityPsgc?.code,
        initial?.cityMunicipality
      )
    const barangay =
      findPsgcOption(
        childrenOf(psgcBarangays, cityMunicipality?.code ?? ''),
        initial?.barangayPsgc?.code,
        initial?.barangay
      ) ?? findPsgcOption(psgcBarangays, initial?.barangayPsgc?.code, initial?.barangay)
    return { province, cityMunicipality, barangay }
  })
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
      <ScrollArea className="min-h-0 flex-1">
        <div className="p-4">
          <FieldGroup className="gap-3">
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
            <FieldSeparator />
            <FieldSet className="gap-3">
              <FieldLegend>Name</FieldLegend>
              <FieldGroup className="grid gap-3 sm:grid-cols-2">
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
                  <Select
                    value={draft.suffix || undefined}
                    onValueChange={(value) => set('suffix', value ?? '')}
                  >
                    <SelectTrigger id="suffix">
                      <SelectValue placeholder="Select suffix" />
                    </SelectTrigger>
                    <SelectContent>
                      {suffixOptions.map((suffix) => (
                        <SelectItem key={suffix} value={suffix}>
                          {suffix}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <FieldSet className="gap-3">
              <FieldLegend>Address</FieldLegend>
              <FieldGroup className="grid gap-3 sm:grid-cols-2">
                <AddressCombobox
                  id="province"
                  label="Province"
                  options={psgcProvinces}
                  value={address.province}
                  emptyMessage="No province found."
                  onChange={(province) => {
                    const region = psgcRegions.find((option) => option.code === province?.parentCode)
                    setAddress((current) => ({
                      ...current,
                      province,
                      cityMunicipality: undefined,
                      barangay: undefined
                    }))
                    setDraft((current) => ({
                      ...current,
                      regionPsgc: addressSelection(region),
                      province: province?.name ?? '',
                      provincePsgc: addressSelection(province),
                      cityMunicipality: '',
                      cityMunicipalityPsgc: undefined,
                      barangay: '',
                      barangayPsgc: undefined
                    }))
                  }}
                />
                <AddressCombobox
                  id="city-municipality"
                  label="City / Municipality"
                  options={childrenOf(psgcCitiesMunicipalities, address.province?.code ?? '')}
                  value={address.cityMunicipality}
                  disabled={!address.province}
                  emptyMessage="No municipality found."
                  onChange={(cityMunicipality) => {
                    setAddress((current) => ({ ...current, cityMunicipality, barangay: undefined }))
                    setDraft((current) => ({
                      ...current,
                      cityMunicipality: cityMunicipality?.name ?? '',
                      cityMunicipalityPsgc: addressSelection(cityMunicipality),
                      barangay: '',
                      barangayPsgc: undefined
                    }))
                  }}
                />
                <AddressCombobox
                  id="barangay"
                  label="Barangay"
                  options={childrenOf(psgcBarangays, address.cityMunicipality?.code ?? '')}
                  value={address.barangay}
                  disabled={!address.cityMunicipality}
                  emptyMessage="No barangay found."
                  onChange={(barangay) => {
                    setAddress((current) => ({ ...current, barangay }))
                    setDraft((current) => ({
                      ...current,
                      barangay: barangay?.name ?? '',
                      barangayPsgc: addressSelection(barangay)
                    }))
                  }}
                />
              </FieldGroup>
              <Field>
                <FieldLabel htmlFor="street-subdivision">Street / Subdivision</FieldLabel>
                <Input
                  id="street-subdivision"
                  value={draft.streetSubdivision}
                  onChange={(event) => set('streetSubdivision', event.target.value)}
                />
              </Field>
            </FieldSet>
            <FieldSeparator />
            <FieldSet className="gap-3">
              <FieldLegend>Contact information</FieldLegend>
              <FieldGroup>
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
                <div className="flex flex-nowrap items-center gap-1 overflow-x-auto text-muted-foreground">
                  <Button
                    type="button"
                    variant="link"
                    size="sm"
                    onClick={() =>
                      set('contacts', [
                        ...draft.contacts,
                        { id: id('mobile'), kind: 'mobile', value: '', isPrimary: false }
                      ])
                    }
                  >
                    <Plus data-icon="inline-start" />
                    Add Contact
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      set('contacts', [
                        ...draft.contacts,
                        { id: id('telephone'), kind: 'telephone', value: '', isPrimary: false }
                      ])
                    }
                  >
                    <Plus data-icon="inline-start" />
                    Add telephone
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      set('emails', [
                        ...draft.emails,
                        {
                          id: id('email'),
                          value: '',
                          isPrimary: draft.emails.length === 0
                        }
                      ])
                    }
                  >
                    <Plus data-icon="inline-start" />
                    Add Email
                  </Button>
                </div>
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <FieldSet className="gap-3">
              <FieldLegend>Account attribution</FieldLegend>
              <FieldGroup className="grid gap-3 sm:grid-cols-2">
                <Field>
                  <FieldLabel htmlFor="occupation">Occupation</FieldLabel>
                  <Input
                    id="occupation"
                    value={draft.occupation}
                    onChange={(event) => set('occupation', event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="agent">Agent</FieldLabel>
                  <Select
                    value={draft.agent || undefined}
                    onValueChange={(value) => set('agent', value ?? '')}
                  >
                    <SelectTrigger id="agent">
                      <SelectValue placeholder="Select agent" />
                    </SelectTrigger>
                    <SelectContent>
                      {agentOptions.map((agent) => (
                        <SelectItem key={agent} value={agent}>
                          {agent}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field>
                  <FieldLabel htmlFor="referred-by">Referred By</FieldLabel>
                  <Input
                    id="referred-by"
                    value={draft.referredBy}
                    onChange={(event) => set('referredBy', event.target.value)}
                  />
                </Field>
              </FieldGroup>
            </FieldSet>
          </FieldGroup>
        </div>
      </ScrollArea>
      <CardFooter className="shrink-0 justify-end gap-2 border-t bg-background p-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit">Save Account</Button>
      </CardFooter>
    </form>
  )
}
