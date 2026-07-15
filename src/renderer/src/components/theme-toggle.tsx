import { Moon, Sun } from '@phosphor-icons/react'

import { Button } from '@/components/ui/button'

type ThemeToggleProps = {
  isDark: boolean
  onToggle: () => void
}

export function ThemeToggle({ isDark, onToggle }: ThemeToggleProps): React.JSX.Element {
  const label = isDark ? 'Switch to light mode' : 'Switch to dark mode'

  return (
    <Button type="button" variant="outline" size="icon" onClick={onToggle} aria-label={label}>
      {isDark ? <Sun data-icon="inline-start" weight="bold" /> : <Moon data-icon="inline-start" weight="bold" />}
    </Button>
  )
}
