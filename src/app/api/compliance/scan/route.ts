import Anthropic from '@anthropic-ai/sdk'
import { auth } from '@/lib/auth'
import { eq, and, gte, lte, isNotNull, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  complianceDeadlines,
  transactions,
  transactionLines,
  payrollRuns,
  payrollEntries,
  vendors,
  funds,
  accounts,
} from '@/lib/db/schema'
import type { Citation } from '@/lib/compliance/workflow-types'

const client = new Anthropic()

interface ScanRequest {
  deadlineId: number
  workflowType: string
}

interface ScanResponse {
  content: string
  citations: Citation[]
}

// Prompt templates per workflow type
const SCAN_PROMPTS: Record<string, string> = {
  tax_form_990: `You are a nonprofit compliance specialist. Based on the financial data provided, generate a plain-text compliance brief for IRS Form 990 filing. Cover: (1) Revenue recognition completeness, (2) Functional expense allocation accuracy, (3) Officer compensation reporting requirements, (4) Public support test status, (5) Unrelated business income exposure. Flag any items requiring attorney review. Be concise and actionable.`,

  tax_w2: `You are a payroll compliance specialist. Review the payroll data provided and generate a plain-text W-2 filing readiness brief. Cover: (1) Payroll run completeness for the calendar year, (2) GL reconciliation status, (3) Social Security and Medicare wage base accuracy, (4) State withholding requirements for MA, (5) Any corrections needed before e-filing. Be concise and actionable.`,

  tax_1099_nec: `You are a tax compliance specialist. Review the vendor payment data and generate a plain-text 1099-NEC filing readiness brief. Cover: (1) Vendors meeting $600 threshold, (2) W-9 collection status, (3) Tax ID verification requirements, (4) Common 1099-NEC exclusions (corporations, qualified payments), (5) Filing deadlines. Be concise and actionable.`,

  tax_941: `You are a payroll tax specialist. Review the quarterly payroll data and generate a plain-text Form 941 filing brief. Cover: (1) Employee count and wage totals, (2) Federal income tax withheld, (3) Social Security and Medicare calculations, (4) Deposit schedule compliance, (5) Any reconciliation items. Be concise and actionable.`,

  tax_m941: `You are a Massachusetts payroll tax specialist. Review the quarterly payroll data and generate a plain-text MA Form M-941 filing brief for MassTaxConnect. Cover: (1) MA income tax withheld, (2) Wage base and withholding reconciliation, (3) Deposit schedule compliance under M.G.L. c. 62B, (4) Filing instructions for MassTaxConnect. Be concise and actionable.`,

  tax_form_pc: `You are a Massachusetts nonprofit compliance specialist. Generate a plain-text Form PC filing readiness brief for the MA Attorney General. Cover: (1) Charitable registration status, (2) Gross revenue and support calculation, (3) Program description accuracy, (4) Required attachments (audited financials threshold). Be concise and actionable.`,

  annual_review: `You are a nonprofit compliance specialist. Generate a plain-text annual review compliance brief. Cover the specific areas relevant to this review type based on the financial data provided. Cite applicable IRC sections and ASC standards. Be concise and actionable.`,

  annual_attestation: `You are a nonprofit governance specialist. Generate a plain-text attestation compliance brief. Cover: (1) Applicable governance requirements, (2) Documentation requirements, (3) Board approval process, (4) IRS Form 990 disclosure requirements. Be concise and actionable.`,

  budget_cycle: `You are a nonprofit financial planning specialist. Review the budget and actual data provided and generate a plain-text budget cycle brief. Cover: (1) Variance analysis highlights, (2) Cash position and forecast, (3) Fund balance status, (4) Budget approval requirements. Be concise and actionable.`,

  grant_report: `You are a nonprofit grant compliance specialist. Review the fund activity data and generate a plain-text grant reporting brief. Cover: (1) Expenditure vs. budget variance, (2) Allowable cost compliance under 2 CFR §200, (3) Period of performance status, (4) Drawdown calculation. Be concise and actionable.`,

  grant_closeout: `You are a nonprofit grant compliance specialist. Review the fund data and generate a plain-text grant closeout brief. Cover: (1) Final expenditure reconciliation, (2) Unspent funds and return requirements, (3) Federal reporting requirements under 2 CFR §200.344, (4) Documentation retention requirements. Be concise and actionable.`,

  grant_milestone: `You are a nonprofit program compliance specialist. Generate a plain-text grant milestone reporting brief. Cover: (1) Deliverable completion documentation, (2) Required supporting evidence, (3) Funder reporting format requirements, (4) Deadline compliance. Be concise and actionable.`,

  tenant_deposit: `You are a Massachusetts real estate compliance specialist. Review the tenant deposit data and generate a plain-text security deposit interest brief. Cover: (1) MA statutory interest rate requirement (M.G.L. c. 186 §15B), (2) Interest calculation method, (3) Annual payment timing requirements, (4) Documentation requirements. Be concise and actionable.`,
}

