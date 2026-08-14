import * as React from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { CardFooter } from '@/components/ui/card'
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible'
import {
  Field,
  FieldDescription,
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
  Stepper,
  StepperDescription,
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger
} from '@/components/ui/reui/stepper'
import { formatPhilippinePeso } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AddressMapPicker } from '@/features/in-house-accounts/components/address-map-picker'
import {
  agentOptions,
  branchLabels,
  branchNames,
  formatAccountName,
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
import type { InstallmentFrequency, InstallmentRulesRecord } from '../../../../../shared/contracts'
import { calculateInstallment } from '../../../../../shared/installment-calculations'
import type { PersistedInstallmentRow } from '@/features/in-house-accounts/installment-data'

export type InHouseAccountWorkflowSave =
  | {
      readonly mode: 'new'
      readonly accountDraft: AccountDraft
      readonly loanDraft: LoanDraft
    }
  | {
      readonly mode: 'existing'
      readonly customerId: string
      readonly accountDraft: AccountDraft
      readonly loanDraft: LoanDraft
    }

type InHouseAccountFormProps = {
  readonly onSave: (payload: InHouseAccountWorkflowSave) => Promise<void>
  readonly onCancel: () => void
  readonly onDirtyChange?: (dirty: boolean) => void
  readonly existingRows: readonly PersistedInstallmentRow[]
}

const emptyAccountDraft: AccountDraft = {
  branch: 'Goa',
  lastName: '',
  firstName: '',
  middleName: '',
  suffix: '',
  streetSubdivision: '',
  landmarkRemarks: '',
  latitude: undefined,
  longitude: undefined,
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

const newAccountSteps = [
  { step: 1, title: 'Account', description: 'Choose a record' },
  { step: 2, title: 'Personal', description: 'Set customer identity' },
  { step: 3, title: 'Contact & Work', description: 'Add contact details' },
  { step: 4, title: 'Address & Location', description: 'Set address and pin' },
  { step: 5, title: 'Loan', description: 'Set loan terms' },
  { step: 6, title: 'Review', description: 'Confirm and create' }
] as const

const existingAccountSteps = [
  { step: 1, title: 'Account', description: 'Choose a customer' },
  { step: 5, title: 'Loan', description: 'Set loan terms' },
  { step: 6, title: 'Review', description: 'Confirm and create' }
] as const

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
  onEdit,
  children
}: {
  readonly title: string
  readonly onEdit?: () => void
  readonly children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="border-b pb-3 last:border-b-0">
      <div className="mb-2 flex items-center justify-between gap-2">
        <h3 className="text-xs font-semibold text-foreground">{title}</h3>
        {onEdit && (
          <Button type="button" variant="ghost" size="xs" onClick={onEdit}>
            Edit
          </Button>
        )}
      </div>
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
  onDirtyChange,
  existingRows
}: InHouseAccountFormProps): React.JSX.Element {
  const [accountDraft, setAccountDraft] = React.useState<AccountDraft>(emptyAccountDraft)
  const [accountErrors, setAccountErrors] = React.useState<AccountValidationErrors>({})
  const [loanDraft, setLoanDraft] = React.useState<LoanDraft>(emptyLoanDraft)
  const [loanErrors, setLoanErrors] = React.useState<LoanValidationErrors>({})
  const [formError, setFormError] = React.useState<string>()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [mode, setMode] = React.useState<'new' | 'existing'>('new')
  const [existingSearch, setExistingSearch] = React.useState('')
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string>()
  const [step, setStep] = React.useState(1)
  const [catalogOptions, setCatalogOptions] = React.useState<CatalogOptionRecord[]>([])
  const [installmentRules, setInstallmentRules] = React.useState<InstallmentRulesRecord>()
  const [address, setAddress] = React.useState<{
    province?: PsgcOption
    cityMunicipality?: PsgcOption
    barangay?: PsgcOption
  }>({})
  const [locationSource, setLocationSource] = React.useState<'geocoded' | 'manual'>()
  const [mapZoom, setMapZoom] = React.useState(14)
  const [geocodeMessage, setGeocodeMessage] = React.useState<string>()
  const geocodeSequence = React.useRef(0)
  const wizardSteps = mode === 'new' ? newAccountSteps : existingAccountSteps
  const currentStepIndex = wizardSteps.findIndex((item) => item.step === step)
  React.useEffect(() => {
    void window.api.catalogOptions
      .list({ activeOnly: true })
      .then(({ rows }) => setCatalogOptions(rows))
      .catch(() => undefined)
  }, [])
  React.useEffect(() => {
    void window.api.installmentRules.getActive().then(setInstallmentRules).catch(() => undefined)
  }, [])
  const agents = catalogOptions
    .filter((option) => option.kind === 'IN_HOUSE_AGENT')
    .map((option) => option.value)
  const monthlyTerms = installmentRules?.monthlyPlans.map((plan) => plan.terms) ?? []
  const setAccount = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]): void =>
    setAccountDraft((current) => ({ ...current, [key]: value }))
  const setLoan = <K extends keyof LoanDraft>(key: K, value: LoanDraft[K]): void =>
    setLoanDraft((current) => ({ ...current, [key]: value }))
  const calculatedLoan = React.useMemo(() => {
    if (!installmentRules) return loanDraft
    const frequency = (loanDraft.paymentFrequency === 'Semi-monthly' ? 'Semi' : loanDraft.paymentFrequency) as InstallmentFrequency
    if (!['Daily', 'Weekly', 'Semi', 'Monthly'].includes(frequency)) return loanDraft
    const calculation = calculateInstallment({ releaseDate: loanDraft.dateReleased, frequency, terms: Number.parseInt(loanDraft.terms, 10), items: loanDraft.items.map((item) => ({ quantity: item.quantity, unitPriceCentavos: Math.round(item.price * 100) })), actualDownPaymentCentavos: Math.round(loanDraft.downPayment * 100) }, installmentRules)
    return { ...loanDraft, paymentFrequency: frequency, startDate: calculation.startDate ?? '', firstDueDate: calculation.endDate ?? '', principal: calculation.grandTotalCentavos / 100, grandTotal: calculation.grandTotalCentavos / 100, interest: (calculation.interestCentavos ?? 0) / 100, fees: (calculation.requiredFeeCentavos ?? 0) / 100, installmentAmount: (calculation.paymentAmountCentavos ?? 0) / 100 }
  }, [installmentRules, loanDraft])

  const geocodeAddress = React.useCallback(
    async (
      values: {
        readonly barangay?: string
        readonly cityMunicipality?: string
        readonly province: string
      },
      zoom: number
    ): Promise<void> => {
      const request = ++geocodeSequence.current
      if (!values.province) {
        setGeocodeMessage(undefined)
        return
      }
      setGeocodeMessage('Finding approximate location…')

      try {
        const result = await window.api.geocoding.forward(values)
        if (request !== geocodeSequence.current) return
        if (!result) {
          setGeocodeMessage(
            'Location could not be found automatically. Set it manually on the map.'
          )
          return
        }
        setAccountDraft((current) => ({
          ...current,
          latitude: result.latitude,
          longitude: result.longitude
        }))
        setLocationSource('geocoded')
        setMapZoom(zoom)
        setGeocodeMessage(undefined)
      } catch {
        if (request !== geocodeSequence.current) return
        setGeocodeMessage('Location could not be found automatically. Set it manually on the map.')
      }
    },
    []
  )

  const validateAccountFields = (
    keys: readonly (keyof AccountDraft)[]
  ): AccountValidationErrors => {
    const errors = validateAccountDraft(normalizeAccountDraft(accountDraft))
    return Object.fromEntries(
      Object.entries(errors).filter(([key]) => keys.includes(key as keyof AccountDraft))
    ) as AccountValidationErrors
  }

  const focusFirstInvalidField = (): void => {
    requestAnimationFrame(() =>
      document.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus()
    )
  }

  const continueStep = (): void => {
    if (step === 1 && mode === 'existing' && !selectedCustomerId) return
    if (step === 2) {
      const errors = validateAccountFields(['branch', 'lastName', 'firstName'])
      setAccountErrors(errors)
      if (Object.keys(errors).length) {
        focusFirstInvalidField()
        return
      }
    }
    if (step === 3) {
      const errors = validateAccountFields(['contacts', 'emails'])
      setAccountErrors(errors)
      if (Object.keys(errors).length) {
        focusFirstInvalidField()
        return
      }
    }
    if (step === 5) {
      const errors = validateLoanDraft(normalizeLoanDraft(calculatedLoan))
      setLoanErrors(errors)
      if (Object.keys(errors).length) {
        focusFirstInvalidField()
        return
      }
    }
    setStep(wizardSteps[Math.min(currentStepIndex + 1, wizardSteps.length - 1)].step)
  }

  const save = async (): Promise<void> => {
    if (isSubmitting) return
    setFormError(undefined)
    const normalizedLoan = normalizeLoanDraft(calculatedLoan)
    const loanValidation = validateLoanDraft(normalizedLoan)
    setLoanErrors(loanValidation)
    if (Object.keys(loanValidation).length) {
      setStep(5)
      focusFirstInvalidField()
      return
    }

    const normalizedAccount = normalizeAccountDraft(accountDraft)
    const accountValidation = validateAccountDraft(normalizedAccount)
    setAccountErrors(accountValidation)
    if (Object.keys(accountValidation).length) {
      if (mode === 'existing') {
        setFormError(
          'The selected account is missing required customer details. Select another account or update it first.'
        )
        setStep(1)
        return
      }
      setStep(
        accountValidation.branch || accountValidation.lastName || accountValidation.firstName
          ? 2
          : 3
      )
      focusFirstInvalidField()
      return
    }
    setIsSubmitting(true)
    try {
      await onSave(
        mode === 'existing' && selectedCustomerId
          ? {
              mode: 'existing',
              customerId: selectedCustomerId,
              accountDraft: normalizedAccount,
              loanDraft: normalizedLoan
            }
          : { mode: 'new', accountDraft: normalizedAccount, loanDraft: normalizedLoan }
      )
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
  const existingCustomers = React.useMemo(() => {
    const query = existingSearch.trim().toLowerCase()
    return Array.from(
      new Map(
        existingRows
          .filter((row) => row.accountStatus !== 'BLACKLISTED')
          .filter((row) => !query || formatAccountName(row.account).toLowerCase().includes(query))
          .map((row) => [row.account.id, row])
      ).values()
    )
  }, [existingRows, existingSearch])
  const selectedExistingCustomer = existingCustomers.find(
    (row) => row.account.id === selectedCustomerId
  )

  return (
    <form
      className="flex min-h-0 flex-1 flex-col"
      onInputCapture={() => onDirtyChange?.(true)}
      onSubmit={(event) => {
        event.preventDefault()
        if (step === 6) void save()
      }}
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="grid gap-4 p-4 lg:grid-cols-[11rem_minmax(0,1fr)]">
          {formError && <FieldError className="lg:col-span-2">{formError}</FieldError>}

          <Stepper
            value={step}
            onValueChange={(nextStep) => {
              const nextIndex = wizardSteps.findIndex((item) => item.step === nextStep)
              if (nextIndex >= 0 && nextIndex <= currentStepIndex) setStep(nextStep)
            }}
            orientation="vertical"
            indicators={{ completed: <Check /> }}
            className="sticky top-0 self-start border-r bg-background pr-4 lg:row-span-4"
          >
            <StepperNav>
              {wizardSteps.map(({ step: stepNumber, title, description }, index) => (
                <StepperItem
                  key={title}
                  step={stepNumber}
                  disabled={index > currentStepIndex}
                  className="relative items-start not-last:flex-1"
                >
                  <StepperTrigger className="items-start gap-2.5 pb-10 text-left last:pb-0">
                    <StepperIndicator>{index + 1}</StepperIndicator>
                    <span className="mt-0.5 flex flex-col items-start gap-1">
                      <StepperTitle>{title}</StepperTitle>
                      <StepperDescription className="text-xs">{description}</StepperDescription>
                    </span>
                  </StepperTrigger>
                  {index < wizardSteps.length - 1 && (
                    <StepperSeparator className="absolute inset-y-0 top-7 left-3 -order-1 m-0 -translate-x-1/2 group-data-[orientation=vertical]/stepper-nav:h-[calc(100%-2rem)]" />
                  )}
                </StepperItem>
              ))}
            </StepperNav>
          </Stepper>

          <FieldGroup className={cn('lg:col-start-2', step !== 1 && 'hidden')}>
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Account</FieldLegend>
              <ToggleGroup
                value={[mode]}
                variant="outline"
                spacing={0}
                aria-label="Account type"
                onValueChange={(value) => {
                  const selected = value[0]
                  if (!selected) return
                  const nextMode = selected as 'new' | 'existing'
                  setMode(nextMode)
                  setStep(1)
                }}
              >
                <ToggleGroupItem value="new">New Account</ToggleGroupItem>
                <ToggleGroupItem value="existing">Existing Account</ToggleGroupItem>
              </ToggleGroup>
              <FieldDescription>
                {mode === 'new'
                  ? 'Create a customer record and its first loan.'
                  : 'Select an existing customer, then create a new loan without re-entering their details.'}
              </FieldDescription>
              {mode === 'new' && (
                <Field data-invalid={Boolean(accountErrors.branch)} className="max-w-sm">
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
              )}
              {mode === 'existing' && (
                <FieldGroup className="gap-2">
                  <Field>
                    <FieldLabel htmlFor="existing-account-search">
                      Search existing accounts
                    </FieldLabel>
                    <Input
                      id="existing-account-search"
                      value={existingSearch}
                      onChange={(event) => setExistingSearch(event.target.value)}
                      placeholder="Search client name..."
                    />
                  </Field>
                  <div className="max-h-56 overflow-y-auto rounded-md border">
                    {existingCustomers.slice(0, 25).map((row) => (
                      <Button
                        key={row.account.id}
                        type="button"
                        variant={selectedCustomerId === row.account.id ? 'secondary' : 'ghost'}
                        className="h-auto w-full justify-start rounded-none px-3 py-2 text-left"
                        onClick={() => {
                          setSelectedCustomerId(row.account.id)
                          setAccountDraft({
                            ...emptyAccountDraft,
                            ...row.account,
                            contacts: row.account.contacts ?? emptyAccountDraft.contacts,
                            emails: row.account.emails ?? emptyAccountDraft.emails
                          })
                        }}
                      >
                        <span className="flex min-w-0 flex-col gap-0.5">
                          <span className="font-medium">{formatAccountName(row.account)}</span>
                          <span className="text-xs text-muted-foreground">
                            {row.account.id} · {row.account.branch} · {row.meta.status}
                          </span>
                        </span>
                      </Button>
                    ))}
                  </div>
                  {selectedExistingCustomer && (
                    <div className="grid gap-1 rounded-md bg-muted/50 p-3 text-sm sm:grid-cols-3">
                      <span className="font-medium">
                        {formatAccountName(selectedExistingCustomer.account)}
                      </span>
                      <span className="text-muted-foreground">
                        {selectedExistingCustomer.account.contacts.find(
                          (contact) => contact.isPrimary
                        )?.value ?? 'No primary contact'}
                      </span>
                      <span className="text-muted-foreground">
                        {selectedExistingCustomer.account.barangay ||
                          selectedExistingCustomer.account.cityMunicipality ||
                          'No address recorded'}
                      </span>
                    </div>
                  )}
                </FieldGroup>
              )}
            </FieldSet>
          </FieldGroup>

          <FieldGroup className={cn('gap-4 lg:col-start-2', step !== 2 && 'hidden')}>
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Identity</FieldLegend>
              <FieldGroup className="grid max-w-4xl gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_8rem]">
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
                  <FieldLabel htmlFor="middle-name">
                    Middle Name <span className="text-muted-foreground">(optional)</span>
                  </FieldLabel>
                  <Input
                    id="middle-name"
                    value={accountDraft.middleName}
                    onChange={(event) => setAccount('middleName', event.target.value)}
                  />
                </Field>
                <Field>
                  <FieldLabel htmlFor="suffix">
                    Suffix <span className="text-muted-foreground">(optional)</span>
                  </FieldLabel>
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
          </FieldGroup>

          <FieldGroup className={cn('gap-4 lg:col-start-2', step !== 4 && 'hidden')}>
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Address</FieldLegend>
              <FieldGroup className="grid gap-6 lg:grid-cols-2 lg:items-start">
                <div className="flex flex-col gap-3">
                  <FieldGroup className="gap-3">
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
                        void geocodeAddress({ province: province?.name ?? '' }, 8)
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
                        void geocodeAddress(
                          {
                            cityMunicipality: cityMunicipality?.name,
                            province: address.province?.name ?? ''
                          },
                          11
                        )
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
                        void geocodeAddress(
                          {
                            barangay: barangay?.name,
                            cityMunicipality: address.cityMunicipality?.name,
                            province: address.province?.name ?? ''
                          },
                          15
                        )
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
                  <Field>
                    <FieldLabel htmlFor="landmark-remarks">Landmark / Remarks</FieldLabel>
                    <Textarea
                      id="landmark-remarks"
                      value={accountDraft.landmarkRemarks}
                      onChange={(event) => setAccount('landmarkRemarks', event.target.value)}
                      placeholder="Nearest landmark or delivery notes"
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Map location</FieldLabel>
                  <AddressMapPicker
                    latitude={accountDraft.latitude}
                    longitude={accountDraft.longitude}
                    isVisible={step === 4}
                    zoom={mapZoom}
                    onChange={({ latitude, longitude }) => {
                      setAccount('latitude', latitude)
                      setAccount('longitude', longitude)
                      setLocationSource('manual')
                      setGeocodeMessage(undefined)
                    }}
                  />
                  {(geocodeMessage || locationSource === 'geocoded') && (
                    <FieldDescription>
                      {geocodeMessage ??
                        'Approximate location based on address. Click the map or drag the pin to set the exact location.'}
                    </FieldDescription>
                  )}
                </Field>
              </FieldGroup>
            </FieldSet>
          </FieldGroup>

          <FieldGroup className={cn('gap-4 lg:col-start-2', step !== 3 && 'hidden')}>
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
                  <FieldLabel htmlFor="civil-status">Civil Status</FieldLabel>
                  <Select
                    value={accountDraft.civilStatus || undefined}
                    onValueChange={(value) => setAccount('civilStatus', value ?? '')}
                  >
                    <SelectTrigger id="civil-status">
                      <SelectValue placeholder="Select status" />
                    </SelectTrigger>
                    <SelectContent>
                      {['Single', 'Married', 'Separated', 'Widowed', 'Prefer not to say'].map(
                        (status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
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
          </FieldGroup>

          <FieldGroup className={cn('gap-4 lg:col-start-2', step !== 5 && 'hidden')}>
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
                    value={calculatedLoan.startDate}
                    aria-invalid={Boolean(loanErrors.startDate)}
                    readOnly
                  />
                  <FieldError>{loanErrors.startDate}</FieldError>
                </Field>
                <Field data-invalid={Boolean(loanErrors.firstDueDate)}>
                  <FieldLabel htmlFor="first-due-date">End Date</FieldLabel>
                  <Input
                    id="first-due-date"
                    type="date"
                    value={calculatedLoan.firstDueDate}
                    aria-invalid={Boolean(loanErrors.firstDueDate)}
                    readOnly
                  />
                  <FieldError>{loanErrors.firstDueDate}</FieldError>
                </Field>
                <Field data-invalid={Boolean(loanErrors.paymentFrequency)}>
                  <FieldLabel htmlFor="payment-frequency">Payment Frequency</FieldLabel>
                  <Select
                    value={loanDraft.paymentFrequency}
                    onValueChange={(value) => {
                      const paymentFrequency = value as InstallmentFrequency
                      const terms = paymentFrequency === 'Daily' ? installmentRules?.dailyPlans.map((plan) => plan.terms) : paymentFrequency === 'Weekly' ? installmentRules?.weeklyTerms : paymentFrequency === 'Semi' ? installmentRules?.semiTerms : installmentRules?.monthlyPlans.map((plan) => plan.terms)
                      setLoanDraft((current) => ({
                        ...current,
                        paymentFrequency,
                        terms: terms?.length ? String(terms[0]) : ''
                      }))
                    }}
                  >
                    <SelectTrigger id="payment-frequency">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(['Daily', 'Weekly', 'Semi', 'Monthly'] as const).map((frequency) => (
                        <SelectItem key={frequency} value={frequency}>
                          {frequency === 'Semi' ? 'Semi-monthly' : frequency}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FieldError>{loanErrors.paymentFrequency}</FieldError>
                </Field>
                <Field data-invalid={Boolean(loanErrors.terms)}>
                  <FieldLabel htmlFor="terms">No. of Payments</FieldLabel>
                  {(
                    <Select
                      value={loanDraft.terms}
                      onValueChange={(value) => setLoan('terms', value ?? '')}
                    >
                      <SelectTrigger id="terms" aria-invalid={Boolean(loanErrors.terms)}>
                        <SelectValue placeholder="Select terms" />
                      </SelectTrigger>
                      <SelectContent>
                        {((loanDraft.paymentFrequency === 'Daily' ? installmentRules?.dailyPlans.map((plan) => plan.terms) : loanDraft.paymentFrequency === 'Weekly' ? installmentRules?.weeklyTerms : loanDraft.paymentFrequency === 'Semi' ? installmentRules?.semiTerms : monthlyTerms) ?? []).map((term) => (
                          <SelectItem key={term} value={String(term)}>
                            {term}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                  <FieldError>{loanErrors.terms}</FieldError>
                </Field>
              </FieldGroup>
            </FieldSet>
            <FieldSeparator />
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Payment Summary</FieldLegend>
              <FieldGroup className="grid max-w-3xl gap-3 sm:grid-cols-2">
                {(
                  [
                    ['downPayment', 'Down Payment']
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
            <FieldSeparator />
            <FieldSet className="gap-3">
              <FieldLegend variant="label">Calculated Summary</FieldLegend>
              <div className="grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
                {[
                  ['Grand Total', money(calculatedLoan.grandTotal)],
                  ['Payment Amount', money(calculatedLoan.installmentAmount)],
                  ['Required Fee', money(calculatedLoan.fees)],
                  ['Interest', money(calculatedLoan.interest)],
                  ['Total Installment', money(calculatedLoan.grandTotal + calculatedLoan.interest)]
                ].map(([label, value]) => (
                  <div key={label} className="border-l-2 border-primary/30 pl-3">
                    <div className="text-xs text-muted-foreground">{label}</div>
                    <div className="font-medium tabular-nums text-foreground">{value}</div>
                  </div>
                ))}
              </div>
              <FieldError>{loanErrors.principal || loanErrors.installmentAmount || loanErrors.grandTotal}</FieldError>
            </FieldSet>
              <Collapsible defaultOpen>
               <CollapsibleTrigger className="w-full rounded-md border px-3 py-2 text-left text-sm font-medium hover:bg-muted">
                 Items / Collateral / Remarks
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
                        className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_6rem_8rem_8rem_auto]"
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
                        <output className="flex items-center justify-end tabular-nums text-sm">{money(item.quantity * item.price)}</output>
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

          <div className={cn('grid gap-3 lg:col-start-2', step !== 6 && 'hidden')}>
            <ReviewSection title="Customer" onEdit={() => setStep(1)}>
              <ReviewValue label="Name" value={customerName} />
              <ReviewValue label="Branch" value={branchLabels[accountDraft.branch]} />
              <ReviewValue
                label="Entry"
                value={mode === 'new' ? 'New account' : 'Existing account'}
              />
            </ReviewSection>
            <ReviewSection title="Contact" onEdit={mode === 'new' ? () => setStep(3) : undefined}>
              <ReviewValue
                label="Primary contact"
                value={accountDraft.contacts.find((contact) => contact.isPrimary)?.value}
              />
              <ReviewValue
                label="Email"
                value={accountDraft.emails.find((email) => email.isPrimary)?.value}
              />
            </ReviewSection>
            <ReviewSection title="Address" onEdit={mode === 'new' ? () => setStep(4) : undefined}>
              <ReviewValue
                label="Address"
                value={[
                  accountDraft.streetSubdivision,
                  accountDraft.barangay,
                  accountDraft.cityMunicipality,
                  accountDraft.province
                ]
                  .filter(Boolean)
                  .join(', ')}
              />
              <ReviewValue label="Landmark" value={accountDraft.landmarkRemarks} />
              <ReviewValue
                label="Map pin"
                value={
                  typeof accountDraft.latitude !== 'number' ||
                  typeof accountDraft.longitude !== 'number'
                    ? undefined
                    : `${accountDraft.latitude.toFixed(5)}, ${accountDraft.longitude.toFixed(5)}`
                }
              />
            </ReviewSection>
            <ReviewSection title="Loan schedule" onEdit={() => setStep(5)}>
              <ReviewValue label="Date Released" value={loanDraft.dateReleased} />
              <ReviewValue label="Start Date" value={calculatedLoan.startDate} />
              <ReviewValue label="End Date" value={calculatedLoan.firstDueDate} />
              <ReviewValue label="Frequency" value={calculatedLoan.paymentFrequency === 'Semi' ? 'Semi-monthly' : calculatedLoan.paymentFrequency} />
              <ReviewValue label="No. of Payments" value={calculatedLoan.terms} />
              <ReviewValue label="Payment Amount" value={money(calculatedLoan.installmentAmount)} />
            </ReviewSection>
            <ReviewSection title="Loan" onEdit={() => setStep(5)}>
              <ReviewValue label="Grand Total" value={money(calculatedLoan.grandTotal)} />
              <ReviewValue label="Interest" value={money(calculatedLoan.interest)} />
              <ReviewValue label="Total Installment" value={money(calculatedLoan.grandTotal + calculatedLoan.interest)} />
              <ReviewValue label="Down Payment" value={money(calculatedLoan.downPayment)} />
              <ReviewValue label="Payment Amount" value={money(calculatedLoan.installmentAmount)} />
              <ReviewValue label="Required Fee" value={money(calculatedLoan.fees)} />
            </ReviewSection>
            <ReviewSection title="Items / Collateral" onEdit={() => setStep(5)}>
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
                           <span className="shrink-0 tabular-nums">{money(item.quantity * item.price)}</span>
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
        {currentStepIndex > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => setStep(wizardSteps[currentStepIndex - 1].step)}
          >
            Back
          </Button>
        )}
        {currentStepIndex < wizardSteps.length - 1 && (
          <Button
            type="button"
            disabled={mode === 'existing' && !selectedCustomerId}
            onClick={continueStep}
          >
            Continue
          </Button>
        )}
        {step === 6 && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Creating…' : mode === 'new' ? 'Create Account & Loan' : 'Create Loan'}
          </Button>
        )}
      </CardFooter>
    </form>
  )
}
