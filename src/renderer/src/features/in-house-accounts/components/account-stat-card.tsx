import * as React from 'react'

import { Card, CardContent } from '@/components/ui/card'

export function InHouseAccountStatCard({
  label,
  value
}: {
  readonly label: string
  readonly value: React.ReactNode
}): React.JSX.Element {
  return (
    <Card className="min-h-14 rounded-md">
      <CardContent className="flex h-14 flex-col justify-center px-3 py-2">
        <p className="truncate text-xs text-muted-foreground">{label}</p>
        <p className="truncate text-lg font-semibold tabular-nums">{value}</p>
      </CardContent>
    </Card>
  )
}
