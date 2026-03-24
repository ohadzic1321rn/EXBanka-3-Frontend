import { describe, it, expect } from 'vitest'
import { validateAccountNumber } from '../../utils/accountValidation'

// Mod 11 algorithm:
// weights = [2,3,4,5,6,7] cycling for positions 0-15 (first 16 digits)
// sum = Σ digit[i] × weight[i]
// valid if (sum + parseInt(last2digits)) % 11 === 0
//
// Valid examples computed:
//   "000000000000000000" → sum=0, ctrl=00 → (0+0)%11=0 ✓
//   "100000000000000009" → sum=2, ctrl=09 → (2+9)%11=0 ✓
//   "160000000000000002" → sum=20, ctrl=02 → (20+2)%11=0 ✓

describe('validateAccountNumber', () => {
  it('returns true for all-zeros account (control 00)', () => {
    expect(validateAccountNumber('000000000000000000')).toBe(true)
  })

  it('returns true for a computed-valid 18-digit account', () => {
    expect(validateAccountNumber('160000000000000002')).toBe(true)
  })

  it('returns true for another valid account', () => {
    expect(validateAccountNumber('100000000000000009')).toBe(true)
  })

  it('returns false when control digits are wrong', () => {
    expect(validateAccountNumber('160000000000000099')).toBe(false)
  })

  it('returns false for 17-digit number (too short)', () => {
    expect(validateAccountNumber('12345678901234567')).toBe(false)
  })

  it('returns false for 19-digit number (too long)', () => {
    expect(validateAccountNumber('1234567890123456789')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(validateAccountNumber('')).toBe(false)
  })

  it('returns false for non-numeric 18-char string', () => {
    expect(validateAccountNumber('abcdefghijklmnopqr')).toBe(false)
  })

  it('returns false for all-nines (wrong checksum)', () => {
    // sum for 999999999999999999 first 16 nines:
    // 9*(2+3+4+5+6+7+2+3+4+5+6+7+2+3+4+5) = 9*68 = 612
    // (612 + 99) % 11 = 711 % 11 = 7*11+? = 711/11=64.6... 64*11=704, 711-704=7 ≠ 0
    expect(validateAccountNumber('999999999999999999')).toBe(false)
  })
})
