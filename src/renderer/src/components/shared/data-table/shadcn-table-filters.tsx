import * as React from 'react'
import { RotateCcw } from 'lucide-react'

import { FilterButton } from '@/components/ui/filter-button'
import { DatePickerInput } from '@/components/ui/date-picker-input'
import { Input } from '@/components/ui/input'
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from '@/components/ui/combobox'
import {
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger
} from '@/components/ui/popover'
import { Button } from '@/components/ui/button'

export type ShadcnFilterField = {
  key: string
  label: string
  type?: 'text' | 'range'
  options?: readonly { value: string; label: string }[]
  inputType?: 'date' | 'number'
  placeholder?: string
  minKey?: string
  maxKey?: string
  minPlaceholder?: string
  maxPlaceholder?: string
}

type ShadcnTableFiltersProps = {
  fields: readonly ShadcnFilterField[]
  filters: readonly { field: string; value: string }[]
  onChange: (filters: Array<{ field: string; value: string }>) => void
  className?: string
}

export function ShadcnTableFilters({
  fields,
  filters,
  onChange,
  className
}: ShadcnTableFiltersProps): React.JSX.Element {
  const [open, setOpen] = React.useState(false)

  const clear = (): void => onChange([])

  const updateValue = (field: string, value: string): void => {
    onChange([
      ...filters.filter((filter) => filter.field !== field),
      ...(value ? [{ field, value }] : [])
    ])
  }

  const updateRange = (
    field: ShadcnFilterField,
    side: 'min' | 'max',
    value: string
  ): void => {
    const minKey = field.minKey ?? `${field.key}Min`
    const maxKey = field.maxKey ?? `${field.key}Max`
    const next = filters.filter((filter) => filter.field !== minKey && filter.field !== maxKey)
    const min = side === 'min' ? value : filters.find((filter) => filter.field === minKey)?.value
    const max = side === 'max' ? value : filters.find((filter) => filter.field === maxKey)?.value
    onChange([
      ...next,
      ...(min ? [{ field: minKey, value: min }] : []),
      ...(max ? [{ field: maxKey, value: max }] : [])
    ])
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <FilterButton className={className}>
            Filter{filters.length ? ` (${filters.length})` : ''}
          </FilterButton>
        }
      />
      <PopoverContent align="start" className="w-80 p-1">
        <PopoverTitle className="sr-only">Filter table</PopoverTitle>
        <div className="flex flex-col gap-2">
          {fields.map((field) => {
              if (field.options) {
                const selectedValue = filters.find((filter) => filter.field === field.key)?.value
                return (
                  <div key={field.key} className="min-w-0 p-2">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{field.label}</p>
                    <Combobox
                      items={field.options ?? []}
                      itemToStringLabel={(option) => option.label}
                      itemToStringValue={(option) => option.value}
                      value={
                        (field.options ?? []).find((option) => option.value === selectedValue) ?? null
                      }
                      onValueChange={(option) => updateValue(field.key, option?.value ?? '')}
                    >
                      <ComboboxInput
                        placeholder={field.placeholder ?? `Search ${field.label.toLowerCase()}...`}
                        showClear
                      />
                      <ComboboxContent>
                        <ComboboxEmpty>No matching {field.label.toLowerCase()}.</ComboboxEmpty>
                        <ComboboxList>
                          {(option) => <ComboboxItem value={option}>{option.label}</ComboboxItem>}
                        </ComboboxList>
                      </ComboboxContent>
                    </Combobox>
                  </div>
                )
              }

              if (field.type === 'text') {
                return (
                  <div key={field.key} className="min-w-0 p-2">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{field.label}</p>
                    <Input
                      value={filters.find((filter) => filter.field === field.key)?.value ?? ''}
                      placeholder={field.placeholder}
                      onChange={(event) => updateValue(field.key, event.target.value)}
                    />
                  </div>
                )
              }

              if (field.type === 'range') {
                const minKey = field.minKey ?? `${field.key}Min`
                const maxKey = field.maxKey ?? `${field.key}Max`
                return (
                  <div key={field.key} className="min-w-0 p-2">
                    <p className="mb-1.5 text-xs font-medium text-muted-foreground">{field.label}</p>
                    <div className="flex flex-col gap-2">
                      {field.inputType === 'date' ? (
                        <>
                          <DatePickerInput
                            value={filters.find((filter) => filter.field === minKey)?.value ?? ''}
                            placeholder={field.minPlaceholder ?? 'From'}
                            aria-label={`${field.label} minimum`}
                            onValueChange={(value) => updateRange(field, 'min', value)}
                          />
                          <DatePickerInput
                            value={filters.find((filter) => filter.field === maxKey)?.value ?? ''}
                            placeholder={field.maxPlaceholder ?? 'To'}
                            aria-label={`${field.label} maximum`}
                            onValueChange={(value) => updateRange(field, 'max', value)}
                          />
                        </>
                      ) : (
                        <>
                          <Input
                            type={field.inputType ?? 'number'}
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={filters.find((filter) => filter.field === minKey)?.value ?? ''}
                            placeholder={field.minPlaceholder ?? 'Min'}
                            aria-label={`${field.label} minimum`}
                            onChange={(event) => updateRange(field, 'min', event.target.value)}
                          />
                          <Input
                            type={field.inputType ?? 'number'}
                            min="0"
                            step="0.01"
                            inputMode="decimal"
                            value={filters.find((filter) => filter.field === maxKey)?.value ?? ''}
                            placeholder={field.maxPlaceholder ?? 'Max'}
                            aria-label={`${field.label} maximum`}
                            onChange={(event) => updateRange(field, 'max', event.target.value)}
                          />
                        </>
                      )}
                    </div>
                  </div>
                )
              }

              return null
            })}
          {filters.length > 0 && (
            <div className="flex items-center justify-between border-t px-2 py-1.5">
              <span className="text-xs text-muted-foreground">
                {filters.length} active
              </span>
              <Button type="button" variant="ghost" size="sm" onClick={clear}>
                <RotateCcw data-icon="inline-start" />
                Clear
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
