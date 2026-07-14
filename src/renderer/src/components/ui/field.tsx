import { cn } from '@/lib/utils'

function FieldGroup({ className, ...props }: React.ComponentProps<'div'>): React.JSX.Element {
  return <div className={cn('flex w-full flex-col gap-5', className)} {...props} />
}

function Field({
  className,
  ...props
}: React.ComponentProps<'div'> & { 'data-invalid'?: boolean }): React.JSX.Element {
  return (
    <div
      role="group"
      className={cn('flex w-full flex-col gap-2 data-[invalid=true]:text-destructive', className)}
      {...props}
    />
  )
}

function FieldLabel({ className, ...props }: React.ComponentProps<'label'>): React.JSX.Element {
  return <label className={cn('text-sm font-medium leading-none', className)} {...props} />
}

function FieldError({ className, ...props }: React.ComponentProps<'p'>): React.JSX.Element {
  return (
    <p role="alert" className={cn('text-sm font-normal text-destructive', className)} {...props} />
  )
}

export { Field, FieldError, FieldGroup, FieldLabel }
