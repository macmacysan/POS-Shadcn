import * as React from 'react'
import { toast } from 'sonner'

import { NotificationContext } from './notification-context-definition'
import type { NotificationInput, NotificationType } from './notification-types'

const durations: Record<NotificationType, number> = {
  success: 3000,
  info: 3000,
  warning: 6000,
  error: 6000
}

export function NotificationProvider({
  children
}: {
  children: React.ReactNode
}): React.JSX.Element {
  const notify = React.useCallback((input: NotificationInput): string | number => {
    const options = {
      id: input.id ?? `${input.type}:${input.title}:${input.description ?? ''}`,
      description: input.description,
      duration: durations[input.type],
      closeButton: true
    }

    return toast[input.type](input.title, options)
  }, [])

  return <NotificationContext.Provider value={{ notify }}>{children}</NotificationContext.Provider>
}
