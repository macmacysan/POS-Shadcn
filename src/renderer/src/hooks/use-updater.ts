import * as React from 'react'

import type { UpdateState } from '@/../../shared/contracts'

type UpdaterAction = 'check' | 'download' | 'install'

export function useUpdater(): {
  state: UpdateState | null
  activeAction: UpdaterAction | undefined
  isRequesting: boolean
  checkForUpdates: () => Promise<void>
  downloadUpdate: () => Promise<void>
  installUpdate: () => Promise<void>
} {
  const [state, setState] = React.useState<UpdateState | null>(null)
  const [activeAction, setActiveAction] = React.useState<UpdaterAction>()
  const [isRequesting, setIsRequesting] = React.useState(false)

  React.useEffect(() => {
    let active = true
    const unsubscribe = window.api.updater.onStateChange((nextState) => {
      if (active) setState(nextState)
    })
    void window.api.updater
      .getState()
      .then((nextState) => {
        if (active) setState(nextState)
      })
      .catch(() => undefined)

    return () => {
      active = false
      unsubscribe()
    }
  }, [])

  const invoke = React.useCallback(
    async (action: UpdaterAction): Promise<void> => {
      if (isRequesting) return
      setActiveAction(action)
      setIsRequesting(true)
      try {
        if (action === 'check') await window.api.updater.checkForUpdates()
        else if (action === 'download') await window.api.updater.downloadUpdate()
        else await window.api.updater.installUpdate()
      } catch {
        // The main process publishes user-safe updater errors when it is available.
      } finally {
        if (action !== 'install') setIsRequesting(false)
      }
    },
    [isRequesting]
  )

  return {
    state,
    activeAction,
    isRequesting,
    checkForUpdates: () => invoke('check'),
    downloadUpdate: () => invoke('download'),
    installUpdate: () => invoke('install')
  }
}
