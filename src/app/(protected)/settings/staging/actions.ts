'use server'

import { eq } from 'drizzle-orm'
import { revalidatePath } from 'next/cache'
import { db } from '@/lib/db'
import { stagingRecords } from '@/lib/db/schema'
import { processReceivedStagingRecords, type ProcessingResult } from '@/lib/staging/processor'
import { getStagingRecords, getStagingRecordCounts, type StagingRecordWithRelations } from '@/lib/staging/queries'
import type { StagingSourceApp, StagingStatus } from '@/lib/validators/staging-records'

// --- Data Fetching ---

export async function fetchStagingRecords(filters?: {
  status?: StagingStatus
  sourceApp?: StagingSourceApp
}): Promise<StagingRecordWithRelations[]> {
  return getStagingRecords(filters)
}

export async function fetchStagingCounts(): Promise<Record<string, number>> {
  return getStagingRecordCounts()
}

// --- Actions ---

export async function triggerStagingProcessor(): Promise<ProcessingResult> {
  const result = await processReceivedStagingRecords()
  revalidatePath('/settings/staging')
  return result
}

export async function updateStagingRecordStatus(
  id: number,
  status: 'matched_to_payment' | 'paid'
): Promise<{ success: boolean } | { error: string }> {
  try {
    const [existing] = await db
      .select()
      .from(stagingRecords)
      .where(eq(stagingRecords.id, id))

    if (!existing) {
      return { error: `Staging record ${id} not found` }
    }

    // Validate status transitions
    const validTransitions: Record<string, string[]> = {
      posted: ['matched_to_payment'],
      matched_to_payment: ['paid'],
    }

    const allowed = validTransitions[existing.status] ?? []
    if (!allowed.includes(status)) {
      return {
        error: `Cannot transition from '${existing.status}' to '${status}'`,
      }
    }

    await db
      .update(stagingRecords)
      .set({ status })
      .where(eq(stagingRecords.id, id))

    revalidatePath('/settings/staging')
    return { success: true }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { error: message }
  }
}
