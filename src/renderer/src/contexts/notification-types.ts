export type NotificationAction = {
  label: string
  onClick: () => void
}

export type NotificationProgress = {
  value: number
  label: string
}

export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export type NotificationInput = {
  type: NotificationType
  title: string
  description?: string
  id?: string
  action?: NotificationAction
  cancel?: NotificationAction
  progress?: NotificationProgress
  duration?: number
}

export type NotificationRecord = NotificationInput & {
  id: string
  createdAt: number
  read: boolean
}
