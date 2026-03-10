'use client'

import { useState, useMemo } from 'react'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DataTable } from '@/components/shared/data-table'
import { complianceColumns } from './columns'
import { type ComplianceDeadlineRow } from './actions'
import { CopilotPanel, useCopilot } from '@/components/copilot'
import { WorkflowPipelineHost } from './workflow-pipeline-host'

interface ComplianceCalendarClientProps {
  initialDeadlines: ComplianceDeadlineRow[]
  userId: string
}

export function ComplianceCalendarClient({
  initialDeadlines,
  userId,
}: ComplianceCalendarClientProps) {
  const [categoryFilter, setCategoryFilter] = useState('all')
  const [statusFilter, setStatusFilter] = useState('all')
  const [selectedDeadline, setSelectedDeadline] = useState<ComplianceDeadlineRow | null>(null)
  const [copilotOpen, setCopilotOpen] = useState(false)

  const filtered = initialDeadlines.filter((d) => {
    if (categoryFilter !== 'all' && d.category !== categoryFilter) return false
    if (statusFilter !== 'all' && d.status !== statusFilter) return false
    return true
  })

  const copilotContext = useMemo(
    () => ({
      pageId: 'compliance',
      pageDescription: 'Compliance Calendar — upcoming compliance deadlines and workflow management',
      data: selectedDeadline
        ? {
            selectedDeadline: {
              taskName: selectedDeadline.taskName,
              dueDate: selectedDeadline.dueDate,
              category: selectedDeadline.category,
              status: selectedDeadline.status,
              workflowType: selectedDeadline.workflowType,
              legalCitation: selectedDeadline.legalCitation,
            },
          }
        : {},
      tools: [],
      knowledge: [
        'This page shows compliance deadlines for a nonprofit organization.',
        'Workflows guide users through checklist, AI scan, draft review, and delivery steps.',
      ],
    }),
    [selectedDeadline]
  )

  const { messages, isStreaming, error, sendMessage, clearChat } = useCopilot({
    context: copilotContext,
    userId,
  })

  function handleRowClick(row: ComplianceDeadlineRow) {
    setSelectedDeadline(row)
    setCopilotOpen(true)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">
          Compliance Calendar
        </h1>
      </div>

      <div className="flex items-center gap-4">
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger
            className="w-[180px]"
            data-testid="compliance-category-filter"
          >
            <SelectValue placeholder="All Categories" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="tax">Tax</SelectItem>
            <SelectItem value="tenant">Tenant</SelectItem>
            <SelectItem value="grant">Grant</SelectItem>
            <SelectItem value="budget">Budget</SelectItem>
          </SelectContent>
        </Select>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-[180px]"
            data-testid="compliance-status-filter"
          >
            <SelectValue placeholder="All Statuses" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="upcoming">Upcoming</SelectItem>
            <SelectItem value="reminded">Reminded</SelectItem>
            <SelectItem value="completed">Completed</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <DataTable
        columns={complianceColumns}
        data={filtered}
        onRowClick={handleRowClick}
        initialSorting={[{ id: 'dueDate', desc: false }]}
        emptyMessage="No compliance deadlines found."
        testIdPrefix="compliance"
      />

      <CopilotPanel
        open={copilotOpen}
        onClose={() => {
          setCopilotOpen(false)
          setSelectedDeadline(null)
        }}
        messages={messages}
        isStreaming={isStreaming}
        error={error}
        onSendMessage={sendMessage}
        onClearChat={clearChat}
        workflowContent={
          selectedDeadline
            ? (
              <WorkflowPipelineHost
                deadlineId={selectedDeadline.id}
                workflowType={selectedDeadline.workflowType ?? null}
                userId={userId}
              />
            )
            : undefined
        }
        defaultTab={selectedDeadline?.workflowType ? 'workflow' : 'chat'}
      />
    </div>
  )
}
