import type { InsertFund } from '@/lib/validators'

export const seedFunds: InsertFund[] = [
  { name: 'General Fund', restrictionType: 'UNRESTRICTED', isSystemLocked: true, description: 'Default unrestricted operating fund' },
  { name: 'AHP Fund', restrictionType: 'RESTRICTED', isSystemLocked: false, description: 'Affordable Housing Program grant funds' },
  { name: 'CPA Fund', restrictionType: 'RESTRICTED', isSystemLocked: false, description: 'Community Preservation Act funds' },
  { name: 'MassDev Fund', restrictionType: 'RESTRICTED', isSystemLocked: false, description: 'MassDevelopment grant funds' },
  { name: 'HTC Equity Fund', restrictionType: 'RESTRICTED', isSystemLocked: false, description: 'Historic Tax Credit equity funds' },
  { name: 'MassSave Fund', restrictionType: 'RESTRICTED', isSystemLocked: false, description: 'MassSave energy rebate funds' },
]
