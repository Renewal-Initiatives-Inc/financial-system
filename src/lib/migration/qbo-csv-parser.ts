import Papa from 'papaparse'

/** A single row from the QBO General Journal CSV export */
export interface QboRow {
  date: string // YYYY-MM-DD (converted from MM/DD/YYYY)
  transactionNo: string
  transactionType: string
  memo: string
  accountName: string
  name: string // vendor/customer/donor
  class: string // maps to fund
  debit: number // 0 if empty
  credit: number // 0 if empty
}

/** A parsed multi-line QBO transaction (grouped by transactionNo) */
export interface QboParsedTransaction {
  transactionNo: string
  date: string
  transactionType: string
  memo: string
  lines: QboTransactionLine[]
}

export interface QboTransactionLine {
  accountName: string
  name: string
  class: string
  debit: number
  credit: number
}

/** Errors found during CSV parsing */
export class QboParseError extends Error {
  constructor(
    message: string,
    public readonly row?: number
  ) {
    super(message)
    this.name = 'QboParseError'
  }
}

/**
 * Convert MM/DD/YYYY to YYYY-MM-DD
 */
export function convertDate(dateStr: string): string {
  const trimmed = dateStr.trim()
  const match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/)
  if (!match) {
    throw new QboParseError(`Invalid date format: "${dateStr}" (expected MM/DD/YYYY)`)
  }
  const [, month, day, year] = match
  return `${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`
}

/**
 * Parse a currency string like "$1,234.56" or "1234.56" or "" to a number
 */
export function parseCurrency(value: string | undefined | null): number {
  if (value == null || value.trim() === '') return 0
  const cleaned = value.replace(/[$,]/g, '').trim()
  if (cleaned === '') return 0
  const num = Number(cleaned)
  if (isNaN(num)) {
    throw new QboParseError(`Invalid currency value: "${value}"`)
  }
  return Math.round(num * 100) / 100 // round to 2 decimal places
}

/** QBO CSV column header names (case-insensitive matching) */
const COLUMN_MAP: Record<string, keyof QboRow> = {
  'date': 'date',
  'trans no': 'transactionNo',
  'transaction no': 'transactionNo',
  'trans no.': 'transactionNo',
  'transaction no.': 'transactionNo',
  'num': 'transactionNo',
  'type': 'transactionType',
  'transaction type': 'transactionType',
  'memo': 'memo',
  'memo/description': 'memo',
  'description': 'memo',
  'account': 'accountName',
  'account name': 'accountName',
  'name': 'name',
  'class': 'class',
  'debit': 'debit',
  'credit': 'credit',
}

/**
 * Parse QBO General Journal CSV into structured rows.
 */
export function parseQboCsv(csvContent: string): QboRow[] {
  const result = Papa.parse<Record<string, string>>(csvContent, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (header: string) => header.trim(),
  })

  if (result.errors.length > 0) {
    const firstError = result.errors[0]
    throw new QboParseError(
      `CSV parse error: ${firstError.message}`,
      firstError.row
    )
  }

  if (result.data.length === 0) {
    throw new QboParseError('CSV file contains no data rows')
  }

  // Map CSV column headers to our field names
  const headers = Object.keys(result.data[0])
  const columnMapping = new Map<string, string>()

  for (const header of headers) {
    const normalized = header.toLowerCase().trim()
    if (normalized in COLUMN_MAP) {
      columnMapping.set(header, COLUMN_MAP[normalized])
    }
  }

  // Validate required columns exist
  const mappedFields = new Set(columnMapping.values())
  const requiredFields: (keyof QboRow)[] = ['date', 'transactionNo', 'accountName', 'debit', 'credit']
  const missing = requiredFields.filter((f) => !mappedFields.has(f))
  if (missing.length > 0) {
    throw new QboParseError(
      `Missing required CSV columns: ${missing.join(', ')}. Found columns: ${headers.join(', ')}`
    )
  }

  const rows: QboRow[] = []
  let lastDate = ''
  let lastTransactionNo = ''
  let lastTransactionType = ''
  let lastMemo = ''

  for (let i = 0; i < result.data.length; i++) {
    const raw = result.data[i]

    // Map raw columns to structured fields
    const mapped: Record<string, string> = {}
    for (const [csvHeader, fieldName] of columnMapping) {
      mapped[fieldName] = raw[csvHeader] ?? ''
    }

    // QBO uses blank fields for continuation rows — carry forward
    const date = mapped.date?.trim() || lastDate
    const transactionNo = mapped.transactionNo?.trim() || lastTransactionNo
    const transactionType = mapped.transactionType?.trim() || lastTransactionType
    const memo = mapped.memo?.trim() || lastMemo

    if (!date) {
      throw new QboParseError(`Row ${i + 1}: missing date`, i)
    }
    if (!transactionNo) {
      throw new QboParseError(`Row ${i + 1}: missing transaction number`, i)
    }
    if (!mapped.accountName?.trim()) {
      throw new QboParseError(`Row ${i + 1}: missing account name`, i)
    }

    // Update carry-forward values
    if (mapped.date?.trim()) lastDate = mapped.date.trim()
    if (mapped.transactionNo?.trim()) lastTransactionNo = mapped.transactionNo.trim()
    if (mapped.transactionType?.trim()) lastTransactionType = mapped.transactionType.trim()
    if (mapped.memo?.trim()) lastMemo = mapped.memo.trim()

    rows.push({
      date: convertDate(date),
      transactionNo,
      transactionType,
      memo,
      accountName: mapped.accountName.trim(),
      name: mapped.name?.trim() ?? '',
      class: mapped.class?.trim() ?? '',
      debit: parseCurrency(mapped.debit),
      credit: parseCurrency(mapped.credit),
    })
  }

  return rows
}

/**
 * Group parsed QBO rows into multi-line transactions by transaction number.
 * Validates that each transaction balances (debits = credits).
 */
export function groupTransactions(rows: QboRow[]): QboParsedTransaction[] {
  const groups = new Map<string, QboRow[]>()

  for (const row of rows) {
    const existing = groups.get(row.transactionNo)
    if (existing) {
      existing.push(row)
    } else {
      groups.set(row.transactionNo, [row])
    }
  }

  const transactions: QboParsedTransaction[] = []

  for (const [transactionNo, groupRows] of groups) {
    const firstRow = groupRows[0]
    const totalDebits = groupRows.reduce((sum, r) => sum + r.debit, 0)
    const totalCredits = groupRows.reduce((sum, r) => sum + r.credit, 0)

    if (Math.abs(totalDebits - totalCredits) >= 0.01) {
      throw new QboParseError(
        `Transaction ${transactionNo} is unbalanced: debits=$${totalDebits.toFixed(2)}, credits=$${totalCredits.toFixed(2)}`
      )
    }

    transactions.push({
      transactionNo,
      date: firstRow.date,
      transactionType: firstRow.transactionType,
      memo: firstRow.memo,
      lines: groupRows.map((r) => ({
        accountName: r.accountName,
        name: r.name,
        class: r.class,
        debit: r.debit,
        credit: r.credit,
      })),
    })
  }

  return transactions
}

/**
 * Full parse pipeline: CSV string → grouped transactions.
 */
export function parseAndGroupQboCsv(csvContent: string): QboParsedTransaction[] {
  const rows = parseQboCsv(csvContent)
  return groupTransactions(rows)
}
