import { eq, and, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { vendors, invoices } from '@/lib/db/schema'
import type { WorkflowConfig } from '../workflow-types'

export const tax1099NECConfig: WorkflowConfig = {
  workflowType: 'tax_1099_nec',
  displayName: '1099-NEC Filing',
  cluster: 'A',
  requiresWarningDialog: true,
  steps: {
    checklist: {
      autoChecks: [
        {
          id: '1099-vendor-threshold',
          label: 'At least one vendor with W-9 collected and payments ≥ $600 in calendar year',
          check: async () => {
            const year = new Date().getFullYear() - 1
            const startDate = `${year}-01-01`
            const endDate = `${year}-12-31`
            const [row] = await db
              .select({
                total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS numeric)), 0)`,
              })
              .from(invoices)
              .innerJoin(vendors, eq(invoices.vendorId, vendors.id))
              .where(
                and(
                  eq(invoices.paymentStatus, 'PAID'),
                  eq(vendors.w9Status, 'COLLECTED'),
                  eq(vendors.is1099Eligible, true),
                  gte(invoices.invoiceDate, startDate),
                  lte(invoices.invoiceDate, endDate)
                )
              )
              .limit(1)
            return parseFloat(row?.total ?? '0') >= 600
          },
        },
        {
          id: '1099-txns-posted',
          label: 'All qualifying vendor transactions posted to GL',
          check: async () => {
            const year = new Date().getFullYear() - 1
            const startDate = `${year}-01-01`
            const endDate = `${year}-12-31`
            // Check that no 1099-eligible vendor invoices are missing a GL transaction
            const [unposted] = await db
              .select({ id: invoices.id })
              .from(invoices)
              .innerJoin(vendors, eq(invoices.vendorId, vendors.id))
              .where(
                and(
                  eq(vendors.is1099Eligible, true),
                  eq(invoices.paymentStatus, 'PAID'),
                  gte(invoices.invoiceDate, startDate),
                  lte(invoices.invoiceDate, endDate),
                  sql`${invoices.glTransactionId} IS NULL`
                )
              )
              .limit(1)
            return !unposted
          },
        },
      ],
      manualChecks: [
        {
          id: 'w9-collected',
          label: 'All vendor tax IDs (W-9s) collected for vendors paid ≥ $600?',
          requiresExplanation: true,
        },
        {
          id: 'nec-amounts-verified',
          label: 'Non-employee compensation amounts verified against vendor payments?',
          requiresExplanation: false,
        },
      ],
    },
    scan: {
      reportSlugs: ['vendor-1099', 'ap-aging'],
      aiPromptTemplate: 'tax_1099_nec',
      citations: [
        {
          label: 'IRC §6041A; 26 CFR §1.6041A-1',
          url: 'https://www.irs.gov/form1099nec',
        },
        {
          label: 'IRS Publication 1220 — Filing Information Returns',
          url: 'https://www.irs.gov/pub/irs-pdf/p1220.pdf',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-1099-package',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/1099-nec/',
      notifyRoles: ['admin'],
    },
  },
}
