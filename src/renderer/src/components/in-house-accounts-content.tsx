import * as React from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Plus, Search } from 'lucide-react'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'
import { InputGroup, InputGroupAddon, InputGroupInput } from '@/components/ui/input-group'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/components/ui/select'
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import {
  Drawer,
  DrawerContent,
  DrawerDescription,
  DrawerHeader,
  DrawerTitle
} from '@/components/ui/drawer'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow
} from '@/components/ui/table'
import { useIsMobile } from '@/hooks/use-mobile'
import { ScrollArea } from '@/components/ui/scroll-area'
import { InHouseAccountForm } from '@/components/in-house-account-form'
import { InHouseAccountInspector } from '@/components/in-house-account-inspector'
import {
  branchLabels,
  branchNames,
  createAccount,
  formatAccountDateTime,
  formatAccountName,
  formatAddressSummary,
  normalizeAccountDraft,
  sampleAccounts,
  type BranchName,
  type InHouseAccount
} from '@/lib/in-house-accounts'

type SortDirection = 'asc' | 'desc'
const storageKey = 'cashiers-report-in-house-accounts'
const branchBadgeClasses: Record<BranchName, string> = {
  Goa: 'bg-primary/10 text-primary border-primary/20',
  Tinambac: 'bg-secondary text-secondary-foreground border-border',
  Tigaon: 'bg-accent text-accent-foreground border-border',
  Lagonoy: 'bg-muted text-muted-foreground border-border'
}

function readAccounts(): readonly InHouseAccount[] {
  const saved = localStorage.getItem(storageKey)
  if (!saved) return sampleAccounts
  try {
    const parsed: unknown = JSON.parse(saved)
    return Array.isArray(parsed) ? (parsed as InHouseAccount[]) : sampleAccounts
  } catch (error) {
    if (error instanceof SyntaxError) return sampleAccounts
    throw error
  }
}
function SortLabel({
  direction,
  onClick,
  children
}: {
  readonly direction: SortDirection
  readonly onClick: () => void
  readonly children: React.ReactNode
}): React.JSX.Element {
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className="-ml-2 h-7 px-2 text-xs"
      onClick={onClick}
    >
      {children}
      {direction === 'desc' ? (
        <ArrowDown data-icon="inline-end" />
      ) : direction === 'asc' ? (
        <ArrowUp data-icon="inline-end" />
      ) : (
        <ArrowUpDown data-icon="inline-end" />
      )}
    </Button>
  )
}

