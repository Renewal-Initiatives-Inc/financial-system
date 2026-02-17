export const seedAnnualRates = [
  // FICA Social Security rate
  { fiscalYear: 2025, configKey: 'fica_ss_rate', value: '0.062000', notes: 'IRS Pub 15', updatedBy: 'system' },
  { fiscalYear: 2026, configKey: 'fica_ss_rate', value: '0.062000', notes: 'IRS Pub 15', updatedBy: 'system' },
  // FICA Medicare rate
  { fiscalYear: 2025, configKey: 'fica_medicare_rate', value: '0.014500', notes: 'IRS Pub 15', updatedBy: 'system' },
  { fiscalYear: 2026, configKey: 'fica_medicare_rate', value: '0.014500', notes: 'IRS Pub 15', updatedBy: 'system' },
  // Social Security wage base
  { fiscalYear: 2025, configKey: 'fica_ss_wage_base', value: '176100.000000', notes: 'SSA announcement', updatedBy: 'system' },
  { fiscalYear: 2026, configKey: 'fica_ss_wage_base', value: '184500.000000', notes: 'SSA announcement Oct 2025', updatedBy: 'system' },
  // Vendor 1099 threshold
  { fiscalYear: 2025, configKey: 'vendor_1099_threshold', value: '600.000000', notes: 'Pre-OBBBA', updatedBy: 'system' },
  { fiscalYear: 2026, configKey: 'vendor_1099_threshold', value: '2000.000000', notes: 'Per OBBBA (P.L. 119-21)', updatedBy: 'system' },
  // MA state tax rate
  { fiscalYear: 2025, configKey: 'ma_state_tax_rate', value: '0.050000', notes: 'MA DOR Circular M', updatedBy: 'system' },
  { fiscalYear: 2026, configKey: 'ma_state_tax_rate', value: '0.050000', notes: 'MA DOR Circular M', updatedBy: 'system' },
  // MA surtax rate
  { fiscalYear: 2025, configKey: 'ma_surtax_rate', value: '0.040000', notes: 'MA "millionaire\'s tax"', updatedBy: 'system' },
  { fiscalYear: 2026, configKey: 'ma_surtax_rate', value: '0.040000', notes: 'MA "millionaire\'s tax"', updatedBy: 'system' },
  // MA surtax threshold (indexed annually for inflation)
  { fiscalYear: 2025, configKey: 'ma_surtax_threshold', value: '1083150.000000', notes: 'MA DOR (indexed from $1M base)', updatedBy: 'system' },
  { fiscalYear: 2026, configKey: 'ma_surtax_threshold', value: '1107750.000000', notes: 'MA DOR Form 1-ES 2026', updatedBy: 'system' },
  // IRS standard mileage rate (business use)
  { fiscalYear: 2025, configKey: 'mileage_rate', value: '0.700000', notes: 'IRS Notice 2025-05 ($0.70/mile)', updatedBy: 'system' },
  { fiscalYear: 2026, configKey: 'mileage_rate', value: '0.725000', notes: 'IRS Notice 2026-10 ($0.725/mile)', updatedBy: 'system' },
]
