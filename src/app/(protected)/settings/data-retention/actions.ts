'use server'

import { sql } from 'drizzle-orm'
import { db } from '@/lib/db'

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

/**
 * Queries record age and count for each data category
 * defined in the Information Security Policy §6.3.
 */
export async function getRetentionSummary(): Promise<RetentionSummary> {
  const queries = [
    {
      label: 'GL Transactions',
      table: 'transactions',
      retentionPolicy: '7 years (IRS 501(c)(3))',
    },
    {
      label: 'Audit Log',
      table: 'audit_log',
      retentionPolicy: 'Indefinite (append-only)',
    },
    {
      label: 'Bank Transactions',
      table: 'bank_transactions',
      retentionPolicy: 'Account duration + 7 years',
    },
    {
      label: 'Bank Accounts',
      table: 'bank_accounts',
      retentionPolicy: 'Account duration + 7 years',
    },
    {
      label: 'Vendors',
      table: 'vendors',
      retentionPolicy: 'Active relationship + 7 years',
    },
    {
      label: 'Payroll Runs',
      table: 'payroll_runs',
      retentionPolicy: 'Employment + tax filing periods',
    },
    {
      label: 'Donors',
      table: 'donors',
      retentionPolicy: '7 years (IRS 501(c)(3))',
    },
    {
      label: 'Pledges',
      table: 'pledges',
      retentionPolicy: '7 years (IRS 501(c)(3))',
    },
    {
      label: 'Invoices',
      table: 'invoices',
      retentionPolicy: '7 years (IRS 501(c)(3))',
    },
    {
      label: 'Ramp Transactions',
      table: 'ramp_transactions',
      retentionPolicy: '7 years (IRS 501(c)(3))',
    },
  ]

  const categories: RetentionCategory[] = []

  for (const q of queries) {
    const timestampCol =
      q.table === 'audit_log' ? 'timestamp' : 'created_at'

    const result = await db.execute(sql.raw(`
      SELECT
        COUNT(*) AS total_records,
        MIN(${timestampCol})::text AS oldest_record,
        MAX(${timestampCol})::text AS newest_record,
        EXTRACT(YEAR FROM AGE(NOW(), MIN(${timestampCol})))
          + EXTRACT(MONTH FROM AGE(NOW(), MIN(${timestampCol}))) / 12.0
          AS age_years
      FROM ${q.table}
    `))

    const row = result.rows[0] as {
      total_records: string
      oldest_record: string | null
      newest_record: string | null
      age_years: string | null
    }

    categories.push({
      label: q.label,
      table: q.table,
      retentionPolicy: q.retentionPolicy,
      totalRecords: parseInt(row.total_records, 10),
      oldestRecord: row.oldest_record,
      newestRecord: row.newest_record,
      ageYears: row.age_years ? parseFloat(parseFloat(row.age_years).toFixed(1)) : null,
    })
  }

  return {
    categories,
    generatedAt: new Date().toISOString(),
  }
}
