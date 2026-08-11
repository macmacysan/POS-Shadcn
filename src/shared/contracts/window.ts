export const windowIpcChannels = {
  minimize: 'window:minimize',
  toggleMaximize: 'window:toggle-maximize',
  close: 'window:close',
  isMaximized: 'window:is-maximized',
  showSystemMenu: 'window:show-system-menu',
  maximizedChanged: 'window:maximized-changed'
} as const

export type WindowControlsApi = {
  minimize: () => Promise<void>
  toggleMaximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
  showSystemMenu: () => Promise<void>
  onMaximizedChange: (listener: (isMaximized: boolean) => void) => () => void
}
