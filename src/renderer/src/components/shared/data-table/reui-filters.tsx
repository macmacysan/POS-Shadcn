import type React from 'react'

import {
  Filters,
  type Filter,
  type FilterFieldConfig,
  type FilterFieldsConfig
} from '@/../../components/reui/filters'

export type ReuiFilterField = FilterFieldConfig<string>

type ReuiFiltersProps = {
  filters: Filter<string>[]
  fields: FilterFieldsConfig<string>
  onChange: (filters: Filter<string>[]) => void
  className?: string
}

export function ReuiFilters({
  filters,
  fields,
  onChange,
  className
}: ReuiFiltersProps): React.JSX.Element {
  return (
    <Filters
      filters={filters}
      fields={fields}
      onChange={onChange}
      className={className}
      size="sm"
      allowMultiple
      enableShortcut
      shortcutKey="f"
      i18n={{
        addFilter: 'Filter',
        searchFields: 'Search filters...',
        noFieldsFound: 'No filters found.'
      }}
    />
  )
}
