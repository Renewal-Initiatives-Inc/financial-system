'use client'

import { useState } from 'react'
import { Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  getArtifactsByYear,
  getWorkflowLogsByDeadline,
  type ArtifactRow,
} from './admin-actions'

type WorkflowLog = Awaited<ReturnType<typeof getWorkflowLogsByDeadline>>[number]

interface ComplianceAdminClientProps {
  initialArtifacts: ArtifactRow[]
  years: number[]
  initialYear: number
}

function formatFileSize(bytes: number | null): string {
  if (bytes === null) return '—'
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ComplianceAdminClient({
  initialArtifacts,
  years,
  initialYear,
}: ComplianceAdminClientProps) {
  const [artifacts, setArtifacts] = useState<ArtifactRow[]>(initialArtifacts)
  const [selectedYear, setSelectedYear] = useState(initialYear.toString())
  const [selectedDeadlineId, setSelectedDeadlineId] = useState<string>('')
  const [logs, setLogs] = useState<WorkflowLog[]>([])
  const [isLoadingArtifacts, setIsLoadingArtifacts] = useState(false)
  const [isLoadingLogs, setIsLoadingLogs] = useState(false)

  const currentYear = new Date().getFullYear()
  const yearOptions = years.length > 0 ? years : [currentYear]

  // Unique deadlines from artifacts for the log viewer selector
  const uniqueDeadlines = Array.from(
    new Map(artifacts.map((a) => [a.deadlineId, a.taskName])).entries()
  ).map(([id, name]) => ({ id, name }))

  async function handleYearChange(year: string) {
    setSelectedYear(year)
    setIsLoadingArtifacts(true)
    try {
      const rows = await getArtifactsByYear(Number(year))
      setArtifacts(rows)
      setSelectedDeadlineId('')
      setLogs([])
    } finally {
      setIsLoadingArtifacts(false)
    }
  }

  async function handleDeadlineChange(deadlineId: string) {
    setSelectedDeadlineId(deadlineId)
    setIsLoadingLogs(true)
    try {
      const logRows = await getWorkflowLogsByDeadline(Number(deadlineId))
      setLogs(logRows)
    } finally {
      setIsLoadingLogs(false)
    }
  }

  const totalArtifacts = artifacts.length
  const mostRecentDelivery = artifacts.length > 0
    ? new Date(Math.max(...artifacts.map((a) => new Date(a.createdAt).getTime())))
    : null

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Compliance Admin</h1>
      </div>

      {/* Section 3: Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Total Artifacts ({selectedYear})</p>
          <p className="text-2xl font-semibold mt-1">{totalArtifacts}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Workflows Completed ({selectedYear})</p>
          <p className="text-2xl font-semibold mt-1">{totalArtifacts}</p>
        </div>
        <div className="rounded-lg border p-4">
          <p className="text-sm text-muted-foreground">Most Recent Delivery</p>
          <p className="text-2xl font-semibold mt-1">
            {mostRecentDelivery
              ? mostRecentDelivery.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })
              : '—'}
          </p>
        </div>
      </div>

      {/* Section 1: Artifact Browser */}
      <div data-testid="admin-artifact-table">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-medium">Artifact Browser</h2>
          <Select value={selectedYear} onValueChange={handleYearChange}>
            <SelectTrigger className="w-[120px]" data-testid="admin-year-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearOptions.map((y) => (
                <SelectItem key={y} value={y.toString()}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoadingArtifacts ? (
          <p className="text-sm text-muted-foreground py-4">Loading...</p>
        ) : artifacts.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">
            No artifacts found for {selectedYear}.
          </p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">Task</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">File</th>
                  <th className="text-left px-4 py-2 font-medium">Size</th>
                  <th className="text-left px-4 py-2 font-medium">Created By</th>
                  <th className="text-left px-4 py-2 font-medium">Date</th>
                  <th className="px-4 py-2" />
                </tr>
              </thead>
              <tbody>
                {artifacts.map((artifact) => (
                  <tr key={artifact.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2">{artifact.taskName}</td>
                    <td className="px-4 py-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                        {artifact.artifactType}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-muted-foreground max-w-[200px] truncate">
                      {artifact.fileName}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {formatFileSize(artifact.fileSize)}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{artifact.createdBy}</td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(artifact.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-2">
                      <Button asChild size="sm" variant="outline">
                        <a href={artifact.blobUrl} download={artifact.fileName}>
                          <Download className="h-3.5 w-3.5 mr-1" />
                          Download
                        </a>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Section 2: Workflow Log Viewer */}
      <div data-testid="admin-log-viewer">
        <div className="flex items-center gap-4 mb-3">
          <h2 className="text-lg font-medium">Workflow Log Viewer</h2>
          <Select
            value={selectedDeadlineId}
            onValueChange={handleDeadlineChange}
            disabled={uniqueDeadlines.length === 0}
          >
            <SelectTrigger className="w-[280px]" data-testid="admin-deadline-select">
              <SelectValue placeholder="Select a deadline..." />
            </SelectTrigger>
            <SelectContent>
              {uniqueDeadlines.map((d) => (
                <SelectItem key={d.id} value={d.id.toString()}>
                  {d.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {isLoadingLogs ? (
          <p className="text-sm text-muted-foreground py-4">Loading logs...</p>
        ) : !selectedDeadlineId ? (
          <p className="text-sm text-muted-foreground py-4">
            Select a deadline above to view its workflow audit log.
          </p>
        ) : logs.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4">No log entries found.</p>
        ) : (
          <div className="rounded-md border overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="text-left px-4 py-2 font-medium">Step</th>
                  <th className="text-left px-4 py-2 font-medium">Action</th>
                  <th className="text-left px-4 py-2 font-medium">User</th>
                  <th className="text-left px-4 py-2 font-medium">Timestamp</th>
                  <th className="text-left px-4 py-2 font-medium">Data</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((log) => (
                  <tr key={log.id} className="border-b last:border-0 hover:bg-muted/30">
                    <td className="px-4 py-2">
                      <span className="rounded bg-muted px-1.5 py-0.5 text-xs font-medium">
                        {log.step}
                      </span>
                    </td>
                    <td className="px-4 py-2 font-mono text-xs">{log.action}</td>
                    <td className="px-4 py-2 text-muted-foreground">{log.userId}</td>
                    <td className="px-4 py-2 text-muted-foreground whitespace-nowrap">
                      {new Date(log.createdAt).toLocaleDateString('en-US', {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-4 py-2">
                      {log.data ? (
                        <pre className="text-xs bg-muted rounded p-2 max-h-32 overflow-auto">
                          {JSON.stringify(log.data, null, 2)}
                        </pre>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
