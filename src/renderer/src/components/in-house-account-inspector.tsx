import * as React from 'react'
import { Badge } from '@/components/ui/badge'
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from '@/components/ui/empty'
import { CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
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
      <Empty className="h-full rounded-none border-0 p-6">
        <EmptyHeader>
          <EmptyTitle>No account selected</EmptyTitle>
          <EmptyDescription>Select an account to view its details.</EmptyDescription>
        </EmptyHeader>
      </Empty>
    )
  const mobile = account.contacts.filter((contact) => contact.kind === 'mobile')
  const telephone = account.contacts.filter((contact) => contact.kind === 'telephone')
  return (
    <ScrollArea className="min-h-0 flex-1">
      <CardHeader className="p-4 pb-2">
        <h2 className="text-sm font-semibold">Account Summary</h2>
        <CardTitle>{formatAccountName(account)}</CardTitle>
        <CardDescription className="flex flex-wrap items-center gap-2">
          <Badge variant="secondary">{branchLabels[account.branch]}</Badge>
          <span className="text-xs text-muted-foreground">{account.id}</span>
        </CardDescription>
      </CardHeader>
      <CardContent className="p-3">
        <DetailSection title="ACCOUNT SUMMARY">
          <Detail label="Branch" value={branchLabels[account.branch]} />
          <Detail label="Complete Name" value={formatAccountName(account)} />
          <Detail label="Account ID" value={account.id} />
          <Detail label="Last Added" value={formatAccountDateTime(account.createdAt)} />
        </DetailSection>
        <DetailSection title="ADDRESS">
          <Detail label="Region" value={account.regionPsgc?.name} />
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
          <ContactList
            label="Telephone numbers"
            values={telephone.map((contact) => contact.value)}
          />
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
      </CardContent>
    </ScrollArea>
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
    <section>
      <h3 className="pt-4 pb-1 text-xs font-semibold uppercase tracking-wide">{title}</h3>
      <dl className="divide-y">{children}</dl>
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
    <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] gap-3 py-1.5 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-right font-medium">{value || '—'}</dd>
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
    <div className="grid grid-cols-[minmax(7rem,0.8fr)_minmax(0,1.2fr)] gap-3 py-1.5 text-xs">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-right font-medium">
        {values.length ? (
          values.map((value, index) => (
            <p key={`${label}-${value}`} className="break-all">
              {value}
              {index === primaryIndex && <span className="ml-2 text-primary">Primary</span>}
            </p>
          ))
        ) : (
          <p>—</p>
        )}
      </dd>
    </div>
  )
}
