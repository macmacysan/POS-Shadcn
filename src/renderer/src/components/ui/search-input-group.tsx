import { Search as SearchIcon } from 'lucide-react'
import type * as React from 'react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
import { cn } from '@/lib/utils'

export function SearchInputGroup({
  className,
  ...props
}: React.ComponentProps<typeof InputGroupInput>): React.JSX.Element {
  return (
    <InputGroup className={cn('max-w-sm', className)}>
      <InputGroupAddon align="inline-start" className="pl-2">
        <InputGroupText>
          <SearchIcon aria-hidden="true" />
        </InputGroupText>
      </InputGroupAddon>
      <InputGroupInput {...props} type="search" />
    </InputGroup>
  )
}
