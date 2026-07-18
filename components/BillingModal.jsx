'use client'

import React from 'react'
import { Dialog, DialogHeader } from '@astryxdesign/core/Dialog'
import { VStack } from '@astryxdesign/core/VStack'
import { HStack } from '@astryxdesign/core/HStack'
import { Text } from '@astryxdesign/core/Text'
import { Button } from '@astryxdesign/core/Button'
import { Banner } from '@astryxdesign/core/Banner'
import { PACKS } from '../lib/packs'

// Real credit-purchase flow — was in the original flat GenerateApp.jsx
// before that got replaced by the full DesignPipe port (which has no
// billing concept at all, BYOK). Genstock genuinely needs this somewhere;
// the Account menu's Billing item is that place now.
export default function BillingModal({ isOpen, onOpenChange }) {
  const [balance, setBalance] = React.useState(null)
  const [error, setError] = React.useState(null)

  React.useEffect(() => {
    if (!isOpen) return
    setError(null)
    fetch('/api/credits/check?cost=0')
      .then((r) => r.json())
      .then((d) => setBalance(d.balance))
      .catch((e) => setError(e.message))
  }, [isOpen])

  const buyPack = async (pack) => {
    setError(null)
    try {
      const res = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pack }),
      })
      const data = await res.json()
      if (data.url) window.location.href = data.url
      else setError(data.error || 'Could not start checkout')
    } catch (e) {
      setError(e.message)
    }
  }

  return (
    <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" width={420}>
      <DialogHeader title="Billing" onOpenChange={onOpenChange} />
      <VStack gap={4}>
        <VStack gap={1}>
          <Text type="label">Credit balance</Text>
          <Text type="body">{balance === null ? 'Loading…' : `${balance} credit${balance === 1 ? '' : 's'}`}</Text>
        </VStack>

        <VStack gap={2}>
          <Text type="label">Buy more</Text>
          {Object.values(PACKS).map((p) => (
            <HStack key={p.label} justify="between" align="center">
              <Text type="body">{p.label} — {p.credits} credits</Text>
              <Button label="Buy" variant="secondary" size="sm" onClick={() => buyPack(p.label)} />
            </HStack>
          ))}
        </VStack>

        {error && <Banner status="error" title="Billing error" description={error} isDismissable />}
      </VStack>
    </Dialog>
  )
}
