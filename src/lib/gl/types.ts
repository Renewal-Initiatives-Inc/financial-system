import type { InferSelectModel } from 'drizzle-orm'
import type {
  accounts,
  funds,
  transactions,
  transactionLines,
} from '@/lib/db/schema'

// Inferred DB row types
export type Account = InferSelectModel<typeof accounts>
export type Fund = InferSelectModel<typeof funds>
export type Transaction = InferSelectModel<typeof transactions>
export type TransactionLineRow = InferSelectModel<typeof transactionLines>

// Transaction line with resolved relations
export type TransactionLineWithRelations = TransactionLineRow & {
  account: Account
  fund: Fund
}

// Full transaction with all lines
export type TransactionWithLines = Transaction & {
  lines: TransactionLineRow[]
}

// Result returned by createTransaction, editTransaction, reverseTransaction
export type TransactionResult = {
  transaction: {
    id: number
    date: string
    memo: string
    sourceType: string
    isSystemGenerated: boolean
    lines: Array<{
      id: number
      accountId: number
      fundId: number
      debit: string | null
      credit: string | null
      cipCostCodeId: number | null
      memo: string | null
    }>
  }
  releaseTransaction?: TransactionResult['transaction']
  lockedYearWarning?: { year: number; message: string }
}
