/**
 * Network selection context for Arc Lending Lab.
 *
 * The app supports two networks:
 *   - Arc Testnet  (chainId 5042002) — default, has built-in deployments
 *   - Arc Mainnet  (chainId 5042)    — optional, requires VITE_MAINNET_* env vars
 */
import { createContext, useContext } from 'react'

export type NetworkId = 'testnet' | 'mainnet'

export const NETWORK_CHAIN_IDS: Record<NetworkId, number> = {
  testnet: 5042002,
  mainnet: 5042,
}

export interface NetworkContextValue {
  network: NetworkId
  setNetwork: (n: NetworkId) => void
}

export const NetworkContext = createContext<NetworkContextValue>({
  network: 'testnet',
  setNetwork: () => undefined,
})

export function useNetwork(): NetworkContextValue {
  return useContext(NetworkContext)
}