const CITATIONS: Record<string, Citation[]> = {
  tax_form_990: [
    { label: 'IRC §6033 — Annual reports by exempt organizations', url: 'https://www.irs.gov/form990' },
    { label: 'Reg §1.6033-2 — Annual returns by exempt organizations' },
    { label: 'IRS Form 990 Instructions', url: 'https://www.irs.gov/instructions/i990' },
  ],
  tax_w2: [
    { label: 'IRC §6051 — W-2 Wage statements', url: 'https://www.ssa.gov/employer/businessServices.htm' },
    { label: '26 CFR §31.6051-1 — Statements for employees' },
    { label: 'IRS Publication 15 (Circular E)', url: 'https://www.irs.gov/pub15' },
  ],
  tax_1099_nec: [
    { label: 'IRC §6041A — Information returns on payments ≥$600', url: 'https://www.irs.gov/form1099nec' },
    { label: '26 CFR §1.6041A-1 — Returns of information' },
    { label: 'IRS Publication 1220 — FIRE System', url: 'https://www.irs.gov/pub/irs-pdf/p1220.pdf' },
  ],
  tax_941: [
    { label: 'IRC §3102, §3111, §3402 — Employment taxes', url: 'https://www.irs.gov/form941' },
    { label: 'IRS Form 941 Instructions', url: 'https://www.irs.gov/instructions/i941' },
  ],
  tax_m941: [
    { label: 'M.G.L. c. 62B — Massachusetts income tax withholding', url: 'https://www.mass.gov/masstaxconnect' },
    { label: 'MA DOR Form M-941 Instructions' },
  ],
  tax_form_pc: [
    { label: 'M.G.L. c. 12 §8F — Annual report requirement', url: 'https://www.mass.gov/how-to/file-your-annual-report-form-pc' },
    { label: 'MA AG Charity Division — Form PC Instructions' },
  ],
  annual_review: [
    { label: 'IRC §170(f)(8) — Substantiation requirements' },
    { label: 'ASC 958-605 — Contributions received', url: 'https://fasb.org/page/PageContent?pageId=/standards/fasb-accounting-standards-codification.html' },
  ],
  annual_attestation: [
    { label: 'IRS Form 990 Part VI — Governance', url: 'https://www.irs.gov/pub/irs-pdf/f990.pdf' },
    { label: 'IRC §4958 — Intermediate sanctions' },
  ],
  budget_cycle: [
    { label: 'FASB ASU 2016-14 — Presentation of financial statements of not-for-profit entities' },
    { label: 'IRS Form 990 Part IX — Statement of functional expenses' },
  ],
  grant_report: [
    { label: '2 CFR §200 — Uniform Guidance', url: 'https://www.ecfr.gov/current/title-2/part-200' },
    { label: '2 CFR §200.301 — Performance measurement' },
  ],
  grant_closeout: [
    { label: '2 CFR §200.344 — Post-closeout adjustments', url: 'https://www.ecfr.gov/current/title-2/part-200' },
    { label: '2 CFR §200.334 — Record retention requirements' },
  ],
  grant_milestone: [
    { label: '2 CFR §200.328 — Monitoring and reporting performance', url: 'https://www.ecfr.gov/current/title-2/part-200' },
  ],
  tenant_deposit: [
    { label: 'M.G.L. c. 186 §15B — Security deposits', url: 'https://malegislature.gov/Laws/GeneralLaws/PartII/TitleI/Chapter186/Section15B' },
  ],
}

