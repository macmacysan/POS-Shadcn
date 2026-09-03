export type NotificationType = 'success' | 'error' | 'warning' | 'info'

export type NotificationInput = {
  type: NotificationType
  title: string
  description?: string
  id?: string
}

export type NotificationRecord = NotificationInput & {
  id: string
  createdAt: number
  read: boolean
}
