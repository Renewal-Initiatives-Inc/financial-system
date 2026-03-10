#!/usr/bin/env npx tsx
/**
 * Populates rich metadata columns on compliance_deadlines for all 28+ hardcoded annual deadlines.
 * Idempotent — safe to run multiple times.
 *
 * Usage:
 *   npx tsx scripts/populate-compliance-metadata.ts
 */

import { db } from '../src/lib/db'
import { complianceDeadlines } from '../src/lib/db/schema'
import { eq, like } from 'drizzle-orm'

interface DeadlineMeta {
  taskNamePattern: string  // exact or prefix for LIKE matching
  useExact: boolean
  workflowType: typeof complianceDeadlines.$inferInsert['workflowType']
  authoritySource: string | null
  legalCitation: string | null
  referenceUrl: string | null
  recommendedActions: string[]
}

const METADATA: DeadlineMeta[] = [
  {
    taskNamePattern: 'Form 990 filing',
    useExact: true,
    workflowType: 'tax_form_990',
    authoritySource: 'IRS',
    legalCitation: 'IRC §6033; Reg §1.6033-2',
    referenceUrl: 'https://www.irs.gov/form990',
    recommendedActions: [
      'Pull trial balance for FY',
      'Verify officer compensation figures',
      'Confirm public support calculation',
      'Review Part VII compensation table',
      'Run workflow 2 weeks before due date',
    ],
  },
  {
    taskNamePattern: 'Form PC filing',
    useExact: true,
    workflowType: 'tax_form_pc',
    authoritySource: 'MA AG',
    legalCitation: 'M.G.L. c. 12 §8F',
    referenceUrl: 'https://www.mass.gov/how-to/file-your-annual-report-form-pc',
    recommendedActions: [
      'Confirm 990 has been filed',
      'Verify charitable registration is current',
      'Gather gross support and revenue totals',
      'Complete MA AG online portal submission',
    ],
  },
  {
    taskNamePattern: 'Federal 941 (Q',
    useExact: false,
    workflowType: 'tax_941',
    authoritySource: 'IRS',
    legalCitation: 'IRC §3102, §3111, §3402',
    referenceUrl: 'https://www.irs.gov/form941',
    recommendedActions: [
      'Reconcile payroll deposits for the quarter',
      'Verify employee count and wage totals',
      'Confirm federal tax withholding amounts',
      'Review prior quarter balance if applicable',
      'Submit via TaxBandits e-filing',
    ],
  },
  {
    taskNamePattern: 'MA M-941 (Q',
    useExact: false,
    workflowType: 'tax_m941',
    authoritySource: 'MA DOR',
    legalCitation: 'M.G.L. c. 62B',
    referenceUrl: 'https://www.mass.gov/masstaxconnect',
    recommendedActions: [
      'Reconcile MA state withholding for the quarter',
      'Generate M-941 data report',
      'Log into MassTaxConnect to file',
      'Confirm payment posted',
    ],
  },
  {
    taskNamePattern: 'W-2 filing',
    useExact: true,
    workflowType: 'tax_w2',
    authoritySource: 'SSA/IRS',
    legalCitation: 'IRC §6051; 26 CFR §31.6051-1',
    referenceUrl: 'https://www.ssa.gov/employer/businessServices.htm',
    recommendedActions: [
      'Verify all employee SSNs are collected',
      'Reconcile payroll to GL for full calendar year',
      'Confirm W-9s on file for all employees',
      'Generate W-2 package and review boxes 1–17',
      'Submit via TaxBandits e-filing by Jan 31',
    ],
  },
  {
    taskNamePattern: '1099-NEC filing',
    useExact: true,
    workflowType: 'tax_1099_nec',
    authoritySource: 'IRS',
    legalCitation: 'IRC §6041A; 26 CFR §1.6041A-1',
    referenceUrl: 'https://www.irs.gov/form1099nec',
    recommendedActions: [
      'Identify vendors paid ≥ $600 in calendar year',
      'Confirm W-9s collected for all qualifying vendors',
      'Verify tax IDs before filing',
      'Generate 1099-NEC package',
      'Submit via TaxBandits e-filing by Jan 31',
    ],
  },
  {
    taskNamePattern: 'Annual in-kind review',
    useExact: true,
    workflowType: 'annual_review',
    authoritySource: 'IRS',
    legalCitation: 'IRC §170(f)(8); ASC 958-605',
    referenceUrl: 'https://www.irs.gov/charities-non-profits/charitable-organizations/substantiation-and-disclosure-requirements',
    recommendedActions: [
      'Pull all in-kind donation transactions for FY',
      'Verify fair value documentation for each item',
      'Confirm contemporaneous written acknowledgment letters sent',
      'Reconcile in-kind revenue to GL',
      'Prepare in-kind summary report',
    ],
  },
  {
    taskNamePattern: 'Officer compensation review',
    useExact: true,
    workflowType: 'annual_review',
    authoritySource: 'IRS',
    legalCitation: 'IRC §4958; Reg §53.4958-6',
    referenceUrl: 'https://www.irs.gov/charities-non-profits/charitable-organizations/intermediate-sanctions-irc-4958',
    recommendedActions: [
      'Pull officer compensation from payroll for FY',
      'Research comparability data (Open990.org)',
      'Document board approval of compensation',
      'Prepare board resolution if rates are changing',
      'Update Form 990 Part VII accordingly',
    ],
  },
  {
    taskNamePattern: 'Conflict of interest attestation',
    useExact: true,
    workflowType: 'annual_attestation',
    authoritySource: 'IRS',
    legalCitation: 'IRS Form 990 Part VI Line 12',
    referenceUrl: 'https://www.irs.gov/pub/irs-pdf/f990.pdf',
    recommendedActions: [
      'Distribute COI disclosure forms to all board members and officers',
      'Collect signed attestations',
      'Review any disclosed conflicts for board action',
      'Record attestation completion in board minutes',
      'Update Form 990 Part VI Line 12',
    ],
  },
  {
    taskNamePattern: 'Annual tax rate review (SS wage base)',
    useExact: true,
    workflowType: 'annual_review',
    authoritySource: 'SSA',
    legalCitation: '42 U.S.C. §430',
    referenceUrl: 'https://www.ssa.gov/oact/cola/cbb.html',
    recommendedActions: [
      'Check SSA announcement for new wage base',
      'Verify Medicare rate (unchanged at 1.45%)',
      'Update payroll system rate configuration',
      'Document rate changes for audit trail',
    ],
  },
  {
    taskNamePattern: 'Year-end functional allocation review',
    useExact: true,
    workflowType: 'annual_review',
    authoritySource: 'IRS',
    legalCitation: 'ASC 958-720-45; FASB ASU 2016-14',
    referenceUrl: 'https://fasb.org/page/PageContent?pageId=/standards/fasb-accounting-standards-codification.html',
    recommendedActions: [
      'Review current FY functional allocation percentages',
      'Verify time-and-effort documentation supports allocations',
      'Update allocation percentages for next FY if needed',
      'Prepare allocation summary for Form 990 Part IX',
    ],
  },
  {
    taskNamePattern: 'Public support trajectory review',
    useExact: true,
    workflowType: 'annual_review',
    authoritySource: 'IRS',
    legalCitation: 'IRC §509(a)(1); Reg §1.509(a)-3',
    referenceUrl: 'https://www.irs.gov/charities-non-profits/public-charities/public-support-test',
    recommendedActions: [
      'Calculate public support percentage for current FY',
      'Project trajectory through FY2029',
      'Flag if percentage approaches 33% threshold',
      'Prepare board briefing if action needed',
    ],
  },
  {
    taskNamePattern: 'UBIT annual review',
    useExact: true,
    workflowType: 'annual_review',
    authoritySource: 'IRS',
    legalCitation: 'IRC §511-515; Reg §1.512(a)-1',
    referenceUrl: 'https://www.irs.gov/charities-non-profits/unrelated-business-income-tax',
    recommendedActions: [
      'Identify any revenue streams not substantially related to mission',
      'Assess UBIT exposure against IRC §512-514',
      'If no exposure: prepare No UBIT Exposure memo',
      'If exposure found: consult CPA for Schedule M filing',
    ],
  },
  {
    taskNamePattern: 'MA Secretary of State Annual Report',
    useExact: true,
    workflowType: 'annual_attestation',
    authoritySource: 'MA SOC',
    legalCitation: 'M.G.L. c. 180 §26A',
    referenceUrl: 'https://www.sec.state.ma.us/cor/corpweb/corannrpt/annrptidx.htm',
    recommendedActions: [
      'Log into MA SOC online filing portal',
      'Confirm registered agent and principal address',
      'Update officer list if changed',
      'Submit and retain confirmation number',
    ],
  },
  {
    taskNamePattern: 'Insurance renewal (Hiscox BOP)',
    useExact: true,
    workflowType: null,
    authoritySource: null,
    legalCitation: null,
    referenceUrl: null,
    recommendedActions: [
      'Contact Hiscox 60 days before renewal date',
      'Review current policy limits and coverage',
      'Compare quotes if needed',
      'Confirm payment and update certificate of insurance',
    ],
  },
  {
    taskNamePattern: 'Budget draft (ED)',
    useExact: true,
    workflowType: 'budget_cycle',
    authoritySource: null,
    legalCitation: 'Internal policy',
    referenceUrl: null,
    recommendedActions: [
      'Pull YTD actuals through at least 6 months',
      'Annualize actuals for projection',
      'Draft next-FY budget with ED input',
      'Export budget CSV for board review',
    ],
  },
  {
    taskNamePattern: 'Budget board circulation',
    useExact: true,
    workflowType: 'budget_cycle',
    authoritySource: null,
    legalCitation: 'Internal policy',
    referenceUrl: null,
    recommendedActions: [
      'Confirm ED has approved budget draft',
      'Prepare board pack with budget summary',
      'Distribute to board members 2 weeks before meeting',
      'Collect any feedback before approval meeting',
    ],
  },
  {
    taskNamePattern: 'Budget board approval',
    useExact: true,
    workflowType: 'budget_cycle',
    authoritySource: null,
    legalCitation: "Robert's Rules; IRS Form 990 Part VI",
    referenceUrl: null,
    recommendedActions: [
      'Confirm board quorum for the meeting',
      'Present budget to board',
      'Record vote in board minutes',
      'Prepare and store board resolution',
    ],
  },
  {
    taskNamePattern: 'Quarterly board prep (Q',
    useExact: false,
    workflowType: 'budget_cycle',
    authoritySource: null,
    legalCitation: 'Internal policy',
    referenceUrl: null,
    recommendedActions: [
      'Pull YTD P&L vs budget variance report',
      'Review cash position and projections',
      'Highlight any accounts with >10% variance',
      'Prepare board pack PDF',
      'Distribute materials 1 week before meeting',
    ],
  },
  {
    taskNamePattern: 'Annual grant compliance review',
    useExact: true,
    workflowType: 'grant_report',
    authoritySource: null,
    legalCitation: '2 CFR §200 (Uniform Guidance)',
    referenceUrl: 'https://www.ecfr.gov/current/title-2/part-200',
    recommendedActions: [
      'Confirm all active funds have complete transaction records for FY',
      'Review expenditures against grant restrictions',
      'Flag any potential compliance issues for each fund',
      'Prepare annual compliance summary report',
    ],
  },
]

