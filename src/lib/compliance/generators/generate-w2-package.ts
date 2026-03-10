import { getW2VerificationData } from '@/lib/reports/w2-verification'
import { generateCombinedW2PDF } from '@/lib/pdf/w2-generator'
import type { W2Row } from '@/lib/reports/w2-verification'
import type {
  TaxBanditsW2Payload,
  TaxBanditsW2Employee,
  TaxBanditsAddress,
} from '@/lib/taxbandits/types'

export interface W2PackageResult {
  pdfBytes: Uint8Array
  year: number
  employeeCount: number
  /** Pre-built payload for TaxBandits submission at delivery step.
   *  SSNs are not stored in payrollEntries — callers must populate
   *  each employee's SSN before submitting to TaxBandits. */
  taxBanditsPayload: TaxBanditsW2Payload
}

const DEFAULT_EMPLOYER_ADDRESS: TaxBanditsAddress = {
  Address1: process.env.EMPLOYER_ADDRESS ?? '123 Main Street',
  City: process.env.EMPLOYER_CITY ?? 'Boston',
  State: process.env.EMPLOYER_STATE ?? 'MA',
  ZipCd: process.env.EMPLOYER_ZIP ?? '02101',
}

function buildEmployeePayload(row: W2Row, seq: number): TaxBanditsW2Employee {
  const nameParts = row.employeeName.trim().split(' ')
  const firstName = nameParts[0] ?? row.employeeName
  const lastName = nameParts.length > 1 ? nameParts[nameParts.length - 1] : 'Unknown'

  return {
    SequenceId: String(seq).padStart(4, '0'),
    OriginalW2: true,
    SSN: '000-00-0000', // Placeholder — must be replaced with real SSN at delivery
    FirstNm: firstName,
    LastNm: lastName,
    Address: DEFAULT_EMPLOYER_ADDRESS, // Placeholder employee address
    Box1: row.box1,
    Box2: row.box2,
    Box3: row.box3,
    Box4: row.box4,
    Box5: row.box5,
    Box6: row.box6,
    StateDetails: [
      {
        State: 'MA',
        StateWages: row.box16,
        StateIncomeTax: row.box17,
      },
    ],
  }
}

/**
 * Generate the W-2 package for the given calendar year.
 * Produces:
 *   1. Combined PDF (employer Copy D verification summary)
 *   2. TaxBandits payload skeleton (SSNs need to be filled in at delivery)
 */
export async function generateW2Package(year?: number): Promise<W2PackageResult> {
  const targetYear = year ?? new Date().getFullYear() - 1

  const w2Data = await getW2VerificationData({ year: targetYear })

  const employer = {
    ein: process.env.EMPLOYER_EIN ?? '00-0000000',
    name: process.env.EMPLOYER_NAME ?? 'Renewal Initiatives Inc.',
    address: process.env.EMPLOYER_ADDRESS ?? '123 Main Street',
    city: process.env.EMPLOYER_CITY ?? 'Boston',
    state: process.env.EMPLOYER_STATE ?? 'MA',
    zip: process.env.EMPLOYER_ZIP ?? '02101',
  }

  const pdfBytes = await generateCombinedW2PDF(w2Data.rows, employer, targetYear)

  const taxBanditsPayload: TaxBanditsW2Payload = {
    BusinessId: process.env.TAXBANDITS_BUSINESS_ID ?? '',
    TaxYear: String(targetYear),
    IsFederalFiling: true,
    IsStateFiling: true,
    IsW2OnlineFiling: true,
    IsW2PostalMailing: false,
    W2Employees: w2Data.rows.map((row, i) => buildEmployeePayload(row, i + 1)),
  }

  return {
    pdfBytes,
    year: targetYear,
    employeeCount: w2Data.totalEmployees,
    taxBanditsPayload,
  }
}
