import * as React from 'react'
import { Check, Plus, Trash2 } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { AmountInputGroup } from '@/components/ui/amount-input-group'
import { Checkbox } from '@/components/ui/checkbox'
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
  StepperIndicator,
  StepperItem,
  StepperNav,
  StepperSeparator,
  StepperTitle,
  StepperTrigger
} from '@/components/ui/reui/stepper'
import { formatAmountInput, formatPhilippinePeso } from '@/lib/currency'
import { cn } from '@/lib/utils'
import { Textarea } from '@/components/ui/textarea'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { AddressMapPicker } from '@/features/in-house-accounts/components/address-map-picker'
import { ProductCombobox } from '@/components/shared/product-combobox'
import {
  agentOptions,
  branchLabels,
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
  findPsgcOption,
  psgcBarangays,
  psgcCitiesMunicipalities,
  psgcProvinces,
  psgcRegions,
  type PsgcOption
} from '@/lib/psgc'
import type { CatalogOptionRecord, ProductCatalogItem } from '../../../../../shared/contracts'
import type { InstallmentFrequency, InstallmentRulesRecord } from '../../../../../shared/contracts'
import { calculateInstallment } from '../../../../../shared/installment-calculations'
import type { PersistedInstallmentRow } from '@/features/in-house-accounts/installment-data'

export type InHouseAccountWorkflowSave =
  | {
      readonly mode: 'new'
      readonly createLoan: boolean
      readonly accountDraft: AccountDraft
      readonly loanDraft: LoanDraft
    }
  | {
      readonly mode: 'existing'
      readonly createLoan: true
      readonly customerId: string
      readonly accountDraft: AccountDraft
      readonly loanDraft: LoanDraft
    }

type InHouseAccountFormProps = {
  readonly onSave: (payload: InHouseAccountWorkflowSave) => Promise<void>
  readonly onCancel: () => void
  readonly initialMode?: 'new' | 'existing'
  readonly initialBranch?: AccountDraft['branch']
  readonly initialAccountDraft?: AccountDraft
  readonly initialLoanDraft?: LoanDraft
  readonly initialCreateLoan?: boolean
  readonly initialSelectedCustomerId?: string
  readonly lockMode?: boolean
  readonly lockCreateLoan?: boolean
  readonly submitLabel?: string
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
  items: [{ id: 'new-item', name: '', model: '', quantity: 1, price: 0 }],
  remarks: ''
}

const newAccountSteps = [
  { step: 1, title: 'Account' },
  { step: 2, title: 'Personal' },
  { step: 3, title: 'Contact & Work' },
  { step: 4, title: 'Address & Location' },
  { step: 5, title: 'Items' },
  { step: 6, title: 'Payments Period' },
  { step: 7, title: 'Review' }
] as const

const existingAccountSteps = newAccountSteps
const accountOnlySteps = newAccountSteps.filter(({ step }) => step !== 5 && step !== 6)

function id(prefix: string): string {
  return `${prefix}-${crypto.randomUUID()}`
}

function addressSelection(option: PsgcOption | undefined): AccountAddressSelection | undefined {
  return option ? { code: option.code, name: option.name } : undefined
}

function money(value: number | undefined): string {
  return formatPhilippinePeso(value ?? 0)
}

function initialAddress(account?: AccountDraft): {
  province?: PsgcOption
  cityMunicipality?: PsgcOption
  barangay?: PsgcOption
} {
  const province = findPsgcOption(psgcProvinces, account?.provincePsgc?.code, account?.province)
  const cityMunicipality = findPsgcOption(
    childrenOf(psgcCitiesMunicipalities, province?.code ?? ''),
    account?.cityMunicipalityPsgc?.code,
    account?.cityMunicipality
  )
  return {
    province,
    cityMunicipality,
    barangay: findPsgcOption(
      childrenOf(psgcBarangays, cityMunicipality?.code ?? ''),
      account?.barangayPsgc?.code,
      account?.barangay
    )
  }
}