async function updateDeadlineMetadata(meta: DeadlineMeta): Promise<number> {
  const rows = meta.useExact
    ? await db
        .select({ id: complianceDeadlines.id })
        .from(complianceDeadlines)
        .where(eq(complianceDeadlines.taskName, meta.taskNamePattern))
    : await db
        .select({ id: complianceDeadlines.id })
        .from(complianceDeadlines)
        .where(like(complianceDeadlines.taskName, `${meta.taskNamePattern}%`))

  if (rows.length === 0) return 0

  for (const row of rows) {
    await db
      .update(complianceDeadlines)
      .set({
        workflowType: meta.workflowType,
        authoritySource: meta.authoritySource,
        legalCitation: meta.legalCitation,
        referenceUrl: meta.referenceUrl,
        recommendedActions:
          meta.recommendedActions.length > 0
            ? JSON.stringify(meta.recommendedActions)
            : null,
      })
      .where(eq(complianceDeadlines.id, row.id))
  }

  return rows.length
}

async function main() {
  console.log('Populating compliance deadline metadata...\n')

  let totalUpdated = 0
  let totalSkipped = 0

  for (const meta of METADATA) {
    const updated = await updateDeadlineMetadata(meta)
    if (updated > 0) {
      console.log(`✓ Updated ${updated} row(s) for: ${meta.taskNamePattern}`)
      totalUpdated += updated
    } else {
      console.log(`- Skipped (not found): ${meta.taskNamePattern}`)
      totalSkipped++
    }
  }

  console.log(`\nDone. Updated ${totalUpdated} deadlines, skipped ${totalSkipped} patterns (no matching rows).`)
  process.exit(0)
}

main().catch((err) => {
  console.error('Error:', err)
  process.exit(1)
})
