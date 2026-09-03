import * as React from 'react'
import { toast } from 'sonner'

import { NotificationContext } from './notification-context-definition'
import type { NotificationInput, NotificationRecord, NotificationType } from './notification-types'

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
  const [notifications, setNotifications] = React.useState<NotificationRecord[]>([])
  const sequence = React.useRef(0)
  const notify = React.useCallback((input: NotificationInput): string | number => {
    const id = `notification-${Date.now()}-${sequence.current++}`
    const options = {
      id: input.id ?? id,
      description: input.description,
      duration: durations[input.type],
      closeButton: true
    }

    setNotifications((current) => [
      { ...input, id, createdAt: Date.now(), read: false },
      ...current
    ].slice(0, 100))
    return toast[input.type](input.title, options)
  }, [])

  React.useEffect(() => {
    const onError = (event: ErrorEvent): void => {
      notify({ type: 'error', title: 'Application error', description: event.message })
    }
    const onRejection = (event: PromiseRejectionEvent): void => {
      const reason = event.reason instanceof Error ? event.reason.message : String(event.reason)
      notify({ type: 'error', title: 'Unexpected error', description: reason })
    }
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [notify])

  const markAllRead = React.useCallback(() => {
    setNotifications((current) => current.map((item) => ({ ...item, read: true })))
  }, [])

  return <NotificationContext.Provider value={{ notify, notifications, markAllRead }}>
    {children}
  </NotificationContext.Provider>
}
