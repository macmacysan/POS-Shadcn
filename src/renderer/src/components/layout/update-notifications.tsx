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

export function UpdateNotifications(): null {
  const { notify } = useNotifications()
  const { state, activeAction, isRequesting, checkForUpdates, downloadUpdate, installUpdate } =
    useUpdater()

  React.useEffect(() => {
    if (!state) return

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

    if (state.type === 'error' && activeAction) {
      const checking = activeAction === 'check'
      const downloading = activeAction === 'download'
      notify({
        id: UPDATE_NOTIFICATION_ID,
        type: 'error',
        title: checking
          ? 'Unable to check for updates.'
          : downloading
            ? 'Unable to download update.'
            : 'Unable to install update.',
        description: 'Check your internet connection and try again.',
        action: {
          label: 'Retry',
          onClick: () =>
            void (checking ? checkForUpdates() : downloading ? downloadUpdate() : installUpdate())
        }
      })
    }
  }, [activeAction, checkForUpdates, downloadUpdate, installUpdate, isRequesting, notify, state])

  return null
}
