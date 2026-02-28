import { describe, it, expect } from 'vitest'
import {
  parseQboCsv,
  groupTransactions,
  parseAndGroupQboCsv,
  convertDate,
  parseCurrency,
  QboParseError,
} from '../qbo-csv-parser'

describe('convertDate', () => {
  it('converts MM/DD/YYYY to YYYY-MM-DD', () => {
    expect(convertDate('01/15/2025')).toBe('2025-01-15')
    expect(convertDate('12/31/2025')).toBe('2025-12-31')
  })

  it('pads single-digit month and day', () => {
    expect(convertDate('1/5/2025')).toBe('2025-01-05')
  })

  it('throws on invalid format', () => {
    expect(() => convertDate('2025-01-15')).toThrow(QboParseError)
    expect(() => convertDate('invalid')).toThrow(QboParseError)
  })
})

describe('parseCurrency', () => {
  it('handles plain numbers', () => {
    expect(parseCurrency('1234.56')).toBe(1234.56)
  })

  it('strips dollar signs and commas', () => {
    expect(parseCurrency('$1,234.56')).toBe(1234.56)
  })

  it('returns 0 for empty/null/undefined', () => {
    expect(parseCurrency('')).toBe(0)
    expect(parseCurrency(null)).toBe(0)
    expect(parseCurrency(undefined)).toBe(0)
  })

  it('rounds to 2 decimal places', () => {
    expect(parseCurrency('1.999')).toBe(2)
  })

  it('throws on non-numeric values', () => {
    expect(() => parseCurrency('abc')).toThrow(QboParseError)
  })
})

describe('parseQboCsv', () => {
  const HEADER = 'Date,Trans No,Type,Memo/Description,Account,Name,Class,Debit,Credit'

  it('parses a single 2-line transaction', () => {
    const csv = [
      HEADER,
      '01/15/2025,1001,Journal Entry,Rent payment,Checking,Tenant A,General,$500.00,',
      '01/15/2025,1001,Journal Entry,Rent payment,Rental Income,Tenant A,General,,$500.00',
    ].join('\n')

    const rows = parseQboCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].date).toBe('2025-01-15')
    expect(rows[0].transactionNo).toBe('1001')
    expect(rows[0].accountName).toBe('Checking')
    expect(rows[0].debit).toBe(500)
    expect(rows[0].credit).toBe(0)
    expect(rows[1].accountName).toBe('Rental Income')
    expect(rows[1].debit).toBe(0)
    expect(rows[1].credit).toBe(500)
  })

  it('parses a multi-line transaction (3+ lines)', () => {
    const csv = [
      HEADER,
      '02/01/2025,1002,Journal Entry,Utility split,Electric,Eversource,,,$100.00',
      '02/01/2025,1002,Journal Entry,Utility split,Gas,National Grid,,,$50.00',
      '02/01/2025,1002,Journal Entry,Utility split,Checking,,,,$150.00',
    ].join('\n')

    const rows = parseQboCsv(csv)
    expect(rows).toHaveLength(3)
    expect(rows[0].credit).toBe(100)
    expect(rows[1].credit).toBe(50)
    expect(rows[2].credit).toBe(150)
  })

  it('handles QBO continuation rows (blank carry-forward fields)', () => {
    const csv = [
      HEADER,
      '03/01/2025,1003,Journal Entry,Multi-line entry,Checking,,,,$200.00',
      ',,,,Savings,,,$200.00,',
    ].join('\n')

    const rows = parseQboCsv(csv)
    expect(rows).toHaveLength(2)
    expect(rows[0].date).toBe('2025-03-01')
    expect(rows[0].transactionNo).toBe('1003')
    expect(rows[1].date).toBe('2025-03-01')
    expect(rows[1].transactionNo).toBe('1003')
    expect(rows[1].accountName).toBe('Savings')
  })

  it('handles currency formatting with $ and commas', () => {
    const csv = [
      HEADER,
      '01/01/2025,1004,Journal Entry,Big payment,Checking,,General,"$10,500.00",',
      '01/01/2025,1004,Journal Entry,Big payment,CIP - Hard Costs,,AHP,,"$10,500.00"',
    ].join('\n')

    const rows = parseQboCsv(csv)
    expect(rows[0].debit).toBe(10500)
    expect(rows[1].credit).toBe(10500)
  })

  it('converts dates from MM/DD/YYYY to YYYY-MM-DD', () => {
    const csv = [
      HEADER,
      '6/3/2025,1005,Journal Entry,Test,Checking,,,$100.00,',
      '6/3/2025,1005,Journal Entry,Test,Savings,,,,$100.00',
    ].join('\n')

    const rows = parseQboCsv(csv)
    expect(rows[0].date).toBe('2025-06-03')
  })

  it('rejects CSV with missing required columns', () => {
    const csv = 'Date,Memo,Amount\n01/01/2025,test,100'

    expect(() => parseQboCsv(csv)).toThrow(QboParseError)
    expect(() => parseQboCsv(csv)).toThrow(/Missing required CSV columns/)
  })

  it('skips rows with missing account name (QBO summary/filler rows)', () => {
    const csv = [
      HEADER,
      '01/01/2025,1006,Journal Entry,Test,Checking,,General,$100.00,',
      '01/01/2025,1006,Journal Entry,Test,Savings,,General,,$100.00',
      ',,,,,,,$100.00,$100.00', // summary row — no account, skipped
    ].join('\n')

    const rows = parseQboCsv(csv)
    // Only the two rows with account names are kept; summary row is skipped
    expect(rows).toHaveLength(2)
    expect(rows[0].accountName).toBe('Checking')
    expect(rows[1].accountName).toBe('Savings')
  })

  it('handles empty CSV content', () => {
    expect(() => parseQboCsv(HEADER)).toThrow(QboParseError)
    expect(() => parseQboCsv(HEADER)).toThrow(/no data rows/)
  })
})

