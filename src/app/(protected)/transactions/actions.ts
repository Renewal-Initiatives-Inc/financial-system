'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, desc, sql, ilike, gte, lte, or, count } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  transactions,
  transactionLines,
  accounts,
  funds,
  cipCostCodes,
  auditLog,
} from '@/lib/db/schema'
import {
  createTransaction,
  editTransaction,
  reverseTransaction,
  voidTransaction,
} from '@/lib/gl/engine'
import type { InsertTransaction, EditTransaction } from '@/lib/validators'
import type { AccountRow } from '@/app/(protected)/accounts/actions'
import { getUserId } from '@/lib/auth'

// --- Types ---

export type TransactionListRow = {
  id: number
  date: string
  memo: string
  sourceType: string
  isSystemGenerated: boolean
  isVoided: boolean
  reversalOfId: number | null
  reversedById: number | null
  createdBy: string
  createdAt: Date
  totalAmount: string
  lineCount: number
}

export type TransactionLineDetail = {
  id: number
  accountId: number
  accountCode: string
  accountName: string
  fundId: number
  fundName: string
  fundRestrictionType: string
  debit: string | null
  credit: string | null
  cipCostCodeId: number | null
  cipCostCodeName: string | null
  memo: string | null
}

export type TransactionDetail = {
  id: number
  date: string
  memo: string
  sourceType: string
  isSystemGenerated: boolean
  isVoided: boolean
  reversalOfId: number | null
  reversedById: number | null
  createdBy: string
  createdAt: Date
  lines: TransactionLineDetail[]
  auditEntries: AuditEntry[]
}

export type AuditEntry = {
  id: number
  timestamp: Date
  userId: string
  action: string
  beforeState: unknown
  afterState: unknown
  metadata: unknown
}

export type TransactionFilters = {
  dateFrom?: string
  dateTo?: string
  sourceType?: string[]
  search?: string
  amountMin?: number
  amountMax?: number
  includeVoided?: boolean
  page?: number
  pageSize?: number
}

export type FundRow = {
  id: number
  name: string
  restrictionType: string
  isActive: boolean
}

export type CipCostCodeRow = {
  id: number
  code: string
  name: string
  category: string
  isActive: boolean
  sortOrder: number
}

// --- Server Actions ---

export async function getTransactions(
  filters: TransactionFilters = {}
): Promise<{ rows: TransactionListRow[]; total: number }> {
  const {
    dateFrom,
    dateTo,
    sourceType,
    search,
    includeVoided = false,
    page = 1,
    pageSize = 25,
  } = filters

  const conditions = []

  if (!includeVoided) {
    conditions.push(eq(transactions.isVoided, false))
  }

  if (dateFrom) {
    conditions.push(gte(transactions.date, dateFrom))
  }
  if (dateTo) {
    conditions.push(lte(transactions.date, dateTo))
  }

  if (sourceType && sourceType.length > 0) {
    conditions.push(
      or(
        ...sourceType.map((st) =>
          eq(
            transactions.sourceType,
            st as (typeof transactions.sourceType.enumValues)[number]
          )
        )
      )!
    )
  }

  if (search) {
    conditions.push(ilike(transactions.memo, `%${search}%`))
  }

  const whereClause = conditions.length > 0 ? and(...conditions) : undefined

  // Get total count
  const [totalResult] = await db
    .select({ value: count() })
    .from(transactions)
    .where(whereClause)

  const total = totalResult?.value ?? 0

  // Get rows with line aggregates
  const baseQuery = db
    .select({
      id: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      sourceType: transactions.sourceType,
      isSystemGenerated: transactions.isSystemGenerated,
      isVoided: transactions.isVoided,
      reversalOfId: transactions.reversalOfId,
      reversedById: transactions.reversedById,
      createdBy: transactions.createdBy,
      createdAt: transactions.createdAt,
      totalAmount: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      lineCount: sql<number>`COUNT(${transactionLines.id})::int`,
    })
    .from(transactions)
    .leftJoin(
      transactionLines,
      eq(transactionLines.transactionId, transactions.id)
    )
    .where(whereClause)
    .groupBy(transactions.id)
    .orderBy(desc(transactions.date), desc(transactions.id))
    .$dynamic()

  // pageSize=0 means fetch all (client-side pagination)
  if (pageSize > 0) {
    baseQuery.limit(pageSize).offset((page - 1) * pageSize)
  }

  const rows = await baseQuery

  return { rows, total }
}

