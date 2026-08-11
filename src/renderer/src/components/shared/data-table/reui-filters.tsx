import type React from 'react'
import { ListFilter } from 'lucide-react'

import { Button } from '@/components/ui/button'
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
      trigger={
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="border-dashed text-muted-foreground"
        >
          <ListFilter data-icon="inline-start" aria-hidden="true" />
          Filter{filters.length ? ` (${filters.length})` : ''}
        </Button>
      }
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
