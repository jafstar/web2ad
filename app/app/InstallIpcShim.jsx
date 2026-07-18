'use client'

import { useEffect } from 'react'
import { installIpcShim } from '../../lib/ipcShim'

// Rendered as a sibling BEFORE {children} in layout.js — React fires
// effects in tree order, so this runs before any ported component's own
// effects that call window.ipc.invoke(...).
export default function InstallIpcShim() {
  useEffect(() => {
    installIpcShim()
  }, [])
  return null
}
