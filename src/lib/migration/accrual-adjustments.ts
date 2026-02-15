import type { AccountLookup, FundLookup } from './account-mapping'
import { createTransaction } from '@/lib/gl/engine'
import type { InsertTransaction } from '@/lib/validators'
import type { TransactionResult } from '@/lib/gl/types'

export interface AhpInterestConfig {
  annualRate: number // e.g. 0.02 for 2%
  drawnAmount: number // current principal balance
  daysSinceLastPayment: number // days of accrued interest
}

export interface AccrualAdjustmentOptions {
  accountLookup: AccountLookup
  fundLookup: FundLookup
  adjustmentDate: string // YYYY-MM-DD, last day of FY25

  // Prepaid insurance
  prepaidInsuranceAmount: number // $501 per plan

  // Accrued reimbursements (Heather)
  reimbursementAmount: number // $4,472 per plan
  reimbursementExpenseAccountCode: string // TBD — requires Jeff's input
  reimbursementFundName: string // TBD — requires Jeff's input

  // December rent AR
  rentArAmount: number // parameterized per plan

  // AHP interest
  ahpInterest?: AhpInterestConfig // optional — only if AHP loan is active

  createdBy: string
  dryRun?: boolean
}

export interface AdjustmentEntry {
  name: string
  description: string
  amount: number
  transaction?: TransactionResult
  glInput: InsertTransaction
}

export interface AdjustmentResult {
  adjustments: AdjustmentEntry[]
  errors: Array<{ name: string; message: string }>
}

/**
 * Calculate accrued AHP loan interest.
 * Formula: rate × principal × days / 365
 */
export function calculateAhpInterest(config: AhpInterestConfig): number {
  const interest = config.annualRate * config.drawnAmount * config.daysSinceLastPayment / 365
  return Math.round(interest * 100) / 100
}

/**
 * Generate accrual-basis adjustment entries to convert from QBO cash-basis
 * to our accrual-basis opening balances (SYS-P0-012).
 */
