import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  tenants,
  accounts,
  funds,
  securityDepositReceipts,
  complianceDeadlines,
} from '@/lib/db/schema'
import { createTransaction } from '@/lib/gl/engine'
import { logAudit } from '@/lib/audit/logger'
import type { NeonDatabase } from 'drizzle-orm/neon-serverless'

async function getAccountByCode(code: string) {
  const [account] = await db
    .select()
    .from(accounts)
    .where(eq(accounts.code, code))
  if (!account) throw new Error(`Account ${code} not found`)
  return account
}

async function getGeneralFund() {
  const [fund] = await db
    .select()
    .from(funds)
    .where(eq(funds.name, 'General Fund'))
  if (!fund) throw new Error('General Fund not found')
  return fund
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr)
  d.setDate(d.getDate() + days)
  return d.toISOString().split('T')[0]
}

function computeAnniversary(moveInDate: string): string {
  const d = new Date(moveInDate)
  const now = new Date()
  const thisYear = now.getFullYear()
  const anniversary = new Date(thisYear, d.getMonth(), d.getDate())
  if (anniversary < now) {
    anniversary.setFullYear(thisYear + 1)
  }
  return anniversary.toISOString().split('T')[0]
}

export async function collectSecurityDeposit(
  tenantId: number,
  amount: number,
  depositDate: string,
  escrowBankRef: string,
  userId: string
): Promise<{ transactionId: number }> {
  // 1. Load tenant
  const [tenant] = await db
    .select()
    .from(tenants)
    .where(eq(tenants.id, tenantId))

  if (!tenant) throw new Error(`Tenant ${tenantId} not found`)
  if (!tenant.isActive) throw new Error('Cannot collect deposit for inactive tenant')
  if (tenant.securityDepositAmount && parseFloat(tenant.securityDepositAmount) > 0) {
    throw new Error('Security deposit already collected for this tenant')
  }

  // 2. MA maximum: deposit cannot exceed first month's rent
  const monthlyRent = parseFloat(tenant.monthlyRent)
  if (amount > monthlyRent) {
    throw new Error(
      `Deposit ($${amount.toFixed(2)}) exceeds first month's rent ($${monthlyRent.toFixed(2)}) — MA G.L. c. 186 § 15B`
    )
  }

  // 3. Resolve GL accounts
  const escrowAccount = await getAccountByCode('1020') // Security Deposit Escrow (Asset)
  const liabilityAccount = await getAccountByCode('2060') // Security Deposits Held (Liability)
  const generalFund = await getGeneralFund()

  // 4. Create GL entry: DR 1020 (Escrow), CR 2060 (Liability)
  const txnResult = await createTransaction({
    date: depositDate,
    memo: `Security deposit collected — ${tenant.name} (Unit ${tenant.unitNumber})`,
    sourceType: 'MANUAL',
    isSystemGenerated: false,
    createdBy: userId,
    lines: [
      {
        accountId: escrowAccount.id,
        fundId: generalFund.id,
        debit: amount,
        credit: null,
      },
      {
        accountId: liabilityAccount.id,
        fundId: generalFund.id,
        debit: null,
        credit: amount,
      },
    ],
  })

  // 5. Update tenant record
  const moveInDate = tenant.moveInDate ?? depositDate
  const anniversary = computeAnniversary(moveInDate)

  await db
    .update(tenants)
    .set({
      securityDepositAmount: String(amount),
      depositDate,
      escrowBankRef,
      tenancyAnniversary: anniversary,
      updatedAt: new Date(),
    })
    .where(eq(tenants.id, tenantId))

  // 6. Create receipt tracking records
  const receiptRecords = [
    {
      tenantId,
      receiptType: 'collection_receipt',
      dueDate: depositDate, // Due immediately at collection
    },
    {
      tenantId,
      receiptType: 'bank_details_receipt',
      dueDate: addDays(depositDate, 30), // Within 30 days
    },
    {
      tenantId,
      receiptType: 'statement_of_condition',
      dueDate: addDays(moveInDate, 10), // Within 10 days of move-in
    },
  ]
  await db.insert(securityDepositReceipts).values(receiptRecords)

  // 7. Create compliance deadlines
  const deadlineRecords = [
    {
      taskName: `Statement of condition — ${tenant.name} (Unit ${tenant.unitNumber})`,
      dueDate: addDays(moveInDate, 10),
      category: 'tenant' as const,
      recurrence: 'one_time' as const,
      status: 'upcoming' as const,
      tenantId,
    },
    {
      taskName: `30-day bank details receipt — ${tenant.name} (Unit ${tenant.unitNumber})`,
      dueDate: addDays(depositDate, 30),
      category: 'tenant' as const,
      recurrence: 'one_time' as const,
      status: 'upcoming' as const,
      tenantId,
    },
    {
      taskName: `Security deposit interest — ${tenant.name} (Unit ${tenant.unitNumber})`,
      dueDate: anniversary,
      category: 'tenant' as const,
      recurrence: 'per_tenant' as const,
      status: 'upcoming' as const,
      tenantId,
    },
  ]
  await db.insert(complianceDeadlines).values(deadlineRecords)

  // 8. Audit log (outside the GL engine's own audit)
  await db.transaction(async (tx) => {
    await logAudit(tx as unknown as NeonDatabase<any>, {
      userId,
      action: 'created',
      entityType: 'security_deposit',
      entityId: tenantId,
      afterState: {
        tenantId,
        amount,
        depositDate,
        escrowBankRef,
        transactionId: txnResult.transaction.id,
      },
    })
  })

  return { transactionId: txnResult.transaction.id }
}
