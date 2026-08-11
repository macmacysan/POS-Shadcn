import * as React from 'react'
import { Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CardFooter } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
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
import { formatPhilippinePeso } from '@/lib/currency'
import { Textarea } from '@/components/ui/textarea'
import {
  agentOptions,
  branchLabels,
  branchNames,
  formatAccountName,
  loanTermOptions,
  paymentFrequencyOptions,
  suffixOptions,
  type AccountAddressSelection,
  type AccountContact,
  type AccountDraft,
  type AccountEmail,
  type AccountValidationErrors,
  type LoanDraft,
  type LoanValidationErrors,
  normalizeAccountDraft,
  normalizeLoanDraft,
  validateAccountDraft,
  validateLoanDraft
} from '@/lib/in-house-accounts'
import {
  childrenOf,
  psgcBarangays,
  psgcCitiesMunicipalities,
  psgcProvinces,
  psgcRegions,
  type PsgcOption
} from '@/lib/psgc'
import type { CatalogOptionRecord } from '../../../../../shared/contracts'

export type InHouseAccountWorkflowSave =
  | {
      readonly mode: 'new'
      readonly accountDraft: AccountDraft
      readonly loanDraft: LoanDraft
    }
  | {
      readonly mode: 'existing'
      readonly customerId: string
      readonly loanDraft: LoanDraft
    }

type InHouseAccountFormProps = {
  readonly onSave: (payload: InHouseAccountWorkflowSave) => Promise<void>
  readonly onCancel: () => void
  readonly onDirtyChange?: (dirty: boolean) => void
}

