'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, desc, ilike, sql, isNotNull, count, or } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  transactions,
  transactionLines,
  accounts,
  funds,
  tenants,
  donors,
  vendors,
  pledges,
  ahpLoanConfig,
  invoices,
} from '@/lib/db/schema'
import {
  rentPaymentSchema,
  rentAdjustmentSchema,
  donationSchema,
  earnedIncomeSchema,
  investmentIncomeSchema,
  ahpLoanForgivenessSchema,
  inKindContributionSchema,
  fundCashReceiptSchema,
  fundConditionMetSchema,
  insertFundingSourceSchema,
  insertFundSchema,
  updateFundSchema,
  insertPledgeSchema,
  insertArInvoiceSchema,
  type RentPayment,
  type RentAdjustment,
  type Donation,
  type EarnedIncome,
  type InvestmentIncome,
  type AhpLoanForgiveness,
  type InKindContribution,
  type FundCashReceipt,
  type FundConditionMet,
  type InsertFundingSource,
  type InsertFund,
  type UpdateFund,
  type InsertPledge,
  type InsertArInvoice,
} from '@/lib/validators'
import { createTransaction } from '@/lib/gl/engine'
import { logAudit } from '@/lib/audit/logger'
import {
  shouldSendAcknowledgment,
  buildAcknowledgmentData,
} from '@/lib/revenue/donor-acknowledgment'
import { sendDonorAcknowledgmentEmail } from '@/lib/integrations/postmark'
import {
  recordUnconditionalFunding,
  recordFundCashReceipt as recordFundCashReceiptLogic,
  recordConditionalFundingCash,
  recognizeConditionalRevenue,
} from '@/lib/revenue/funding-sources'
import {
  recordLoanForgiveness,
  getAhpLoanConfig,
  getAvailableCredit,
} from '@/lib/revenue/ahp-loan'
import { deactivateFund } from '@/lib/gl/deactivation'
import { SystemLockedError } from '@/lib/gl/errors'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

// --- Types ---

export type FundRow = typeof funds.$inferSelect

export type FundingSourceRow = FundRow & {
  funderName: string | null
}

export type FundWithBalance = FundRow & {
  balance: string
  transactionCount: number
}

export type FundDetail = FundRow & {
  balance: string
  transactionCount: number
  assetTotal: string
  liabilityTotal: string
  netAssetTotal: string
  revenueTotal: string
  expenseTotal: string
}

export type PledgeRow = typeof pledges.$inferSelect

export type PledgeWithDonor = PledgeRow & {
  donorName: string
  fundName: string
}

// --- Helper: resolve account by code ---

async function getAccountByCode(code: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, code))
  if (!account) throw new Error(`Account ${code} not found`)
  return account
}

async function getGeneralFund() {
  const [fund] = await db.select().from(funds).where(eq(funds.name, 'General Fund'))
  if (!fund) throw new Error('General Fund not found')
  return fund
}

// --- Helper: Calculate fund balance breakdown ---

async function getFundBalanceBreakdown(
  fundId: number
): Promise<{
  balance: string
  transactionCount: number
  assetTotal: string
  liabilityTotal: string
  netAssetTotal: string
  revenueTotal: string
  expenseTotal: string
}> {
  const breakdown = await db
    .select({
      accountType: accounts.type,
      totalDebit: sql<string>`COALESCE(SUM(${transactionLines.debit}), 0)`,
      totalCredit: sql<string>`COALESCE(SUM(${transactionLines.credit}), 0)`,
    })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .innerJoin(accounts, eq(transactionLines.accountId, accounts.id))
    .where(
      and(
        eq(transactionLines.fundId, fundId),
        eq(transactions.isVoided, false)
      )
    )
    .groupBy(accounts.type)

  const [txnCount] = await db
    .select({ value: count() })
    .from(transactionLines)
    .innerJoin(transactions, eq(transactionLines.transactionId, transactions.id))
    .where(
      and(
        eq(transactionLines.fundId, fundId),
        eq(transactions.isVoided, false)
      )
    )

  const byType: Record<string, { debit: number; credit: number }> = {}
  for (const row of breakdown) {
    byType[row.accountType] = {
      debit: parseFloat(row.totalDebit),
      credit: parseFloat(row.totalCredit),
    }
  }

  const getNet = (type: string) => {
    const t = byType[type]
    if (!t) return 0
    return t.debit - t.credit
  }

  const assetNet = getNet('ASSET')
  const liabilityNet = getNet('LIABILITY')
  const netAssetNet = getNet('NET_ASSET')
  const revenueNet = getNet('REVENUE')
  const expenseNet = getNet('EXPENSE')

  const totalDebit = Object.values(byType).reduce((s, t) => s + t.debit, 0)
  const totalCredit = Object.values(byType).reduce((s, t) => s + t.credit, 0)
  const netBalance = totalDebit - totalCredit

  return {
    balance: netBalance.toFixed(2),
    transactionCount: txnCount?.value ?? 0,
    assetTotal: assetNet.toFixed(2),
    liabilityTotal: liabilityNet.toFixed(2),
    netAssetTotal: netAssetNet.toFixed(2),
    revenueTotal: revenueNet.toFixed(2),
    expenseTotal: expenseNet.toFixed(2),
  }
}

