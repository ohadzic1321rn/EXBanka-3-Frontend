export const OWN_BANK_CODE = '111'

export const PARTNER_BANK_NAMES: Record<string, string> = {
  '111': 'EXBanka-3',
  '222': 'Banka 2',
  '333': 'Banka 3',
  '444': 'Banka 4',
}

export function validateAccountNumber(broj: string): boolean {
  if (!/^\d{18}$/.test(broj)) return false

  const bankCode = broj.slice(0, 3)
  const validBank = bankCode === '111' || bankCode === '222' || bankCode === '333' || bankCode === '444'
  if (!validBank) return false

  // Checksum: (sum of all digits) % 11 == 0
  const sum = broj.split('').reduce((s, ch) => s + Number(ch), 0)
  return sum % 11 === 0
}

export function bankCodeOf(broj: string): string {
  return broj.slice(0, 3)
}

export function isCrossBankAccount(broj: string): boolean {
  if (!/^\d{3}/.test(broj)) return false
  return bankCodeOf(broj) !== OWN_BANK_CODE
}

export function bankNameOf(broj: string): string {
  return PARTNER_BANK_NAMES[bankCodeOf(broj)] ?? `Banka ${bankCodeOf(broj)}`
}
