import { eq, and, sql, gte, lte } from 'drizzle-orm'
import { db } from '@/lib/db'
import {
  vendors,
  invoices,
  annualRateConfig,
} from '@/lib/db/schema'
import { decryptVendorTaxId } from '@/lib/encryption'

export interface Vendor1099Row {
  vendorId: number
  vendorName: string
  address: string | null
  taxId: string | null
  entityType: string | null
  w9Status: string
  w9CollectedDate: string | null
  totalPaid: number
  exceedsThreshold: boolean
}

export interface Vendor1099Data {
  rows: Vendor1099Row[]
  year: number
  threshold: number
  vendorsOverThreshold: number
  w9CollectedCount: number
  w9PendingCount: number
  totalPaid: number
  generatedAt: string
}

export interface Vendor1099Summary {
  vendorsOverThreshold: number
  w9CollectedCount: number
  w9PendingCount: number
}

/**
 * Aggregate vendor payments for 1099-NEC preparation.
 */
export async function getVendor1099Data(year: number): Promise<Vendor1099Data> {
  const now = new Date().toISOString()
  const startDate = `${year}-01-01`
  const endDate = `${year}-12-31`

  // Get threshold from annual_rate_config (default $600)
  const thresholdConfig = await db
    .select({ value: annualRateConfig.value })
    .from(annualRateConfig)
    .where(
      and(
        eq(annualRateConfig.fiscalYear, year),
        eq(annualRateConfig.configKey, 'vendor_1099_threshold')
      )
    )
    .limit(1)

  const threshold = thresholdConfig.length > 0
    ? parseFloat(thresholdConfig[0].value)
    : 600

  // Get all 1099-eligible vendors
  const eligibleVendors = await db
    .select()
    .from(vendors)
    .where(eq(vendors.is1099Eligible, true))
    .orderBy(vendors.name)

  const rows: Vendor1099Row[] = []

  for (const vendor of eligibleVendors) {
    // Sum paid invoices to this vendor in the calendar year
    const paymentResult = await db
      .select({
        total: sql<string>`COALESCE(SUM(CAST(${invoices.amount} AS numeric)), 0)`,
      })
      .from(invoices)
      .where(
        and(
          eq(invoices.vendorId, vendor.id),
          eq(invoices.paymentStatus, 'PAID'),
          gte(invoices.invoiceDate, startDate),
          lte(invoices.invoiceDate, endDate)
        )
      )

    const totalPaid = parseFloat(paymentResult[0]?.total ?? '0')

    // Decrypt tax ID for 1099 filing (only place decryption occurs)
    let decryptedTaxId: string | null = null
    if (vendor.taxId) {
      try {
        decryptedTaxId = decryptVendorTaxId(vendor.taxId)
      } catch {
        // Legacy plaintext value (pre-encryption migration) — use as-is
        decryptedTaxId = vendor.taxId
      }
    }

    rows.push({
      vendorId: vendor.id,
      vendorName: vendor.name,
      address: vendor.address,
      taxId: decryptedTaxId,
      entityType: vendor.entityType,
      w9Status: vendor.w9Status,
      w9CollectedDate: vendor.w9CollectedDate,
      totalPaid,
      exceedsThreshold: totalPaid >= threshold,
    })
  }

  const vendorsOverThreshold = rows.filter((r) => r.exceedsThreshold).length
  const w9CollectedCount = rows.filter(
    (r) => r.exceedsThreshold && r.w9Status === 'COLLECTED'
  ).length
  const w9PendingCount = rows.filter(
    (r) => r.exceedsThreshold && r.w9Status !== 'COLLECTED'
  ).length
  const totalPaid = rows.reduce((s, r) => s + r.totalPaid, 0)

  return {
    rows,
    year,
    threshold,
    vendorsOverThreshold,
    w9CollectedCount,
    w9PendingCount,
    totalPaid,
    generatedAt: now,
  }
}

/**
 * Dashboard-level summary.
 */
export async function getVendor1099Summary(year: number): Promise<Vendor1099Summary> {
  const data = await getVendor1099Data(year)
  return {
    vendorsOverThreshold: data.vendorsOverThreshold,
    w9CollectedCount: data.w9CollectedCount,
    w9PendingCount: data.w9PendingCount,
  }
}