// --- Query Actions ---

export async function getRecentRevenue(limit = 20) {
  const rows = await db
    .select()
    .from(transactions)
    .where(eq(transactions.isVoided, false))
    .orderBy(desc(transactions.createdAt))
    .limit(limit)

  return rows
}

export async function getRentAccruals(year: number, month: number) {
  const monthStr = String(month).padStart(2, '0')
  const pattern = `%rent accrual%${year}-${monthStr}%`

  return db
    .select()
    .from(transactions)
    .where(
      and(
        ilike(transactions.memo, pattern),
        eq(transactions.sourceType, 'SYSTEM'),
        eq(transactions.isVoided, false)
      )
    )
    .orderBy(transactions.date)
}

// --- Funding Source Queries ---

export async function getFundingSources(filters?: {
  status?: string
}): Promise<FundingSourceRow[]> {
  const conditions = [eq(funds.isSystemLocked, false)]
  if (filters?.status) {
    conditions.push(
      eq(
        funds.status,
        filters.status as (typeof funds.status.enumValues)[number]
      )
    )
  }

  const rows = await db
    .select({
      fund: funds,
      funderName: vendors.name,
    })
    .from(funds)
    .leftJoin(vendors, eq(funds.funderId, vendors.id))
    .where(and(...conditions))
    .orderBy(desc(funds.createdAt))

  return rows.map((r) => ({
    ...r.fund,
    funderName: r.funderName ?? null,
  }))
}

export async function getFundingSourceById(
  id: number
): Promise<(FundDetail & { funderName: string | null }) | null> {
  const [row] = await db
    .select({
      fund: funds,
      funderName: vendors.name,
    })
    .from(funds)
    .leftJoin(vendors, eq(funds.funderId, vendors.id))
    .where(eq(funds.id, id))

  if (!row) return null

  const balanceInfo = await getFundBalanceBreakdown(id)

  return {
    ...row.fund,
    ...balanceInfo,
    funderName: row.funderName ?? null,
  }
}

export async function getFundingSourceTransactions(fundId: number) {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        ilike(transactions.sourceReferenceId, `fund%${fundId}%`),
        eq(transactions.isVoided, false)
      )
    )
    .orderBy(desc(transactions.date))
}

// --- Fund Management Queries (merged from /funds/actions.ts) ---

export async function getFunds(): Promise<FundWithBalance[]> {
  const allFunds = await db
    .select()
    .from(funds)
    .orderBy(funds.name)

  const result: FundWithBalance[] = []
  for (const fund of allFunds) {
    const balanceInfo = await getFundBalanceBreakdown(fund.id)
    result.push({
      ...fund,
      balance: balanceInfo.balance,
      transactionCount: balanceInfo.transactionCount,
    })
  }

  return result
}

export async function getFundById(id: number): Promise<FundDetail | null> {
  const [fund] = await db
    .select()
    .from(funds)
    .where(eq(funds.id, id))

  if (!fund) return null

  const balanceInfo = await getFundBalanceBreakdown(id)

  return {
    ...fund,
    ...balanceInfo,
  }
}

// --- Pledge Queries ---

