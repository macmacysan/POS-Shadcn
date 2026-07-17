import { format } from 'date-fns'

export const branchNames = ['Goa', 'Tinambac', 'Tigaon', 'Lagonoy'] as const
export type BranchName = (typeof branchNames)[number]

export const branchLabels: Record<BranchName, string> = {
  Goa: 'Goa',
  Tinambac: 'Tinambac',
  Tigaon: 'Tigaon',
  Lagonoy: 'Lagonoy'
}

export type AccountContact = {
  readonly id: string
  readonly kind: 'mobile' | 'telephone'
  readonly value: string
  readonly isPrimary: boolean
}

export type AccountEmail = {
  readonly id: string
  readonly value: string
  readonly isPrimary: boolean
}

export type AccountAddressSelection = {
  readonly code: string
  readonly name: string
}

export type InHouseAccount = {
  readonly id: string
  readonly branch: BranchName
  readonly lastName: string
  readonly firstName: string
  readonly middleName?: string
  readonly suffix?: string
  readonly streetSubdivision?: string
  readonly regionPsgc?: AccountAddressSelection
  readonly barangay: string
  readonly barangayPsgc?: AccountAddressSelection
  readonly cityMunicipality: string
  readonly cityMunicipalityPsgc?: AccountAddressSelection
  readonly province: string
  readonly provincePsgc?: AccountAddressSelection
  readonly occupation?: string
  readonly contacts: readonly AccountContact[]
  readonly emails: readonly AccountEmail[]
  readonly agent?: string
  readonly referredBy?: string
  readonly createdAt: string
  readonly updatedAt: string
}

export type AccountDraft = Omit<InHouseAccount, 'id' | 'createdAt' | 'updatedAt'>

export type AccountValidationErrors = Partial<Record<keyof AccountDraft | 'form', string>>

export const suffixOptions = ['Jr.', 'Sr.', 'II', 'III', 'IV', 'V'] as const
export const agentOptions = ['Mark Rivera', 'Nina Dela Cruz', 'Paolo Santos'] as const

const mobilePattern = /^(?:\+?63|0)\d{10}$/
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export const sampleAccounts: readonly InHouseAccount[] = [
  {
    id: 'IH-2026-0041',
    branch: 'Goa',
    lastName: 'Santos',
    firstName: 'Maria Clara',
    middleName: 'Villanueva',
    suffix: 'Jr.',
    streetSubdivision: 'Purok 3, San Isidro Village',
    barangay: 'Payatan',
    cityMunicipality: 'Goa',
    province: 'Camarines Sur',
    occupation: 'Store owner',
    contacts: [
      { id: 'contact-41-1', kind: 'mobile', value: '09171234567', isPrimary: true },
      { id: 'contact-41-2', kind: 'mobile', value: '09981234567', isPrimary: false },
      { id: 'contact-41-3', kind: 'telephone', value: '(054) 555 0141', isPrimary: false }
    ],
    emails: [{ id: 'email-41-1', value: 'maria.santos@example.com', isPrimary: true }],
    agent: 'Mark Rivera',
    referredBy: 'Ana Santos',
    createdAt: '2026-07-14T08:32:00.000Z',
    updatedAt: '2026-07-14T08:32:00.000Z'
  },
  {
    id: 'IH-2026-0037',
    branch: 'Tinambac',
    lastName: 'Cruz',
    firstName: 'Luis Miguel',
    barangay: 'Olag Pequeño',
    cityMunicipality: 'Tinambac',
    province: 'Camarines Sur',
    occupation: 'Driver',
    contacts: [
      { id: 'contact-37-1', kind: 'mobile', value: '09179876543', isPrimary: true },
      { id: 'contact-37-2', kind: 'telephone', value: '(054) 555 0137', isPrimary: false }
    ],
    emails: [],
    agent: 'Nina Dela Cruz',
    createdAt: '2026-07-12T10:15:00.000Z',
    updatedAt: '2026-07-12T10:15:00.000Z'
  },
  {
    id: 'IH-2026-0029',
    branch: 'Tigaon',
    lastName: 'de los Santos',
    firstName: 'Beatriz',
    middleName: 'M.',
    barangay: 'Talojongon',
    cityMunicipality: 'Tigaon',
    province: 'Camarines Sur',
    occupation: 'Teacher',
    contacts: [{ id: 'contact-29-1', kind: 'mobile', value: '09175551234', isPrimary: true }],
    emails: [{ id: 'email-29-1', value: 'beatriz@example.com', isPrimary: true }],
    agent: 'Paolo Santos',
    referredBy: 'Community fair',
    createdAt: '2026-07-08T14:45:00.000Z',
    updatedAt: '2026-07-08T14:45:00.000Z'
  }
]

