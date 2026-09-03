import * as React from 'react'

import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle
} from '@/components/ui/sheet'
import { cn } from '@/lib/utils'

const widthClasses = {
  narrow: 'sm:max-w-md',
  default: 'sm:max-w-lg',
  wide: 'sm:max-w-2xl'
} as const

type TaskSheetWidth = keyof typeof widthClasses

type TaskSheetProps = Omit<React.ComponentProps<typeof Sheet>, 'children'> & {
  title: React.ReactNode
  description?: React.ReactNode
  children: React.ReactNode
  footer?: React.ReactNode
  width?: TaskSheetWidth
  bodyClassName?: string
}

function TaskSheet({
  title,
  description,
  children,
  footer,
  width = 'default',
  bodyClassName,
  ...sheetProps
}: TaskSheetProps): React.JSX.Element {
  return (
    <Sheet {...sheetProps}>
      <SheetContent
        side="right"
        className={cn('w-full gap-0 overflow-hidden p-0', widthClasses[width])}
      >
        <SheetHeader className="shrink-0 border-b pr-12">
          <SheetTitle>{title}</SheetTitle>
          {description ? <SheetDescription>{description}</SheetDescription> : null}
        </SheetHeader>
        <div className={cn('min-h-0 flex-1 overflow-y-auto p-4', bodyClassName)}>{children}</div>
        {footer ? (
          <SheetFooter className="shrink-0 flex-row justify-end border-t">{footer}</SheetFooter>
        ) : null}
      </SheetContent>
    </Sheet>
  )
}

export { TaskSheet }
export type { TaskSheetProps, TaskSheetWidth }