export async function getPledges(filters?: {
  status?: string
}): Promise<PledgeWithDonor[]> {
  const rows = await db
    .select({
      pledge: pledges,
      donorName: donors.name,
      fundName: funds.name,
    })
    .from(pledges)
    .leftJoin(donors, eq(pledges.donorId, donors.id))
    .leftJoin(funds, eq(pledges.fundId, funds.id))
    .where(
      filters?.status
        ? eq(
            pledges.status,
            filters.status as (typeof pledges.status.enumValues)[number]
          )
        : undefined
    )
    .orderBy(desc(pledges.createdAt))

  return rows.map((r) => ({
    ...r.pledge,
    donorName: r.donorName ?? 'Unknown',
    fundName: r.fundName ?? 'Unknown',
  }))
}

export async function getPledgeById(
  id: number
): Promise<PledgeWithDonor | null> {
  const [row] = await db
    .select({
      pledge: pledges,
      donorName: donors.name,
      fundName: funds.name,
    })
    .from(pledges)
    .leftJoin(donors, eq(pledges.donorId, donors.id))
    .leftJoin(funds, eq(pledges.fundId, funds.id))
    .where(eq(pledges.id, id))

  if (!row) return null

  return {
    ...row.pledge,
    donorName: row.donorName ?? 'Unknown',
    fundName: row.fundName ?? 'Unknown',
  }
}

export async function getDonations(limit = 50) {
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        ilike(transactions.memo, '%donation%'),
        eq(transactions.isVoided, false)
      )
    )
    .orderBy(desc(transactions.date))
    .limit(limit)
}

export async function getRecentEarnedIncome(limit = 20) {
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        ilike(transactions.memo, 'Earned income%'),
        eq(transactions.isVoided, false)
      )
    )
    .orderBy(desc(transactions.date))
    .limit(limit)
}

export async function getRecentInvestmentIncome(limit = 20) {
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        ilike(transactions.memo, 'Investment income%'),
        eq(transactions.isVoided, false)
      )
    )
    .orderBy(desc(transactions.date))
    .limit(limit)
}

export async function getRecentInKindContributions(limit = 20) {
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        ilike(transactions.memo, 'In-kind contribution%'),
        eq(transactions.isVoided, false)
      )
    )
    .orderBy(desc(transactions.date))
    .limit(limit)
}

export async function getRecentAhpForgiveness(limit = 20) {
  return db
    .select({
      id: transactions.id,
      date: transactions.date,
      memo: transactions.memo,
      createdAt: transactions.createdAt,
    })
    .from(transactions)
    .where(
      and(
        ilike(transactions.memo, '%forgiveness%'),
        eq(transactions.isVoided, false)
      )
    )
    .orderBy(desc(transactions.date))
    .limit(limit)
}

export async function getAhpLoanStatus() {
  return getAhpLoanConfig()
}

// --- Dropdown helpers ---

export async function getActiveTenants() {
  return db
    .select({
      id: tenants.id,
      name: tenants.name,
      unitNumber: tenants.unitNumber,
      monthlyRent: tenants.monthlyRent,
    })
    .from(tenants)
    .where(eq(tenants.isActive, true))
    .orderBy(tenants.name)
}

export async function getActiveDonors() {
  return db
    .select({
      id: donors.id,
      name: donors.name,
      email: donors.email,
    })
    .from(donors)
    .where(eq(donors.isActive, true))
    .orderBy(donors.name)
}

export async function getActiveVendors() {
  return db
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .where(eq(vendors.isActive, true))
    .orderBy(vendors.name)
}

export async function getActiveFunds() {
  // Only show General Fund (system-locked) + restricted funds.
  // Unrestricted user-created funding sources exist for tracking, not GL posting.
  return db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
    })
    .from(funds)
    .where(
      and(
        eq(funds.isActive, true),
        or(eq(funds.isSystemLocked, true), eq(funds.restrictionType, 'RESTRICTED'))
      )
    )
    .orderBy(funds.name)
}

export async function getRevenueAccounts() {
  return db
    .select({ id: accounts.id, name: accounts.name, code: accounts.code })
    .from(accounts)
    .where(and(eq(accounts.type, 'REVENUE'), eq(accounts.isActive, true)))
    .orderBy(accounts.code)
}

