import type * as React from 'react'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

type NameSuggestionInputProps = Omit<React.ComponentProps<typeof Input>, 'value' | 'onChange'> & {
  value: string
  onValueChange: (value: string) => void
}

function titleCase(value: string): string {
  return value
    .toLocaleLowerCase()
    .replace(
      /(^|[\s'-])([\p{L}])/gu,
      (_, boundary: string, letter: string) => `${boundary}${letter.toLocaleUpperCase()}`
    )
}

function suggestedName(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || !/[\p{L}]/u.test(trimmed)) return null

  const isAllUppercase = trimmed === trimmed.toLocaleUpperCase()
  const isAllLowercase = trimmed === trimmed.toLocaleLowerCase()
  if (!isAllUppercase && !isAllLowercase) return null

  const leadingWhitespace = value.match(/^\s*/u)?.[0] ?? ''
  const trailingWhitespace = value.match(/\s*$/u)?.[0] ?? ''
  const suggestion = `${leadingWhitespace}${titleCase(trimmed)}${trailingWhitespace}`
  return suggestion === value ? null : suggestion
}

export function NameSuggestionInput({
  value,
  onValueChange,
  ...props
}: NameSuggestionInputProps): React.JSX.Element {
  const suggestion = suggestedName(value)

  return (
    <div className="flex min-w-0 items-center gap-2">
      <Input
        {...props}
        value={value}
        autoCapitalize="words"
        onChange={(event) => onValueChange(event.target.value)}
      />
      {suggestion && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          aria-label={`Use suggested capitalization: ${suggestion}`}
          onClick={() => onValueChange(suggestion)}
        >
          Title case
        </Button>
      )}
    </div>
  )
}
