'use server'

import { count, min, max, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  transactions,
  auditLog,
  bankTransactions,
  bankAccounts,
  vendors,
  payrollRuns,
  donors,
  pledges,
  invoices,
  rampTransactions,
} from '@/lib/db/schema'
import type { PgTable } from 'drizzle-orm/pg-core'

export interface RetentionCategory {
  label: string
  table: string
  retentionPolicy: string
  totalRecords: number
  oldestRecord: string | null
  newestRecord: string | null
  ageYears: number | null
}

export interface RetentionSummary {
  categories: RetentionCategory[]
  generatedAt: string
}

// Hardcoded table references — no dynamic table names
const retentionQueries: {
  label: string
  tableName: string
  retentionPolicy: string
  table: PgTable
  timestampCol: string
}[] = [
  {
    label: 'GL Transactions',
    tableName: 'transactions',
    retentionPolicy: '7 years (IRS 501(c)(3))',
    table: transactions,
    timestampCol: 'created_at',
  },
  {
    label: 'Audit Log',
    tableName: 'audit_log',
    retentionPolicy: 'Indefinite (append-only)',
    table: auditLog,
    timestampCol: 'timestamp',
  },
  {
    label: 'Bank Transactions',
    tableName: 'bank_transactions',
    retentionPolicy: 'Account duration + 7 years',
    table: bankTransactions,
    timestampCol: 'created_at',
  },
  {
    label: 'Bank Accounts',
    tableName: 'bank_accounts',
    retentionPolicy: 'Account duration + 7 years',
    table: bankAccounts,
    timestampCol: 'created_at',
  },
  {
    label: 'Vendors',
    tableName: 'vendors',
    retentionPolicy: 'Active relationship + 7 years',
    table: vendors,
    timestampCol: 'created_at',
  },
  {
    label: 'Payroll Runs',
    tableName: 'payroll_runs',
    retentionPolicy: 'Employment + tax filing periods',
    table: payrollRuns,
    timestampCol: 'created_at',
  },
  {
    label: 'Donors',
    tableName: 'donors',
    retentionPolicy: '7 years (IRS 501(c)(3))',
    table: donors,
    timestampCol: 'created_at',
  },
  {
    label: 'Pledges',
    tableName: 'pledges',
    retentionPolicy: '7 years (IRS 501(c)(3))',
    table: pledges,
    timestampCol: 'created_at',
  },
  {
    label: 'Invoices',
    tableName: 'invoices',
    retentionPolicy: '7 years (IRS 501(c)(3))',
    table: invoices,
    timestampCol: 'created_at',
  },
  {
    label: 'Ramp Transactions',
    tableName: 'ramp_transactions',
    retentionPolicy: '7 years (IRS 501(c)(3))',
    table: rampTransactions,
    timestampCol: 'created_at',
  },
]

/**
 * Queries record age and count for each data category
 * defined in the Information Security Policy §6.3.
 *
 * Uses explicit Drizzle table references instead of sql.raw()
 * to prevent SQL injection (FS-C1).
 */
export async function getRetentionSummary(): Promise<RetentionSummary> {
  const categories: RetentionCategory[] = []

  for (const q of retentionQueries) {
    const tsCol = sql.identifier(q.timestampCol)

    const result = await db
      .select({
        totalRecords: count(),
        oldestRecord: sql<string | null>`min(${tsCol})::text`,
        newestRecord: sql<string | null>`max(${tsCol})::text`,
        ageYears: sql<string | null>`
          EXTRACT(YEAR FROM AGE(NOW(), min(${tsCol})))
            + EXTRACT(MONTH FROM AGE(NOW(), min(${tsCol}))) / 12.0
        `,
      })
      .from(q.table)

    const row = result[0]

    categories.push({
      label: q.label,
      table: q.tableName,
      retentionPolicy: q.retentionPolicy,
      totalRecords: Number(row.totalRecords),
      oldestRecord: row.oldestRecord,
      newestRecord: row.newestRecord,
      ageYears: row.ageYears ? parseFloat(parseFloat(row.ageYears).toFixed(1)) : null,
    })
  }

  return {
    categories,
    generatedAt: new Date().toISOString(),
  }
}