async function fetchContextData(deadlineId: number, workflowType: string): Promise<string> {
  try {
    // Get the deadline row for metadata
    const [deadline] = await db
      .select()
      .from(complianceDeadlines)
      .where(eq(complianceDeadlines.id, deadlineId))

    if (!deadline) return 'No deadline data found.'

    const lines: string[] = [`Compliance Item: ${deadline.taskName}`, `Due: ${deadline.dueDate}`, `Category: ${deadline.category ?? 'N/A'}`, '']

    // Pull relevant data based on workflow type
    if (workflowType === 'tax_w2' || workflowType === 'tax_941' || workflowType === 'tax_m941') {
      const year = new Date(deadline.dueDate).getFullYear()
      const start = `${year - 1}-01-01`
      const end = `${year - 1}-12-31`

      const runs = await db
        .select({ id: payrollRuns.id, periodStart: payrollRuns.payPeriodStart, periodEnd: payrollRuns.payPeriodEnd, status: payrollRuns.status })
        .from(payrollRuns)
        .where(and(gte(payrollRuns.payPeriodStart, start), lte(payrollRuns.payPeriodEnd, end)))

      const entries = await db
        .select({
          employeeName: payrollEntries.employeeName,
          grossPay: sql<string>`SUM(${payrollEntries.grossPay})`,
          fedWithholding: sql<string>`SUM(${payrollEntries.federalWithholding})`,
          stateWithholding: sql<string>`SUM(${payrollEntries.stateWithholding})`,
          ssEmployee: sql<string>`SUM(${payrollEntries.socialSecurityEmployee})`,
          medicareEmployee: sql<string>`SUM(${payrollEntries.medicareEmployee})`,
        })
        .from(payrollEntries)
        .innerJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
        .where(and(gte(payrollRuns.payPeriodStart, start), lte(payrollRuns.payPeriodEnd, end)))
        .groupBy(payrollEntries.employeeName)

      lines.push(`Payroll Runs (${start} to ${end}): ${runs.length}`)
      lines.push(`Posted Runs: ${runs.filter((r) => r.status === 'POSTED').length}`)
      lines.push('')
      lines.push('Employee Totals:')
      for (const e of entries) {
        lines.push(`  ${e.employeeName}: Gross $${e.grossPay}, Fed WH $${e.fedWithholding}, State WH $${e.stateWithholding}`)
      }
    }

    if (workflowType === 'tax_1099_nec') {
      const year = new Date(deadline.dueDate).getFullYear()
      const start = `${year - 1}-01-01`
      const end = `${year - 1}-12-31`

      const vendorPayments = await db
        .select({
          vendorName: vendors.name,
          w9Status: vendors.w9Status,
          is1099Eligible: vendors.is1099Eligible,
          total: sql<string>`SUM(COALESCE(${transactionLines.debit}, 0) - COALESCE(${transactionLines.credit}, 0))`,
        })
        .from(vendors)
        .innerJoin(transactionLines, sql`${transactionLines.id} IN (
          SELECT tl.id FROM transaction_lines tl
          INNER JOIN transactions t ON tl.transaction_id = t.id
          WHERE t.date BETWEEN ${start} AND ${end}
          AND t.source_reference_id LIKE 'vendor-' || ${vendors.id}::text || '%'
        )`)
        .where(eq(vendors.is1099Eligible, true))
        .groupBy(vendors.name, vendors.w9Status, vendors.is1099Eligible)

      lines.push('1099-NEC Eligible Vendors:')
      for (const v of vendorPayments) {
        lines.push(`  ${v.vendorName}: Total $${v.total}, W-9: ${v.w9Status}`)
      }
    }

    if (workflowType === 'tax_form_990') {
      // Get transaction count and date range as a data proxy
      const txCount = await db
        .select({ count: sql<number>`COUNT(*)` })
        .from(transactions)
        .where(eq(transactions.isVoided, false))

      lines.push(`Total transactions in system: ${txCount[0]?.count ?? 0}`)

      const fundList = await db.select({ id: funds.id, name: funds.name, restrictionType: funds.restrictionType }).from(funds).where(eq(funds.isActive, true))
      lines.push(`Active funds: ${fundList.length}`)
      lines.push(fundList.map((f) => `  ${f.name} (${f.restrictionType})`).join('\n'))
    }

    return lines.join('\n')
  } catch {
    return 'Unable to fetch financial context data.'
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await auth()
  if (!session?.user) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  let body: ScanRequest
  try {
    body = await request.json()
  } catch {
    return Response.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { deadlineId, workflowType } = body

  if (!workflowType || typeof workflowType !== 'string') {
    return Response.json({ error: 'workflowType is required' }, { status: 400 })
  }

  const promptTemplate = SCAN_PROMPTS[workflowType]
  if (!promptTemplate) {
    return Response.json({ error: `Unknown workflowType: ${workflowType}` }, { status: 400 })
  }

  const contextData = await fetchContextData(deadlineId, workflowType)

  const message = await client.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: promptTemplate,
    messages: [
      {
        role: 'user',
        content: `Generate a compliance brief for this filing. Financial context:\n\n${contextData}`,
      },
    ],
  })

  const content =
    message.content[0].type === 'text' ? message.content[0].text : 'Unable to generate compliance brief.'

  const citations = CITATIONS[workflowType] ?? []

  const response: ScanResponse = { content, citations }
  return Response.json(response)
}
