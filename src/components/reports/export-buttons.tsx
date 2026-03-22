'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  generateCSV,
  generateTypedCSV,
  triggerDownload,
} from '@/lib/reports/csv/export-csv'
import type { CSVColumnDef } from '@/lib/reports/csv/export-csv'

interface ExportButtonsProps {
  reportSlug: string
  /** Readable report title for filenames (e.g. "Balance Sheet") */
  reportTitle?: string
  data?: Record<string, unknown>[]
  /** Legacy string column names — used with generateCSV */
  columns?: string[]
  /** Typed column definitions — used with generateTypedCSV */
  csvColumns?: CSVColumnDef[]
  filters?: Record<string, string>
}

export function ExportButtons({
  reportSlug,
  reportTitle,
  data,
  columns,
  csvColumns,
  filters,
}: ExportButtonsProps) {
  const [isPdfLoading, setIsPdfLoading] = useState(false)
  const { data: session } = useSession()
  const userName = session?.user?.name ?? session?.user?.email ?? 'Unknown'
  const dateStr = new Date().toISOString().split('T')[0]
  const fileBase = reportTitle ? `${reportTitle} - ${dateStr}` : `${reportSlug}-${dateStr}`

  async function handlePdfExport() {
    setIsPdfLoading(true)
    try {
      const params = new URLSearchParams({ report: reportSlug, ...filters })
      const res = await fetch(`/api/reports/pdf?${params.toString()}`)
      if (!res.ok) throw new Error('PDF generation failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${fileBase}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      toast.error('PDF export failed. Try downloading as CSV instead.')
    } finally {
      setIsPdfLoading(false)
    }
  }

  function handleCsvExport() {
    if (!data) return

    let csv: string
    if (csvColumns) {
      csv = generateTypedCSV(csvColumns, data, {
        reportTitle: reportTitle ?? reportSlug,
        exportedBy: userName,
        exportedAt: new Date().toISOString(),
      })
    } else if (columns) {
      csv = generateCSV(columns, data)
    } else {
      return
    }

    triggerDownload(csv, `${fileBase}.csv`)
  }

  const csvDisabled = !data || (!columns && !csvColumns)

  return (
    <div className="flex items-center gap-2">
      <Button
        variant="outline"
        size="sm"
        onClick={handlePdfExport}
        disabled={isPdfLoading}
        data-testid="export-pdf-btn"
      >
        {isPdfLoading ? (
          <Loader2 className="h-4 w-4 mr-1 animate-spin" />
        ) : (
          <FileText className="h-4 w-4 mr-1" />
        )}
        PDF
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleCsvExport}
        disabled={csvDisabled}
        data-testid="export-csv-btn"
      >
        <Download className="h-4 w-4 mr-1" />
        CSV
      </Button>
    </div>
  )
}
