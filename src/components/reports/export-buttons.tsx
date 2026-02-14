'use client'

import { useState } from 'react'
import { Download, FileText, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { generateCSV, triggerDownload } from '@/lib/reports/csv/export-csv'

interface ExportButtonsProps {
  reportSlug: string
  data?: Record<string, unknown>[]
  columns?: string[]
  filters?: Record<string, string>
}

export function ExportButtons({
  reportSlug,
  data,
  columns,
  filters,
}: ExportButtonsProps) {
  const [isPdfLoading, setIsPdfLoading] = useState(false)

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
      a.download = `${reportSlug}-${new Date().toISOString().split('T')[0]}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // PDF export is optional — silently degrade
      console.error('PDF export failed')
    } finally {
      setIsPdfLoading(false)
    }
  }

  function handleCsvExport() {
    if (!data || !columns) return
    const csv = generateCSV(columns, data)
    triggerDownload(csv, `${reportSlug}-${new Date().toISOString().split('T')[0]}.csv`)
  }

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
        disabled={!data || !columns}
        data-testid="export-csv-btn"
      >
        <Download className="h-4 w-4 mr-1" />
        CSV
      </Button>
    </div>
  )
}