const emptyAccountDraft: AccountDraft = {
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

const emptyLoanDraft: LoanDraft = {
  dateReleased: '',
  startDate: '',
  firstDueDate: '',
  paymentFrequency: 'Monthly',
  terms: '',
  principal: 0,
  interest: 0,
  downPayment: 0,
  fees: 0,
  installmentAmount: 0,
  grandTotal: 0,
  items: [{ id: 'new-item', name: '', quantity: 1, price: 0 }],
  remarks: ''
}

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function addressSelection(option: PsgcOption | undefined): AccountAddressSelection | undefined {
  return option ? { code: option.code, name: option.name } : undefined
}

function money(value: number | undefined): string {
  return formatPhilippinePeso(value ?? 0)
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
  errors,
  actions
}: {
  readonly contacts: readonly AccountContact[]
  readonly onChange: (contacts: readonly AccountContact[]) => void
  readonly errors?: string
  readonly actions: React.ReactNode
}): React.JSX.Element {
  const update = (contactId: string, patch: Partial<AccountContact>): void =>
    onChange(
      contacts.map((contact) => (contact.id === contactId ? { ...contact, ...patch } : contact))
    )
  const remove = (contactId: string): void =>
    onChange(contacts.filter((contact) => contact.id !== contactId))
  const mobileCount = contacts.filter((contact) => contact.kind === 'mobile').length

  return (
    <FieldSet className="gap-2">
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
      {actions}
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
    <FieldSet className="gap-2">
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

function ReviewSection({
  title,
  children
}: {
  readonly title: string
  readonly children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="rounded-lg border bg-card p-3">
      <h3 className="mb-2 text-xs font-semibold text-foreground">{title}</h3>
      <div className="grid gap-2 text-xs sm:grid-cols-2">{children}</div>
    </section>
  )
}

function ReviewValue({
  label,
  value
}: {
  readonly label: string
  readonly value: React.ReactNode
}): React.JSX.Element {
  return (
    <div className="min-w-0">
      <div className="text-muted-foreground">{label}</div>
      <div className="truncate font-light text-foreground">{value || '-'}</div>
    </div>
  )
}

export function InHouseAccountForm({
  onSave,
  onCancel,
  onDirtyChange
}: InHouseAccountFormProps): React.JSX.Element {
  const [accountDraft, setAccountDraft] = React.useState<AccountDraft>(emptyAccountDraft)
  const [accountErrors, setAccountErrors] = React.useState<AccountValidationErrors>({})
  const [loanDraft, setLoanDraft] = React.useState<LoanDraft>(emptyLoanDraft)
  const [loanErrors, setLoanErrors] = React.useState<LoanValidationErrors>({})
  const [formError, setFormError] = React.useState<string>()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [catalogOptions, setCatalogOptions] = React.useState<CatalogOptionRecord[]>([])
  const [address, setAddress] = React.useState<{
    province?: PsgcOption
    cityMunicipality?: PsgcOption
    barangay?: PsgcOption
  }>({})
  React.useEffect(() => {
    void window.api.catalogOptions
      .list({ activeOnly: true })
      .then(({ rows }) => setCatalogOptions(rows))
      .catch(() => undefined)
  }, [])
  const agents = catalogOptions
    .filter((option) => option.kind === 'IN_HOUSE_AGENT')
    .map((option) => option.value)
  const monthlyTerms = Array.from({ length: 12 }, (_, index) => index + 1)
  const setAccount = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]): void =>
    setAccountDraft((current) => ({ ...current, [key]: value }))
  const setLoan = <K extends keyof LoanDraft>(key: K, value: LoanDraft[K]): void =>
    setLoanDraft((current) => ({ ...current, [key]: value }))

  const save = async (): Promise<void> => {
    if (isSubmitting) return
    setFormError(undefined)
    const normalizedLoan = normalizeLoanDraft(loanDraft)
    const loanValidation = validateLoanDraft(normalizedLoan)
    setLoanErrors(loanValidation)
    if (Object.keys(loanValidation).length) {
      return
    }

    const normalizedAccount = normalizeAccountDraft(accountDraft)
    const accountValidation = validateAccountDraft(normalizedAccount)
    setAccountErrors(accountValidation)
    if (Object.keys(accountValidation).length) {
      return
    }
    setIsSubmitting(true)
    try {
      await onSave({ mode: 'new', accountDraft: normalizedAccount, loanDraft: normalizedLoan })
    } catch {
      setFormError('The account and loan could not be created. Your entries are still available.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const addLoanItem = (): void =>
    setLoan('items', [...loanDraft.items, { id: id('item'), name: '', quantity: 1, price: 0 }])

  const removeLoanItem = (itemId: string): void =>
    setLoan(
      'items',
      loanDraft.items.length > 1
        ? loanDraft.items.filter((item) => item.id !== itemId)
        : emptyLoanDraft.items
    )

  const customerName = formatAccountName(accountDraft)

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onInputCapture={() => onDirtyChange?.(true)}
      onSubmit={(event) => {
        event.preventDefault()
        void save()
      }}
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-6 p-6 xl:grid-cols-2">
          {formError && <FieldError className="xl:col-span-2">{formError}</FieldError>}

          <FieldGroup className="gap-4">
            <>
              <FieldSet className="gap-3">
                <FieldLegend variant="label">Customer classification</FieldLegend>
                <Field data-invalid={Boolean(accountErrors.branch)}>
                  <FieldLabel htmlFor="account-branch">Branch</FieldLabel>
                  <Select
                    value={accountDraft.branch}
                    onValueChange={(value) => setAccount('branch', value as AccountDraft['branch'])}
                  >
                    <SelectTrigger id="account-branch" aria-invalid={Boolean(accountErrors.branch)}>
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
                  <FieldError>{accountErrors.branch}</FieldError>
                </Field>
              </FieldSet>
              <FieldSeparator />
              <FieldSet className="gap-3">
                <FieldLegend variant="label">Name</FieldLegend>
                <FieldGroup className="grid gap-3 sm:grid-cols-2">
                  <Field data-invalid={Boolean(accountErrors.lastName)}>
                    <FieldLabel htmlFor="last-name">Last Name</FieldLabel>
                    <Input
                      id="last-name"
                      value={accountDraft.lastName}
                      aria-invalid={Boolean(accountErrors.lastName)}
                      onChange={(event) => setAccount('lastName', event.target.value)}
                    />
                    <FieldError>{accountErrors.lastName}</FieldError>
                  </Field>
                  <Field data-invalid={Boolean(accountErrors.firstName)}>
                    <FieldLabel htmlFor="first-name">First Name</FieldLabel>
                    <Input
                      id="first-name"
                      value={accountDraft.firstName}
                      aria-invalid={Boolean(accountErrors.firstName)}
                      onChange={(event) => setAccount('firstName', event.target.value)}
                    />
                    <FieldError>{accountErrors.firstName}</FieldError>
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="middle-name">Middle Name</FieldLabel>
                    <Input
                      id="middle-name"
                      value={accountDraft.middleName}
                      onChange={(event) => setAccount('middleName', event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="suffix">Suffix</FieldLabel>
                    <Select
                      value={accountDraft.suffix || undefined}
                      onValueChange={(value) => setAccount('suffix', value ?? '')}
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
              <Collapsible>
                <CollapsibleTrigger className="w-full rounded-md border border-dashed px-3 py-2 text-left text-sm font-medium hover:bg-muted">
                  Address &amp; location
                </CollapsibleTrigger>
                <CollapsibleContent className="pt-3">
                  <FieldSet className="gap-3">
                    <FieldLegend variant="label">Address</FieldLegend>
                    <FieldGroup className="grid gap-3 sm:grid-cols-2">
                      <AddressCombobox
                        id="province"
                        label="Province"
                        options={psgcProvinces}
                        value={address.province}
                        emptyMessage="No province found."
                        onChange={(province) => {
                          const region = psgcRegions.find(
                            (option) => option.code === province?.parentCode
                          )
                          setAddress({ province, cityMunicipality: undefined, barangay: undefined })
                          setAccountDraft((current) => ({
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
                          setAddress((current) => ({
                            ...current,
                            cityMunicipality,
                            barangay: undefined
                          }))
                          setAccountDraft((current) => ({
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
                          setAccountDraft((current) => ({
                            ...current,
                            barangay: barangay?.name ?? '',
                            barangayPsgc: addressSelection(barangay)
                          }))
                        }}
                      />
                      <Field>
                        <FieldLabel htmlFor="street-subdivision">Street / Subdivision</FieldLabel>
                        <Input
                          id="street-subdivision"
                          value={accountDraft.streetSubdivision}
                          onChange={(event) => setAccount('streetSubdivision', event.target.value)}
                        />
                      </Field>
                    </FieldGroup>
                  </FieldSet>
                </CollapsibleContent>
              </Collapsible>
              <FieldSeparator />
              <FieldSet className="gap-3">
                <FieldLegend variant="label">Contact information</FieldLegend>
                <FieldGroup className="gap-3">
                  <ContactRows
                    contacts={accountDraft.contacts}
                    onChange={(contacts) => setAccount('contacts', contacts)}
                    errors={accountErrors.contacts}
                    actions={
                      <div className="flex flex-nowrap items-center gap-1 overflow-x-auto text-muted-foreground">
                        <Button
                          type="button"
                          variant="secondary"
                          size="xs"
                          onClick={() =>
                            setAccount('contacts', [
                              ...accountDraft.contacts,
                              {
                                id: id('mobile'),
                                kind: 'mobile',
                                value: '',
                                isPrimary: false
                              }
                            ])
                          }
                        >
                          <Plus data-icon="inline-start" />
                          Add contact
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setAccount('contacts', [
                              ...accountDraft.contacts,
                              {
                                id: id('telephone'),
                                kind: 'telephone',
                                value: '',
                                isPrimary: false
                              }
                            ])
                          }
                        >
                          <Plus data-icon="inline-start" />
                          Add telephone
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="xs"
                          onClick={() =>
                            setAccount('emails', [
                              ...accountDraft.emails,
                              {
                                id: id('email'),
                                value: '',
                                isPrimary: accountDraft.emails.length === 0
                              }
                            ])
                          }
                        >
                          <Plus data-icon="inline-start" />
                          Add email
                        </Button>
                      </div>
                    }
                  />
                  {(accountDraft.emails.length > 0 || accountErrors.emails) && (
                    <EmailRows
                      emails={accountDraft.emails}
                      onChange={(emails) => setAccount('emails', emails)}
                      error={accountErrors.emails}
                    />
                  )}
                </FieldGroup>
              </FieldSet>
              <FieldSeparator />
              <FieldSet className="gap-3">
                <FieldLegend variant="label">Customer attribution</FieldLegend>
                <FieldGroup className="grid gap-3 sm:grid-cols-2">
                  <Field>
                    <FieldLabel htmlFor="occupation">Occupation</FieldLabel>
                    <Input
                      id="occupation"
                      value={accountDraft.occupation}
                      onChange={(event) => setAccount('occupation', event.target.value)}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="agent">Agent</FieldLabel>
                    <Select
                      value={accountDraft.agent || undefined}
                      onValueChange={(value) => setAccount('agent', value ?? '')}
                    >
                      <SelectTrigger id="agent">
                        <SelectValue placeholder="Select agent" />
                      </SelectTrigger>
                      <SelectContent>
                        {(agents.length ? agents : agentOptions).map((agent) => (
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
                      value={accountDraft.referredBy}
                      onChange={(event) => setAccount('referredBy', event.target.value)}
                    />
                  </Field>
                </FieldGroup>
              </FieldSet>
            </>
          </FieldGroup>

          <FieldGroup className="gap-4">
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Loan schedule</FieldLegend>
              <FieldGroup className="grid gap-3 sm:grid-cols-3">
                <Field data-invalid={Boolean(loanErrors.dateReleased)}>
                  <FieldLabel htmlFor="date-released">Date Released</FieldLabel>
                  <Input
                    id="date-released"
                    type="date"
                    value={loanDraft.dateReleased}
                    aria-invalid={Boolean(loanErrors.dateReleased)}
                    onChange={(event) => setLoan('dateReleased', event.target.value)}
                  />
                  <FieldError>{loanErrors.dateReleased}</FieldError>
                </Field>
                <Field data-invalid={Boolean(loanErrors.startDate)}>
                  <FieldLabel htmlFor="start-date">Start Date</FieldLabel>
                  <Input
                    id="start-date"
                    type="date"
                    value={loanDraft.startDate}
                    aria-invalid={Boolean(loanErrors.startDate)}
                    onChange={(event) => setLoan('startDate', event.target.value)}
                  />
                  <FieldError>{loanErrors.startDate}</FieldError>
                </Field>
                <Field data-invalid={Boolean(loanErrors.firstDueDate)}>
                  <FieldLabel htmlFor="first-due-date">First Due Date</FieldLabel>
                  <Input
                    id="first-due-date"
                    type="date"
                    value={loanDraft.firstDueDate}
                    aria-invalid={Boolean(loanErrors.firstDueDate)}
                    onChange={(event) => setLoan('firstDueDate', event.target.value)}
                  />
                  <FieldError>{loanErrors.firstDueDate}</FieldError>
                </Field>
                <Field data-invalid={Boolean(loanErrors.paymentFrequency)}>
                  <FieldLabel htmlFor="payment-frequency">Payment Frequency</FieldLabel>
                  <Select
                    value={loanDraft.paymentFrequency}
                    onValueChange={(value) => {
                      const paymentFrequency = value as LoanDraft['paymentFrequency']
                      const count = Math.max(1, Number.parseInt(loanDraft.terms, 10) || 1)
                      setLoanDraft((current) => ({
                        ...current,
                        paymentFrequency,
                        terms:
                          paymentFrequency === 'Monthly'
                            ? `${Math.min(count, 12)} month${count === 1 ? '' : 's'}`
                            : String(count)
                      }))
                    }}
                  >
                    <SelectTrigger id="payment-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {paymentFrequencyOptions.map((frequency) => (
                        <SelectItem key={frequency} value={frequency}>
                          {frequency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{loanErrors.paymentFrequency}</FieldError>
                </Field>
                <Field data-invalid={Boolean(loanErrors.terms)}>
                  <FieldLabel htmlFor="terms">Terms</FieldLabel>
                  {loanDraft.paymentFrequency === 'Monthly' ? (
                    <Select
                      value={loanDraft.terms}
                      onValueChange={(value) => setLoan('terms', value ?? '')}
                    >
                      <SelectTrigger id="terms" aria-invalid={Boolean(loanErrors.terms)}>
                        <SelectValue placeholder="Select terms" />
                      </SelectTrigger>
                      <SelectContent>
                        {(monthlyTerms.length
                          ? monthlyTerms.map((term) => `${term} month${term === 1 ? '' : 's'}`)
                          : loanTermOptions
                        ).map((term) => (
                          <SelectItem key={term} value={term}>
                            {term}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <Input
                      id="terms"
                      type="number"
                      min={1}
                      inputMode="numeric"
                      value={loanDraft.terms}
                      aria-invalid={Boolean(loanErrors.terms)}
                      onChange={(event) => setLoan('terms', event.target.value)}
                    />
                  )}
                  <FieldError>{loanErrors.terms}</FieldError>
                </Field>
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Financial summary</FieldLegend>
              <FieldGroup className="grid gap-3 sm:grid-cols-3">
                {(
                  [
                    ['principal', 'Principal'],
                    ['interest', 'Interest'],
                    ['downPayment', 'Down Payment'],
                    ['fees', 'Fees'],
                    ['installmentAmount', 'Installment Amount'],
                    ['grandTotal', 'Grand Total']
                  ] as const
                ).map(([key, label]) => (
                  <Field key={key} data-invalid={Boolean(loanErrors[key])}>
                    <FieldLabel htmlFor={key}>{label}</FieldLabel>
                    <Input
                      id={key}
                      type="number"
                      min="0"
                      step="0.01"
                      value={loanDraft[key] || ''}
                      aria-invalid={Boolean(loanErrors[key])}
                      onChange={(event) => setLoan(key, Number(event.target.value))}
                    />
                    <FieldError>{loanErrors[key]}</FieldError>
                  </Field>
                ))}
              </FieldGroup>
            </FieldSet>
            <Collapsible>
              <CollapsibleTrigger className="w-full rounded-md border border-dashed px-3 py-2 text-left text-sm font-medium hover:bg-muted">
                Items, collateral &amp; remarks
              </CollapsibleTrigger>
              <CollapsibleContent className="flex flex-col gap-4 pt-3">
                <FieldSet className="gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <FieldLegend variant="label">Items / Collateral</FieldLegend>
                    <Button type="button" variant="secondary" size="xs" onClick={addLoanItem}>
                      <Plus data-icon="inline-start" />
                      Add item
                    </Button>
                  </div>
                  <FieldGroup className="gap-2">
                    {loanDraft.items.map((item) => (
                      <div
                        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_auto]"
                        key={item.id}
                      >
                        <Input
                          aria-label="Item or collateral"
                          placeholder="Item / collateral"
                          value={item.name}
                          onChange={(event) =>
                            setLoan(
                              'items',
                              loanDraft.items.map((current) =>
                                current.id === item.id
                                  ? { ...current, name: event.target.value }
                                  : current
                              )
                            )
                          }
                        />
                        <Input
                          aria-label="Quantity"
                          type="number"
                          min="0"
                          value={item.quantity || ''}
                          onChange={(event) =>
                            setLoan(
                              'items',
                              loanDraft.items.map((current) =>
                                current.id === item.id
                                  ? { ...current, quantity: Number(event.target.value) }
                                  : current
                              )
                            )
                          }
                        />
                        <Input
                          aria-label="Price"
                          type="number"
                          min="0"
                          step="0.01"
                          value={item.price || ''}
                          onChange={(event) =>
                            setLoan(
                              'items',
                              loanDraft.items.map((current) =>
                                current.id === item.id
                                  ? { ...current, price: Number(event.target.value) }
                                  : current
                              )
                            )
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label="Remove item"
                          onClick={() => removeLoanItem(item.id)}
                        >
                          <Trash2 />
                        </Button>
                      </div>
                    ))}
                  </FieldGroup>
                </FieldSet>
                <Field>
                  <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
                  <Textarea
                    id="remarks"
                    value={loanDraft.remarks}
                    onChange={(event) => setLoan('remarks', event.target.value)}
                  />
                </Field>
              </CollapsibleContent>
            </Collapsible>
          </FieldGroup>

          <div className="grid gap-3 xl:col-span-2">
            <ReviewSection title="Customer">
              <ReviewValue label="Name" value={customerName} />
              <ReviewValue label="Branch" value={branchLabels[accountDraft.branch]} />
              <ReviewValue
                label="Contact"
                value={accountDraft.contacts.find((contact) => contact.isPrimary)?.value}
              />
              <ReviewValue label="Entry" value="New customer" />
            </ReviewSection>
            <ReviewSection title="Loan">
              <ReviewValue label="Date Released" value={loanDraft.dateReleased} />
              <ReviewValue label="Start Date" value={loanDraft.startDate} />
              <ReviewValue label="First Due Date" value={loanDraft.firstDueDate} />
              <ReviewValue label="Frequency" value={loanDraft.paymentFrequency} />
              <ReviewValue label="Terms" value={loanDraft.terms} />
              <ReviewValue label="Installment" value={money(loanDraft.installmentAmount)} />
            </ReviewSection>
            <ReviewSection title="Financial Summary">
              <ReviewValue label="Principal" value={money(loanDraft.principal)} />
              <ReviewValue label="Interest" value={money(loanDraft.interest)} />
              <ReviewValue label="Down Payment" value={money(loanDraft.downPayment)} />
              <ReviewValue label="Fees" value={money(loanDraft.fees)} />
              <ReviewValue label="Grand Total" value={money(loanDraft.grandTotal)} />
              <ReviewValue
                label="Balance after down payment"
                value={money(Math.max(loanDraft.grandTotal - loanDraft.downPayment, 0))}
              />
            </ReviewSection>
            <ReviewSection title="Items / Collateral">
              <div className="sm:col-span-2">
                {loanDraft.items.filter((item) => item.name.trim()).length ? (
                  <ul className="space-y-1">
                    {loanDraft.items
                      .filter((item) => item.name.trim())
                      .map((item) => (
                        <li key={item.id} className="flex justify-between gap-2">
                          <span className="truncate">
                            {item.name} x {item.quantity || 0}
                          </span>
                          <span className="shrink-0 tabular-nums">{money(item.price)}</span>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <p className="text-muted-foreground">No items listed.</p>
                )}
              </div>
            </ReviewSection>
          </div>
        </div>
      </ScrollArea>

      <CardFooter className="sticky bottom-0 z-10 shrink-0 justify-end gap-2 border-t bg-background p-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Creating…' : 'Create Account & Loan'}
        </Button>
      </CardFooter>
    </form>
  )
}
