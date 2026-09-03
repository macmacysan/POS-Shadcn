const philippinePesoFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})
export const PESO_SIGN_HIDDEN_STORAGE_KEY = 'cashiers-report-hide-peso-sign'

let hidePesoSign =
  typeof localStorage !== 'undefined' &&
  localStorage.getItem(PESO_SIGN_HIDDEN_STORAGE_KEY) === 'true'

export function setPesoSignHidden(hidden: boolean): void {
  hidePesoSign = hidden
  localStorage.setItem(PESO_SIGN_HIDDEN_STORAGE_KEY, String(hidden))
}

export function pesoSign(): string {
  return hidePesoSign ? '' : '₱'
}

export function formatPhilippinePeso(value: number): string {
  const absoluteValue = Math.abs(value)
  return `${value < 0 ? '-' : ''}${pesoSign()}${philippinePesoFormatter.format(absoluteValue)}`
}

export function formatCentavos(value: number): string {
  return formatPhilippinePeso(value / 100)
}

export function formatAmountInput(value: string): string {
  const normalized = value.replace(/[^\d.]/g, '')
  if (!normalized) return ''
  const [rawWhole = '', rawFraction] = normalized.split('.', 2)
  const whole = (rawWhole || '0').replace(/^0+(?=\d)/, '')
  const formattedWhole = whole.replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  return rawFraction === undefined
    ? formattedWhole
    : `${formattedWhole}.${rawFraction.slice(0, 2)}`
}
