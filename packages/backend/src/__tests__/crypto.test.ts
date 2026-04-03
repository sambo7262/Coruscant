import { describe, it, expect } from 'vitest'
import { encrypt, decrypt } from '../crypto.js'

const TEST_SEED = 'aabbccddeeff00112233445566778899aabbccddeeff00112233445566778899'

describe('crypto', () => {
  it('round-trip: encrypt then decrypt returns original plaintext', () => {
    const plaintext = 'my-api-key-12345'
    const stored = encrypt(plaintext, TEST_SEED)
    const result = decrypt(stored, TEST_SEED)
    expect(result).toBe(plaintext)
  })

  it('output is in ivHex:tagHex:ciphertextHex format (3 colon-separated segments)', () => {
    const stored = encrypt('hello', TEST_SEED)
    const parts = stored.split(':')
    expect(parts).toHaveLength(3)
  })

  it('IV segment is exactly 24 hex chars (12 bytes)', () => {
    const stored = encrypt('hello', TEST_SEED)
    const [ivHex] = stored.split(':')
    expect(ivHex).toHaveLength(24)
    expect(ivHex).toMatch(/^[0-9a-f]+$/i)
  })

  it('auth tag segment is exactly 32 hex chars (16 bytes)', () => {
    const stored = encrypt('hello', TEST_SEED)
    const [, tagHex] = stored.split(':')
    expect(tagHex).toHaveLength(32)
    expect(tagHex).toMatch(/^[0-9a-f]+$/i)
  })

  it('produces different ciphertext each call (random IV)', () => {
    const plaintext = 'my-api-key'
    const result1 = encrypt(plaintext, TEST_SEED)
    const result2 = encrypt(plaintext, TEST_SEED)
    // Different random IVs mean different stored values
    expect(result1).not.toBe(result2)
  })

  it('decrypt with wrong seed throws an error', () => {
    const stored = encrypt('secret', TEST_SEED)
    const wrongSeed = '0000000000000000000000000000000000000000000000000000000000000000'
    expect(() => decrypt(stored, wrongSeed)).toThrow()
  })

  it('encrypts empty string round-trip', () => {
    const stored = encrypt('', TEST_SEED)
    expect(decrypt(stored, TEST_SEED)).toBe('')
  })

  it('encrypts special characters round-trip', () => {
    const plaintext = 'abc123!@#$%^&*()-_=+[]{}|;:,.<>?'
    const stored = encrypt(plaintext, TEST_SEED)
    expect(decrypt(stored, TEST_SEED)).toBe(plaintext)
  })
})
