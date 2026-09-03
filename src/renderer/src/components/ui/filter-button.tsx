import * as React from 'react'
import { ListFilter } from 'lucide-react'

import { Button } from '@/components/ui/button'

export function FilterButton(props: React.ComponentProps<typeof Button>): React.JSX.Element {
  return (
    <Button type="button" variant="outline" size="sm" {...props}>
      <ListFilter data-icon="inline-start" aria-hidden="true" />
      {props.children ?? 'Filter'}
    </Button>
  )
}
