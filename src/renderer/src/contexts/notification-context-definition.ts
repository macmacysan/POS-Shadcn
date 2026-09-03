import * as React from 'react'

import type { NotificationInput, NotificationRecord } from './notification-types'

export type NotificationContextValue = {
  notify: (input: NotificationInput) => string | number
  notifications: readonly NotificationRecord[]
  markAllRead: () => void
}

export const NotificationContext = React.createContext<NotificationContextValue | undefined>(
  undefined
)
