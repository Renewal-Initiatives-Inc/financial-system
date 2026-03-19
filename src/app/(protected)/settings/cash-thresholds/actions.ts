'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { appSettings } from '@/lib/db/schema'

export type CashThresholdSettings = {
  cashThresholdWarning: string
  cashThresholdCritical: string
}

const CASH_THRESHOLD_KEYS = [
  'cashThresholdWarning',
  'cashThresholdCritical',
] as const

const cashThresholdSchema = z.object({
  cashThresholdWarning: z.string().refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
    { message: 'Must be a positive number' }
  ),
  cashThresholdCritical: z.string().refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
    { message: 'Must be a positive number' }
  ),
}).refine(
  (data) => parseFloat(data.cashThresholdWarning) > parseFloat(data.cashThresholdCritical),
  { message: 'Warning threshold must be greater than critical threshold' }
)

export async function getCashThresholdSettings(): Promise<CashThresholdSettings> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)

  const defaults: CashThresholdSettings = {
    cashThresholdWarning: '20000',
    cashThresholdCritical: '10000',
  }

  for (const row of rows) {
    if (row.key in defaults) {
      defaults[row.key as keyof CashThresholdSettings] = row.value
    }
  }

  return defaults
}

export async function updateCashThresholdSettings(
  data: CashThresholdSettings
): Promise<{ success: boolean } | { error: string }> {
  try {
    const validated = cashThresholdSchema.parse(data)

    for (const key of CASH_THRESHOLD_KEYS) {
      // Upsert: try update first, then insert if not found
      const [existing] = await db
        .select({ id: appSettings.id })
        .from(appSettings)
        .where(eq(appSettings.key, key))

      if (existing) {
        await db
          .update(appSettings)
          .set({ value: validated[key], updatedAt: new Date() })
          .where(eq(appSettings.key, key))
      } else {
        await db.insert(appSettings).values({
          key,
          value: validated[key],
          description:
            key === 'cashThresholdWarning'
              ? 'Unrestricted cash warning threshold ($)'
              : 'Unrestricted cash critical threshold ($)',
        })
      }
    }

    revalidatePath('/settings/cash-thresholds')
    revalidatePath('/reports/cash-projection')
    return { success: true }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.issues[0].message }
    }
    return { error: err instanceof Error ? err.message : 'Save failed' }
  }
}
