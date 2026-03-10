'use client'

import { Button } from '@/components/ui/button'
import { CheckCircle, Download, RotateCcw } from 'lucide-react'

interface DeliveryStepProps {
  artifactUrl: string | null
  fileName: string | null
  deliveredAt: string | null
  onStartOver?: () => void
}

export function DeliveryStep({
  artifactUrl,
  fileName,
  deliveredAt,
  onStartOver,
}: DeliveryStepProps) {
  const formattedDate = deliveredAt
    ? new Date(deliveredAt).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
      })
    : null

  return (
    <div data-testid="workflow-delivery-step" className="space-y-4 text-center py-4">
      <div className="flex justify-center">
        <CheckCircle className="h-12 w-12 text-green-500" />
      </div>
      <div>
        <h3 className="font-semibold text-lg">Workflow Complete</h3>
        <p className="text-sm text-muted-foreground mt-1">Your artifact has been saved.</p>
      </div>

      {fileName && (
        <div className="text-sm text-muted-foreground">
          <p className="font-medium text-foreground">{fileName}</p>
          <p>Saved to compliance archive</p>
          {formattedDate && <p className="mt-1">Delivered {formattedDate}</p>}
        </div>
      )}

      {artifactUrl && fileName && (
        <Button
          data-testid="workflow-delivery-download-btn"
          variant="outline"
          asChild
        >
          <a href={artifactUrl} download={fileName}>
            <Download className="mr-2 h-4 w-4" />
            Download
          </a>
        </Button>
      )}

      {onStartOver && (
        <div>
          <Button variant="ghost" size="sm" onClick={onStartOver}>
            <RotateCcw className="mr-2 h-4 w-4" />
            Start Over
          </Button>
        </div>
      )}
    </div>
  )
}
