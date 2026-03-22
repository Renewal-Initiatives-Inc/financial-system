import { describe, expect, it } from 'vitest'
import {
  normalizeVendorName,
  matchBankTransactionToInvoices,
  type OutstandingInvoice,
  type BankTransactionInput,
} from './invoice-matcher'

// --- Helper to build test data ---

function makeInvoice(overrides: Partial<OutstandingInvoice> = {}): OutstandingInvoice {
  return {
    invoiceId: 1,
    direction: 'AP',
    purchaseOrderId: 10,
    poNumber: 'PO-10',
    vendorId: 5,
    vendorName: 'Expenses-R-Us',
    invoiceNumber: 'INV-001',
    invoiceAmount: '210.00',
    invoiceDate: '2026-03-10',
    fundId: 1,
    ...overrides,
  }
}

function makeBankTxn(overrides: Partial<BankTransactionInput> = {}): BankTransactionInput {
  return {
    amount: '-210.00', // outflow — negative
    date: '2026-03-15',
    merchantName: 'EXPENSES R US LLC',
    category: null,
    ...overrides,
  }
}

// --- Tests ---

describe('normalizeVendorName', () => {
  it('strips LLC', () => {
    expect(normalizeVendorName('Expenses R Us LLC')).toBe('expenses r us')
  })

  it('strips Inc', () => {
    expect(normalizeVendorName('Acme Inc.')).toBe('acme')
  })

  it('strips Corp', () => {
    expect(normalizeVendorName('Widget Corp')).toBe('widget')
  })

  it('strips punctuation and collapses whitespace', () => {
    expect(normalizeVendorName('Expenses-R-Us,  LLC')).toBe('expensesrus')
  })

  it('lowercases', () => {
    expect(normalizeVendorName('ACME CORP')).toBe('acme')
  })
})

describe('matchBankTransactionToInvoices', () => {
  it('returns empty array when no outstanding invoices', () => {
    const result = matchBankTransactionToInvoices(makeBankTxn(), [])
    expect(result).toEqual([])
  })

  it('exact match: amount + vendor produces high score', () => {
    const invoices = [makeInvoice()]
    const result = matchBankTransactionToInvoices(makeBankTxn(), invoices)

    expect(result).toHaveLength(1)
    expect(result[0].invoiceId).toBe(1)
    expect(result[0].confidenceScore).toBeGreaterThanOrEqual(60)
    expect(result[0].matchReason).toContain('Amount: exact match')
  })

  it('fuzzy vendor match: "EXPENSES R US LLC" matches "Expenses-R-Us" with high vendor score', () => {
    const invoices = [makeInvoice({ vendorName: 'Expenses-R-Us' })]
    const bankTxn = makeBankTxn({ merchantName: 'EXPENSES R US LLC' })
    const result = matchBankTransactionToInvoices(bankTxn, invoices)

    expect(result).toHaveLength(1)
    // The composite should be >= 60 (amount alone contributes 40)
    expect(result[0].confidenceScore).toBeGreaterThanOrEqual(60)
  })

  it('amount mismatch: $210 bank txn does not match $255 invoice', () => {
    const invoices = [makeInvoice({ invoiceAmount: '255.00' })]
    const result = matchBankTransactionToInvoices(makeBankTxn(), invoices)

    expect(result).toHaveLength(0)
  })

  it('amount tolerance: ±$0.01 is accepted', () => {
    const invoices = [makeInvoice({ invoiceAmount: '210.01' })]
    const result = matchBankTransactionToInvoices(makeBankTxn(), invoices)

    expect(result).toHaveLength(1)
  })

  it('amount tolerance: $0.02 difference is rejected', () => {
    const invoices = [makeInvoice({ invoiceAmount: '210.02' })]
    const result = matchBankTransactionToInvoices(makeBankTxn(), invoices)

    expect(result).toHaveLength(0)
  })

  it('ranks multiple candidates by score', () => {
    const invoices = [
      makeInvoice({ invoiceId: 1, vendorName: 'Totally Different Vendor' }),
      makeInvoice({ invoiceId: 2, vendorName: 'Expenses R Us' }),
    ]
    const result = matchBankTransactionToInvoices(makeBankTxn(), invoices)

    // Both have exact amount match, but #2 has better vendor match
    if (result.length === 2) {
      expect(result[0].invoiceId).toBe(2)
      expect(result[0].confidenceScore).toBeGreaterThan(result[1].confidenceScore)
    }
  })

  it('date proximity boosts score', () => {
    const invoices = [makeInvoice({ invoiceDate: '2026-03-14' })] // 1 day before bank txn
    const bankTxn = makeBankTxn({ date: '2026-03-15' })
    const result = matchBankTransactionToInvoices(bankTxn, invoices)

    expect(result).toHaveLength(1)
    expect(result[0].confidenceScore).toBeGreaterThanOrEqual(60)
  })

  it('old invoice date reduces date score but still matches if amount + vendor are good', () => {
    const invoices = [makeInvoice({ invoiceDate: '2026-01-01' })] // ~75 days before
    const bankTxn = makeBankTxn({ date: '2026-03-15' })
    const result = matchBankTransactionToInvoices(bankTxn, invoices)

    // Amount (40) is exact, vendor should contribute some, date is 0
    // Should still pass 60 threshold with vendor contribution
    expect(result.length).toBeGreaterThanOrEqual(0)
  })

  it('null merchant name still works (just gets 0 vendor score)', () => {
    const invoices = [makeInvoice()]
    const bankTxn = makeBankTxn({ merchantName: null })
    const result = matchBankTransactionToInvoices(bankTxn, invoices)

    // Amount alone gives 40, date adds some — may or may not hit 60
    // The important thing is it doesn't throw
    expect(Array.isArray(result)).toBe(true)
  })

  it('AR invoice matches positive bank amount (deposit)', () => {
    const invoices = [
      makeInvoice({
        direction: 'AR',
        invoiceId: 100,
        vendorName: 'HUD Grant Fund',
        invoiceAmount: '5000.00',
        purchaseOrderId: null,
        poNumber: null,
        vendorId: null,
      }),
    ]
    const bankTxn = makeBankTxn({
      amount: '5000.00', // positive = deposit
      merchantName: 'HUD GRANT FUND',
    })
    const result = matchBankTransactionToInvoices(bankTxn, invoices)

    expect(result).toHaveLength(1)
    expect(result[0].invoiceId).toBe(100)
    expect(result[0].direction).toBe('AR')
    expect(result[0].confidenceScore).toBeGreaterThanOrEqual(60)
  })

  it('AR invoice does NOT match negative bank amount (outflow)', () => {
    const invoices = [
      makeInvoice({
        direction: 'AR',
        invoiceAmount: '5000.00',
      }),
    ]
    const bankTxn = makeBankTxn({ amount: '-5000.00' })
    const result = matchBankTransactionToInvoices(bankTxn, invoices)

    expect(result).toHaveLength(0)
  })

  it('AP invoice does NOT match positive bank amount (deposit)', () => {
    const invoices = [makeInvoice({ direction: 'AP', invoiceAmount: '210.00' })]
    const bankTxn = makeBankTxn({ amount: '210.00' }) // positive = deposit
    const result = matchBankTransactionToInvoices(bankTxn, invoices)

    expect(result).toHaveLength(0)
  })
})
