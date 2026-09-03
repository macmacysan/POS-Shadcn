'use client'

import * as React from 'react'
import { format, isValid, parse } from 'date-fns'
import { CalendarIcon } from 'lucide-react'

import { Calendar } from '@/components/ui/calendar'
import { InputGroup, InputGroupAddon, InputGroupButton, InputGroupInput } from '@/components/ui/input-group'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

type DatePickerInputProps = {
  id?: string
  value?: string
  defaultValue?: string
  onValueChange?: (value: string) => void
  name?: string
  required?: boolean
  disabled?: boolean
  min?: string
  max?: string
  placeholder?: string
  className?: string
  'aria-invalid'?: boolean
  'aria-label'?: string
}

function parseDate(value?: string): Date | undefined {
  if (!value) return undefined
  const date = parse(value, 'yyyy-MM-dd', new Date())
  return isValid(date) && format(date, 'yyyy-MM-dd') === value ? date : undefined
}

function parseInputDate(value: string): Date | undefined {
  return parseDate(value) ?? (() => {
    const date = parse(value, 'MMMM dd, yyyy', new Date())
    return isValid(date) ? date : undefined
  })()
}

function formatDate(date?: Date): string {
  return date ? format(date, 'MMMM dd, yyyy') : ''
}

export function DatePickerInput({
  id,
  value,
  defaultValue,
  onValueChange,
  name,
  required,
  disabled,
  min,
  max,
  placeholder = 'Select date',
  className,
  'aria-invalid': ariaInvalid,
  'aria-label': ariaLabel
}: DatePickerInputProps): React.JSX.Element {
  const controlled = value !== undefined
  const [internalValue, setInternalValue] = React.useState(defaultValue ?? '')
  const dateValue = controlled ? value : internalValue
  const selectedDate = parseDate(dateValue)
  const [inputValue, setInputValue] = React.useState(() => formatDate(selectedDate))
  const [month, setMonth] = React.useState<Date | undefined>(selectedDate)
  const [open, setOpen] = React.useState(false)
  const inputRef = React.useRef<HTMLInputElement>(null)

  React.useEffect(() => {
    setInputValue(formatDate(selectedDate))
    setMonth(selectedDate)
  }, [dateValue])

  const updateValue = React.useCallback(
    (nextDate?: Date) => {
      const nextValue = nextDate ? format(nextDate, 'yyyy-MM-dd') : ''
      if (!controlled) setInternalValue(nextValue)
      onValueChange?.(nextValue)
    },
    [controlled, onValueChange]
  )

  const setValidity = React.useCallback((nextValue: string) => {
    const valid = !nextValue || Boolean(parseInputDate(nextValue))
    inputRef.current?.setCustomValidity(valid ? '' : 'Enter a valid date.')
    return valid
  }, [])

  const minDate = parseDate(min)
  const maxDate = parseDate(max)
  const disabledDates = React.useMemo(
    () =>
      [minDate && { before: minDate }, maxDate && { after: maxDate }].filter(
        Boolean
      ) as Array<{ before: Date } | { after: Date }>,
    [minDate, maxDate]
  )

  return (
    <>
      {name && <input type="hidden" name={name} value={dateValue} />}
      <InputGroup className={className}>
        <InputGroupInput
          ref={inputRef}
          id={id}
          value={inputValue}
          required={required}
          disabled={disabled}
          placeholder={placeholder}
          aria-invalid={ariaInvalid}
          aria-label={ariaLabel}
          onChange={(event) => {
            const nextInput = event.target.value
            setInputValue(nextInput)
            const parsed = parseInputDate(nextInput)
            setValidity(nextInput)
            if (parsed) {
              setMonth(parsed)
              updateValue(parsed)
            }
          }}
          onBlur={() => {
            const parsed = parseInputDate(inputValue)
            if (setValidity(inputValue)) setInputValue(formatDate(parsed))
          }}
          onKeyDown={(event) => {
            if (event.key === 'ArrowDown') {
              event.preventDefault()
              setOpen(true)
            }
          }}
        />
        <InputGroupAddon align="inline-end">
          <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger
              render={
                <InputGroupButton
                  variant="ghost"
                  size="icon-xs"
                  aria-label={ariaLabel ?? 'Select date'}
                  disabled={disabled}
                />
              }
            >
              <CalendarIcon data-icon="inline-end" />
            </PopoverTrigger>
            <PopoverContent className="w-auto overflow-hidden p-0" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                month={month}
                onMonthChange={setMonth}
                disabled={disabledDates}
                onSelect={(nextDate) => {
                  updateValue(nextDate)
                  setInputValue(formatDate(nextDate))
                  setValidity(nextDate ? format(nextDate, 'yyyy-MM-dd') : '')
                  setOpen(false)
                }}
              />
            </PopoverContent>
          </Popover>
        </InputGroupAddon>
      </InputGroup>
    </>
  )
}
