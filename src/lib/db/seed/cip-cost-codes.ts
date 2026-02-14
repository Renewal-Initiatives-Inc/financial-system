import type { InsertCipCostCode } from '@/lib/validators'

export const seedCipCostCodes: InsertCipCostCode[] = [
  // Hard Cost codes (CSI divisions)
  { code: '03', name: 'Concrete', category: 'HARD_COST', sortOrder: 10 },
  { code: '07', name: 'Thermal & Moisture Protection', category: 'HARD_COST', sortOrder: 20 },
  { code: '08', name: 'Openings', category: 'HARD_COST', sortOrder: 30 },
  { code: '09', name: 'Finishes', category: 'HARD_COST', sortOrder: 40 },
  { code: '22', name: 'Plumbing', category: 'HARD_COST', sortOrder: 50 },
  { code: '23', name: 'HVAC', category: 'HARD_COST', sortOrder: 60 },
  { code: '26', name: 'Electrical', category: 'HARD_COST', sortOrder: 70 },
  { code: '31', name: 'Earthwork', category: 'HARD_COST', sortOrder: 80 },

  // Soft Cost codes
  { code: 'S01', name: 'Architectural & Engineering', category: 'SOFT_COST', sortOrder: 100 },
  { code: 'S02', name: 'Legal', category: 'SOFT_COST', sortOrder: 110 },
  { code: 'S03', name: 'Permitting', category: 'SOFT_COST', sortOrder: 120 },
  { code: 'S04', name: 'Inspection', category: 'SOFT_COST', sortOrder: 130 },
  { code: 'S05', name: 'Environmental', category: 'SOFT_COST', sortOrder: 140 },
  { code: 'S06', name: 'Appraisal', category: 'SOFT_COST', sortOrder: 150 },
  { code: 'S07', name: "Insurance (Builder's Risk)", category: 'SOFT_COST', sortOrder: 160 },
  { code: 'S08', name: 'Accounting & Audit', category: 'SOFT_COST', sortOrder: 170 },
  { code: 'S09', name: 'Project Management', category: 'SOFT_COST', sortOrder: 180 },
]