export async function getTransactionById(
  id: number
): Promise<TransactionDetail | null> {
  const [txn] = await db
    .select()
    .from(transactions)
    .where(eq(transactions.id, id))

  if (!txn) return null

  // Fetch lines with resolved names
  const lines = await db
    .select({
      id: transactionLines.id,
      accountId: transactionLines.accountId,
      accountCode: accounts.code,
      accountName: accounts.name,
      fundId: transactionLines.fundId,
      fundName: funds.name,
      fundRestrictionType: funds.restrictionType,
      debit: transactionLines.debit,
      credit: transactionLines.credit,
      cipCostCodeId: transactionLines.cipCostCodeId,
      cipCostCodeName: cipCostCodes.name,
      memo: transactionLines.memo,
    })
    .from(transactionLines)
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .innerJoin(funds, eq(transactionLines.fundId, funds.id))
    .leftJoin(cipCostCodes, eq(transactionLines.cipCostCodeId, cipCostCodes.id))
    .where(eq(transactionLines.transactionId, id))

  // Fetch audit trail
  const auditEntries = await db
    .select()
    .from(auditLog)
    .where(
      and(
        eq(auditLog.entityType, 'transaction'),
        eq(auditLog.entityId, id)
      )
    )
    .orderBy(auditLog.timestamp)

  return {
    ...txn,
    lines,
    auditEntries,
  }
}

export async function createManualTransaction(
  data: {
    date: string
    memo: string
    lines: Array<{
      accountId: number
      fundId: number
      debit: number | null
      credit: number | null
      cipCostCodeId?: number | null
      memo?: string | null
    }>
  }
): Promise<{
  transactionId: number
  releaseTransactionId?: number
  lockedYearWarning?: { year: number; message: string }
}> {
  const userId = await getUserId()
  const input: InsertTransaction = {
    date: data.date,
    memo: data.memo,
    sourceType: 'MANUAL',
    isSystemGenerated: false,
    lines: data.lines,
    createdBy: userId,
  }

  const result = await createTransaction(input)

  revalidatePath('/transactions')
  return {
    transactionId: result.transaction.id,
    releaseTransactionId: result.releaseTransaction?.id,
    lockedYearWarning: result.lockedYearWarning,
  }
}

export async function editTransactionAction(
  id: number,
  updates: EditTransaction
): Promise<{
  transactionId: number
  lockedYearWarning?: { year: number; message: string }
}> {
  const userId = await getUserId()
  const result = await editTransaction(id, updates, userId)

  revalidatePath('/transactions')
  revalidatePath(`/transactions/${id}`)
  return {
    transactionId: result.transaction.id,
    lockedYearWarning: result.lockedYearWarning,
  }
}

export async function reverseTransactionAction(
  id: number
): Promise<{ reversalId: number }> {
  const userId = await getUserId()
  const result = await reverseTransaction(id, userId)

  revalidatePath('/transactions')
  revalidatePath(`/transactions/${id}`)
  revalidatePath(`/transactions/${result.transaction.id}`)
  return { reversalId: result.transaction.id }
}

export async function voidTransactionAction(
  id: number
): Promise<{ lockedYearWarning?: { year: number; message: string } }> {
  const userId = await getUserId()
  const result = await voidTransaction(id, userId)

  revalidatePath('/transactions')
  revalidatePath(`/transactions/${id}`)
  return { lockedYearWarning: result.lockedYearWarning }
}

export async function getAccountsForSelector(): Promise<AccountRow[]> {
  return db
    .select()
    .from(accounts)
    .where(eq(accounts.isActive, true))
    .orderBy(accounts.code)
}

export async function getFundsForSelector(): Promise<FundRow[]> {
  // Only show General Fund (system-locked) + restricted funds.
  // Unrestricted user-created funding sources exist for tracking, not GL posting.
  const rows = await db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
      isActive: funds.isActive,
    })
    .from(funds)
    .where(
      and(
        eq(funds.isActive, true),
        or(eq(funds.isSystemLocked, true), eq(funds.restrictionType, 'RESTRICTED'))
      )
    )
    .orderBy(funds.name)

  return rows
}

export async function getCipCostCodesForSelector(): Promise<CipCostCodeRow[]> {
  const rows = await db
    .select({
      id: cipCostCodes.id,
      code: cipCostCodes.code,
      name: cipCostCodes.name,
      category: cipCostCodes.category,
      isActive: cipCostCodes.isActive,
      sortOrder: cipCostCodes.sortOrder,
    })
    .from(cipCostCodes)
    .where(eq(cipCostCodes.isActive, true))
    .orderBy(cipCostCodes.sortOrder)

  return rows
}