function formatMobileNumber(value: string): string {
  const digits = value.replace(/\D/g, '').slice(0, 11)
  return [digits.slice(0, 4), digits.slice(4, 7), digits.slice(7, 11)].filter(Boolean).join('-')
}

function AddressCombobox({
  id: fieldId,
  label,
  options,
  value,
  disabled,
  emptyMessage,
  error,
  onChange
}: {
  readonly id: string
  readonly label: string
  readonly options: readonly PsgcOption[]
  readonly value?: PsgcOption
  readonly disabled?: boolean
  readonly emptyMessage: string
  readonly error?: string
  readonly onChange: (value: PsgcOption | undefined) => void
}): React.JSX.Element {
  return (
    <Field data-invalid={Boolean(error)}>
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
          aria-invalid={Boolean(error)}
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
      <FieldError>{error}</FieldError>
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
                placeholder="0900-000-0000"
                maxLength={13}
                inputMode="numeric"
                onChange={(event) =>
                  update(contact.id, { value: formatMobileNumber(event.target.value) })
                }
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
  initialMode = 'new',
  initialBranch,
  initialAccountDraft,
  initialLoanDraft,
  initialCreateLoan,
  initialSelectedCustomerId,
  lockMode = false,
  lockCreateLoan = false,
  submitLabel,
  onDirtyChange,
  existingRows
}: InHouseAccountFormProps): React.JSX.Element {
  const [accountDraft, setAccountDraft] = React.useState<AccountDraft>({
    ...emptyAccountDraft,
    branch: initialBranch ?? emptyAccountDraft.branch,
    ...initialAccountDraft,
    contacts: [...emptyAccountDraft.contacts],
    emails: [],
    ...(initialAccountDraft
      ? { contacts: initialAccountDraft.contacts, emails: initialAccountDraft.emails }
      : {})
  })
  const [accountErrors, setAccountErrors] = React.useState<AccountValidationErrors>({})
  const [loanDraft, setLoanDraft] = React.useState<LoanDraft>(initialLoanDraft ?? emptyLoanDraft)
  const [loanErrors, setLoanErrors] = React.useState<LoanValidationErrors>({})
  const [formError, setFormError] = React.useState<string>()
  const [isSubmitting, setIsSubmitting] = React.useState(false)
  const [mode, setMode] = React.useState<'new' | 'existing'>(initialMode ?? 'new')
  const [createLoan, setCreateLoan] = React.useState(initialCreateLoan ?? true)
  const [existingSearch, setExistingSearch] = React.useState('')
  const [selectedCustomerId, setSelectedCustomerId] = React.useState<string | undefined>(
    initialSelectedCustomerId
  )
  const [step, setStep] = React.useState(1)
  const [catalogOptions, setCatalogOptions] = React.useState<CatalogOptionRecord[]>([])
  const [productCatalog, setProductCatalog] = React.useState<ProductCatalogItem[]>([])
  const [installmentRules, setInstallmentRules] = React.useState<InstallmentRulesRecord>()
  const [address, setAddress] = React.useState(() => initialAddress(initialAccountDraft))
  const [locationSource, setLocationSource] = React.useState<'geocoded' | 'manual'>()
  const [mapZoom, setMapZoom] = React.useState(14)
  const [geocodeMessage, setGeocodeMessage] = React.useState<string>()
  const [serialItemIds, setSerialItemIds] = React.useState<ReadonlySet<string>>(new Set())
  const geocodeSequence = React.useRef(0)
  const wizardSteps =
    mode === 'new' ? (createLoan ? newAccountSteps : accountOnlySteps) : existingAccountSteps
  const currentStepIndex = wizardSteps.findIndex((item) => item.step === step)
  const currentStep = wizardSteps[currentStepIndex] ?? wizardSteps[0]
  React.useEffect(() => {
    void window.api.catalogOptions
      .list({ activeOnly: true })
      .then(({ rows }) => setCatalogOptions(rows))
      .catch(() => undefined)
  }, [])
  React.useEffect(() => {
    void window.api.productCatalog
      .list()
      .then(({ rows }) => setProductCatalog(rows))
      .catch(() => undefined)
  }, [])
  React.useEffect(() => {
    void window.api.installmentRules
      .getActive()
      .then(setInstallmentRules)
      .catch(() => undefined)
  }, [])
  const agents = catalogOptions
    .filter((option) => option.kind === 'IN_HOUSE_AGENT')
    .map((option) => option.value)
  const monthlyTerms = installmentRules?.monthlyPlans.map((plan) => plan.terms) ?? []
  const setAccount = <K extends keyof AccountDraft>(key: K, value: AccountDraft[K]): void =>
    setAccountDraft((current) => ({ ...current, [key]: value }))
  const setLoan = <K extends keyof LoanDraft>(key: K, value: LoanDraft[K]): void =>
    setLoanDraft((current) => ({ ...current, [key]: value }))
  const resetNewAccountForm = (): void => {
    setMode('new')
    setCreateLoan(true)
    setAccountDraft({
      ...emptyAccountDraft,
      branch: initialBranch ?? emptyAccountDraft.branch,
      contacts: [...emptyAccountDraft.contacts],
      emails: []
    })
    setLoanDraft({ ...emptyLoanDraft, items: [{ ...emptyLoanDraft.items[0] }] })
    setAccountErrors({})
    setLoanErrors({})
    setFormError(undefined)
    setExistingSearch('')
    setSelectedCustomerId(undefined)
    setAddress({})
    setLocationSource(undefined)
    setMapZoom(14)
    setGeocodeMessage(undefined)
    setSerialItemIds(new Set())
    setStep(1)
    onDirtyChange?.(false)
  }
  const calculatedLoan = React.useMemo(() => {
    if (!installmentRules) return loanDraft
    const frequency = (
      loanDraft.paymentFrequency === 'Semi-monthly' ? 'Semi' : loanDraft.paymentFrequency
    ) as InstallmentFrequency
    if (!['Daily', 'Weekly', 'Semi', 'Monthly'].includes(frequency)) return loanDraft
    const calculation = calculateInstallment(
      {
        releaseDate: loanDraft.dateReleased,
        frequency,
        terms: Number.parseInt(loanDraft.terms, 10),
        items: loanDraft.items.map((item) => ({
          quantity: item.quantity,
          unitPriceCentavos: Math.round(item.price * 100)
        })),
        actualDownPaymentCentavos: Math.round(loanDraft.downPayment * 100)
      },
      installmentRules
    )
    return {
      ...loanDraft,
      paymentFrequency: frequency,
      startDate: calculation.startDate ?? '',
      firstDueDate: calculation.endDate ?? '',
      principal: calculation.grandTotalCentavos / 100,
      grandTotal: calculation.grandTotalCentavos / 100,
      interest: (calculation.interestCentavos ?? 0) / 100,
      fees: (calculation.requiredFeeCentavos ?? 0) / 100,
      installmentAmount: (calculation.paymentAmountCentavos ?? 0) / 100
    }
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
    if (step === 4) {
      const errors = validateAccountFields([
        'province',
        'cityMunicipality',
        'barangay',
        'streetSubdivision'
      ])
      setAccountErrors(errors)
      if (Object.keys(errors).length) {
        focusFirstInvalidField()
        return
      }
    }
    if (step === 5) {
      if (
        !loanDraft.items.some((item) => item.name.trim() && item.quantity > 0 && item.price > 0)
      ) {
        setLoanErrors({ items: 'Add at least one complete item.' })
        return
      }
    }
    if (step === 6) {
      const errors = validateLoanDraft(normalizeLoanDraft(calculatedLoan))
      setLoanErrors(errors)
      if (Object.keys(errors).length) {
        focusFirstInvalidField()
        return
      }
    }
    const nextStep = wizardSteps[Math.min(currentStepIndex + 1, wizardSteps.length - 1)]
    if (nextStep) setStep(nextStep.step)
  }

  const save = async (): Promise<void> => {
    if (isSubmitting) return
    setFormError(undefined)
    const normalizedLoan = normalizeLoanDraft(calculatedLoan)
    if (createLoan) {
      const loanValidation = validateLoanDraft(normalizedLoan)
      setLoanErrors(loanValidation)
      if (Object.keys(loanValidation).length) {
        setStep(6)
        focusFirstInvalidField()
        return
      }
    }

    const normalizedAccount = normalizeAccountDraft(accountDraft)
    const accountValidation = validateAccountDraft(normalizedAccount)
    setAccountErrors(accountValidation)
    if (Object.keys(accountValidation).length) {
      setStep(
        accountValidation.branch || accountValidation.lastName || accountValidation.firstName
          ? 2
          : accountValidation.province ||
              accountValidation.cityMunicipality ||
              accountValidation.barangay ||
              accountValidation.streetSubdivision
            ? 4
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
              createLoan: true,
              customerId: selectedCustomerId,
              accountDraft: normalizedAccount,
              loanDraft: normalizedLoan
            }
          : {
              mode: 'new',
              createLoan,
              accountDraft: normalizedAccount,
              loanDraft: normalizedLoan
            }
      )
    } catch (error) {
      setFormError(
        error instanceof Error
          ? error.message
          : 'The account or loan could not be saved. Your entries are still available.'
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  const addLoanItem = (): void =>
    setLoan('items', [
      ...loanDraft.items,
      { id: id('item'), name: '', model: '', quantity: 1, price: 0 }
    ])

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
        if (step === 7) void save()
      }}
    >
      <ScrollArea className="min-h-0 flex-1">
        <div className="mx-auto grid w-full max-w-6xl gap-5 p-4 sm:p-6 lg:grid-cols-[13rem_minmax(0,1fr)]">
          {formError && <FieldError className="lg:col-span-2">{formError}</FieldError>}

          <Stepper
            value={step}
            onValueChange={(nextStep) => {
              const nextIndex = wizardSteps.findIndex((item) => item.step === nextStep)
              if (nextIndex >= 0 && nextIndex <= currentStepIndex) setStep(nextStep)
            }}
            orientation="vertical"
            indicators={{ completed: <Check /> }}
            className="items-start"
          >
            <StepperNav>
              {wizardSteps.map(({ step: stepNumber, title }, index) => (
                <StepperItem
                  key={title}
                  step={stepNumber}
                  disabled={index > currentStepIndex}
                  className="relative items-start not-last:flex-1"
                >
                  <StepperTrigger className="items-start gap-2.5 pb-10 text-left last:pb-0">
                    <StepperIndicator>{index + 1}</StepperIndicator>
                    <StepperTitle className="mt-0.5">{title}</StepperTitle>
                  </StepperTrigger>
                  {index < wizardSteps.length - 1 && (
                    <StepperSeparator className="absolute inset-y-0 top-7 left-3 -order-1 m-0 -translate-x-1/2 group-data-[orientation=vertical]/stepper-nav:h-[calc(100%-2rem)]" />
                  )}
                </StepperItem>
              ))}
            </StepperNav>
          </Stepper>

          <Card className="min-w-0 overflow-hidden border-border/70 shadow-sm lg:col-start-2">
            <CardHeader className="border-b bg-muted/20 px-4 py-4 sm:px-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <CardTitle className="text-base">{currentStep.title}</CardTitle>
                  <CardDescription>
                    {step === 7
                      ? createLoan
                        ? 'Check the details before creating the account and loan.'
                        : 'Check the details before creating the client record.'
                      : createLoan
                        ? 'Complete this section to continue with the account and loan setup.'
                        : 'Complete this section to continue with the client setup.'}
                  </CardDescription>
                </div>
                <Badge variant="secondary" className="shrink-0 tabular-nums">
                  Step {step} of {wizardSteps.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="px-4 py-5 sm:px-6">
              <FieldGroup className={cn('lg:col-start-2', step !== 1 && 'hidden')}>
                <FieldSet className="gap-3">
                  <FieldLegend variant="label">Account</FieldLegend>
                  {!lockMode && (
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
                        if (nextMode === 'new') resetNewAccountForm()
                        else setStep(1)
                      }}
                    >
                      <ToggleGroupItem value="new" onClick={resetNewAccountForm}>
                        New Account
                      </ToggleGroupItem>
                      <ToggleGroupItem value="existing">Existing Account</ToggleGroupItem>
                    </ToggleGroup>
                  )}
                  <FieldDescription>
                    {mode === 'new'
                      ? 'Create a customer record, with or without its first loan.'
                      : 'Select an existing customer, then create a new loan without re-entering their details.'}
                  </FieldDescription>
                  {mode === 'new' && !lockCreateLoan && (
                    <label className="flex items-center gap-2 text-sm font-medium">
                      <Checkbox
                        checked={createLoan}
                        onCheckedChange={(checked) => setCreateLoan(checked === true)}
                      />
                      Create a loan now
                    </label>
                  )}
                  {mode === 'existing' && !lockMode && (
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
                              setAddress(initialAddress(row.account))
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
                  <FieldDescription>
                    Add the loan customer’s legal name and identity details.
                  </FieldDescription>
                  <FieldGroup className="mx-auto grid w-full max-w-md gap-3">
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
                          error={accountErrors.province}
                          onChange={(province) => {
                            const region = psgcRegions.find(
                              (option) => option.code === province?.parentCode
                            )
                            setAddress({
                              province,
                              cityMunicipality: undefined,
                              barangay: undefined
                            })
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
                          options={childrenOf(
                            psgcCitiesMunicipalities,
                            address.province?.code ?? ''
                          )}
                          value={address.cityMunicipality}
                          disabled={!address.province}
                          emptyMessage="No municipality found."
                          error={accountErrors.cityMunicipality}
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
                          error={accountErrors.barangay}
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
                        <Field data-invalid={Boolean(accountErrors.streetSubdivision)}>
                          <FieldLabel htmlFor="street-subdivision">Street / Subdivision</FieldLabel>
                          <Input
                            id="street-subdivision"
                            value={accountDraft.streetSubdivision}
                            aria-invalid={Boolean(accountErrors.streetSubdivision)}
                            onChange={(event) =>
                              setAccount('streetSubdivision', event.target.value)
                            }
                          />
                          <FieldError>{accountErrors.streetSubdivision}</FieldError>
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
                      {step === 4 && (
                        <AddressMapPicker
                          latitude={accountDraft.latitude}
                          longitude={accountDraft.longitude}
                          zoom={mapZoom}
                          onChange={({ latitude, longitude }) => {
                            setAccount('latitude', latitude)
                            setAccount('longitude', longitude)
                            setLocationSource('manual')
                            setGeocodeMessage(undefined)
                          }}
                        />
                      )}
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
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <FieldLegend variant="label">Items</FieldLegend>
                      <FieldDescription>
                        Add the financed product, pricing, and any identifying details.
                      </FieldDescription>
                    </div>
                    <Button type="button" variant="secondary" size="xs" onClick={addLoanItem}>
                      <Plus data-icon="inline-start" />
                      Add item
                    </Button>
                  </div>
                  {loanDraft.items.map((item, index) => (
                    <FieldGroup key={item.id} className="gap-3 rounded-md border p-3">
                      <div className="flex items-center justify-between gap-3">
                        <span className="text-sm font-medium">Item {index + 1}</span>
                        {loanDraft.items.length > 1 && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            aria-label={`Remove item ${index + 1}`}
                            onClick={() => removeLoanItem(item.id)}
                          >
                            <Trash2 />
                          </Button>
                        )}
                      </div>
                      <div className="grid gap-3 sm:grid-cols-2">
                        <Field className="sm:col-span-2">
                          <FieldLabel htmlFor={`item-name-${item.id}`}>Product name</FieldLabel>
                          <ProductCombobox
                            id={`item-name-${item.id}`}
                            value={item.name}
                            items={productCatalog}
                            onChange={(product) =>
                              setLoan(
                                'items',
                                loanDraft.items.map((current) =>
                                  current.id === item.id
                                    ? {
                                        ...current,
                                        name: product.description,
                                        price: product.retailPriceCentavos / 100
                                      }
                                    : current
                                )
                              )
                            }
                          />
                        </Field>
                      </div>
                      <div className="grid gap-3 sm:grid-cols-3">
                        <Field>
                          <FieldLabel htmlFor={`item-price-${item.id}`}>Unit price</FieldLabel>
                          <AmountInputGroup
                            id={`item-price-${item.id}`}
                            name={`item-price-${item.id}`}
                            value={formatAmountInput(String(item.price || ''))}
                            onValueChange={(value) =>
                              setLoan(
                                'items',
                                loanDraft.items.map((current) =>
                                  current.id === item.id
                                    ? { ...current, price: Number(value.replace(/,/g, '')) || 0 }
                                    : current
                                )
                              )
                            }
                          />
                        </Field>
                        <Field>
                          <FieldLabel htmlFor={`item-quantity-${item.id}`}>Quantity</FieldLabel>
                          <Input
                            id={`item-quantity-${item.id}`}
                            type="number"
                            min="1"
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
                        </Field>
                        <Field>
                          <FieldLabel>Serial no.</FieldLabel>
                          {serialItemIds.has(item.id) ? (
                            <Input
                              id={`item-serial-${item.id}`}
                              value={item.serialNo ?? ''}
                              onChange={(event) =>
                                setLoan(
                                  'items',
                                  loanDraft.items.map((current) =>
                                    current.id === item.id
                                      ? { ...current, serialNo: event.target.value }
                                      : current
                                  )
                                )
                              }
                            />
                          ) : (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              onClick={() =>
                                setSerialItemIds((current) => new Set(current).add(item.id))
                              }
                            >
                              Add serial no.
                            </Button>
                          )}
                        </Field>
                      </div>
                      <div className="text-right text-sm tabular-nums text-muted-foreground">
                        Line total{' '}
                        <span className="font-medium text-foreground">
                          {money(item.quantity * item.price)}
                        </span>
                      </div>
                    </FieldGroup>
                  ))}
                  <FieldError>{loanErrors.items}</FieldError>
                  <Field>
                    <FieldLabel htmlFor="remarks">Remarks</FieldLabel>
                    <Textarea
                      id="remarks"
                      value={loanDraft.remarks}
                      onChange={(event) => setLoan('remarks', event.target.value)}
                    />
                  </Field>
                </FieldSet>
              </FieldGroup>

              <FieldGroup className={cn('gap-4 lg:col-start-2', step !== 6 && 'hidden')}>
                <FieldSet className="gap-3">
                  <FieldLegend variant="label">Loan schedule</FieldLegend>
                  <FieldGroup className="grid gap-3 sm:grid-cols-3">
                    <Field data-invalid={Boolean(loanErrors.dateReleased)}>
                      <FieldLabel htmlFor="date-released">Date Released</FieldLabel>
                      <DatePickerInput
                        id="date-released"
                        value={loanDraft.dateReleased}
                        aria-invalid={Boolean(loanErrors.dateReleased)}
                        onValueChange={(date) => setLoan('dateReleased', date)}
                      />
                      <FieldError>{loanErrors.dateReleased}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(loanErrors.startDate)}>
                      <FieldLabel>Start Date</FieldLabel>
                      <output className="flex min-h-9 items-center text-sm tabular-nums text-foreground">
                        {calculatedLoan.startDate || '—'}
                      </output>
                      <FieldError>{loanErrors.startDate}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(loanErrors.firstDueDate)}>
                      <FieldLabel>End Date</FieldLabel>
                      <output className="flex min-h-9 items-center text-sm tabular-nums text-foreground">
                        {calculatedLoan.firstDueDate || '—'}
                      </output>
                      <FieldError>{loanErrors.firstDueDate}</FieldError>
                    </Field>
                    <Field data-invalid={Boolean(loanErrors.paymentFrequency)}>
                      <FieldLabel htmlFor="payment-frequency">Payment Frequency</FieldLabel>
                      <Select
                        value={loanDraft.paymentFrequency}
                        onValueChange={(value) => {
                          const paymentFrequency = value as InstallmentFrequency
                          const terms =
                            paymentFrequency === 'Daily'
                              ? installmentRules?.dailyPlans.map((plan) => plan.terms)
                              : paymentFrequency === 'Weekly'
                                ? installmentRules?.weeklyTerms
                                : paymentFrequency === 'Semi'
                                  ? installmentRules?.semiTerms
                                  : installmentRules?.monthlyPlans.map((plan) => plan.terms)
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
                      {
                        <Select
                          value={loanDraft.terms}
                          onValueChange={(value) => setLoan('terms', value ?? '')}
                        >
                          <SelectTrigger id="terms" aria-invalid={Boolean(loanErrors.terms)}>
                            <SelectValue placeholder="Select terms" />
                          </SelectTrigger>
                          <SelectContent>
                            {(
                              (loanDraft.paymentFrequency === 'Daily'
                                ? installmentRules?.dailyPlans.map((plan) => plan.terms)
                                : loanDraft.paymentFrequency === 'Weekly'
                                  ? installmentRules?.weeklyTerms
                                  : loanDraft.paymentFrequency === 'Semi'
                                    ? installmentRules?.semiTerms
                                    : monthlyTerms) ?? []
                            ).map((term) => (
                              <SelectItem key={term} value={String(term)}>
                                {term}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      }
                      <FieldError>{loanErrors.terms}</FieldError>
                    </Field>
                  </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <FieldSet className="gap-3">
                  <FieldLegend variant="label">Payment Summary</FieldLegend>
                  <FieldGroup className="grid max-w-3xl gap-3 sm:grid-cols-2">
                    <Field data-invalid={Boolean(loanErrors.downPayment)}>
                      <FieldLabel htmlFor="downPayment">Down Payment</FieldLabel>
                      <AmountInputGroup
                        id="downPayment"
                        name="downPayment"
                        value={formatAmountInput(String(loanDraft.downPayment || ''))}
                        ariaInvalid={Boolean(loanErrors.downPayment)}
                        onValueChange={(value) =>
                          setLoan('downPayment', Number(value.replace(/,/g, '')) || 0)
                        }
                      />
                      <FieldDescription>
                        Must be at least {money(calculatedLoan.fees)} Downpayment.
                      </FieldDescription>
                      <FieldError>{loanErrors.downPayment}</FieldError>
                    </Field>
                  </FieldGroup>
                </FieldSet>
                <FieldSeparator />
                <FieldSet className="gap-3">
                  <FieldLegend variant="label">Calculated Summary</FieldLegend>
                  <div className="grid max-w-3xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ['Grand Total', money(calculatedLoan.grandTotal)],
                      ['Payment Amount', money(calculatedLoan.installmentAmount)],
                      ['Downpayment', money(calculatedLoan.fees)],
                      ['Interest', money(calculatedLoan.interest)],
                      [
                        'Total Installment',
                        money(calculatedLoan.grandTotal + calculatedLoan.interest)
                      ]
                    ].map(([label, value]) => (
                      <div key={label} className="border-l-2 border-primary/30 pl-3">
                        <div className="text-xs text-muted-foreground">{label}</div>
                        <div className="font-medium tabular-nums text-foreground">{value}</div>
                      </div>
                    ))}
                  </div>
                  <FieldError>
                    {loanErrors.principal || loanErrors.installmentAmount || loanErrors.grandTotal}
                  </FieldError>
                </FieldSet>
              </FieldGroup>

              <div className={cn('grid gap-3 lg:col-start-2', step !== 7 && 'hidden')}>
                <ReviewSection title="Customer" onEdit={() => setStep(1)}>
                  <ReviewValue label="Name" value={customerName} />
                  <ReviewValue label="Branch" value={branchLabels[accountDraft.branch]} />
                  <ReviewValue
                    label="Entry"
                    value={mode === 'new' ? 'New account' : 'Existing account'}
                  />
                </ReviewSection>
                <ReviewSection
                  title="Contact"
                  onEdit={mode === 'new' ? () => setStep(3) : undefined}
                >
                  <ReviewValue
                    label="Primary contact"
                    value={accountDraft.contacts.find((contact) => contact.isPrimary)?.value}
                  />
                  <ReviewValue
                    label="Email"
                    value={accountDraft.emails.find((email) => email.isPrimary)?.value}
                  />
                </ReviewSection>
                <ReviewSection
                  title="Address"
                  onEdit={mode === 'new' ? () => setStep(4) : undefined}
                >
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
                {createLoan && (
                  <ReviewSection title="Loan schedule" onEdit={() => setStep(6)}>
                    <ReviewValue label="Date Released" value={loanDraft.dateReleased} />
                    <ReviewValue label="Start Date" value={calculatedLoan.startDate} />
                    <ReviewValue label="End Date" value={calculatedLoan.firstDueDate} />
                    <ReviewValue
                      label="Frequency"
                      value={
                        calculatedLoan.paymentFrequency === 'Semi'
                          ? 'Semi-monthly'
                          : calculatedLoan.paymentFrequency
                      }
                    />
                    <ReviewValue label="No. of Payments" value={calculatedLoan.terms} />
                    <ReviewValue
                      label="Payment Amount"
                      value={money(calculatedLoan.installmentAmount)}
                    />
                  </ReviewSection>
                )}
                {createLoan && (
                  <ReviewSection title="Loan" onEdit={() => setStep(6)}>
                    <ReviewValue label="Grand Total" value={money(calculatedLoan.grandTotal)} />
                    <ReviewValue label="Interest" value={money(calculatedLoan.interest)} />
                    <ReviewValue
                      label="Total Installment"
                      value={money(calculatedLoan.grandTotal + calculatedLoan.interest)}
                    />
                    <ReviewValue label="Down Payment" value={money(calculatedLoan.downPayment)} />
                    <ReviewValue
                      label="Payment Amount"
                      value={money(calculatedLoan.installmentAmount)}
                    />
                    <ReviewValue label="Downpayment" value={money(calculatedLoan.fees)} />
                  </ReviewSection>
                )}
                {createLoan && (
                  <ReviewSection title="Items" onEdit={() => setStep(5)}>
                    <div className="sm:col-span-2">
                      {loanDraft.items.filter((item) => item.name.trim()).length ? (
                        <ul className="space-y-1">
                          {loanDraft.items
                            .filter((item) => item.name.trim())
                            .map((item) => (
                              <li key={item.id} className="flex justify-between gap-2">
                                <span className="truncate">
                                  {item.name} · {item.model ?? ''} x {item.quantity || 0}
                                  {item.serialNo ? ` · S/N ${item.serialNo}` : ''}
                                </span>
                                <span className="shrink-0 tabular-nums">
                                  {money(item.quantity * item.price)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      ) : (
                        <p className="text-muted-foreground">No items listed.</p>
                      )}
                    </div>
                  </ReviewSection>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </ScrollArea>

      <div className="sticky bottom-0 z-10 flex shrink-0 justify-end gap-2 border-t bg-background p-3">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        {currentStepIndex > 0 && (
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              const previousStep = wizardSteps[currentStepIndex - 1]
              if (previousStep) setStep(previousStep.step)
            }}
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
        {step === 7 && (
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting
              ? 'Saving…'
              : (submitLabel ??
                (mode === 'new'
                  ? createLoan
                    ? 'Create Account & Loan'
                    : 'Create Client'
                  : 'Create Loan'))}
          </Button>
        )}
      </div>
    </form>
  )
}
