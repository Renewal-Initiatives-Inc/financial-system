// TaxBandits API v1.7.1 Types

export interface TaxBanditsTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
}

// ─── Business ──────────────────────────────────────────────────────────────

export interface TaxBanditsBusinessPayload {
  BusinessNm: string
  TradeNm?: string
  IsEIN: boolean
  EINorSSN: string
  Email: string
  ContactNm: string
  Phone: string
  PhoneExtn?: string
  Fax?: string
  BusinessType: 'ESTE' | 'PART' | 'CORP' | 'EINS' | 'NFPE' | 'GOVT' | 'SOLE'
  SigningAuthority: {
    Name: string
    Phone: string
    BusinessMemberType: string
  }
  MailingAddress: TaxBanditsAddress
}

export interface TaxBanditsAddress {
  Address1: string
  Address2?: string
  City: string
  State: string
  ZipCd: string
  ZipExtnCd?: string
  IsAddressForeign?: boolean
  CountryCd?: string
  ProvinceOrState?: string
  PostalCd?: string
}

export interface TaxBanditsBusinessResponse {
  StatusCode: number
  StatusName: string
  BusinessId: string
  BusinessNm: string
}

// ─── W-2 ────────────────────────────────────────────────────────────────────

export interface TaxBanditsW2Employee {
  SequenceId: string
  OriginalW2: boolean
  SSN: string
  FirstNm: string
  MiddleNm?: string
  LastNm: string
  SuffixNm?: string
  Address: TaxBanditsAddress
  Box1: number   // Wages, tips, other compensation
  Box2: number   // Federal income tax withheld
  Box3: number   // Social security wages
  Box4: number   // Social security tax withheld
  Box5: number   // Medicare wages and tips
  Box6: number   // Medicare tax withheld
  Box7?: number  // Social security tips
  Box8?: number  // Allocated tips
  Box10?: number // Dependent care benefits
  Box11?: number // Nonqualified plans
  Box12?: TaxBanditsW2Box12[]
  Box13?: {
    StatutoryEmployee: boolean
    RetirementPlan: boolean
    ThirdPartySickPay: boolean
  }
  Box14?: TaxBanditsW2Box14[]
  StateDetails?: TaxBanditsW2StateDetail[]
}

export interface TaxBanditsW2Box12 {
  Code: string
  Amount: number
}

export interface TaxBanditsW2Box14 {
  Desc: string
  Amount: number
}

export interface TaxBanditsW2StateDetail {
  State: string
  StateEmployerId?: string
  StateWages: number
  StateIncomeTax: number
  LocalDetails?: {
    LocalityNm: string
    LocalWages: number
    LocalIncomeTax: number
  }[]
}

export interface TaxBanditsW2Payload {
  BusinessId: string
  TaxYear: string
  IsFederalFiling: boolean
  IsStateFiling: boolean
  IsW2OnlineFiling: boolean
  IsW2PostalMailing: boolean
  W2Employees: TaxBanditsW2Employee[]
}

// ─── 1099-NEC ────────────────────────────────────────────────────────────────

export interface TaxBandits1099NECRecipient {
  SequenceId: string
  Original1099: boolean
  RecipientTIN: string
  IsTINMasked?: boolean
  RecipientNm: string
  RecipientAddress: TaxBanditsAddress
  Box1: number  // Nonemployee compensation
  Box4?: number // Federal income tax withheld
  IsDirectSalesIndicator?: boolean
  StateDetails?: TaxBandits1099StateDetail[]
}

export interface TaxBandits1099StateDetail {
  State: string
  StateId?: string
  StateIncomeTax?: number
  StateTaxWithheld?: number
}

export interface TaxBandits1099NECPayload {
  BusinessId: string
  TaxYear: string
  IsFederalFiling: boolean
  IsStateFiling: boolean
  Is1099OnlineFiling: boolean
  Is1099PostalMailing: boolean
  FormType: '1099-NEC'
  Payer1099: TaxBandits1099NECRecipient[]
}

// ─── 941 ────────────────────────────────────────────────────────────────────

export interface TaxBandits941Payload {
  BusinessId: string
  TaxYear: string
  TaxPeriod: 'Q1' | 'Q2' | 'Q3' | 'Q4'
  Line1_EmployeeCount: number
  Line2_TotalWages: number
  Line3_FederalIncomeTaxWithheld: number
  Line4_HasQualifiedSickLeave: boolean
  Line5a_TaxableSSwages: number
  Line5b_TaxableSSTips?: number
  Line5c_TaxableMedicareWages: number
  Line5d_TaxableAdditionalMedicare?: number
  Line6_TotalTaxes: number
  Line7_CurrentQuarterAdjustments?: number
  Line8_TotalTaxesAfterAdjustments: number
  Line9_Overpayment?: number
  Line10_TotalDepositsThisQuarter: number
  Line11_BalanceDue?: number
  Line12_Overpayment?: number
  Deposits?: TaxBandits941Deposit[]
}

export interface TaxBandits941Deposit {
  DepositDate: string
  Amount: number
}

// ─── Submission ──────────────────────────────────────────────────────────────

export interface TaxBanditsSubmissionResponse {
  StatusCode: number
  StatusName: string
  SubmissionId: string
  FormType: string
  RecordCount: number
  Price?: number
  TransactionId?: string
}

export interface TaxBanditsStatusResponse {
  StatusCode: number
  StatusName: string
  SubmissionId: string
  FormType: string
  SubmissionStatus: 'Created' | 'Transmitted' | 'Acknowledged' | 'Rejected' | 'Error'
  RecordCount: number
  AcceptedRecords?: number
  RejectedRecords?: number
  Errors?: TaxBanditsApiErrorDetail[]
}

export interface TaxBanditsApiErrorDetail {
  Id: string
  Name: string
  Message: string
}

export class TaxBanditsApiError extends Error {
  statusCode: number
  errors: TaxBanditsApiErrorDetail[]

  constructor(message: string, statusCode: number, errors: TaxBanditsApiErrorDetail[] = []) {
    super(message)
    this.name = 'TaxBanditsApiError'
    this.statusCode = statusCode
    this.errors = errors
  }
}
