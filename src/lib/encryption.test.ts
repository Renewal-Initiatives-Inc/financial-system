import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

// Must set env before importing
const TEST_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef'

describe('encryption', () => {
  beforeEach(() => {
    vi.stubEnv('PLAID_ENCRYPTION_KEY', TEST_KEY)
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('round-trip encrypt/decrypt returns original plaintext', async () => {
    const { encrypt, decrypt } = await import('./encryption')
    const plaintext = 'access-sandbox-abc123-test-token'
    const encrypted = encrypt(plaintext)
    const decrypted = decrypt(encrypted)
    expect(decrypted).toBe(plaintext)
  })

  it('different IVs per encryption call', async () => {
    const { encrypt } = await import('./encryption')
    const plaintext = 'same-input-text'
    const encrypted1 = encrypt(plaintext)
    const encrypted2 = encrypt(plaintext)
    // Encrypted values should differ due to random IV
    expect(encrypted1).not.toBe(encrypted2)
  })

  it('encrypted format is iv:authTag:ciphertext', async () => {
    const { encrypt } = await import('./encryption')
    const encrypted = encrypt('test')
    const parts = encrypted.split(':')
    expect(parts).toHaveLength(3)
    // Each part should be valid base64
    for (const part of parts) {
      expect(() => Buffer.from(part, 'base64')).not.toThrow()
    }
  })

  it('decrypt fails with wrong key', async () => {
    const { encrypt } = await import('./encryption')
    const encrypted = encrypt('test-value')

    // Change env to a different key
    vi.stubEnv(
      'PLAID_ENCRYPTION_KEY',
      'abcdef0123456789abcdef0123456789abcdef0123456789abcdef0123456789'
    )

    // Re-import to pick up new key
    const { decrypt } = await import('./encryption')
    expect(() => decrypt(encrypted)).toThrow()
  })

  it('throws descriptive error if key is missing', async () => {
    vi.stubEnv('PLAID_ENCRYPTION_KEY', '')
    const { encrypt } = await import('./encryption')
    expect(() => encrypt('test')).toThrow('PLAID_ENCRYPTION_KEY')
  })

  it('throws error for invalid encrypted string format', async () => {
    const { decrypt } = await import('./encryption')
    expect(() => decrypt('not-valid-format')).toThrow('Invalid encrypted string format')
  })
})
