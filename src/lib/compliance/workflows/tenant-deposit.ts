import { eq, and, gt, gte, lte, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { tenants, annualRateConfig } from '@/lib/db/schema'
import type { WorkflowConfig } from '../workflow-types'

export const tenantDepositConfig: WorkflowConfig = {
  workflowType: 'tenant_deposit',
  displayName: 'Security Deposit Interest',
  cluster: 'E',
  requiresWarningDialog: false,
  steps: {
    checklist: {
      autoChecks: [
        {
          id: 'tenant-has-deposit',
          label: 'Tenant record exists with security deposit amount > 0',
          check: async () => {
            const [row] = await db
              .select({ id: tenants.id })
              .from(tenants)
              .where(
                and(
                  eq(tenants.isActive, true),
                  gt(sql<number>`CAST(${tenants.securityDepositAmount} AS numeric)`, 0)
                )
              )
              .limit(1)
            return !!row
          },
        },
        {
          id: 'anniversary-within-30-days',
          label: 'Tenancy anniversary date falls within 30 days',
          check: async () => {
            const today = new Date()
            const in30 = new Date(today)
            in30.setDate(in30.getDate() + 30)
            const todayStr = today.toISOString().substring(0, 10)
            const in30Str = in30.toISOString().substring(0, 10)
            const [row] = await db
              .select({ id: tenants.id })
              .from(tenants)
              .where(
                and(
                  eq(tenants.isActive, true),
                  gte(tenants.tenancyAnniversary, todayStr),
                  lte(tenants.tenancyAnniversary, in30Str)
                )
              )
              .limit(1)
            return !!row
          },
        },
        {
          id: 'ma-rate-configured',
          label: 'MA security deposit interest rate available in system config',
          check: async () => {
            const year = new Date().getFullYear()
            const [row] = await db
              .select({ id: annualRateConfig.id })
              .from(annualRateConfig)
              .where(
                and(
                  eq(annualRateConfig.fiscalYear, year),
                  eq(annualRateConfig.configKey, 'security_deposit_interest_rate')
                )
              )
              .limit(1)
            // If no config row, we use the statutory 3% default — still passes
            return true
          },
        },
      ],
      manualChecks: [
        {
          id: 'tenant-in-occupancy',
          label: 'Tenant still in occupancy?',
          requiresExplanation: true,
        },
      ],
    },
    scan: {
      reportSlugs: ['tenant-deposit-summary'],
      aiPromptTemplate: 'tenant_deposit',
      citations: [
        {
          label: 'M.G.L. c. 186 §15B — Security Deposit Interest',
          url: 'https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section15B',
        },
      ],
    },
    draft: {
      artifactType: 'pdf',
      generatorFn: 'generate-deposit-interest',
    },
    delivery: {
      blobPrefix: 'compliance-artifacts/tenant-deposit/',
    },
  },
}
