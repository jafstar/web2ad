'use client'

import { useEffect } from 'react'

// Astryx's dark mode activates via html[data-theme="dark"] (theme-neutral/
// dist/theme.css). designpipe-app forces this at the Electron level
// (nativeTheme.themeSource = 'dark'); the web equivalent is setting the
// attribute directly. Scoped to the /app subtree only — cleans up on
// unmount so navigating back to the black/white landing page isn't stuck
// dark.
export default function ForceDarkTheme() {
  useEffect(() => {
    document.documentElement.setAttribute('data-theme', 'dark')
    return () => document.documentElement.removeAttribute('data-theme')
  }, [])
  return null
}
