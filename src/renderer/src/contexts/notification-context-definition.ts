import * as React from 'react'

import type { NotificationInput } from './notification-types'

export type NotificationContextValue = {
  notify: (input: NotificationInput) => string | number
}

export const NotificationContext = React.createContext<NotificationContextValue | undefined>(
  undefined
)
