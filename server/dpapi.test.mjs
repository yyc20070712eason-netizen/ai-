import { describe, expect, it } from 'vitest'
import { protectAndVerifySecret, protectSecret, unprotectSecret } from './dpapi.mjs'

describe.skipIf(process.platform !== 'win32')('Windows DPAPI secrets', () => {
  it('encrypts and decrypts a secret for the current Windows user', () => {
    const secret = 'sk-test-only-not-a-real-api-key-1234567890'
    const encrypted = protectSecret(secret)

    expect(encrypted).not.toContain(secret)
    expect(unprotectSecret(encrypted)).toBe(secret)
    expect(protectAndVerifySecret(secret)).not.toContain(secret)
  })

  it('rejects invalid encrypted payloads', () => {
    expect(() => unprotectSecret('not-valid-base64')).toThrow('Windows 无法读取已保存的 API Key。')
  })
})
