import type * as React from 'react'

import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle
} from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { cn } from '@/lib/utils'

type WorkstationShellProps = React.ComponentProps<'main'> & {
  summary?: React.ReactNode
  summaryClassName?: string
  workspaceClassName?: string
}

/**
 * Keeps a compact supporting summary beside the primary work area. The grid never
 * stacks, so constrained desktop widths preserve access to the active workspace.
 */
export function WorkstationShell({
  summary,
  summaryClassName,
  workspaceClassName,
  className,
  children,
  ...props
}: WorkstationShellProps): React.JSX.Element {
  return (
    <main
      className={cn(
        'grid min-h-0 min-w-0 flex-1 gap-3 overflow-hidden bg-workspace p-3',
        summary ? 'grid-cols-[minmax(14rem,18rem)_minmax(0,1fr)]' : 'grid-cols-1',
        className
      )}
      {...props}
    >
      {summary && (
        <aside className={cn('min-h-0 min-w-0 overflow-hidden', summaryClassName)}>{summary}</aside>
      )}
      <section className={cn('min-h-0 min-w-0 overflow-hidden', workspaceClassName)}>
        {children}
      </section>
    </main>
  )
}

type WorkstationSurfaceProps = Omit<React.ComponentProps<typeof Card>, 'title'> & {
  title: React.ReactNode
  description?: React.ReactNode
  actions?: React.ReactNode
  footer?: React.ReactNode
  contentClassName?: string
}

/**
 * A compact, scroll-safe surface for the active data table or focused workflow.
 */
export function WorkstationSurface({
  title,
  description,
  actions,
  footer,
  contentClassName,
  className,
  children,
  ...props
}: WorkstationSurfaceProps): React.JSX.Element {
  return (
    <Card
      size="sm"
      className={cn(
        'h-full min-h-0 min-w-0 gap-0 overflow-hidden rounded-lg bg-workspace-surface py-0 ring-1 ring-workspace-border',
        className
      )}
      {...props}
    >
      <CardHeader className="min-h-11 gap-0 px-3 py-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {description && <CardDescription className="mt-0.5 text-xs">{description}</CardDescription>}
        {actions && <CardAction className="flex items-center gap-2">{actions}</CardAction>}
      </CardHeader>
      <Separator />
      <CardContent className={cn('min-h-0 min-w-0 flex-1 px-0', contentClassName)}>
        {children}
      </CardContent>
      {footer && (
        <>
          <Separator />
          <CardFooter className="min-h-11 shrink-0 rounded-none bg-workspace-subtle px-3 py-2">
            {footer}
          </CardFooter>
        </>
      )}
    </Card>
  )
}
