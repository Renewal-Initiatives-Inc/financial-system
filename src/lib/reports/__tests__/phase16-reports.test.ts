import { describe, it, expect } from 'vitest'

// ---------------------------------------------------------------------------
// Phase 16 Report Module Export Tests
// Verifies every query module exports the correct function and type names
// ---------------------------------------------------------------------------

describe('Phase 16: Audit & Compliance reports', () => {
  it('audit-log exports getAuditLogData and constants', async () => {
    const mod = await import('../audit-log')
    expect(typeof mod.getAuditLogData).toBe('function')
    expect(Array.isArray(mod.AUDIT_ACTIONS)).toBe(true)
    expect(mod.AUDIT_ACTIONS.length).toBeGreaterThan(0)
    expect(Array.isArray(mod.AUDIT_ENTITY_TYPES)).toBe(true)
    expect(mod.AUDIT_ENTITY_TYPES.length).toBeGreaterThan(0)
  })

  it('transaction-history exports getTransactionHistoryData', async () => {
    const mod = await import('../transaction-history')
    expect(typeof mod.getTransactionHistoryData).toBe('function')
  })

  it('late-entries exports getLateEntriesData', async () => {
    const mod = await import('../late-entries')
    expect(typeof mod.getLateEntriesData).toBe('function')
  })

})

describe('Phase 16: Specialized financial reports', () => {
  it('donor-giving-history exports getDonorGivingHistoryData', async () => {
    const mod = await import('../donor-giving-history')
    expect(typeof mod.getDonorGivingHistoryData).toBe('function')
  })

  it('cash-projection exports getCashProjectionData', async () => {
    const mod = await import('../cash-projection')
    expect(typeof mod.getCashProjectionData).toBe('function')
  })

})

describe('Phase 16: Payroll reports', () => {
  it('payroll-register exports getPayrollRegisterData', async () => {
    const mod = await import('../payroll-register')
    expect(typeof mod.getPayrollRegisterData).toBe('function')
  })

  it('payroll-tax-liability exports getPayrollTaxLiabilityData', async () => {
    const mod = await import('../payroll-tax-liability')
    expect(typeof mod.getPayrollTaxLiabilityData).toBe('function')
  })

  it('w2-verification exports getW2VerificationData', async () => {
    const mod = await import('../w2-verification')
    expect(typeof mod.getW2VerificationData).toBe('function')
  })

  it('employer-payroll-cost exports getEmployerPayrollCostData', async () => {
    const mod = await import('../employer-payroll-cost')
    expect(typeof mod.getEmployerPayrollCostData).toBe('function')
  })

  it('quarterly-tax-prep exports getQuarterlyTaxPrepData', async () => {
    const mod = await import('../quarterly-tax-prep')
    expect(typeof mod.getQuarterlyTaxPrepData).toBe('function')
  })
})

describe('Phase 16: Budget & annual reports', () => {
  it('capital-budget exports getCapitalBudgetData', async () => {
    const mod = await import('../capital-budget')
    expect(typeof mod.getCapitalBudgetData).toBe('function')
  })

  it('form-990-data exports getForm990Data', async () => {
    const mod = await import('../form-990-data')
    expect(typeof mod.getForm990Data).toBe('function')
  })
})

// ---------------------------------------------------------------------------
// Report definitions registry — Phase 16 reports
// ---------------------------------------------------------------------------

describe('REPORT_DEFINITIONS Phase 16 coverage', () => {
  const PHASE_16_SLUGS = [
    'audit-log',
    'transaction-history',
    'late-entries',
    'donor-giving-history',
    'cash-projection',
    'payroll-register',
    'payroll-tax-liability',
    'w2-verification',
    'employer-payroll-cost',
    'quarterly-tax-prep',
    'capital-budget',
    'form-990-data',
  ]

  it('all 12 Phase 16 reports are in REPORT_DEFINITIONS', async () => {
    const { REPORT_DEFINITIONS } = await import('../types')
    const definedSlugs = REPORT_DEFINITIONS.map((r) => r.slug)
    for (const slug of PHASE_16_SLUGS) {
      expect(definedSlugs).toContain(slug)
    }
  })

  it('all 12 Phase 16 reports are marked available', async () => {
    const { REPORT_DEFINITIONS } = await import('../types')
    for (const slug of PHASE_16_SLUGS) {
      const def = REPORT_DEFINITIONS.find((r) => r.slug === slug)
      expect(def?.isAvailable).toBe(true)
    }
  })

  it('Phase 16 reports have valid categories', async () => {
    const { REPORT_DEFINITIONS, CATEGORY_LABELS } = await import('../types')
    for (const slug of PHASE_16_SLUGS) {
      const def = REPORT_DEFINITIONS.find((r) => r.slug === slug)
      expect(def).toBeDefined()
      expect(CATEGORY_LABELS[def!.category]).toBeDefined()
    }
  })
})
