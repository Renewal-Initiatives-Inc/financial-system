'use server'

import { revalidatePath } from 'next/cache'
import { eq, and, desc, ilike, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  transactions,
  transactionLines,
  accounts,
  funds,
  tenants,
  donors,
  vendors,
  grants,
  pledges,
  ahpLoanConfig,
} from '@/lib/db/schema'
import {
  rentPaymentSchema,
  rentAdjustmentSchema,
  donationSchema,
  earnedIncomeSchema,
  investmentIncomeSchema,
  ahpLoanForgivenessSchema,
  inKindContributionSchema,
  grantCashReceiptSchema,
  grantConditionMetSchema,
  insertGrantSchema,
  updateGrantSchema,
  insertPledgeSchema,
  type RentPayment,
  type RentAdjustment,
  type Donation,
  type EarnedIncome,
  type InvestmentIncome,
  type AhpLoanForgiveness,
  type InKindContribution,
  type GrantCashReceipt,
  type GrantConditionMet,
  type InsertGrant,
  type InsertPledge,
} from '@/lib/validators'
import { createTransaction } from '@/lib/gl/engine'
import { logAudit } from '@/lib/audit/logger'
import {
  shouldSendAcknowledgment,
  buildAcknowledgmentData,
} from '@/lib/revenue/donor-acknowledgment'
import { sendDonorAcknowledgmentEmail } from '@/lib/integrations/postmark'
import {
  recordUnconditionalGrant,
  recordGrantCashReceipt as recordGrantCashReceiptLogic,
  recordConditionalGrantCash,
  recognizeConditionalGrant,
} from '@/lib/revenue/grants'
import {
  recordLoanForgiveness,
  getAhpLoanConfig,
  getAvailableCredit,
} from '@/lib/revenue/ahp-loan'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

// --- Types ---

export type GrantRow = typeof grants.$inferSelect
export type PledgeRow = typeof pledges.$inferSelect

export type GrantWithFunder = GrantRow & {
  funderName: string
  fundName: string
}

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

export async function getGrants(filters?: {
  status?: string
}): Promise<GrantWithFunder[]> {
  const rows = await db
    .select({
      grant: grants,
      funderName: vendors.name,
      fundName: funds.name,
    })
    .from(grants)
    .leftJoin(vendors, eq(grants.funderId, vendors.id))
    .leftJoin(funds, eq(grants.fundId, funds.id))
    .where(
      filters?.status
        ? eq(
            grants.status,
            filters.status as (typeof grants.status.enumValues)[number]
          )
        : undefined
    )
    .orderBy(desc(grants.createdAt))

  return rows.map((r) => ({
    ...r.grant,
    funderName: r.funderName ?? 'Unknown',
    fundName: r.fundName ?? 'Unknown',
  }))
}

export async function getGrantById(
  id: number
): Promise<GrantWithFunder | null> {
  const [row] = await db
    .select({
      grant: grants,
      funderName: vendors.name,
      fundName: funds.name,
    })
    .from(grants)
    .leftJoin(vendors, eq(grants.funderId, vendors.id))
    .leftJoin(funds, eq(grants.fundId, funds.id))
    .where(eq(grants.id, id))

  if (!row) return null

  return {
    ...row.grant,
    funderName: row.funderName ?? 'Unknown',
    fundName: row.fundName ?? 'Unknown',
  }
}

export async function getGrantTransactions(grantId: number) {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        ilike(transactions.sourceReferenceId, `%grant%${grantId}%`),
        eq(transactions.isVoided, false)
      )
    )
    .orderBy(desc(transactions.date))
}

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
  return db
    .select({
      id: funds.id,
      name: funds.name,
      restrictionType: funds.restrictionType,
    })
    .from(funds)
    .where(eq(funds.isActive, true))
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

  // Adjustment accounts by type
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

  // Trigger acknowledgment email if >$250
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

export async function createGrant(
  data: InsertGrant,
  userId: string
): Promise<{ id: number; transactionId: number }> {
  const validated = insertGrantSchema.parse(data)
  const amount = parseFloat(validated.amount)

  // Insert grant record
  const [newGrant] = await db.transaction(async (tx) => {
    const result = await tx
      .insert(grants)
      .values({
        funderId: validated.funderId,
        amount: validated.amount,
        type: validated.type,
        conditions: validated.conditions ?? null,
        startDate: validated.startDate ?? null,
        endDate: validated.endDate ?? null,
        fundId: validated.fundId,
        isUnusualGrant: validated.isUnusualGrant ?? false,
      })
      .returning()

    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'grant',
      entityId: result[0].id,
      afterState: result[0] as unknown as Record<string, unknown>,
    })

    return result
  })

  // Create GL entry based on type
  let transactionId: number
  if (validated.type === 'UNCONDITIONAL') {
    const result = await recordUnconditionalGrant(
      newGrant.id,
      amount,
      validated.fundId,
      validated.startDate ?? new Date().toISOString().split('T')[0],
      userId
    )
    transactionId = result.transactionId
  } else {
    // Conditional: no GL entry until cash received or conditions met
    transactionId = 0
  }

  revalidatePath('/revenue')
  revalidatePath('/revenue/grants')
  return { id: newGrant.id, transactionId }
}

export async function recordGrantCashReceiptAction(
  data: GrantCashReceipt,
  userId: string
): Promise<{ transactionId: number }> {
  const validated = grantCashReceiptSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const [grant] = await db
    .select()
    .from(grants)
    .where(eq(grants.id, validated.grantId))
  if (!grant) throw new Error(`Grant ${validated.grantId} not found`)

  let result: { transactionId: number }
  if (grant.type === 'CONDITIONAL') {
    result = await recordConditionalGrantCash(
      grant.id,
      amount,
      grant.fundId,
      validated.date,
      userId
    )
  } else {
    result = await recordGrantCashReceiptLogic(
      grant.id,
      amount,
      grant.fundId,
      validated.date,
      userId
    )
  }

  revalidatePath('/revenue')
  revalidatePath('/revenue/grants')
  revalidatePath(`/revenue/grants/${grant.id}`)
  return result
}

export async function recognizeConditionalGrantRevenue(
  data: GrantConditionMet,
  userId: string
): Promise<{ transactionId: number }> {
  const validated = grantConditionMetSchema.parse(data)
  const amount = parseFloat(validated.amount)

  const [grant] = await db
    .select()
    .from(grants)
    .where(eq(grants.id, validated.grantId))
  if (!grant) throw new Error(`Grant ${validated.grantId} not found`)
  if (grant.type !== 'CONDITIONAL') {
    throw new Error('Revenue recognition is only for conditional grants')
  }

  const result = await recognizeConditionalGrant(
    grant.id,
    amount,
    grant.fundId,
    validated.date,
    validated.note,
    userId
  )

  revalidatePath('/revenue')
  revalidatePath('/revenue/grants')
  revalidatePath(`/revenue/grants/${grant.id}`)
  return result
}

export async function createPledge(
  data: InsertPledge,
  userId: string
): Promise<{ id: number; transactionId: number }> {
  const validated = insertPledgeSchema.parse(data)
  const amount = parseFloat(validated.amount)

  // GL entry: DR Pledges Receivable (1120), CR Donation Income (4200)
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

  // Insert pledge record
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

  // GL: DR Cash, CR Pledges Receivable
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

  // Update pledge status
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

  // Revenue account by in-kind type
  const revenueAccountCodes: Record<string, string> = {
    GOODS: '4500',
    SERVICES: '4510',
    FACILITY_USE: '4520',
  }

  // Debit account depends on type: goods → asset, services/facility → expense
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
