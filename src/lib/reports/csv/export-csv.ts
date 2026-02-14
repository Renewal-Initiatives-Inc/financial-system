/**
 * Generic CSV export utility.
 * Handles currency formatting, special characters, UTF-8 BOM for Excel compatibility.
 */

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
