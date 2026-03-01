/**
 * Asset category configuration derived from Financial Policies & Procedures
 * Sections 2.3 (75 Oliver Street component depreciation) and 2.4 (all other assets).
 *
 * Used by the create-asset dialog to auto-fill useful life and suggest GL accounts.
 * Option B: suggest + warn on deviation.
 */

/**
 * De minimis safe harbor capitalization threshold per Treasury Reg §1.263(a)-1(f).
 * Items below this amount are expensed immediately regardless of useful life.
 * Also applies to prepaid expense capitalization (Section 2.2).
 */
export const CAPITALIZATION_THRESHOLD = 2500

/**
 * Prepaid capitalization minimum benefit period in months (Section 2.2).
 * Prepayments with benefit periods <= this are expensed immediately.
 */
export const PREPAID_MIN_BENEFIT_MONTHS = 12

export interface AssetCategory {
  key: string
  label: string
  group: 'building_component' | 'general'
  /** Default useful life in months. null = user must enter manually. */
  usefulLifeMonths: number | null
  /** Max useful life months (for categories with ranges like equipment 7-10yr). null = no range. */
  usefulLifeMaxMonths: number | null
  /** Suggested GL asset account code. null = user must select. */
  glAssetCode: string | null
  /** Suggested GL accumulated depreciation account code. null = user must select. */
  glAccumDeprCode: string | null
}

export const ASSET_CATEGORIES: AssetCategory[] = [
  // 75 Oliver Street — component depreciation (Section 2.3)
  {
    key: 'building_structure',
    label: 'Building - Structural Elements',
    group: 'building_component',
    usefulLifeMonths: 540,
    usefulLifeMaxMonths: null,
    glAssetCode: '1600',
    glAccumDeprCode: '1800',
  },
  {
    key: 'building_roof',
    label: 'Building - Roof',
    group: 'building_component',
    usefulLifeMonths: 360,
    usefulLifeMaxMonths: null,
    glAssetCode: '1600',
    glAccumDeprCode: '1800',
  },
  {
    key: 'building_hvac',
    label: 'Building - HVAC',
    group: 'building_component',
    usefulLifeMonths: 240,
    usefulLifeMaxMonths: null,
    glAssetCode: '1600',
    glAccumDeprCode: '1800',
  },
  {
    key: 'building_electrical',
    label: 'Building - Electrical',
    group: 'building_component',
    usefulLifeMonths: 240,
    usefulLifeMaxMonths: null,
    glAssetCode: '1600',
    glAccumDeprCode: '1800',
  },
  {
    key: 'building_plumbing',
    label: 'Building - Plumbing',
    group: 'building_component',
    usefulLifeMonths: 240,
    usefulLifeMaxMonths: null,
    glAssetCode: '1600',
    glAccumDeprCode: '1800',
  },
  {
    key: 'building_windows',
    label: 'Building - Windows',
    group: 'building_component',
    usefulLifeMonths: 300,
    usefulLifeMaxMonths: null,
    glAssetCode: '1600',
    glAccumDeprCode: '1800',
  },
  {
    key: 'building_flooring_hard',
    label: 'Building - Flooring (Hard Surface)',
    group: 'building_component',
    usefulLifeMonths: 180,
    usefulLifeMaxMonths: null,
    glAssetCode: '1600',
    glAccumDeprCode: '1800',
  },
  {
    key: 'building_flooring_soft',
    label: 'Building - Flooring (Carpet/Soft)',
    group: 'building_component',
    usefulLifeMonths: 84,
    usefulLifeMaxMonths: null,
    glAssetCode: '1600',
    glAccumDeprCode: '1800',
  },
  // General assets (Section 2.4)
  {
    key: 'computer',
    label: 'Computer / Technology Equipment',
    group: 'general',
    usefulLifeMonths: 60,
    usefulLifeMaxMonths: null,
    glAssetCode: '1700',
    glAccumDeprCode: '1830',
  },
  {
    key: 'vehicle',
    label: 'Vehicle',
    group: 'general',
    usefulLifeMonths: 84,
    usefulLifeMaxMonths: null,
    glAssetCode: '1700',
    glAccumDeprCode: '1830',
  },
  {
    key: 'equipment',
    label: 'Equipment / Machinery',
    group: 'general',
    usefulLifeMonths: 84,
    usefulLifeMaxMonths: 120,
    glAssetCode: '1700',
    glAccumDeprCode: '1830',
  },
  {
    key: 'furniture',
    label: 'Furniture & Fixtures',
    group: 'general',
    usefulLifeMonths: 120,
    usefulLifeMaxMonths: null,
    glAssetCode: '1700',
    glAccumDeprCode: '1830',
  },
  {
    key: 'intangible',
    label: 'Intangible (Software License)',
    group: 'general',
    usefulLifeMonths: 36,
    usefulLifeMaxMonths: 60,
    glAssetCode: '1700',
    glAccumDeprCode: '1830',
  },
  {
    key: 'other',
    label: 'Other',
    group: 'general',
    usefulLifeMonths: null,
    usefulLifeMaxMonths: null,
    glAssetCode: null,
    glAccumDeprCode: null,
  },
]

/**
 * Get category by key.
 */
export function getAssetCategory(key: string): AssetCategory | undefined {
  return ASSET_CATEGORIES.find((c) => c.key === key)
}

/**
 * Check if a useful life value deviates from the policy default for a given category.
 * Returns a warning message if it deviates, or null if it's within range.
 */
export function checkUsefulLifeDeviation(
  categoryKey: string,
  usefulLifeMonths: number
): string | null {
  const category = getAssetCategory(categoryKey)
  if (!category || category.usefulLifeMonths === null) return null

  const defaultMonths = category.usefulLifeMonths
  const maxMonths = category.usefulLifeMaxMonths

  // If there's a range (e.g. equipment 7-10 years), check if within range
  if (maxMonths !== null) {
    if (usefulLifeMonths < defaultMonths || usefulLifeMonths > maxMonths) {
      const minYears = (defaultMonths / 12).toFixed(0)
      const maxYears = (maxMonths / 12).toFixed(0)
      return `Policy range for ${category.label} is ${minYears}–${maxYears} years (${defaultMonths}–${maxMonths} months)`
    }
    return null
  }

  // Exact match expected
  if (usefulLifeMonths !== defaultMonths) {
    const years = (defaultMonths / 12).toFixed(0)
    return `Policy default for ${category.label} is ${years} years (${defaultMonths} months)`
  }

  return null
}
