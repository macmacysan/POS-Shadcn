import * as React from 'react'

import { useNotifications } from '@/hooks/use-notifications'
import { useUpdater } from '@/hooks/use-updater'

const UPDATE_NOTIFICATION_ID = 'application-update'

function formatBytes(bytes: number): string {
  if (bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const unit = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  return `${(bytes / 1024 ** unit).toFixed(unit === 0 ? 0 : 1)} ${units[unit]}`
}

export function UpdateNotifications(): React.JSX.Element | null {
  const { notify } = useNotifications()
  const { state, activeAction, isRequesting, checkForUpdates, downloadUpdate, installUpdate } =
    useUpdater()
  const displayedErrorState = React.useRef<typeof state>(null)

  React.useEffect(() => {
    if (!state) return
    if (state.type !== 'error') displayedErrorState.current = null

    if (state.type === 'checking') {
      notify({
        id: UPDATE_NOTIFICATION_ID,
        type: 'info',
        title: 'Checking for updates',
        description: 'Looking for a newer version.',
        duration: 3_000
      })
      return
    }

    if (state.type === 'update-not-available') {
      notify({
        id: UPDATE_NOTIFICATION_ID,
        type: 'success',
        title: 'You’re up to date',
        description: `Cashiers Report ${state.currentVersion} is the latest version.`,
        duration: 3_000
      })
      return
    }

    if (state.type === 'update-available') {
      notify({
        id: UPDATE_NOTIFICATION_ID,
        type: 'info',
        title: 'Update available',
        description: `Cashiers Report ${state.availableVersion} is available.`,
        action: { label: 'Download update', onClick: () => void downloadUpdate() },
        duration: Infinity
      })
      return
    }

    if (state.type === 'download-progress') {
      const percent = Math.floor(state.percent)
      const size = state.totalBytes
        ? `${formatBytes(state.transferredBytes)} / ${formatBytes(state.totalBytes)}`
        : formatBytes(state.transferredBytes)
      notify({
        id: UPDATE_NOTIFICATION_ID,
        type: 'info',
        title: 'Downloading update',
        description: `Cashiers Report ${state.availableVersion}`,
        progress: { value: state.percent, label: `${percent}% · ${size}` },
        duration: Infinity
      })
      return
    }

    if (state.type === 'update-downloaded') {
      if (activeAction === 'install' && isRequesting) {
        notify({
          id: UPDATE_NOTIFICATION_ID,
          type: 'info',
          title: 'Installing update',
          description: 'Cashiers Report will restart shortly.',
          duration: Infinity
        })
        return
      }
      notify({
        id: UPDATE_NOTIFICATION_ID,
        type: 'success',
        title: 'Update ready',
        description: `Cashiers Report ${state.availableVersion} is ready to install.`,
        cancel: { label: 'Later', onClick: () => undefined },
        action: { label: 'Update & Restart', onClick: () => void installUpdate() },
        duration: Infinity
      })
      return
    }

    if (state.type === 'error') {
      if (displayedErrorState.current === state) return
      displayedErrorState.current = state
      const checking = activeAction === 'check'
      const downloading = activeAction === 'download'
      const retry = checking
        ? checkForUpdates
        : downloading
          ? downloadUpdate
          : activeAction === 'install'
            ? installUpdate
            : checkForUpdates
      notify({
        id: UPDATE_NOTIFICATION_ID,
        type: 'error',
        title: 'Update failed',
        description: state.message,
        action: {
          label: 'Try again',
          onClick: () => void retry()
        }
      })
    }
  }, [activeAction, checkForUpdates, downloadUpdate, installUpdate, isRequesting, notify, state])

  return null
}
