import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import {
  branchLabels,
  formatAccountDateTime,
  formatAccountName,
  type InHouseAccount
} from '@/lib/in-house-accounts'

export function InHouseAccountInspector({
  account
}: {
  readonly account?: InHouseAccount
}): React.JSX.Element {
  if (!account)
    return (
      <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Select an account to view its details.
      </div>
    )
  const mobile = account.contacts.filter((contact) => contact.kind === 'mobile')
  const telephone = account.contacts.filter((contact) => contact.kind === 'telephone')
  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-y-auto p-4">
      <div className="mb-4">
        <p className="text-xs text-muted-foreground">ACCOUNT SUMMARY</p>
        <h2 className="mt-1 text-base font-semibold">{formatAccountName(account)}</h2>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{branchLabels[account.branch]}</Badge>
          <span className="text-xs text-muted-foreground">{account.id}</span>
        </div>
      </div>
      <DetailSection title="ACCOUNT SUMMARY">
        <Detail label="Branch" value={branchLabels[account.branch]} />
        <Detail label="Complete Name" value={formatAccountName(account)} />
        <Detail label="Account ID" value={account.id} />
        <Detail label="Last Added" value={formatAccountDateTime(account.createdAt)} />
      </DetailSection>
      <DetailSection title="ADDRESS">
        <Detail label="Street / Subdivision" value={account.streetSubdivision} />
        <Detail label="Barangay" value={account.barangay} />
        <Detail label="City / Municipality" value={account.cityMunicipality} />
        <Detail label="Province" value={account.province} />
      </DetailSection>
      <DetailSection title="CONTACT INFORMATION">
        <ContactList
          label="Mobile numbers"
          values={mobile.map((contact) => contact.value)}
          primaryIndex={mobile.findIndex((contact) => contact.isPrimary)}
        />
        <ContactList label="Telephone numbers" values={telephone.map((contact) => contact.value)} />
        <ContactList
          label="Email addresses"
          values={account.emails.map((email) => email.value)}
          primaryIndex={account.emails.findIndex((email) => email.isPrimary)}
        />
      </DetailSection>
      <DetailSection title="OTHER INFORMATION">
        <Detail label="Occupation" value={account.occupation} />
        <Detail label="Agent" value={account.agent} />
        <Detail label="Referred By" value={account.referredBy} />
      </DetailSection>
    </div>
  )
}

function DetailSection({
  title,
  children
}: {
  readonly title: string
  readonly children: React.ReactNode
}): React.JSX.Element {
  return (
    <section className="flex flex-col gap-2 border-t py-3 first:border-t-0 first:pt-0">
      <p className="text-xs font-medium tracking-wide text-muted-foreground">{title}</p>
      {children}
    </section>
  )
}
function Detail({
  label,
  value
}: {
  readonly label: string
  readonly value?: string
}): React.JSX.Element {
  return (
    <div className="grid grid-cols-[7rem_minmax(0,1fr)] gap-2 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="min-w-0 break-words">{value || '—'}</span>
    </div>
  )
}
function ContactList({
  label,
  values,
  primaryIndex = -1
}: {
  readonly label: string
  readonly values: readonly string[]
  readonly primaryIndex?: number
}): React.JSX.Element {
  return (
    <div className="flex flex-col gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      {values.length ? (
        values.map((value, index) => (
          <span key={`${label}-${value}`} className="break-all">
            {value}
            {index === primaryIndex && <span className="ml-2 text-primary">Primary</span>}
          </span>
        ))
      ) : (
        <span>—</span>
      )}
    </div>
  )
}
