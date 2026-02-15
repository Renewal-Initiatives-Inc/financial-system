import { eq, and } from 'drizzle-orm'
import { db } from '@/lib/db'
import { accounts, functionalAllocations } from '@/lib/db/schema'

export interface AllocationDefault {
  accountId: number
  accountCode: string
  accountName: string
  subType: string | null
  programPct: number
  adminPct: number
  fundraisingPct: number
  isPermanentRule: boolean
  source: 'permanent' | 'prior-year' | 'sub-type'
}

/**
 * Static sub-type defaults for year-1 or accounts without prior history.
 */
const SUB_TYPE_DEFAULTS: Record<string, { program: number; admin: number; fundraising: number; permanent: boolean }> = {
  'Property Ops': { program: 100, admin: 0, fundraising: 0, permanent: true },
  'Non-Cash': { program: 100, admin: 0, fundraising: 0, permanent: true },
  'Financial': { program: 100, admin: 0, fundraising: 0, permanent: true },
  'Payroll': { program: 70, admin: 25, fundraising: 5, permanent: false },
  'Operating': { program: 80, admin: 20, fundraising: 0, permanent: false },
}

/**
 * Three-tier default resolution for functional allocations:
 *   1. Permanent rules (highest priority)
 *   2. Prior-year percentages (year 2+)
 *   3. Sub-type defaults (year 1 or new accounts)
 */
export async function getDefaultAllocations(
  fiscalYear: number
): Promise<AllocationDefault[]> {
  // Get all active expense accounts
  const expenseAccounts = await db
    .select({
      id: accounts.id,
      code: accounts.code,
      name: accounts.name,
      subType: accounts.subType,
    })
    .from(accounts)
    .where(
      and(eq(accounts.type, 'EXPENSE'), eq(accounts.isActive, true))
    )
    .orderBy(accounts.code)

  // Fetch all permanent rules
  const permanentRules = await db
    .select()
    .from(functionalAllocations)
    .where(eq(functionalAllocations.isPermanentRule, true))

  const permanentMap = new Map(
    permanentRules.map((r) => [r.accountId, r])
  )

  // Fetch prior-year allocations
  const priorYear = await db
    .select()
    .from(functionalAllocations)
    .where(eq(functionalAllocations.fiscalYear, fiscalYear - 1))

  const priorYearMap = new Map(
    priorYear.map((r) => [r.accountId, r])
  )

  return expenseAccounts.map((acct) => {
    // Tier 1: Permanent rule
    const permanent = permanentMap.get(acct.id)
    if (permanent) {
      return {
        accountId: acct.id,
        accountCode: acct.code,
        accountName: acct.name,
        subType: acct.subType,
        programPct: parseFloat(permanent.programPct),
        adminPct: parseFloat(permanent.adminPct),
        fundraisingPct: parseFloat(permanent.fundraisingPct),
        isPermanentRule: true,
        source: 'permanent' as const,
      }
    }

    // Tier 2: Prior-year
    const prior = priorYearMap.get(acct.id)
    if (prior) {
      return {
        accountId: acct.id,
        accountCode: acct.code,
        accountName: acct.name,
        subType: acct.subType,
        programPct: parseFloat(prior.programPct),
        adminPct: parseFloat(prior.adminPct),
        fundraisingPct: parseFloat(prior.fundraisingPct),
        isPermanentRule: false,
        source: 'prior-year' as const,
      }
    }

    // Tier 3: Sub-type defaults
    const subTypeDefault = SUB_TYPE_DEFAULTS[acct.subType ?? '']
    if (subTypeDefault) {
      return {
        accountId: acct.id,
        accountCode: acct.code,
        accountName: acct.name,
        subType: acct.subType,
        programPct: subTypeDefault.program,
        adminPct: subTypeDefault.admin,
        fundraisingPct: subTypeDefault.fundraising,
        isPermanentRule: subTypeDefault.permanent,
        source: 'sub-type' as const,
      }
    }

    // Fallback: generic split
    return {
      accountId: acct.id,
      accountCode: acct.code,
      accountName: acct.name,
      subType: acct.subType,
      programPct: 80,
      adminPct: 20,
      fundraisingPct: 0,
      isPermanentRule: false,
      source: 'sub-type' as const,
    }
  })
}
