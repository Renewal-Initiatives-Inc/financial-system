/**
 * Resolve a Zitadel user ID to a vendor record.
 *
 * Used by:
 *  - Expense report processor (employee → vendor for reimbursement AP invoices)
 *  - Future: tenant management (tenant → vendor for deposit interest AP invoices)
 *
 * Returns null if no vendor is linked to the given Zitadel user ID.
 * Callers should handle the null case gracefully — the GL entry is still
 * created, but the AP invoice won't be linked to a vendor.
 */

import { eq } from 'drizzle-orm'
import { db } from '@/lib/db'
import { vendors } from '@/lib/db/schema'

export async function resolveVendorByZitadelId(
  zitadelUserId: string | null | undefined
): Promise<{ id: number; name: string } | null> {
  if (!zitadelUserId) return null

  const [vendor] = await db
    .select({ id: vendors.id, name: vendors.name })
    .from(vendors)
    .where(eq(vendors.zitadelUserId, zitadelUserId))

  return vendor ?? null
}
