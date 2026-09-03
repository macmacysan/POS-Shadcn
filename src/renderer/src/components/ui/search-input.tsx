import * as React from 'react'

import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'

export function SearchInput({ className, ...props }: React.ComponentProps<typeof Input>): React.JSX.Element {
  return <Input {...props} className={cn('pl-8 placeholder:text-muted-foreground', className)} />
}
