'use client'

import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { WorkflowPipelineHost } from './workflow-pipeline-host'
import type { ComplianceDeadlineRow } from './actions'

interface ComplianceDetailSheetProps {
  deadline: ComplianceDeadlineRow | null
  open: boolean
  onClose: () => void
  userId: string
}

function parseRecommendedActions(raw: string | null): string[] | null {
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed as string[]
    return null
  } catch {
    return [raw]
  }
}

export function ComplianceDetailSheet({
  deadline,
  open,
  onClose,
  userId,
}: ComplianceDetailSheetProps) {
  const defaultTab = deadline?.workflowType ? 'workflow' : 'details'
  const actions = parseRecommendedActions(deadline?.recommendedActions ?? null)

  return (
    <Sheet open={open} onOpenChange={(o) => !o && onClose()}>
      <SheetContent
        side="right"
        className="w-[500px] sm:max-w-[500px] overflow-y-auto"
        data-testid="compliance-detail-sheet"
      >
        <SheetHeader>
          <SheetTitle>{deadline?.taskName ?? 'Compliance Item'}</SheetTitle>
          <SheetDescription>
            {deadline?.dueDate ? `Due ${deadline.dueDate}` : ''}
          </SheetDescription>
        </SheetHeader>

        {deadline && (
          <Tabs defaultValue={defaultTab} className="mt-4">
            <TabsList className="w-full">
              <TabsTrigger
                value="details"
                className="flex-1"
                data-testid="compliance-detail-tab-details"
              >
                Details
              </TabsTrigger>
              <TabsTrigger
                value="workflow"
                className="flex-1"
                data-testid="compliance-detail-tab-workflow"
              >
                Workflow
              </TabsTrigger>
            </TabsList>

            <TabsContent value="details" className="mt-4 space-y-4">
              {deadline.legalCitation && (
                <div>
                  <p className="text-xs text-muted-foreground">Legal Citation</p>
                  <p className="text-sm mt-0.5">{deadline.legalCitation}</p>
                </div>
              )}
              {deadline.authoritySource && (
                <div>
                  <p className="text-xs text-muted-foreground">Authority Source</p>
                  <p className="text-sm mt-0.5">{deadline.authoritySource}</p>
                </div>
              )}
              {deadline.referenceUrl && (
                <div>
                  <p className="text-xs text-muted-foreground">Reference</p>
                  <a
                    href={deadline.referenceUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline mt-0.5 block"
                  >
                    {deadline.referenceUrl}
                  </a>
                </div>
              )}
              {actions && actions.length > 0 && (
                <div>
                  <p className="text-xs text-muted-foreground">Recommended Actions</p>
                  <ul className="list-disc list-inside space-y-1 mt-1">
                    {actions.map((action, i) => (
                      <li key={i} className="text-sm">{action}</li>
                    ))}
                  </ul>
                </div>
              )}
              {deadline.notes && (
                <div>
                  <p className="text-xs text-muted-foreground">Notes</p>
                  <p className="text-sm mt-0.5">{deadline.notes}</p>
                </div>
              )}
            </TabsContent>

            <TabsContent value="workflow" className="mt-4 overflow-y-auto h-full">
              <WorkflowPipelineHost
                deadlineId={deadline.id}
                workflowType={deadline.workflowType ?? null}
                userId={userId}
                onComplete={onClose}
              />
            </TabsContent>
          </Tabs>
        )}
      </SheetContent>
    </Sheet>
  )
}
