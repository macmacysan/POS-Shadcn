import * as React from 'react'

import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList
} from '@/components/ui/combobox'
import type { ProductCatalogItem } from '../../../../shared/contracts'

type ProductComboboxProps = {
  readonly id: string
  readonly value: string
  readonly items: readonly ProductCatalogItem[]
  readonly onChange: (item: ProductCatalogItem) => void
}

export function ProductCombobox({ id, value, items, onChange }: ProductComboboxProps): React.JSX.Element {
  const selected = items.find((item) => item.description === value) ?? null
  return (
    <Combobox
      items={items}
      itemToStringLabel={(item) => item.description}
      itemToStringValue={(item) => item.description}
      value={selected}
      autoHighlight
      onValueChange={(item) => item && onChange(item)}
    >
      <ComboboxInput id={id} placeholder="Search products..." showClear />
      <ComboboxContent>
        <ComboboxEmpty>No products found.</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.description} value={item}>
              {item.description}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  )
}