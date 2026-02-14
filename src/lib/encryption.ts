import { createCipheriv, createDecipheriv, randomBytes } from 'crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const AUTH_TAG_LENGTH = 16

function getKey(): Buffer {
  const hex = process.env.PLAID_ENCRYPTION_KEY
  if (!hex) {
    throw new Error(
      'PLAID_ENCRYPTION_KEY environment variable is required. Generate with: node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
    )
  }
  const key = Buffer.from(hex, 'hex')
  if (key.length !== 32) {
    throw new Error(
      `PLAID_ENCRYPTION_KEY must be 32 bytes (64 hex chars), got ${key.length} bytes`
    )
  }
  return key
}

/**
 * Encrypts plaintext using AES-256-GCM.
 * Returns format: iv:authTag:ciphertext (all base64).
 */
export function encrypt(plaintext: string): string {
  const key = getKey()
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
export function decrypt(encrypted: string): string {
  const key = getKey()
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
