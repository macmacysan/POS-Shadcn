import * as React from 'react'

import { NotificationContext } from '@/contexts/notification-context-definition'
import type { NotificationContextValue } from '@/contexts/notification-context-definition'

export function useNotifications(): NotificationContextValue {
  const context = React.useContext(NotificationContext)
  if (!context) throw new Error('useNotifications must be used within a NotificationProvider')
  return context
}
