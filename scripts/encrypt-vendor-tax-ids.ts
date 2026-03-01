/**
 * One-time data migration: encrypt existing plaintext vendor tax IDs.
 *
 * Reads all vendors with a non-null tax_id, encrypts with VENDOR_ENCRYPTION_KEY,
 * and stores the encrypted value + last 4 digits.
 *
 * Safe to re-run: skips values that are already in encrypted format (iv:authTag:ciphertext).
 *
 * Usage:
 *   npx tsx scripts/encrypt-vendor-tax-ids.ts
 */

import { config } from 'dotenv'
// Default to .env.local; override with DOTENV_PATH for production
config({ path: process.env.DOTENV_PATH || '.env.local' })
import { neon } from '@neondatabase/serverless'
import { createCipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12

function getKey(): Buffer {
  const hex = process.env.VENDOR_ENCRYPTION_KEY
  if (!hex) throw new Error('VENDOR_ENCRYPTION_KEY is required')
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) throw new Error(`Key must be 32 bytes, got ${key.length}`)
  return key
}

function encryptValue(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')
  const authTag = cipher.getAuthTag()
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

function isAlreadyEncrypted(value: string): boolean {
  const parts = value.split(':')
  if (parts.length !== 3) return false
  // Check if each part is valid base64
  try {
    for (const part of parts) {
      Buffer.from(part, 'base64')
    }
    return true
  } catch {
    return false
  }
}

async function main() {
  const sql = neon(process.env.DATABASE_URL!)

  const vendors = await sql`SELECT id, name, tax_id FROM vendors WHERE tax_id IS NOT NULL`
  console.log(`Found ${vendors.length} vendors with tax IDs`)

  let encrypted = 0
  let skipped = 0

  for (const vendor of vendors) {
    const taxId = vendor.tax_id as string

    if (isAlreadyEncrypted(taxId)) {
      console.log(`  [skip] Vendor ${vendor.id} (${vendor.name}) — already encrypted`)
      skipped++
      continue
    }

    const lastFour = taxId.replace(/\D/g, '').slice(-4)
    const encryptedTaxId = encryptValue(taxId)

    await sql`UPDATE vendors SET tax_id = ${encryptedTaxId}, tax_id_last_four = ${lastFour}, updated_at = NOW() WHERE id = ${vendor.id}`

    console.log(`  [done] Vendor ${vendor.id} (${vendor.name}) — encrypted, last4=${lastFour}`)
    encrypted++
  }

  console.log(`\nComplete: ${encrypted} encrypted, ${skipped} skipped`)
}

main().catch((e) => {
  console.error('Migration failed:', e)
  process.exit(1)
})
