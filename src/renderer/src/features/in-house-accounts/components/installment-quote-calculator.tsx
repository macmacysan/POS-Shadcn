import * as React from 'react'
import { Copy } from 'lucide-react'
import { AmountInputGroup } from '@/components/ui/amount-input-group'
import { Button } from '@/components/ui/button'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { Field, FieldDescription, FieldGroup, FieldLabel } from '@/components/ui/field'
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
import { formatCentavos } from '@/lib/currency'
import type { InstallmentFrequency, InstallmentRulesRecord } from '@/../../shared/contracts'
import { calculateInstallment } from '@/../../shared/installment-calculations'

const frequencies = ['Daily', 'Weekly', 'Semi', 'Monthly'] as const
const today = (): string => new Date().toLocaleDateString('en-CA')
const termsFor = (
  frequency: InstallmentFrequency,
  rules?: InstallmentRulesRecord
): readonly number[] =>
  !rules
    ? []
    : frequency === 'Daily'
      ? rules.dailyPlans.map((plan) => plan.terms)
      : frequency === 'Weekly'
        ? rules.weeklyTerms
        : frequency === 'Semi'
          ? rules.semiTerms
          : rules.monthlyPlans.map((plan) => plan.terms)
type Props = { readonly open: boolean; readonly onOpenChange: (open: boolean) => void }
export function InstallmentQuoteCalculator({ open, onOpenChange }: Props): React.JSX.Element {
  const [rules, setRules] = React.useState<InstallmentRulesRecord>()
  const [cashPrice, setCashPrice] = React.useState('')
  const [downPayment, setDownPayment] = React.useState('0')
  const [releaseDate, setReleaseDate] = React.useState(today)
  const [frequency, setFrequency] = React.useState<InstallmentFrequency>('Monthly')
  const [terms, setTerms] = React.useState('')
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (!open || rules) return
    void window.api.installmentRules
      .getActive()
      .then(setRules)
      .catch(() => undefined)
  }, [open, rules])
  const availableTerms = termsFor(frequency, rules)
  React.useEffect(() => {
    if (availableTerms.length && !availableTerms.includes(Number(terms)))
      setTerms(String(availableTerms[0]))
  }, [availableTerms, terms])
  const calculation = React.useMemo(
    () =>
      !rules || !cashPrice || !terms
        ? undefined
        : calculateInstallment(
            {
              releaseDate,
              frequency,
              terms: Number(terms),
              items: [
                {
                  quantity: 1,
                  unitPriceCentavos: Math.round(Number(cashPrice.replace(/,/g, '')) * 100)
                }
              ],
              actualDownPaymentCentavos: Math.round(Number(downPayment.replace(/,/g, '')) * 100)
            },
            rules
          ),
    [cashPrice, downPayment, frequency, releaseDate, rules, terms]
  )
  const isValid = calculation?.paymentAmountCentavos !== null && calculation !== undefined
  const quote = isValid
    ? `${frequency === 'Semi' ? 'Semi-monthly' : frequency}: ${formatCentavos(calculation.paymentAmountCentavos!)} x ${terms} payments. Total: ${formatCentavos(calculation.totalInstallmentCentavos!)}. Down payment: ${formatCentavos(Math.round(Number(downPayment.replace(/,/g, '')) * 100))}. First due: ${calculation.startDate}. Last due: ${calculation.endDate}.`
    : undefined
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="flex w-[min(92vw,30rem)] flex-col p-0">
        <SheetHeader>
          <SheetTitle>Installment calculator</SheetTitle>
          <SheetDescription>
            Quote a payment plan without creating an account or loan.
          </SheetDescription>
        </SheetHeader>
        <FieldGroup className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-4 pb-4">
          <FieldGroup className="grid gap-3 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="quote-cash-price">Cash price</FieldLabel>
              <AmountInputGroup
                id="quote-cash-price"
                name="cash-price"
                value={cashPrice}
                autoFocus
                onValueChange={setCashPrice}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quote-down-payment">Down payment</FieldLabel>
              <AmountInputGroup
                id="quote-down-payment"
                name="down-payment"
                value={downPayment}
                onValueChange={setDownPayment}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quote-release-date">Date released</FieldLabel>
              <DatePickerInput
                id="quote-release-date"
                value={releaseDate}
                onValueChange={setReleaseDate}
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="quote-frequency">Payment frequency</FieldLabel>
              <Select
                value={frequency}
                onValueChange={(value) => setFrequency(value as InstallmentFrequency)}
              >
                <SelectTrigger id="quote-frequency">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {frequencies.map((item) => (
                    <SelectItem key={item} value={item}>
                      {item === 'Semi' ? 'Semi-monthly' : item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field>
              <FieldLabel htmlFor="quote-terms">No. of payments</FieldLabel>
              <Select
                value={terms}
                onValueChange={(value) => setTerms(value ?? '')}
                disabled={!availableTerms.length}
              >
                <SelectTrigger id="quote-terms">
                  <SelectValue placeholder="Select terms" />
                </SelectTrigger>
                <SelectContent>
                  {availableTerms.map((item) => (
                    <SelectItem key={item} value={String(item)}>
                      {item}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </FieldGroup>
          {!rules && <FieldDescription>Loading installment rules</FieldDescription>}
          {rules && !isValid && (
            <FieldDescription>
              Enter a cash price and select a supported payment term.
            </FieldDescription>
          )}
          {isValid && (
            <div className="space-y-3 border-t pt-4">
              <div>
                <p className="text-sm text-muted-foreground">
                  Payment every {frequency === 'Semi' ? 'semi-month' : frequency.toLowerCase()}
                </p>
                <output className="text-2xl font-semibold tabular-nums">
                  {formatCentavos(calculation.paymentAmountCentavos!)}
                </output>
                <p className="text-sm text-muted-foreground">
                  {terms} payments {calculation.startDate} to {calculation.endDate}
                </p>
              </div>
              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Cash price</dt>
                  <dd className="font-medium tabular-nums">
                    {formatCentavos(calculation.grandTotalCentavos)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Total payable</dt>
                  <dd className="font-medium tabular-nums">
                    {formatCentavos(calculation.totalInstallmentCentavos!)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Interest</dt>
                  <dd className="font-medium tabular-nums">
                    {formatCentavos(calculation.interestCentavos!)}
                  </dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Required fee</dt>
                  <dd className="font-medium tabular-nums">
                    {formatCentavos(calculation.requiredFeeCentavos!)}
                  </dd>
                </div>
              </dl>
              {quote && typeof navigator !== 'undefined' && navigator.clipboard && (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    void navigator.clipboard
                      .writeText(quote)
                      .then(() => setCopied(true))
                      .catch(() => undefined)
                  }
                >
                  <Copy data-icon="inline-start" />
                  {copied ? 'Copied' : 'Copy quote'}
                </Button>
              )}
            </div>
          )}
        </FieldGroup>
      </SheetContent>
    </Sheet>
  )
}

