import { eq, and, sql } from 'drizzle-orm'
import { db } from '@/lib/db'
import { payrollEntries, payrollRuns } from '@/lib/db/schema'

export interface EmployeePayrollData {
  id: string
  name: string
  email: string
  compensationType: 'PER_TASK' | 'SALARIED'
  annualSalary: number | null
  expectedAnnualHours: number | null
  exemptStatus: 'EXEMPT' | 'NON_EXEMPT'
  federalFilingStatus: 'single' | 'married' | 'head_of_household'
  federalAllowances: number
  stateAllowances: number
  additionalFederalWithholding: number
  additionalStateWithholding: number
  isHeadOfHousehold: boolean
  isBlind: boolean
  spouseIsBlind: boolean
}

// Mock employees for development (used when PEOPLE_DATABASE_URL is not set)
const MOCK_EMPLOYEES: EmployeePayrollData[] = [
  {
    id: 'emp-001',
    name: 'Heather Takle',
    email: 'heather@renewalinitiatives.org',
    compensationType: 'SALARIED',
    annualSalary: 72000,
    expectedAnnualHours: 2080,
    exemptStatus: 'EXEMPT',
    federalFilingStatus: 'single',
    federalAllowances: 0,
    stateAllowances: 1,
    additionalFederalWithholding: 0,
    additionalStateWithholding: 0,
    isHeadOfHousehold: false,
    isBlind: false,
    spouseIsBlind: false,
  },
  {
    id: 'emp-002',
    name: 'Test Employee 1',
    email: 'test1@renewalinitiatives.org',
    compensationType: 'PER_TASK',
    annualSalary: null,
    expectedAnnualHours: null,
    exemptStatus: 'NON_EXEMPT',
    federalFilingStatus: 'single',
    federalAllowances: 0,
    stateAllowances: 1,
    additionalFederalWithholding: 0,
    additionalStateWithholding: 0,
    isHeadOfHousehold: false,
    isBlind: false,
    spouseIsBlind: false,
  },
  {
    id: 'emp-003',
    name: 'Test Employee 2',
    email: 'test2@renewalinitiatives.org',
    compensationType: 'SALARIED',
    annualSalary: 55000,
    expectedAnnualHours: 2080,
    exemptStatus: 'NON_EXEMPT',
    federalFilingStatus: 'married',
    federalAllowances: 0,
    stateAllowances: 2,
    additionalFederalWithholding: 50,
    additionalStateWithholding: 0,
    isHeadOfHousehold: false,
    isBlind: false,
    spouseIsBlind: false,
  },
]

/**
 * Get all active employees from the People API.
 * Falls back to mock data when PEOPLE_DATABASE_URL is not configured.
 */
export async function getActiveEmployees(): Promise<EmployeePayrollData[]> {
  if (!process.env.PEOPLE_DATABASE_URL) {
    return MOCK_EMPLOYEES
  }

  // Real implementation: read from app-portal's Neon database
  // This will be wired up when the app-portal Postgres role is created
  const { neon } = await import('@neondatabase/serverless')
  const { drizzle } = await import('drizzle-orm/neon-http')

  const peopleSql = neon(process.env.PEOPLE_DATABASE_URL)
  const peopleDb = drizzle(peopleSql)

  const rows = await peopleDb.execute(
    sql`SELECT id, name, email, compensation_type, annual_salary,
        expected_annual_hours, exempt_status, federal_filing_status,
        federal_allowances, state_allowances, additional_federal_withholding,
        additional_state_withholding, is_head_of_household, is_blind,
        spouse_is_blind
        FROM employees WHERE is_active = true`
  )

  // Neon HTTP driver returns numeric/decimal columns as strings to preserve
  // precision. We must explicitly convert them to numbers for math operations.
  return rows.rows.map((row: Record<string, unknown>) => ({
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    compensationType: row.compensation_type as 'PER_TASK' | 'SALARIED',
    annualSalary: row.annual_salary != null ? Number(row.annual_salary) : null,
    expectedAnnualHours: row.expected_annual_hours != null ? Number(row.expected_annual_hours) : null,
    exemptStatus: row.exempt_status as 'EXEMPT' | 'NON_EXEMPT',
    federalFilingStatus: row.federal_filing_status as 'single' | 'married' | 'head_of_household',
    federalAllowances: Number(row.federal_allowances ?? 0),
    stateAllowances: Number(row.state_allowances ?? 0),
    additionalFederalWithholding: Number(row.additional_federal_withholding ?? 0),
    additionalStateWithholding: Number(row.additional_state_withholding ?? 0),
    isHeadOfHousehold: row.is_head_of_household as boolean,
    isBlind: row.is_blind as boolean,
    spouseIsBlind: row.spouse_is_blind as boolean,
  }))
}

/**
 * Get a single employee by ID.
 */
export async function getEmployeeById(
  id: string
): Promise<EmployeePayrollData | null> {
  const employees = await getActiveEmployees()
  return employees.find((e) => e.id === id) ?? null
}

/**
 * Get year-to-date wages for an employee from posted payroll entries.
 * Reads from the financial-system DB (not app-portal).
 */
export async function getEmployeeYtdWages(
  employeeId: string,
  year: number
): Promise<number> {
  const yearStart = `${year}-01-01`
  const yearEnd = `${year}-12-31`

  const result = await db
    .select({
      total: sql<string>`COALESCE(SUM(${payrollEntries.grossPay}::numeric), 0)`,
    })
    .from(payrollEntries)
    .innerJoin(payrollRuns, eq(payrollEntries.payrollRunId, payrollRuns.id))
    .where(
      and(
        eq(payrollEntries.employeeId, employeeId),
        eq(payrollRuns.status, 'POSTED'),
        sql`${payrollRuns.payPeriodStart} >= ${yearStart}`,
        sql`${payrollRuns.payPeriodEnd} <= ${yearEnd}`
      )
    )

  return parseFloat(result[0]?.total ?? '0')
}