export async function generateAccrualAdjustments(
  options: AccrualAdjustmentOptions
): Promise<AdjustmentResult> {
  const { accountLookup, fundLookup, adjustmentDate, createdBy } = options
  const adjustments: AdjustmentEntry[] = []
  const errors: Array<{ name: string; message: string }> = []

  const generalFundId = fundLookup.get('General Fund')
  if (!generalFundId) {
    return {
      adjustments: [],
      errors: [{ name: 'Setup', message: 'General Fund not found in database' }],
    }
  }

  // ── a. Prepaid Insurance ($501) ──
  if (options.prepaidInsuranceAmount > 0) {
    const prepaidId = accountLookup.get('1200') // Prepaid Expenses
    const insuranceId = accountLookup.get('5410') // Property Insurance

    if (prepaidId && insuranceId) {
      const glInput: InsertTransaction = {
        date: adjustmentDate,
        memo: 'FY25→FY26 accrual adjustment: prepaid insurance',
        sourceType: 'FY25_IMPORT',
        sourceReferenceId: 'accrual-adj:prepaid-insurance',
        isSystemGenerated: false,
        createdBy,
        lines: [
          { accountId: prepaidId, fundId: generalFundId, debit: options.prepaidInsuranceAmount, credit: null },
          { accountId: insuranceId, fundId: generalFundId, debit: null, credit: options.prepaidInsuranceAmount },
        ],
      }

      const entry: AdjustmentEntry = {
        name: 'Prepaid Insurance',
        description: `DR Prepaid Expenses $${options.prepaidInsuranceAmount} / CR Property Insurance $${options.prepaidInsuranceAmount}`,
        amount: options.prepaidInsuranceAmount,
        glInput,
      }

      if (!options.dryRun) {
        try {
          entry.transaction = await createTransaction(glInput)
        } catch (err) {
          errors.push({ name: 'Prepaid Insurance', message: (err as Error).message })
        }
      }
      adjustments.push(entry)
    } else {
      errors.push({
        name: 'Prepaid Insurance',
        message: `Missing accounts: ${!prepaidId ? 'Prepaid Expenses (1200)' : ''} ${!insuranceId ? 'Property Insurance (5410)' : ''}`.trim(),
      })
    }
  }

  // ── b. Accrued Reimbursements (Heather, $4,472) ──
  if (options.reimbursementAmount > 0) {
    const reimbPayableId = accountLookup.get('2010') // Reimbursements Payable
    const expenseId = accountLookup.get(options.reimbursementExpenseAccountCode)
    const reimbFundId = fundLookup.get(options.reimbursementFundName) ?? generalFundId

    if (reimbPayableId && expenseId) {
      const glInput: InsertTransaction = {
        date: adjustmentDate,
        memo: 'FY25→FY26 accrual adjustment: accrued reimbursement — Heather Takle',
        sourceType: 'FY25_IMPORT',
        sourceReferenceId: 'accrual-adj:accrued-reimbursement',
        isSystemGenerated: false,
        createdBy,
        lines: [
          { accountId: expenseId, fundId: reimbFundId, debit: options.reimbursementAmount, credit: null },
          { accountId: reimbPayableId, fundId: generalFundId, debit: null, credit: options.reimbursementAmount },
        ],
      }

      const entry: AdjustmentEntry = {
        name: 'Accrued Reimbursements',
        description: `DR ${options.reimbursementExpenseAccountCode} $${options.reimbursementAmount} / CR Reimbursements Payable $${options.reimbursementAmount}`,
        amount: options.reimbursementAmount,
        glInput,
      }

      if (!options.dryRun) {
        try {
          entry.transaction = await createTransaction(glInput)
        } catch (err) {
          errors.push({ name: 'Accrued Reimbursements', message: (err as Error).message })
        }
      }
      adjustments.push(entry)
    } else {
      errors.push({
        name: 'Accrued Reimbursements',
        message: `Missing accounts: ${!expenseId ? `Expense (${options.reimbursementExpenseAccountCode})` : ''} ${!reimbPayableId ? 'Reimbursements Payable (2010)' : ''}`.trim(),
      })
    }
  }

  // ── c. December Rent AR ──
  if (options.rentArAmount > 0) {
    const arId = accountLookup.get('1100') // Accounts Receivable
    const rentalIncomeId = accountLookup.get('4000') // Rental Income

    if (arId && rentalIncomeId) {
      const glInput: InsertTransaction = {
        date: adjustmentDate,
        memo: 'FY25→FY26 accrual adjustment: December rent receivable',
        sourceType: 'FY25_IMPORT',
        sourceReferenceId: 'accrual-adj:rent-ar',
        isSystemGenerated: false,
        createdBy,
        lines: [
          { accountId: arId, fundId: generalFundId, debit: options.rentArAmount, credit: null },
          { accountId: rentalIncomeId, fundId: generalFundId, debit: null, credit: options.rentArAmount },
        ],
      }

      const entry: AdjustmentEntry = {
        name: 'December Rent AR',
        description: `DR Accounts Receivable $${options.rentArAmount} / CR Rental Income $${options.rentArAmount}`,
        amount: options.rentArAmount,
        glInput,
      }

      if (!options.dryRun) {
        try {
          entry.transaction = await createTransaction(glInput)
        } catch (err) {
          errors.push({ name: 'December Rent AR', message: (err as Error).message })
        }
      }
      adjustments.push(entry)
    } else {
      errors.push({
        name: 'December Rent AR',
        message: `Missing accounts: ${!arId ? 'Accounts Receivable (1100)' : ''} ${!rentalIncomeId ? 'Rental Income (4000)' : ''}`.trim(),
      })
    }
  }

  // ── d. Accrued AHP Loan Interest ──
  if (options.ahpInterest) {
    const cipInterestId = accountLookup.get('1550') // CIP - Construction Interest
    const accruedInterestId = accountLookup.get('2520') // Accrued Interest Payable
    const ahpFundId = fundLookup.get('AHP Fund')

    if (cipInterestId && accruedInterestId && ahpFundId) {
      const interestAmount = calculateAhpInterest(options.ahpInterest)

      if (interestAmount > 0) {
        const glInput: InsertTransaction = {
          date: adjustmentDate,
          memo: 'FY25→FY26 accrual adjustment: accrued AHP loan interest',
          sourceType: 'FY25_IMPORT',
          sourceReferenceId: 'accrual-adj:ahp-interest',
          isSystemGenerated: false,
          createdBy,
          lines: [
            { accountId: cipInterestId, fundId: ahpFundId, debit: interestAmount, credit: null },
            { accountId: accruedInterestId, fundId: ahpFundId, debit: null, credit: interestAmount },
          ],
        }

        const entry: AdjustmentEntry = {
          name: 'AHP Interest Accrual',
          description: `DR CIP - Construction Interest $${interestAmount} / CR Accrued Interest Payable $${interestAmount}`,
          amount: interestAmount,
          glInput,
        }

        if (!options.dryRun) {
          try {
            entry.transaction = await createTransaction(glInput)
          } catch (err) {
            errors.push({ name: 'AHP Interest Accrual', message: (err as Error).message })
          }
        }
        adjustments.push(entry)
      }
    } else {
      errors.push({
        name: 'AHP Interest Accrual',
        message: `Missing: ${!cipInterestId ? 'CIP Interest (1550)' : ''} ${!accruedInterestId ? 'Accrued Interest (2520)' : ''} ${!ahpFundId ? 'AHP Fund' : ''}`.trim(),
      })
    }
  }

  return { adjustments, errors }
}
