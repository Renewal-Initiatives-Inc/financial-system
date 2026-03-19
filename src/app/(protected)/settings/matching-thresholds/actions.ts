'use server'

import { revalidatePath } from 'next/cache'
import { eq } from 'drizzle-orm'
import { z } from 'zod'
import { db } from '@/lib/db'
import { appSettings } from '@/lib/db/schema'

// --- Types ---

export type ThresholdSettings = {
  autoMatchMinHitCount: string
  autoMatchMinConfidence: string
  autoMatchMaxAmount: string
  reviewMinConfidence: string
}

const THRESHOLD_KEYS = [
  'autoMatchMinHitCount',
  'autoMatchMinConfidence',
  'autoMatchMaxAmount',
  'reviewMinConfidence',
] as const

const thresholdSchema = z.object({
  autoMatchMinHitCount: z.string().refine(
    (v) => !isNaN(parseInt(v)) && parseInt(v) >= 1,
    { message: 'Must be a positive integer' }
  ),
  autoMatchMinConfidence: z.string().refine(
    (v) => {
      const n = parseFloat(v)
      return !isNaN(n) && n >= 0 && n <= 2
    },
    { message: 'Must be between 0 and 2' }
  ),
  autoMatchMaxAmount: z.string().refine(
    (v) => !isNaN(parseFloat(v)) && parseFloat(v) > 0,
    { message: 'Must be a positive number' }
  ),
  reviewMinConfidence: z.string().refine(
    (v) => {
      const n = parseFloat(v)
      return !isNaN(n) && n >= 0 && n <= 2
    },
    { message: 'Must be between 0 and 2' }
  ),
})

// --- Server Actions ---

export async function getThresholdSettings(): Promise<ThresholdSettings> {
  const rows = await db
    .select({ key: appSettings.key, value: appSettings.value })
    .from(appSettings)

  const defaults: ThresholdSettings = {
    autoMatchMinHitCount: '5',
    autoMatchMinConfidence: '0.95',
    autoMatchMaxAmount: '500.00',
    reviewMinConfidence: '0.70',
  }

  for (const row of rows) {
    if (row.key in defaults) {
      defaults[row.key as keyof ThresholdSettings] = row.value
    }
  }

  return defaults
}

export async function updateThresholdSettings(
  data: ThresholdSettings
): Promise<void> {
  const validated = thresholdSchema.parse(data)

  for (const key of THRESHOLD_KEYS) {
    await db
      .update(appSettings)
      .set({ value: validated[key], updatedAt: new Date() })
      .where(eq(appSettings.key, key))
  }

  revalidatePath('/settings/matching-thresholds')
}

/**
 * Read a single app setting by key. Used by the matching engine.
 */
export async function getAppSetting(key: string): Promise<string | null> {
  const [row] = await db
    .select({ value: appSettings.value })
    .from(appSettings)
    .where(eq(appSettings.key, key))

  return row?.value ?? null
}
