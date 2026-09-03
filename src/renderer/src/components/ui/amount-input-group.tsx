import type * as React from 'react'
import { InfoIcon } from 'lucide-react'

import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
  InputGroupText
} from '@/components/ui/input-group'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { formatAmountInput } from '@/lib/currency'
import { cn } from '@/lib/utils'

type AmountInputGroupProps = {
  id: string
  name: string
  defaultValue?: string
  value?: string
  placeholder?: string
  description?: string
  inputClassName?: string
  ariaInvalid?: boolean
  autoFocus?: boolean
  onValueChange?: (value: string) => void
}

export function AmountInputGroup({
  id,
  name,
  defaultValue,
  value,
  placeholder,
  description,
  inputClassName,
  ariaInvalid,
  autoFocus,
  onValueChange
}: AmountInputGroupProps): React.JSX.Element {
  return (
    <InputGroup>
      <InputGroupAddon align="inline-start" className="pr-2">
        <InputGroupText>₱</InputGroupText>
      </InputGroupAddon>
      <InputGroupInput
        id={id}
        name={name}
        type="text"
        inputMode="decimal"
        className={cn('border-border border-x', inputClassName)}
        defaultValue={defaultValue}
        value={value}
        placeholder={placeholder}
        aria-invalid={ariaInvalid}
        autoFocus={autoFocus}
        onChange={(event) => {
          const nextValue = formatAmountInput(event.currentTarget.value)
          event.currentTarget.value = nextValue
          onValueChange?.(nextValue)
        }}
      />
      {description && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger
              render={
                <InputGroupAddon align="inline-end">
                  <InputGroupButton variant="ghost" size="icon-xs">
                    <InfoIcon />
                  </InputGroupButton>
                </InputGroupAddon>
              }
            />
            <TooltipContent side="left">{description}</TooltipContent>
          </Tooltip>
        </TooltipProvider>
      )}
    </InputGroup>
  )
}
