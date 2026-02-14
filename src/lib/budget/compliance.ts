/**
 * Budget cycle milestones (BDG-P0-004).
 * Consumed by the compliance calendar (Phase 17).
 */
export const BUDGET_CYCLE_MILESTONES = [
  { month: 9, label: 'Budget Review — September' },
  { month: 10, label: 'ED Budget Draft — October' },
  { month: 11, label: 'Board Budget Circulation — November' },
  { month: 12, label: 'Board Budget Approval — December' },
] as const

/**
 * Public support trajectory review.
 * As rental income enters Total Support denominator (Schedule A Line 10a)
 * but NOT Public Support numerator (Line 1), RI's public support % will
 * decline post-construction. Proactive review ensures ratio stays above
 * 33 1/3% per IRC section 509(a).
 */
export const PUBLIC_SUPPORT_REVIEW_MILESTONE = {
  label: 'Public Support Trajectory Review',
  description:
    'Review Schedule A public support percentage — rental income pressures ratio post-construction',
  targetFiscalYear: 2028,
} as const
