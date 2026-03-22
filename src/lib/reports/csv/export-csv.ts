/**
 * CSV export utility.
 * Handles currency formatting, special characters, UTF-8 BOM for Excel compatibility.
 */

import { formatCurrency, formatPercent, formatDate, formatDateTime } from '../types'

// ---------------------------------------------------------------------------
// Typed CSV column definitions
// ---------------------------------------------------------------------------

export interface CSVColumnDef {
  /** Key to look up in the row object */
  key: string
  /** Display label for the column header */
  label: string
  /** Data format — determines value formatting and column suffix */
  format: 'currency' | 'percent' | 'count' | 'date' | 'datetime' | 'text'
}

export interface CSVMeta {
  reportTitle: string
  exportedBy: string
  exportedAt: string
}

// ---------------------------------------------------------------------------
// Column header suffixes by format type
// ---------------------------------------------------------------------------

const FORMAT_SUFFIX: Record<CSVColumnDef['format'], string> = {
  currency: ' ($)',
  percent: ' (%)',
  count: ' (#)',
  date: '',
  datetime: '',
  text: '',
}

// ---------------------------------------------------------------------------
// Typed CSV generator (new — use this for all new report conversions)
// ---------------------------------------------------------------------------

export function generateTypedCSV(
  columns: CSVColumnDef[],
  rows: Record<string, unknown>[],
  meta: CSVMeta
): string {
  const BOM = '\uFEFF'

  // Metadata comment row
  const metaTimestamp = formatDateTime(meta.exportedAt)
  const metaRow = `# Renewal Initiatives Inc. | ${meta.reportTitle} | Exported ${metaTimestamp} by ${meta.exportedBy}`

  // Header row with type suffixes
  const header = columns
    .map((col) => escapeCSVField(col.label + FORMAT_SUFFIX[col.format]))
    .join(',')

  // Data rows with type-aware formatting
  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col.key]
        return escapeCSVField(formatTypedValue(val, col.format))
      })
      .join(',')
  )

  return BOM + [metaRow, header, ...dataRows].join('\r\n')
}

// ---------------------------------------------------------------------------
// Format a value based on its column type
// ---------------------------------------------------------------------------

function formatTypedValue(
  value: unknown,
  format: CSVColumnDef['format']
): string {
  if (value === null || value === undefined) return ''

  switch (format) {
    case 'currency':
      if (typeof value === 'number') return formatCurrency(value)
      return String(value)

    case 'percent':
      if (typeof value === 'number') return formatPercent(value)
      return String(value)

    case 'count':
      if (typeof value === 'number') return String(Math.round(value))
      return String(value)

    case 'date':
      if (value instanceof Date) return formatDate(value.toISOString())
      if (typeof value === 'string') return formatDate(value)
      return String(value)

    case 'datetime':
      if (value instanceof Date) return formatDateTime(value.toISOString())
      if (typeof value === 'string') return formatDateTime(value)
      return String(value)

    case 'text':
    default:
      return String(value)
  }
}

// ---------------------------------------------------------------------------
// Legacy CSV generator — preserved for backward compatibility during migration
// ---------------------------------------------------------------------------

export function generateCSV(
  columns: string[],
  rows: Record<string, unknown>[]
): string {
  const BOM = '\uFEFF'
  const header = columns.map(escapeCSVField).join(',')

  const dataRows = rows.map((row) =>
    columns
      .map((col) => {
        const val = row[col]
        if (val === null || val === undefined) return ''
        if (typeof val === 'number') return formatCSVNumber(val)
        return escapeCSVField(String(val))
      })
      .join(',')
  )

  return BOM + [header, ...dataRows].join('\r\n')
}

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

function escapeCSVField(value: string): string {
  if (
    value.includes(',') ||
    value.includes('"') ||
    value.includes('\n') ||
    value.includes('\r')
  ) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

function formatCSVNumber(value: number): string {
  return value.toFixed(2)
}

export function triggerDownload(csv: string, filename: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
