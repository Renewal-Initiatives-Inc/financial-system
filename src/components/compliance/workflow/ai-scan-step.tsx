'use client'

import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Loader2 } from 'lucide-react'
import type { Citation } from '@/lib/compliance/workflow-types'

interface AIScanStepProps {
  scanContent: string | null
  citations: Citation[]
  isLoading: boolean
  isAcknowledged: boolean
  onAcknowledge: () => void
  isSubmitting: boolean
}

export function AIScanStep({
  scanContent,
  citations,
  isLoading,
  isAcknowledged,
  onAcknowledge,
  isSubmitting,
}: AIScanStepProps) {
  return (
    <div data-testid="workflow-scan-step" className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review the AI-generated compliance brief below before proceeding.
      </p>

      {isLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-4/5" />
          <Skeleton className="h-4 w-full" />
        </div>
      ) : scanContent ? (
        <div className="rounded-md border p-4 space-y-3 text-sm bg-muted/30">
          {scanContent.split('\n').filter(Boolean).map((para, i) => (
            <p key={i}>{para}</p>
          ))}
        </div>
      ) : null}

      {citations.length > 0 && (
        <div className="space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Citations
          </p>
          <ul className="space-y-1">
            {citations.map((cite, i) => (
              <li key={i} className="text-sm">
                {cite.url ? (
                  <a
                    href={cite.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline"
                  >
                    {cite.label}
                  </a>
                ) : (
                  cite.label
                )}
              </li>
            ))}
          </ul>
        </div>
      )}

      <div>
        {isAcknowledged ? (
          <Badge variant="secondary" className="gap-1">
            <CheckCircle className="h-3 w-3" />
            Reviewed
          </Badge>
        ) : (
          <Button
            data-testid="workflow-scan-acknowledge-btn"
            onClick={onAcknowledge}
            disabled={isLoading || isSubmitting || isAcknowledged}
            className="w-full"
          >
            {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            I&apos;ve reviewed these recommendations — Continue
          </Button>
        )}
      </div>
    </div>
  )
}
