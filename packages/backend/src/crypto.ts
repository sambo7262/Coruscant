import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGO = 'aes-256-gcm'
const IV_BYTES = 12

function deriveKey(seed: string): Buffer {
  return createHash('sha256').update(seed).digest()
}

/**
 * Encrypt plaintext with AES-256-GCM using a seed-derived key.
 * Returns "ivHex:tagHex:ciphertextHex" — all colon-delimited hex segments.
 * A random 12-byte IV is generated per call, so the same plaintext
 * produces a different output each time.
 */
export function encrypt(plaintext: string, seed: string): string {
  const key = deriveKey(seed)
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, key, iv)

  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])

  const tag = cipher.getAuthTag()

  return [iv.toString('hex'), tag.toString('hex'), encrypted.toString('hex')].join(':')
}

/**
 * Decrypt a stored "ivHex:tagHex:ciphertextHex" value using the seed.
 * Throws if the auth tag verification fails (wrong seed or tampered data).
 */
export function decrypt(stored: string, seed: string): string {
  const parts = stored.split(':')
  if (parts.length !== 3) {
    throw new Error('Invalid stored format — expected ivHex:tagHex:ciphertextHex')
  }
  const [ivHex, tagHex, ciphertextHex] = parts
  if (!ivHex || !tagHex) {
    throw new Error('Invalid stored format — missing IV or auth tag')
  }

  const key = deriveKey(seed)
  const iv = Buffer.from(ivHex, 'hex')
  const tag = Buffer.from(tagHex, 'hex')
  const ciphertext = Buffer.from(ciphertextHex, 'hex')

  const decipher = createDecipheriv(ALGO, key, iv)
  decipher.setAuthTag(tag)

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()])
  return decrypted.toString('utf8')
}
