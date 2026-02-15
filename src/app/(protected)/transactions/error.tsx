'use client'

import { useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AlertTriangle } from 'lucide-react'

export default function TransactionsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('Transactions error:', error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-4">
      <div className="mx-auto max-w-md text-center space-y-4">
        <AlertTriangle className="mx-auto h-12 w-12 text-destructive" />
        <h1 className="text-2xl font-semibold">Error loading transactions</h1>
        <p className="text-muted-foreground">
          Could not load transaction data. This may be a temporary issue.
        </p>
        <div className="flex justify-center gap-2">
          <Button onClick={reset} data-testid="transactions-error-try-again-btn">Try Again</Button>
          <Button variant="outline" asChild data-testid="transactions-error-dashboard-btn">
            <Link href="/">Dashboard</Link>
          </Button>
        </div>
      </div>
    </div>
  )
}
