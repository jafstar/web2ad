'use client'

import React from 'react'

// Real shared hook, identical in both apps per Mayor's call — DesignPipe's
// main.js stubs credits:check as always { ok: true, unlimited: true }
// (BYOK, no ceiling); genstock-web's ipc shim calls the real balance
// check. Component code (GenerateVariations' button state) never needs
// to know which one it's running against.
export function useCreditsCheck(cost) {
  const [state, setState] = React.useState({ ok: true, unlimited: true, balance: null, loading: true })

  React.useEffect(() => {
    let cancelled = false
    setState((s) => ({ ...s, loading: true }))
    window.ipc.invoke('credits:check', cost).then((result) => {
      if (!cancelled) setState({ ...result, loading: false })
    }).catch(() => {
      if (!cancelled) setState({ ok: true, unlimited: true, balance: null, loading: false })
    })
    return () => { cancelled = true }
  }, [cost])

  return state
}
