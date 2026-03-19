export const seedAnnualRates = [
  // FICA Social Security rate
  { fiscalYear: 2025, configKey: 'fica_ss_rate', value: '0.062000', notes: 'IRS Pub 15', updatedBy: 'system', sourceDocument: 'IRS Publication 15 (2025)', sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15.pdf', verifiedDate: '2025-01-15' },
  { fiscalYear: 2026, configKey: 'fica_ss_rate', value: '0.062000', notes: 'IRS Pub 15', updatedBy: 'system', sourceDocument: 'IRS Publication 15 (2026)', sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15.pdf', verifiedDate: '2026-01-10' },
  // FICA Medicare rate
  { fiscalYear: 2025, configKey: 'fica_medicare_rate', value: '0.014500', notes: 'IRS Pub 15', updatedBy: 'system', sourceDocument: 'IRS Publication 15 (2025)', sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15.pdf', verifiedDate: '2025-01-15' },
  { fiscalYear: 2026, configKey: 'fica_medicare_rate', value: '0.014500', notes: 'IRS Pub 15', updatedBy: 'system', sourceDocument: 'IRS Publication 15 (2026)', sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15.pdf', verifiedDate: '2026-01-10' },
  // Social Security wage base
  { fiscalYear: 2025, configKey: 'fica_ss_wage_base', value: '176100.000000', notes: 'SSA announcement', updatedBy: 'system', sourceDocument: 'SSA Fact Sheet (Oct 2024)', sourceUrl: 'https://www.ssa.gov/news/press/factsheets/colafacts2025.pdf', verifiedDate: '2024-10-15' },
  { fiscalYear: 2026, configKey: 'fica_ss_wage_base', value: '184500.000000', notes: 'SSA announcement Oct 2025', updatedBy: 'system', sourceDocument: 'SSA Fact Sheet (Oct 2025)', sourceUrl: 'https://www.ssa.gov/news/press/factsheets/colafacts2026.pdf', verifiedDate: '2025-10-10' },
  // Vendor 1099 threshold
  { fiscalYear: 2025, configKey: 'vendor_1099_threshold', value: '600.000000', notes: 'Pre-OBBBA', updatedBy: 'system', sourceDocument: 'IRC §6041(a)', sourceUrl: 'https://www.law.cornell.edu/uscode/text/26/6041', verifiedDate: '2025-01-01' },
  { fiscalYear: 2026, configKey: 'vendor_1099_threshold', value: '2000.000000', notes: 'Per OBBBA (P.L. 119-21)', updatedBy: 'system', sourceDocument: 'One Big Beautiful Bill Act (P.L. 119-21) §112', sourceUrl: 'https://www.congress.gov/bill/119th-congress/house-bill/1/text', verifiedDate: '2025-08-15' },
  // MA state tax rate
  { fiscalYear: 2025, configKey: 'ma_state_tax_rate', value: '0.050000', notes: 'MA DOR Circular M', updatedBy: 'system', sourceDocument: 'MA DOR Circular M (2025)', sourceUrl: 'https://www.mass.gov/doc/circular-m-massachusetts-income-tax-withholding-tables', verifiedDate: '2025-01-15' },
  { fiscalYear: 2026, configKey: 'ma_state_tax_rate', value: '0.050000', notes: 'MA DOR Circular M', updatedBy: 'system', sourceDocument: 'MA DOR Circular M (2026)', sourceUrl: 'https://www.mass.gov/doc/circular-m-massachusetts-income-tax-withholding-tables', verifiedDate: '2026-01-10' },
  // MA surtax rate
  { fiscalYear: 2025, configKey: 'ma_surtax_rate', value: '0.040000', notes: 'MA "millionaire\'s tax"', updatedBy: 'system', sourceDocument: 'MA Constitution Art. XLIV (2022 ballot)', sourceUrl: 'https://www.mass.gov/info-details/massachusetts-millionaires-tax', verifiedDate: '2025-01-01' },
  { fiscalYear: 2026, configKey: 'ma_surtax_rate', value: '0.040000', notes: 'MA "millionaire\'s tax"', updatedBy: 'system', sourceDocument: 'MA Constitution Art. XLIV (2022 ballot)', sourceUrl: 'https://www.mass.gov/info-details/massachusetts-millionaires-tax', verifiedDate: '2026-01-01' },
  // MA surtax threshold (indexed annually for inflation)
  { fiscalYear: 2025, configKey: 'ma_surtax_threshold', value: '1083150.000000', notes: 'MA DOR (indexed from $1M base)', updatedBy: 'system', sourceDocument: 'MA DOR TIR 24-12', sourceUrl: 'https://www.mass.gov/technical-information-release/tir-24-12', verifiedDate: '2024-12-01' },
  { fiscalYear: 2026, configKey: 'ma_surtax_threshold', value: '1107750.000000', notes: 'MA DOR Form 1-ES 2026', updatedBy: 'system', sourceDocument: 'MA DOR Form 1-ES (2026)', sourceUrl: 'https://www.mass.gov/doc/2026-form-1-es-estimated-income-tax', verifiedDate: '2025-12-15' },
  // IRS standard mileage rate (business use)
  { fiscalYear: 2025, configKey: 'mileage_rate', value: '0.700000', notes: 'IRS Notice 2025-05 ($0.70/mile)', updatedBy: 'system', sourceDocument: 'IRS Notice 2025-05', sourceUrl: 'https://www.irs.gov/pub/irs-drop/n-25-05.pdf', verifiedDate: '2024-12-19' },
  { fiscalYear: 2026, configKey: 'mileage_rate', value: '0.725000', notes: 'IRS Notice 2026-10 ($0.725/mile)', updatedBy: 'system', sourceDocument: 'IRS Notice 2026-10', sourceUrl: 'https://www.irs.gov/pub/irs-drop/n-26-10.pdf', verifiedDate: '2025-12-20' },
]

// Federal tax brackets stored as JSON — enables DB-driven rate updates without code changes
export const seedFederalTaxBrackets = [
  {
    fiscalYear: 2026,
    configKey: 'federal_tax_brackets',
    value: '0.000000',
    notes: 'Federal tax brackets (percentage method, annual) — IRS Pub 15-T 2026',
    updatedBy: 'system',
    sourceDocument: 'IRS Publication 15-T (2026)',
    sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15t.pdf',
    verifiedDate: '2026-01-10',
    jsonValue: {
      single: [
        { over: 0, notOver: 7500, rate: 0, plus: 0 },
        { over: 7500, notOver: 19900, rate: 0.1, plus: 0 },
        { over: 19900, notOver: 57900, rate: 0.12, plus: 1240 },
        { over: 57900, notOver: 113200, rate: 0.22, plus: 5800 },
        { over: 113200, notOver: 209275, rate: 0.24, plus: 17966 },
        { over: 209275, notOver: 263725, rate: 0.32, plus: 41024 },
        { over: 263725, notOver: 648100, rate: 0.35, plus: 58448 },
        { over: 648100, notOver: null, rate: 0.37, plus: 192979.25 },
      ],
      married: [
        { over: 0, notOver: 19300, rate: 0, plus: 0 },
        { over: 19300, notOver: 44100, rate: 0.1, plus: 0 },
        { over: 44100, notOver: 120100, rate: 0.12, plus: 2480 },
        { over: 120100, notOver: 230700, rate: 0.22, plus: 11600 },
        { over: 230700, notOver: 422850, rate: 0.24, plus: 35932 },
        { over: 422850, notOver: 531750, rate: 0.32, plus: 82048 },
        { over: 531750, notOver: 788000, rate: 0.35, plus: 116896 },
        { over: 788000, notOver: null, rate: 0.37, plus: 206583.5 },
      ],
      head_of_household: [
        { over: 0, notOver: 15550, rate: 0, plus: 0 },
        { over: 15550, notOver: 33250, rate: 0.1, plus: 0 },
        { over: 33250, notOver: 83000, rate: 0.12, plus: 1770 },
        { over: 83000, notOver: 121250, rate: 0.22, plus: 7740 },
        { over: 121250, notOver: 217300, rate: 0.24, plus: 16155 },
        { over: 217300, notOver: 271750, rate: 0.32, plus: 39207 },
        { over: 271750, notOver: 656150, rate: 0.35, plus: 56631 },
        { over: 656150, notOver: null, rate: 0.37, plus: 191171 },
      ],
    },
  },
  {
    fiscalYear: 2026,
    configKey: 'federal_standard_deductions',
    value: '0.000000',
    notes: 'Federal standard deductions by filing status — IRS Pub 15-T 2026',
    updatedBy: 'system',
    sourceDocument: 'IRS Publication 15-T (2026)',
    sourceUrl: 'https://www.irs.gov/pub/irs-pdf/p15t.pdf',
    verifiedDate: '2026-01-10',
    jsonValue: {
      single: 8600,
      married: 12900,
      head_of_household: 8600,
    },
  },
]
