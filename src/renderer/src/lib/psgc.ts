// Bundled from the official PSA PSGC masterlist (April 2026 release) for offline use.
// Source: https://psa.gov.ph/classification/psgc
import records from '@/lib/data/psgc.json'

export type PsgcOption = {
  readonly code: string
  readonly name: string
  readonly parentCode: string
}

type PsgcRecord = {
  readonly name: string
  readonly type: string
  readonly psgc_id: string
  readonly parent_psgc_id: string
}

const allRecords = records as PsgcRecord[]
const cityTypes = new Set([
  'municipality',
  'component_city',
  'independent_component_city',
  'highly_urbanized_city'
])

function optionsFor(predicate: (record: PsgcRecord) => boolean): readonly PsgcOption[] {
  return allRecords
    .filter(predicate)
    .map((record) => ({
      code: record.psgc_id,
      name: record.name,
      parentCode: record.parent_psgc_id
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

export const psgcRegions = optionsFor((record) => record.type === 'region')
export const psgcProvinces = optionsFor((record) => record.type === 'province')
export const psgcCitiesMunicipalities = optionsFor((record) => cityTypes.has(record.type))
export const psgcBarangays = optionsFor((record) => record.type === 'barangay')

export function childrenOf(
  options: readonly PsgcOption[],
  parentCode: string
): readonly PsgcOption[] {
  return options.filter((option) => option.parentCode === parentCode)
}

export function findPsgcOption(
  options: readonly PsgcOption[],
  code: string | undefined,
  name: string | undefined
): PsgcOption | undefined {
  return (
    options.find((option) => option.code === code) ?? options.find((option) => option.name === name)
  )
}
