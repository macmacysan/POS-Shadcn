import * as React from 'react'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/utils'

type KpiCardProps = {
  readonly label: string
  readonly value: string
  readonly emphasis?: boolean
  readonly className?: string
}

export function KpiCard({
  label,
  value,
  emphasis = false,
  className
}: KpiCardProps): React.JSX.Element {
  return (
    <Card
      className={cn(
        'h-full min-w-0 rounded-md border-border/70 bg-muted/30 py-0 shadow-none',
        emphasis && 'border-primary bg-primary text-primary-foreground',
        className
      )}
    >
      <CardHeader className="gap-0 px-3 pb-0 pt-2.5">
        <CardTitle
          className={cn(
            'truncate text-[11px] font-medium uppercase leading-none tracking-wide text-muted-foreground',
            emphasis && 'text-primary-foreground/80'
          )}
        >
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-3 pb-2.5 pt-0">
        <p className="truncate text-lg font-semibold leading-none tracking-tight tabular-nums">
          {value}
        </p>
      </CardContent>
    </Card>
  )
}
