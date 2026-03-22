'use client'

import { formatDateTime } from '@/lib/reports/types'
import { ExportButtons } from './export-buttons'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'

interface ReportShellProps {
  title: string
  generatedAt?: string
  fundName?: string | null
  reportSlug: string
  exportData?: Record<string, unknown>[]
  /** Legacy string column names */
  exportColumns?: string[]
  /** Typed CSV column definitions — takes precedence over exportColumns */
  csvColumns?: CSVColumnDef[]
  /** Filters to forward to PDF route */
  filters?: Record<string, string>
  children: React.ReactNode
}

export function ReportShell({
  title,
  generatedAt,
  fundName,
  reportSlug,
  exportData,
  exportColumns,
  csvColumns,
  filters,
  children,
}: ReportShellProps) {
  const timestamp = generatedAt ?? new Date().toISOString()

  return (
    <div className="space-y-6" data-testid="report-shell">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-sm text-muted-foreground" data-testid="report-timestamp">
              Generated: {formatDateTime(timestamp)}
            </p>
            {fundName && (
              <span className="text-sm font-medium text-muted-foreground">
                Fund: {fundName}
              </span>
            )}
            {!fundName && (
              <span className="text-sm text-muted-foreground">Consolidated</span>
            )}
          </div>
        </div>
        <ExportButtons
          reportSlug={reportSlug}
          reportTitle={title}
          data={exportData}
          columns={exportColumns}
          csvColumns={csvColumns}
          filters={filters}
        />
      </div>

      {children}

      {/* Print-friendly styles */}
      <style jsx global>{`
        @media print {
          nav, aside, [data-testid="export-pdf-btn"], [data-testid="export-csv-btn"],
          [data-testid="report-filter-bar"] {
            display: none !important;
          }
          body {
            font-size: 10pt;
          }
        }
      `}</style>
    </div>
  )
}
