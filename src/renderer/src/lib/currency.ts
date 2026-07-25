const philippinePesoFormatter = new Intl.NumberFormat('en-PH', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2
})

export function formatPhilippinePeso(value: number): string {
  const absoluteValue = Math.abs(value)
  return `${value < 0 ? '-' : ''}₱${philippinePesoFormatter.format(absoluteValue)}`
}
