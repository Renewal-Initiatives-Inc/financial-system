'use client'

import { useState } from 'react'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { FileText, Loader2 } from 'lucide-react'

interface DraftStepProps {
  artifactType: 'pdf' | 'docx' | 'csv'
  fileName: string | null
  previewUrl: string | null
  isGenerating: boolean
  isDraftAccepted: boolean
  requiresWarningDialog: boolean
  onAccept: () => void
  isSubmitting: boolean
}

const TYPE_LABELS: Record<string, string> = {
  pdf: 'PDF',
  docx: 'DOCX',
  csv: 'CSV',
}

export function DraftStep({
  artifactType,
  fileName,
  previewUrl,
  isGenerating,
  isDraftAccepted,
  requiresWarningDialog,
  onAccept,
  isSubmitting,
}: DraftStepProps) {
  const [dialogOpen, setDialogOpen] = useState(false)

  function handleAcceptClick() {
    if (requiresWarningDialog) {
      setDialogOpen(true)
    } else {
      onAccept()
    }
  }

  return (
    <div data-testid="workflow-draft-step" className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Review the generated draft before accepting.
      </p>

      {isGenerating ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-md" />
          <p className="text-sm text-muted-foreground text-center">Generating document...</p>
        </div>
      ) : fileName ? (
        <div className="flex items-center gap-3 rounded-md border p-3">
          <FileText className="h-8 w-8 text-muted-foreground shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{fileName}</p>
            <Badge variant="outline" className="text-xs mt-0.5">
              {TYPE_LABELS[artifactType] ?? artifactType.toUpperCase()}
            </Badge>
          </div>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-blue-600 hover:underline shrink-0"
            >
              Preview
            </a>
          )}
        </div>
      ) : null}

      {isDraftAccepted ? (
        <Badge variant="secondary">Accepted</Badge>
      ) : (
        <Button
          data-testid="workflow-draft-accept-btn"
          onClick={handleAcceptClick}
          disabled={isGenerating || isDraftAccepted || isSubmitting}
          className="w-full"
        >
          {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Accept Final Version
        </Button>
      )}

      <AlertDialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirm Filing Acceptance</AlertDialogTitle>
            <AlertDialogDescription>
              This action initiates the official filing process. Verify all data before proceeding.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              data-testid="workflow-draft-confirm-btn"
              onClick={() => {
                setDialogOpen(false)
                onAccept()
              }}
            >
              Confirm Acceptance
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
