import { randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

const keyLength = 64

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex')
  const hash = scryptSync(password, salt, keyLength).toString('hex')
  return `scrypt$${salt}$${hash}`
}

export function verifyPassword(password: string, encoded: string): boolean {
  const [algorithm, salt, storedHash] = encoded.split('$')
  if (algorithm !== 'scrypt' || !salt || !storedHash) return false
  const actualHash = scryptSync(password, salt, keyLength)
  const expectedHash = Buffer.from(storedHash, 'hex')
  return expectedHash.length === actualHash.length && timingSafeEqual(expectedHash, actualHash)
}
