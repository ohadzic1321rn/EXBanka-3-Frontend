/**
 * Validates an 18-digit Serbian domestic bank account number using the mod 11 checksum.
 *
 * Algorithm:
 *   weights = [2,3,4,5,6,7] cycling for digit positions 0–15 (first 16 digits)
 *   sum     = Σ digit[i] × weight[i]
 *   valid   = (sum + parseInt(last2digits)) % 11 === 0
 */
export function validateAccountNumber(broj: string): boolean {
  const digits = broj.replace(/\D/g, '')
  if (digits.length !== 18) return false

  const weights = [2, 3, 4, 5, 6, 7, 2, 3, 4, 5, 6, 7, 2, 3, 4, 5]

  let sum = 0
  for (let i = 0; i < 16; i++) {
    sum += parseInt(digits[i]) * weights[i]
  }

  const control = parseInt(digits.slice(16))
  return (sum + control) % 11 === 0
}