describe('groupTransactions', () => {
  it('groups rows by transaction number', () => {
    const rows = [
      { date: '2025-01-15', transactionNo: '1001', transactionType: 'JE', memo: 'Test', accountName: 'Checking', name: '', class: '', debit: 500, credit: 0 },
      { date: '2025-01-15', transactionNo: '1001', transactionType: 'JE', memo: 'Test', accountName: 'Rental Income', name: '', class: '', debit: 0, credit: 500 },
      { date: '2025-01-20', transactionNo: '1002', transactionType: 'JE', memo: 'Other', accountName: 'Savings', name: '', class: '', debit: 100, credit: 0 },
      { date: '2025-01-20', transactionNo: '1002', transactionType: 'JE', memo: 'Other', accountName: 'Checking', name: '', class: '', debit: 0, credit: 100 },
    ]

    const grouped = groupTransactions(rows)
    expect(grouped).toHaveLength(2)
    expect(grouped[0].transactionNo).toBe('1001')
    expect(grouped[0].lines).toHaveLength(2)
    expect(grouped[1].transactionNo).toBe('1002')
    expect(grouped[1].lines).toHaveLength(2)
  })

  it('rejects unbalanced transactions', () => {
    const rows = [
      { date: '2025-01-15', transactionNo: '1001', transactionType: 'JE', memo: 'Test', accountName: 'Checking', name: '', class: '', debit: 500, credit: 0 },
      { date: '2025-01-15', transactionNo: '1001', transactionType: 'JE', memo: 'Test', accountName: 'Rental Income', name: '', class: '', debit: 0, credit: 400 },
    ]

    expect(() => groupTransactions(rows)).toThrow(QboParseError)
    expect(() => groupTransactions(rows)).toThrow(/unbalanced/)
  })

  it('handles 3+ line transactions', () => {
    const rows = [
      { date: '2025-02-01', transactionNo: '1003', transactionType: 'JE', memo: 'Split', accountName: 'Checking', name: '', class: '', debit: 0, credit: 300 },
      { date: '2025-02-01', transactionNo: '1003', transactionType: 'JE', memo: 'Split', accountName: 'Electric', name: '', class: '', debit: 100, credit: 0 },
      { date: '2025-02-01', transactionNo: '1003', transactionType: 'JE', memo: 'Split', accountName: 'Gas', name: '', class: '', debit: 100, credit: 0 },
      { date: '2025-02-01', transactionNo: '1003', transactionType: 'JE', memo: 'Split', accountName: 'Water', name: '', class: '', debit: 100, credit: 0 },
    ]

    const grouped = groupTransactions(rows)
    expect(grouped).toHaveLength(1)
    expect(grouped[0].lines).toHaveLength(4)
  })
})

describe('parseAndGroupQboCsv', () => {
  it('full pipeline: CSV → grouped transactions', () => {
    const csv = [
      'Date,Trans No,Type,Memo/Description,Account,Name,Class,Debit,Credit',
      '01/15/2025,1001,Journal Entry,Rent received,Checking,Tenant A,General,$1000.00,',
      '01/15/2025,1001,Journal Entry,Rent received,Rental Income,Tenant A,General,,$1000.00',
      '02/01/2025,1002,Journal Entry,Insurance,Insurance Expense,,General,$500.00,',
      '02/01/2025,1002,Journal Entry,Insurance,Checking,,General,,$500.00',
    ].join('\n')

    const txns = parseAndGroupQboCsv(csv)
    expect(txns).toHaveLength(2)
    expect(txns[0].transactionNo).toBe('1001')
    expect(txns[0].date).toBe('2025-01-15')
    expect(txns[0].lines[0].debit).toBe(1000)
    expect(txns[1].transactionNo).toBe('1002')
    expect(txns[1].date).toBe('2025-02-01')
  })
})
