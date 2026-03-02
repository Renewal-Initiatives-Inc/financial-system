import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKeyFromEnv(envVar: string): Buffer {
  const hex = process.env[envVar]
  if (!hex) {
    throw new Error(
      `${envVar} environment variable is required. Generate with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    )
  }
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) {
    throw new Error(
      `${envVar} must be 32 bytes (64 hex chars), got ${key.length} bytes`
    )
  }
  // Entropy check: reject trivially weak keys (all zeros, repeated bytes, etc.)
  const uniqueBytes = new Set(key).size
  if (uniqueBytes < 4) {
    throw new Error(
      `${envVar} has insufficient entropy (${uniqueBytes} unique byte values). Generate a proper key with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`
    )
  }
  return key
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all base64).
 */
export function encrypt(plaintext: string, keyEnvVar = 'PLAID_ENCRYPTION_KEY'): string {
  const key = getKeyFromEnv(keyEnvVar)
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)

  let encrypted = cipher.update(plaintext, 'utf8', 'base64')
  encrypted += cipher.final('base64')

  const authTag = cipher.getAuthTag()

  return `${iv.toString('base64')}:${authTag.toString('base64')}:${encrypted}`
}

/**
 * Decrypts a string previously encrypted with encrypt().
 */
export function decrypt(encrypted: string, keyEnvVar = 'PLAID_ENCRYPTION_KEY'): string {
  const key = getKeyFromEnv(keyEnvVar)
  const parts = encrypted.split(':')

  if (parts.length !== 3) {
    throw new Error('Invalid encrypted string format (expected iv:authTag:ciphertext)')
  }

  const [ivB64, authTagB64, ciphertext] = parts
  const iv = Buffer.from(ivB64, 'base64')
  const authTag = Buffer.from(authTagB64, 'base64')

  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(authTag)

  let decrypted = decipher.update(ciphertext, 'base64', 'utf8')
  decrypted += decipher.final('utf8')

  return decrypted
}

// --- Vendor tax ID helpers ---

const VENDOR_KEY = 'VENDOR_ENCRYPTION_KEY'

export function encryptVendorTaxId(plaintext: string): string {
  return encrypt(plaintext, VENDOR_KEY)
}

export function decryptVendorTaxId(encrypted: string): string {
  return decrypt(encrypted, VENDOR_KEY)
}
