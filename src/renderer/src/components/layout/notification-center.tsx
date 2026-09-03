import { Bell, CheckCheck } from 'lucide-react'

import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Progress, ProgressLabel, ProgressValue } from '@/components/ui/progress'
import {
  Popover,
  PopoverContent,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger
} from '@/components/ui/popover'
import { useNotifications } from '@/hooks/use-notifications'

export function NotificationCenter(): React.JSX.Element {
  const { notifications, markAllRead } = useNotifications()
  const unreadCount = notifications.filter((item) => !item.read).length

  return (
    <Popover onOpenChange={(open) => open && markAllRead()}>
      <PopoverTrigger
        render={
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="relative text-muted-foreground hover:text-foreground"
            aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ''}`}
          />
        }
      >
        <Bell aria-hidden="true" className="size-4" />
        {unreadCount > 0 && (
          <Badge className="absolute -right-1 -top-1 min-w-4 justify-center rounded-full px-1 py-0 text-[10px] leading-4">
            {unreadCount > 99 ? '99+' : unreadCount}
          </Badge>
        )}
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <PopoverHeader className="flex items-center justify-between border-b px-4 py-3">
          <PopoverTitle>Notifications</PopoverTitle>
          <Button type="button" variant="ghost" size="sm" onClick={markAllRead}>
            <CheckCheck data-icon="inline-start" />
            Mark read
          </Button>
        </PopoverHeader>
        <div className="max-h-96 overflow-y-auto">
          {notifications.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">
              No notifications yet.
            </p>
          ) : (
            notifications.map((item) => (
              <div key={item.id} className="border-b px-4 py-3 last:border-b-0">
                <div className="flex items-start gap-2">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      item.type === 'error'
                        ? 'bg-destructive'
                        : item.type === 'warning'
                          ? 'bg-amber-500'
                          : item.type === 'success'
                            ? 'bg-emerald-500'
                            : 'bg-blue-500'
                    }`}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{item.title}</p>
                    {item.description && (
                      <p className="mt-0.5 text-xs text-muted-foreground">{item.description}</p>
                    )}
                    {item.progress && (
                      <Progress
                        value={item.progress.value}
                        aria-label="Update download progress"
                        className="mt-2"
                      >
                        <ProgressLabel className="sr-only">Update download progress</ProgressLabel>
                        <ProgressValue>{() => item.progress?.label}</ProgressValue>
                      </Progress>
                    )}
                    {(item.cancel || item.action) && (
                      <div className="mt-3 flex justify-end gap-2">
                        {item.cancel && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={item.cancel.onClick}
                          >
                            {item.cancel.label}
                          </Button>
                        )}
                        {item.action && (
                          <Button type="button" size="sm" onClick={item.action.onClick}>
                            {item.action.label}
                          </Button>
                        )}
                      </div>
                    )}
                    <p className="mt-1 text-[11px] text-muted-foreground">
                      {new Date(item.createdAt).toLocaleTimeString([], {
                        hour: 'numeric',
                        minute: '2-digit'
                      })}
                    </p>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  )
}
