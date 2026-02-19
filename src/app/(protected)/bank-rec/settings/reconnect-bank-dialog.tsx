'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { usePlaidLink } from 'react-plaid-link'
import { getUpdateLinkToken } from './actions'
import { toast } from 'sonner'

interface ReconnectBankDialogProps {
  bankAccountId: number | null
  onClose: () => void
  userId: string
}

export function ReconnectBankDialog({
  bankAccountId,
  onClose,
  userId,
}: ReconnectBankDialogProps) {
  const [linkToken, setLinkToken] = useState<string | null>(null)
  const fetchedForId = useRef<number | null>(null)

  const onSuccess = useCallback(() => {
    toast.success('Bank connection restored')
    onClose()
  }, [onClose])

  const onExit = useCallback(() => {
    onClose()
  }, [onClose])

  const { open, ready } = usePlaidLink({
    token: linkToken,
    onSuccess,
    onExit,
  })

  // Fetch update link token when bankAccountId changes
  useEffect(() => {
    if (!bankAccountId || fetchedForId.current === bankAccountId) return
    fetchedForId.current = bankAccountId

    let cancelled = false
    ;(async () => {
      try {
        const token = await getUpdateLinkToken(bankAccountId, userId)
        if (!cancelled) setLinkToken(token)
      } catch (err) {
        if (!cancelled) {
          toast.error(
            err instanceof Error ? err.message : 'Failed to start reconnection'
          )
          onClose()
        }
      }
    })()

    return () => {
      cancelled = true
    }
  }, [bankAccountId, userId, onClose])

  // Reset when dialog closes
  useEffect(() => {
    if (!bankAccountId) {
      fetchedForId.current = null
    }
  }, [bankAccountId])

  // Open Plaid Link as soon as token + SDK are ready
  useEffect(() => {
    if (linkToken && ready) {
      open()
    }
  }, [linkToken, ready, open])

  // This component renders nothing — Plaid Link is a modal overlay
  return null
}