export function formatAccountName(
  account: Pick<InHouseAccount, 'lastName' | 'firstName' | 'middleName' | 'suffix'>
): string {
  return [
    account.lastName.trim() ? `${account.lastName.trim()},` : '',
    account.firstName.trim(),
    account.middleName?.trim(),
    account.suffix?.trim()
  ]
    .filter(Boolean)
    .join(' ')
}

export function formatAddressSummary(
  account: Pick<InHouseAccount, 'barangay' | 'cityMunicipality'>
): string {
  return [account.barangay, account.cityMunicipality].filter((value) => value.trim()).join(', ')
}

export function formatAccountDateTime(value: string): string {
  return format(new Date(value), 'MMM d, yyyy h:mm a')
}

export function validateAccountDraft(draft: AccountDraft): AccountValidationErrors {
  const errors: AccountValidationErrors = {}
  if (!draft.branch) errors.branch = 'Branch is required.'
  if (!draft.lastName.trim()) errors.lastName = 'Last Name is required.'
  if (!draft.firstName.trim()) errors.firstName = 'First Name is required.'
  const mobiles = draft.contacts.filter(
    (contact) => contact.kind === 'mobile' && contact.value.trim()
  )
  if (!mobiles.length) errors.contacts = 'At least one valid mobile number is required.'
  if (mobiles.some((contact) => !mobilePattern.test(contact.value.replace(/[\s()-]/g, '')))) {
    errors.contacts = 'Enter a valid mobile number.'
  }
  if (mobiles.filter((contact) => contact.isPrimary).length > 1)
    errors.contacts = 'Only one primary mobile number is allowed.'
  if (draft.emails.filter((email) => email.isPrimary).length > 1)
    errors.emails = 'Only one primary email address is allowed.'
  if (draft.emails.some((email) => email.value.trim() && !emailPattern.test(email.value.trim())))
    errors.emails = 'Enter a valid email address.'
  return errors
}

export function normalizeAccountDraft(draft: AccountDraft): AccountDraft {
  const contacts = draft.contacts
    .map((contact) => ({ ...contact, value: contact.value.trim() }))
    .filter((contact) => contact.value)
  const emails = draft.emails
    .map((email) => ({ ...email, value: email.value.trim() }))
    .filter((email) => email.value)
  return {
    ...draft,
    lastName: draft.lastName.trim(),
    firstName: draft.firstName.trim(),
    middleName: draft.middleName?.trim() || undefined,
    suffix: draft.suffix?.trim() || undefined,
    streetSubdivision: draft.streetSubdivision?.trim() || undefined,
    barangay: draft.barangay.trim(),
    cityMunicipality: draft.cityMunicipality.trim(),
    province: draft.province.trim(),
    occupation: draft.occupation?.trim() || undefined,
    agent: draft.agent?.trim() || undefined,
    referredBy: draft.referredBy?.trim() || undefined,
    contacts,
    emails
  }
}

export function createAccount(draft: AccountDraft, now = new Date()): InHouseAccount {
  const timestamp = now.toISOString()
  return {
    ...draft,
    id: `IH-${now.getFullYear()}-${String(now.getTime()).slice(-4)}`,
    createdAt: timestamp,
    updatedAt: timestamp
  }
}
