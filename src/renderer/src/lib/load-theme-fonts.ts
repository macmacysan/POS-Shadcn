const FONT_TOKENS = ['--font-sans', '--font-serif', '--font-mono'] as const
const GENERIC_FONTS = new Set(['sans-serif', 'serif', 'monospace', 'cursive', 'fantasy', 'system-ui'])
const FONT_NAME = /^[a-z][a-z0-9 -]{0,63}$/i
const debug = (...message: unknown[]): void => {
  if (import.meta.env.DEV) console.info('[theme-font]', ...message)
}

export function loadThemeFonts(): void {
  for (const token of FONT_TOKENS) {
    const font = getComputedStyle(document.documentElement)
      .getPropertyValue(token)
      .split(',')[0]
      .trim()
      .replaceAll(/["']/g, '')

    if (!FONT_NAME.test(font) || GENERIC_FONTS.has(font.toLowerCase())) {
      debug('skipped', token, font || '(empty)')
      continue
    }

    const id = `theme-font-${font.toLowerCase().replaceAll(' ', '-')}`
    if (document.getElementById(id)) {
      debug('already requested', font)
      continue
    }

    const link = document.createElement('link')
    link.id = id
    link.rel = 'stylesheet'
    link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(font)}&display=swap`
    link.onload = () => {
      void document.fonts.load(`1em "${font}"`).then(() => debug('loaded', font))
    }
    link.onerror = () => console.error('[theme-font] failed to load', font, link.href)
    debug('requesting', font, link.href)
    document.head.append(link)
  }
}