// --- Mutation Actions ---

export async function recordRentPayment(
  data: RentPayment,
  userId: string
): Promise<{ transactionId: number }> {
  const validated = rentPaymentSchema.parse(data)
  const cashAccount = await getAccountByCode('1000')
  const arAccount = await getAccountByCode('1100')
  const amount = parseFloat(validated.amount)

  const txnResult = await createTransaction({
    date: validated.date,
    memo: `Rent payment received`,
    sourceType: 'MANUAL',
    createdBy: userId,
    lines: [
      {
        accountId: cashAccount.id,
        fundId: validated.fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: arAccount.id,
        fundId: validated.fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  revalidatePath('/revenue')
  revalidatePath('/transactions')
  return { transactionId: txnResult.transaction.id }
}

export async function recordRentAdjustment(
  data: RentAdjustment,
  userId: string
): Promise<{ transactionId: number }> {
  const validated = rentAdjustmentSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const adjustmentAccountCodes: Record<string, string> = {
    PRORATION: '4010',
    HARDSHIP: '4020',
    VACATE: '4030',
  }

  const arAccount = await getAccountByCode('1100')
  const adjustmentAccount = await getAccountByCode(
    adjustmentAccountCodes[validated.adjustmentType] ?? '4010'
  )

  const txnResult = await createTransaction({
    date: validated.date,
    memo: `Rent adjustment (${validated.adjustmentType}) - ${validated.note}`,
    sourceType: 'MANUAL',
    createdBy: userId,
    lines: [
      {
        accountId: adjustmentAccount.id,
        fundId: validated.fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: arAccount.id,
        fundId: validated.fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  revalidatePath('/revenue')
  revalidatePath('/transactions')
  return { transactionId: txnResult.transaction.id }
}

export async function recordDonation(
  data: Donation,
  userId: string
): Promise<{ transactionId: number; acknowledgmentSent: boolean }> {
  const validated = donationSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const cashAccount = await getAccountByCode('1000')
  const donationIncomeAccount = await getAccountByCode('4200')

  const txnResult = await createTransaction({
    date: validated.date,
    memo: `Donation received - ${validated.contributionSourceType}`,
    sourceType: 'MANUAL',
    createdBy: userId,
    lines: [
      {
        accountId: cashAccount.id,
        fundId: validated.fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: donationIncomeAccount.id,
        fundId: validated.fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  let acknowledgmentSent = false
  if (shouldSendAcknowledgment(amount)) {
    const [donor] = await db
      .select()
      .from(donors)
      .where(eq(donors.id, validated.donorId))
    const [fund] = await db
      .select()
      .from(funds)
      .where(eq(funds.id, validated.fundId))

    if (donor?.email) {
      const ackData = buildAcknowledgmentData(
        donor.name,
        donor.email,
        validated.date,
        validated.amount,
        fund?.name ?? 'General Fund'
      )
      acknowledgmentSent = await sendDonorAcknowledgmentEmail(
        donor.email,
        ackData
      )
    }
  }

  revalidatePath('/revenue')
  revalidatePath('/transactions')
  revalidatePath('/donors')
  return { transactionId: txnResult.transaction.id, acknowledgmentSent }
}

// --- Funding Source Mutations ---

export async function createFundingSource(
  data: InsertFundingSource,
  userId: string
): Promise<{ id: number; transactionId: number }> {
  const validated = insertFundingSourceSchema.parse(data)

  // Create the fund (a funding source IS a fund)
  const [newFund] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(funds)
      .values({
        name: validated.name,
        fundingCategory: validated.fundingCategory,
        restrictionType: validated.restrictionType,
        description: validated.description ?? null,
        funderId: validated.funderId,
        amount: validated.amount ?? null,
        type: validated.type ?? null,
        conditions: validated.conditions ?? null,
        startDate: validated.startDate ?? null,
        endDate: validated.endDate ?? null,
        isUnusualGrant: validated.isUnusualGrant ?? false,
        matchRequirementPercent: validated.matchRequirementPercent ?? null,
        retainagePercent: validated.retainagePercent ?? null,
        reportingFrequency: validated.reportingFrequency ?? null,
        interestRate: validated.interestRate ?? null,
        contractPdfUrl: validated.contractPdfUrl ?? null,
        extractedMilestones: validated.extractedMilestones ?? null,
        extractedTerms: validated.extractedTerms ?? null,
        extractedCovenants: validated.extractedCovenants ?? null,
        revenueClassification: validated.revenueClassification ?? null,
        classificationRationale: validated.classificationRationale ?? null,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'fund',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  // Create GL entry for unconditional grants/contracts (restricted or unrestricted)
  let transactionId = 0
  if (
    (validated.fundingCategory === 'GRANT' || validated.fundingCategory === 'CONTRACT') &&
    validated.type === 'UNCONDITIONAL' &&
    validated.amount
  ) {
    const amount = parseFloat(validated.amount)
    const result = await recordUnconditionalFunding(
      newFund.id,
      amount,
      validated.startDate ?? new Date().toISOString().split('T')[0],
      userId
    )
    transactionId = result.transactionId
  }

  revalidatePath('/revenue')
  revalidatePath('/revenue/funding-sources')
  return { id: newFund.id, transactionId }
}

export async function createFund(
  data: InsertFund,
  userId: string
): Promise<{ id: number }> {
  const validated = insertFundSchema.parse(data)

  const [newFund] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(funds)
      .values({
        name: validated.name,
        restrictionType: validated.restrictionType,
        description: validated.description ?? null,
        isSystemLocked: validated.isSystemLocked ?? false,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'fund',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/revenue/funding-sources')
  return { id: newFund.id }
}

export async function updateFund(
  id: number,
  data: UpdateFund,
  userId: string
): Promise<void> {
  const validated = updateFundSchema.parse(data)

  await db.transaction(async (tx) => {
    const [existing] = await tx
      .select()
      .from(funds)
      .where(eq(funds.id, id))

    if (!existing) {
      throw new Error(`Fund ${id} not found`)
    }

    if (existing.isSystemLocked && validated.name !== undefined) {
      throw new SystemLockedError('Fund', id)
    }

    const beforeState = { ...existing }

    await tx
      .update(funds)
      .set({
        ...(validated.name !== undefined ? { name: validated.name } : {}),
        ...(validated.description !== undefined ? { description: validated.description } : {}),
        ...(validated.funderId !== undefined ? { funderId: validated.funderId } : {}),
        ...(validated.amount !== undefined ? { amount: validated.amount } : {}),
        ...(validated.type !== undefined ? { type: validated.type } : {}),
        ...(validated.conditions !== undefined ? { conditions: validated.conditions } : {}),
        ...(validated.startDate !== undefined ? { startDate: validated.startDate } : {}),
        ...(validated.endDate !== undefined ? { endDate: validated.endDate } : {}),
        ...(validated.status !== undefined ? { status: validated.status } : {}),
        ...(validated.isUnusualGrant !== undefined ? { isUnusualGrant: validated.isUnusualGrant } : {}),
        ...(validated.matchRequirementPercent !== undefined ? { matchRequirementPercent: validated.matchRequirementPercent } : {}),
        ...(validated.retainagePercent !== undefined ? { retainagePercent: validated.retainagePercent } : {}),
        ...(validated.reportingFrequency !== undefined ? { reportingFrequency: validated.reportingFrequency } : {}),
        ...(validated.interestRate !== undefined ? { interestRate: validated.interestRate } : {}),
        updatedAt: new Date(),
      })
      .where(eq(funds.id, id))

    const [updated] = await tx
      .select()
      .from(funds)
      .where(eq(funds.id, id))

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'updated',
      entityType: 'fund',
      entityId: id,
      beforeState: beforeState as unknown as Record<string, unknown>,
      afterState: updated as unknown as Record<string, unknown>,
    })
  })

  revalidatePath('/revenue/funding-sources')
  revalidatePath(`/revenue/funding-sources/${id}`)
}

export async function toggleFundActive(
  id: number,
  active: boolean,
  userId: string
): Promise<void> {
  if (!active) {
    await deactivateFund(id, userId)
  } else {
    await db.transaction(async (tx) => {
      const [existing] = await tx
        .select()
        .from(funds)
        .where(eq(funds.id, id))

      if (!existing) {
        throw new Error(`Fund ${id} not found`)
      }

      await tx
        .update(funds)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(funds.id, id))

      await logAudit(tx as unknown as NeonDatabase<any>, {
        userId,
        action: 'updated',
        entityType: 'fund',
        entityId: id,
        beforeState: { isActive: false },
        afterState: { isActive: true },
      })
    })
  }

  revalidatePath('/revenue/funding-sources')
  revalidatePath(`/revenue/funding-sources/${id}`)
}

export async function recordFundCashReceiptAction(
  data: FundCashReceipt,
  userId: string
): Promise<{ transactionId: number }> {
  const validated = fundCashReceiptSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const [fund] = await db
    .select()
    .from(funds)
    .where(eq(funds.id, validated.fundId))
  if (!fund) throw new Error(`Funding source ${validated.fundId} not found`)

  let result: { transactionId: number }
  if (fund.type === 'CONDITIONAL') {
    result = await recordConditionalFundingCash(
      fund.id,
      amount,
      validated.date,
      userId
    )
  } else {
    result = await recordFundCashReceiptLogic(
      fund.id,
      amount,
      validated.date,
      userId
    )
  }

  revalidatePath('/revenue')
  revalidatePath('/revenue/funding-sources')
  revalidatePath(`/revenue/funding-sources/${fund.id}`)
  return result
}

export async function recognizeConditionalFundRevenue(
  data: FundConditionMet,
  userId: string
): Promise<{ transactionId: number }> {
  const validated = fundConditionMetSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const [fund] = await db
    .select()
    .from(funds)
    .where(eq(funds.id, validated.fundId))
  if (!fund) throw new Error(`Funding source ${validated.fundId} not found`)
  if (fund.type !== 'CONDITIONAL') {
    throw new Error('Revenue recognition is only for conditional funding sources')
  }

  const result = await recognizeConditionalRevenue(
    fund.id,
    amount,
    validated.date,
    validated.note,
    userId
  )

  revalidatePath('/revenue')
  revalidatePath('/revenue/funding-sources')
  revalidatePath(`/revenue/funding-sources/${fund.id}`)
  return result
}

// --- Pledge Actions ---

export async function createPledge(
  data: InsertPledge,
  userId: string
): Promise<{ id: number; transactionId: number }> {
  const validated = insertPledgeSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const pledgesReceivable = await getAccountByCode('1120')
  const donationIncome = await getAccountByCode('4200')
  const date = validated.expectedDate ?? new Date().toISOString().split('T')[0]

  const txnResult = await createTransaction({
    date,
    memo: `Pledge recorded`,
    sourceType: 'MANUAL',
    createdBy: userId,
    lines: [
      {
        accountId: pledgesReceivable.id,
        fundId: validated.fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: donationIncome.id,
        fundId: validated.fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  const [newPledge] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(pledges)
      .values({
        donorId: validated.donorId,
        amount: validated.amount,
        expectedDate: validated.expectedDate ?? null,
        fundId: validated.fundId,
        glTransactionId: txnResult.transaction.id,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'pledge',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  revalidatePath('/revenue')
  revalidatePath('/revenue/pledges')
  return { id: newPledge.id, transactionId: txnResult.transaction.id }
}

export async function recordPledgePayment(
  pledgeId: number,
  amount: string,
  date: string,
  userId: string
): Promise<{ transactionId: number }> {
  const parsedAmount = parseFloat(amount)
  if (isNaN(parsedAmount) || parsedAmount <= 0) {
    throw new Error('Invalid payment amount')
  }

  const [pledge] = await db
    .select()
    .from(pledges)
    .where(eq(pledges.id, pledgeId))
  if (!pledge) throw new Error(`Pledge ${pledgeId} not found`)

  const cashAccount = await getAccountByCode('1000')
  const pledgesReceivable = await getAccountByCode('1120')

  const txnResult = await createTransaction({
    date,
    memo: `Pledge payment received - Pledge #${pledgeId}`,
    sourceType: 'MANUAL',
    createdBy: userId,
    lines: [
      {
        accountId: cashAccount.id,
        fundId: pledge.fundId,
        debit: parsedAmount,
        credit: null,
      },
      {
        accountId: pledgesReceivable.id,
        fundId: pledge.fundId,
        debit: null,
        credit: parsedAmount,
      },
    ],
  })

  await db
    .update(pledges)
    .set({
      status: 'RECEIVED',
      updatedAt: new Date(),
    })
    .where(eq(pledges.id, pledgeId))

  revalidatePath('/revenue')
  revalidatePath('/revenue/pledges')
  return { transactionId: txnResult.transaction.id }
}

export async function recordEarnedIncome(
  data: EarnedIncome,
  userId: string
): Promise<{ transactionId: number }> {
  const validated = earnedIncomeSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const cashAccount = await getAccountByCode('1000')

  const txnResult = await createTransaction({
    date: validated.date,
    memo: `Earned income - ${validated.description}`,
    sourceType: 'MANUAL',
    createdBy: userId,
    lines: [
      {
        accountId: cashAccount.id,
        fundId: validated.fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: validated.accountId,
        fundId: validated.fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  revalidatePath('/revenue')
  revalidatePath('/transactions')
  return { transactionId: txnResult.transaction.id }
}

export async function recordInvestmentIncome(
  data: InvestmentIncome,
  userId: string
): Promise<{ transactionId: number }> {
  const validated = investmentIncomeSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const cashAccount = await getAccountByCode('1000')
  const investmentIncomeAccount = await getAccountByCode('4400')
  const generalFund = await getGeneralFund()

  const txnResult = await createTransaction({
    date: validated.date,
    memo: `Investment income received`,
    sourceType: 'MANUAL',
    createdBy: userId,
    lines: [
      {
        accountId: cashAccount.id,
        fundId: generalFund.id,
        debit: amount,
        credit: null,
      },
      {
        accountId: investmentIncomeAccount.id,
        fundId: generalFund.id,
        debit: null,
        credit: amount,
      },
    ],
  })

  revalidatePath('/revenue')
  revalidatePath('/transactions')
  return { transactionId: txnResult.transaction.id }
}

export async function recordAhpLoanForgivenessAction(
  data: AhpLoanForgiveness,
  userId: string
): Promise<{ transactionId: number }> {
  const validated = ahpLoanForgivenessSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const result = await recordLoanForgiveness(amount, validated.date, userId)

  revalidatePath('/revenue')
  revalidatePath('/transactions')
  return result
}

export async function recordInKindContribution(
  data: InKindContribution,
  userId: string
): Promise<{ transactionId: number }> {
  const validated = inKindContributionSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const revenueAccountCodes: Record<string, string> = {
    GOODS: '4500',
    SERVICES: '4510',
    FACILITY_USE: '4520',
  }

  const debitAccountCodes: Record<string, string> = {
    GOODS: '1200',
    SERVICES: '5900',
    FACILITY_USE: '5910',
  }

  const debitAccount = await getAccountByCode(
    debitAccountCodes[validated.inKindType] ?? '5900'
  )
  const revenueAccount = await getAccountByCode(
    revenueAccountCodes[validated.inKindType] ?? '4500'
  )

  const txnResult = await createTransaction({
    date: validated.date,
    memo: `In-kind contribution (${validated.inKindType}) - ${validated.description}`,
    sourceType: 'MANUAL',
    createdBy: userId,
    lines: [
      {
        accountId: debitAccount.id,
        fundId: validated.fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: revenueAccount.id,
        fundId: validated.fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  revalidatePath('/revenue')
  revalidatePath('/transactions')
  return { transactionId: txnResult.transaction.id }
}

// --- AR Invoice actions ---

export type ArInvoiceRow = typeof invoices.$inferSelect

/**
 * Get all AR invoices for a funding source, newest first.
 */
export async function getArInvoices(fundId: number): Promise<ArInvoiceRow[]> {
  return db
    .select()
    .from(invoices)
    .where(and(eq(invoices.fundId, fundId), eq(invoices.direction, 'AR')))
    .orderBy(desc(invoices.invoiceDate))
}

/**
 * Issue an AR invoice against a funding source.
 * GL: DR 1110 Grants Receivable, CR revenue account (4100 or 4300)
 */
export async function createArInvoice(
  data: InsertArInvoice,
  userId: string
): Promise<{ id: number; glTransactionId: number }> {
  const validated = insertArInvoiceSchema.parse(data)

  const [fund] = await db
    .select()
    .from(funds)
    .where(eq(funds.id, validated.fundId))
  if (!fund) throw new Error(`Funding source ${validated.fundId} not found`)

  const revenueCode = fund.revenueClassification === 'EARNED_INCOME' ? '4300' : '4100'

  const [arAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1110'))
  if (!arAccount)
    throw new Error('Grants Receivable account (1110) not found. Run seed data first.')

  const [revenueAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, revenueCode))
  if (!revenueAccount)
    throw new Error(`Revenue account (${revenueCode}) not found. Run seed data first.`)

  const [newInvoice] = await db
    .insert(invoices)
    .values({
      direction: 'AR',
      fundId: validated.fundId,
      purchaseOrderId: null,
      vendorId: null,
      invoiceNumber: validated.invoiceNumber ?? null,
      amount: String(validated.amount),
      invoiceDate: validated.invoiceDate,
      dueDate: validated.dueDate ?? null,
      paymentStatus: 'PENDING',
      createdBy: userId,
    })
    .returning()

  const invoiceRef = validated.invoiceNumber || `AR-${newInvoice.id}`

  // GL: DR Grants Receivable, CR Grant Revenue
  const txnResult = await createTransaction({
    date: validated.invoiceDate,
    memo: `AR Invoice ${invoiceRef} — ${fund.name}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `ar-invoice:${newInvoice.id}`,
    isSystemGenerated: false,
    createdBy: userId,
    lines: [
      {
        accountId: arAccount.id,
        fundId: validated.fundId,
        debit: validated.amount,
        credit: null,
      },
      {
        accountId: revenueAccount.id,
        fundId: validated.fundId,
        debit: null,
        credit: validated.amount,
      },
    ],
  })

  await db
    .update(invoices)
    .set({
      glTransactionId: txnResult.transaction.id,
      paymentStatus: 'POSTED',
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, newInvoice.id))

  revalidatePath(`/revenue/funding-sources/${validated.fundId}`)
  revalidatePath('/revenue/funding-sources')

  return { id: newInvoice.id, glTransactionId: txnResult.transaction.id }
}

/**
 * Record payment received for an AR invoice.
 * GL: DR Cash (1000), CR Grants Receivable (1110)
 */
export async function recordArInvoicePayment(
  invoiceId: number,
  paymentDate: string,
  userId: string
): Promise<{ glTransactionId: number }> {
  const [invoice] = await db
    .select()
    .from(invoices)
    .where(eq(invoices.id, invoiceId))

  if (!invoice) throw new Error(`Invoice ${invoiceId} not found`)
  if (invoice.direction !== 'AR')
    throw new Error('Can only record payment for AR invoices here')
  if (invoice.paymentStatus === 'PAID')
    throw new Error('Invoice is already paid')
  if (!invoice.fundId) throw new Error('AR invoice has no associated fund')

  const [cashAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1000'))
  if (!cashAccount)
    throw new Error('Checking account (1000) not found. Run seed data first.')

  const [arAccount] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, '1110'))
  if (!arAccount)
    throw new Error('Grants Receivable account (1110) not found. Run seed data first.')

  const invoiceRef = invoice.invoiceNumber || `AR-${invoice.id}`
  const amount = parseFloat(invoice.amount)

  const txnResult = await createTransaction({
    date: paymentDate,
    memo: `Payment received — ${invoiceRef}`,
    sourceType: 'MANUAL',
    sourceReferenceId: `ar-payment:${invoice.id}`,
    isSystemGenerated: false,
    createdBy: userId,
    lines: [
      {
        accountId: cashAccount.id,
        fundId: invoice.fundId,
        debit: amount,
        credit: null,
      },
      {
        accountId: arAccount.id,
        fundId: invoice.fundId,
        debit: null,
        credit: amount,
      },
    ],
  })

  await db
    .update(invoices)
    .set({ paymentStatus: 'PAID', updatedAt: new Date() })
    .where(eq(invoices.id, invoiceId))

  revalidatePath(`/revenue/funding-sources/${invoice.fundId}`)
  revalidatePath('/revenue/funding-sources')

  return { glTransactionId: txnResult.transaction.id }
}