export function InHouseAccountsContent(): React.JSX.Element {
  const [accounts, setAccounts] = React.useState<readonly InHouseAccount[]>(readAccounts)
  const [selectedId, setSelectedId] = React.useState<string | undefined>(accounts[0]?.id)
  const [search, setSearch] = React.useState('')
  const [branch, setBranch] = React.useState<BranchName | 'all'>('all')
  const [agent, setAgent] = React.useState('all')
  const [sortDirection, setSortDirection] = React.useState<SortDirection>('desc')
  const [isFormOpen, setIsFormOpen] = React.useState(false)
  const isMobile = useIsMobile()
  const selected = accounts.find((account) => account.id === selectedId)
  const agents = Array.from(
    new Set(
      accounts.map((account) => account.agent).filter((value): value is string => Boolean(value))
    )
  )
  const visibleAccounts = React.useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...accounts]
      .filter((account) => branch === 'all' || account.branch === branch)
      .filter((account) => agent === 'all' || account.agent === agent)
      .filter(
        (account) =>
          !query ||
          [
            formatAccountName(account),
            ...account.contacts.map((contact) => contact.value),
            ...account.emails.map((email) => email.value)
          ]
            .join(' ')
            .toLowerCase()
            .includes(query)
      )
      .sort((left, right) => {
        const difference = left.createdAt.localeCompare(right.createdAt)
        return sortDirection === 'desc' ? -difference : difference
      })
  }, [accounts, agent, branch, search, sortDirection])
  const save = (draft: Parameters<typeof createAccount>[0]): void => {
    const next = createAccount(normalizeAccountDraft(draft))
    const updated = [...accounts, next]
    setAccounts(updated)
    setSelectedId(next.id)
    setIsFormOpen(false)
    localStorage.setItem(storageKey, JSON.stringify(updated))
  }
  return (
    <div className="flex min-h-0 min-w-0 flex-1 overflow-hidden p-3">
      <div className="grid h-full min-h-0 w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(270px,320px)] gap-3 max-[900px]:grid-cols-1">
        <Card className="flex min-h-0 min-w-0 flex-col">
          <CardContent className="flex min-h-0 flex-1 flex-col p-0">
            <CardHeader className="flex shrink-0 flex-wrap items-center gap-2 border-b bg-card px-3 py-2">
              <InputGroup className="h-8 min-w-48 max-w-md flex-1">
                <InputGroupAddon>
                  <Search aria-hidden="true" />
                </InputGroupAddon>
                <InputGroupInput
                  className="text-xs"
                  aria-label="Search accounts by name, contact number, or email"
                  placeholder="Search name, contact, or email..."
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                />
              </InputGroup>
              <Select
                value={branch}
                onValueChange={(value) => setBranch(value as BranchName | 'all')}
              >
                <SelectTrigger size="sm" className="w-28" aria-label="Filter by branch">
                  <SelectValue placeholder="Branch" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All branches</SelectItem>
                  {branchNames.map((item) => (
                    <SelectItem key={item} value={item}>
                      {branchLabels[item]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {agents.length > 0 && (
                <Select value={agent} onValueChange={(value) => setAgent(value ?? 'all')}>
                  <SelectTrigger size="sm" className="w-32" aria-label="Filter by agent">
                    <SelectValue placeholder="Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {agents.map((item) => (
                      <SelectItem key={item} value={item}>
                        {item}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
              <Button
                type="button"
                size="sm"
                className="shrink-0"
                onClick={() => setIsFormOpen(true)}
              >
                <Plus data-icon="inline-start" />
                Add Account
              </Button>
            </CardHeader>
            <ScrollArea className="min-h-0 min-w-0 flex-1">
              <Table className="min-w-[760px]">
                <TableHeader className="sticky top-0 z-10 bg-muted/30">
                  <TableRow className="h-9">
                    <TableHead>BRANCH</TableHead>
                    <TableHead>ACCOUNT NAME</TableHead>
                    <TableHead>ADDRESS</TableHead>
                    <TableHead>CONTACT</TableHead>
                    <TableHead>AGENT</TableHead>
                    <TableHead>REFERRED BY</TableHead>
                    <TableHead>
                      <SortLabel
                        direction={sortDirection}
                        onClick={() =>
                          setSortDirection((value) => (value === 'desc' ? 'asc' : 'desc'))
                        }
                      >
                        LAST ADDED
                      </SortLabel>
                    </TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleAccounts.length ? (
                    visibleAccounts.map((account) => {
                      const primaryMobile =
                        account.contacts.find(
                          (contact) => contact.kind === 'mobile' && contact.isPrimary
                        ) ?? account.contacts.find((contact) => contact.kind === 'mobile')
                      const additional =
                        account.contacts.filter((contact) => contact.kind === 'mobile').length -
                        (primaryMobile ? 1 : 0)
                      return (
                        <TableRow
                          key={account.id}
                          tabIndex={0}
                          data-state={selectedId === account.id ? 'selected' : undefined}
                          className="h-10 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          onClick={() => setSelectedId(account.id)}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter' || event.key === ' ') {
                              event.preventDefault()
                              setSelectedId(account.id)
                            }
                          }}
                        >
                          <TableCell>
                            <Badge className={branchBadgeClasses[account.branch]}>
                              {branchLabels[account.branch]}
                            </Badge>
                          </TableCell>
                          <TableCell className="max-w-48 truncate text-xs font-medium">
                            {formatAccountName(account)}
                          </TableCell>
                          <TableCell className="max-w-40 truncate text-xs">
                            {formatAddressSummary(account)}
                          </TableCell>
                          <TableCell className="text-xs">
                            {primaryMobile?.value || '—'}
                            {additional > 0 && (
                              <span className="ml-1 text-muted-foreground">+{additional} more</span>
                            )}
                          </TableCell>
                          <TableCell className="max-w-32 truncate text-xs">
                            {account.agent || '—'}
                          </TableCell>
                          <TableCell className="max-w-32 truncate text-xs">
                            {account.referredBy || '—'}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {formatAccountDateTime(account.createdAt)}
                          </TableCell>
                        </TableRow>
                      )
                    })
                  ) : (
                    <TableRow>
                      <TableCell
                        colSpan={7}
                        className="h-24 text-center text-sm text-muted-foreground"
                      >
                        No matching accounts.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </ScrollArea>
            <CardFooter className="flex shrink-0 items-center border-t bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
              {visibleAccounts.length} account{visibleAccounts.length === 1 ? '' : 's'}
            </CardFooter>
          </CardContent>
        </Card>
        {!isMobile && (
          <Card className="flex min-h-0 min-w-0 flex-col">
            <CardHeader className="border-b p-4">
              <CardTitle>Account Details</CardTitle>
            </CardHeader>
            <InHouseAccountInspector account={selected} />
          </Card>
        )}
      </div>
      {isMobile && (
        <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelectedId(undefined)}>
          <SheetContent side="right" className="w-[min(92vw,26rem)] p-0">
            <SheetHeader className="sr-only">
              <SheetTitle>Account details</SheetTitle>
              <SheetDescription>Full details for the selected account.</SheetDescription>
            </SheetHeader>
            <InHouseAccountInspector account={selected} />
          </SheetContent>
        </Sheet>
      )}
      <Drawer
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        swipeDirection={isMobile ? 'down' : 'right'}
        showSwipeHandle={isMobile}
      >
        <DrawerContent className="[--drawer-content-width:min(96vw,46rem)] [--drawer-inset:1rem] bg-card text-card-foreground shadow-lg ring-1 ring-foreground/10 data-[swipe-direction=down]:!rounded-xl data-[swipe-direction=right]:!rounded-xl">
          <DrawerHeader className="border-b px-4 py-3">
            <DrawerTitle>Add Account</DrawerTitle>
            <DrawerDescription>Create an in-house installment customer account.</DrawerDescription>
          </DrawerHeader>
          <InHouseAccountForm onSave={save} onCancel={() => setIsFormOpen(false)} />
        </DrawerContent>
      </Drawer>
    </div>
  )
}
