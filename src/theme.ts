import { useEffect, useState } from 'react'

export type ResolvedTheme = 'light' | 'dark'

function readTheme(): ResolvedTheme {
  const attr = document.documentElement.dataset.theme
  if (attr === 'light' || attr === 'dark') return attr
  if (typeof window !== 'undefined' && window.matchMedia) {
    return window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light'
  }
  return 'light'
}

/**
 * Charts render with literal JS color values, not CSS custom properties, so
 * they need to know the resolved theme directly rather than inheriting it
 * from CSS. This observes both the explicit `data-theme` toggle and the OS
 * `prefers-color-scheme` fallback so chart colors stay in sync with the rest
 * of the app.
 */
export function useTheme(): ResolvedTheme {
  const [theme, setTheme] = useState<ResolvedTheme>(() =>
    typeof document === 'undefined' ? 'light' : readTheme(),
  )

  useEffect(() => {
    const update = () => setTheme(readTheme())
    update()

    const observer = new MutationObserver(update)
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme'],
    })

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    media.addEventListener('change', update)

    return () => {
      observer.disconnect()
      media.removeEventListener('change', update)
    }
  }, [])

  return theme
}
