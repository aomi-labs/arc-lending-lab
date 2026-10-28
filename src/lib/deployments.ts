import { isAddress } from 'viem'
import type { NetworkId } from './network'

export type VariantId = 'vulnerable' | 'patched'

export interface VariantInfo {
  id: VariantId
  label: string
  contractName: string
  /** What the selector tells the reader the contract is. */
  blurb: string
  /** Value `isPatched()` must return for the address to be accepted as this variant. */
  expectedPatched: boolean
}

export const VARIANTS: Record<VariantId, VariantInfo> = {
  vulnerable: {
    id: 'vulnerable',
    label: 'Vulnerable',
    contractName: 'LabLendingMarket',
    blurb: 'Three deliberate defects. For fuzzing benchmarks only.',
    expectedPatched: false,
  },
  patched: {
    id: 'patched',
    label: 'Patched',
    contractName: 'FixedLabLendingMarket',
    blurb: 'Repairs the same three defects. Unaudited comparison fixture.',
    expectedPatched: true,
  },
}

export interface DeploymentRecord {
  address: string
  /** Deployment transaction hash, known only for the default deployment from .env. */
  txHash?: string
}

const STORAGE_KEY = 'arc-lending-lab:addresses:v1'
const STORAGE_KEY_MAINNET = 'arc-lending-lab:addresses-mainnet:v1'

const clean = (value: unknown): string => (typeof value === 'string' ? value.trim() : '')

/**
 * Public, non-secret Arc Testnet (chain ID 5042002) deployments of this project. They are the
 * fallback when no VITE_ override is set, so a clean checkout works without an .env file.
 */
export const DEFAULT_DEPLOYMENTS: Record<VariantId, DeploymentRecord> = {
  vulnerable: {
    address: '0xb4c00fc759aeff83f693f7c24420771d84e65a77',
    txHash: '0x58a6010b719c57b4965cc6bd8ff2044b7ddd7d393efdb2150403853ece188bfe',
  },
  patched: {
    address: '0x0e813ccf3a9bcf05df1cd39e2f848fedc6cf6129',
    txHash: '0x89092a77f89f3171e08a2d95cd0f36885cdf41962928de7123587608613c13e4',
  },
}

/**
 * Built-in Arc mainnet (chain ID 5042) deployments. VITE_MAINNET_* env vars override these.
 * The vulnerable market must never hold real value on mainnet; its entry stays empty.
 */
export const DEFAULT_MAINNET_DEPLOYMENTS: Record<VariantId, DeploymentRecord> = {
  vulnerable: { address: '' },
  patched: {
    address: '0xBA6CE9A25EA0A392519EdFc3D940dC4FF52616bA',
    txHash: '0x7f3d7fff971e384e5aa36b69cd000dc2eb974481a0ec57f52f973e1d8342cf3f',
  },
}

/**
 * Arc mainnet deployments. VITE_MAINNET_* env vars win over the built-in fallbacks
 * (same pattern as testnet). When a variable is absent the built-in default applies.
 */
export function defaultMainnetDeployments(): Record<VariantId, DeploymentRecord> {
  const env = import.meta.env as Record<string, string | undefined>
  const pick = (id: VariantId, addressKey: string, txKey: string): DeploymentRecord => {
    const fallback = DEFAULT_MAINNET_DEPLOYMENTS[id]
    const address = clean(env[addressKey])
    if (!address) return { ...fallback, txHash: clean(env[txKey]) || fallback.txHash }
    const sameAsFallback = address.toLowerCase() === fallback.address.toLowerCase()
    return { address, txHash: clean(env[txKey]) || (sameAsFallback ? fallback.txHash : undefined) }
  }
  return {
    vulnerable: pick('vulnerable', 'VITE_MAINNET_VULNERABLE_MARKET_ADDRESS', 'VITE_MAINNET_VULNERABLE_MARKET_TX'),
    patched: pick('patched', 'VITE_MAINNET_FIXED_MARKET_ADDRESS', 'VITE_MAINNET_FIXED_MARKET_TX'),
  }
}

/** VITE_ values win over the built-in fallbacks. An overridden address drops the fallback hash. */
export function defaultDeployments(): Record<VariantId, DeploymentRecord> {
  const env = import.meta.env as Record<string, string | undefined>
  const pick = (id: VariantId, addressKey: string, txKey: string): DeploymentRecord => {
    const fallback = DEFAULT_DEPLOYMENTS[id]
    const address = clean(env[addressKey])
    if (!address) return { ...fallback, txHash: clean(env[txKey]) || fallback.txHash }
    const sameAsFallback = address.toLowerCase() === fallback.address.toLowerCase()
    return { address, txHash: clean(env[txKey]) || (sameAsFallback ? fallback.txHash : undefined) }
  }
  return {
    vulnerable: pick('vulnerable', 'VITE_VULNERABLE_MARKET_ADDRESS', 'VITE_VULNERABLE_MARKET_TX'),
    patched: pick('patched', 'VITE_FIXED_MARKET_ADDRESS', 'VITE_FIXED_MARKET_TX'),
  }
}

export function loadOverrides(network: NetworkId = 'testnet'): Partial<Record<VariantId, string>> {
  const key = network === 'mainnet' ? STORAGE_KEY_MAINNET : STORAGE_KEY
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Partial<Record<VariantId, string>> = {}
    for (const id of ['vulnerable', 'patched'] as const) {
      const value = (parsed as Record<string, unknown>)[id]
      if (typeof value === 'string' && isAddress(value)) out[id] = value
    }
    return out
  } catch {
    return {}
  }
}

export function saveOverrides(overrides: Partial<Record<VariantId, string>>, network: NetworkId = 'testnet'): void {
  const key = network === 'mainnet' ? STORAGE_KEY_MAINNET : STORAGE_KEY
  try {
    window.localStorage.setItem(key, JSON.stringify(overrides))
  } catch {
    // Storage can be unavailable (private mode); the in-memory state still applies.
  }
}

export function resolveDeployments(
  overrides: Partial<Record<VariantId, string>>,
  network: NetworkId = 'testnet',
): Record<VariantId, DeploymentRecord> {
  const defaults = network === 'mainnet' ? defaultMainnetDeployments() : defaultDeployments()
  const result = { ...defaults }
  for (const id of ['vulnerable', 'patched'] as const) {
    const override = overrides[id]
    if (!override) continue
    const defaultAddr = defaults[id].address
    if (!defaultAddr || override.toLowerCase() !== defaultAddr.toLowerCase()) {
      result[id] = { address: override }
    }
  }
  return result
}
