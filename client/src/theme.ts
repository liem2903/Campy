import { useState } from 'react'

export type Theme = 'light' | 'dark'

const STORAGE_KEY = 'campi.theme'

function savedTheme(): Theme | null {
  try {
    const value = localStorage.getItem(STORAGE_KEY)
    return value === 'light' || value === 'dark' ? value : null
  } catch {
    return null
  }
}

function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

// Called before the first render so a saved theme applies without a flash.
export function applySavedTheme() {
  const theme = savedTheme()
  if (theme) document.documentElement.dataset.theme = theme
}

export function useTheme() {
  const [theme, setTheme] = useState<Theme>(() => savedTheme() ?? systemTheme())

  function toggleTheme() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    document.documentElement.dataset.theme = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Storage unavailable: the choice lasts until reload.
    }
    setTheme(next)
  }

  return { theme, toggleTheme }
}
