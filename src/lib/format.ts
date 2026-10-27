import { arcTestnet } from 'viem/chains'
import { Amount, gasTokenDecimalsFor, parseGasAmount } from '@/onchain-money'

/** Contract amounts are native USDC (msg.value units, 18 decimals on Arc). */
export const NATIVE_DECIMALS = gasTokenDecimalsFor(arcTestnet.id)

export function fmtUsdc(raw: bigint | undefined, digits = 4): string {
  if (raw === undefined) return '--'
  return Amount.fromRaw(raw, NATIVE_DECIMALS).toFixed(digits)
}

export function fmtExact(raw: bigint): string {
  return Amount.fromRaw(raw, NATIVE_DECIMALS).toString()
}

/** Parses user text into native atomic units. Returns null for blank/invalid/zero input. */
export function parseNative(text: string): bigint | null {
  if (!text.trim()) return null
  try {
    const parsed = parseGasAmount(arcTestnet.id, text).raw
    return parsed > 0n ? parsed : null
  } catch {
    return null
  }
}
