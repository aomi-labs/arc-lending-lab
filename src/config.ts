/**
 * wagmi configuration
 * Built with Arc Studio — https://studio.arc.io
 */

import { http, createConfig } from 'wagmi'
import { mainnet } from 'wagmi/chains'
import { arcTestnet } from 'viem/chains'
import { defineChain } from 'viem'
import { injected } from 'wagmi/connectors'
import { registerChain } from './tracing'
import { requireChain } from './onchain-facts'

// Arc mainnet — defined from onchain-facts so no values are typed by hand
const _arcMainnetFacts = requireChain(5042)
export const arcMainnet = defineChain({
  id: _arcMainnetFacts.chainId,
  name: _arcMainnetFacts.name,
  nativeCurrency: {
    name: _arcMainnetFacts.nativeCurrency.symbol,
    symbol: _arcMainnetFacts.nativeCurrency.symbol,
    decimals: _arcMainnetFacts.nativeCurrency.decimals,
  },
  rpcUrls: {
    default: { http: _arcMainnetFacts.rpcUrls as [string, ...string[]] },
  },
  blockExplorers: {
    default: { name: 'Arc Explorer', url: _arcMainnetFacts.explorerBase },
  },
})

// Pre-register chain RPC URLs so trace events show correct chain names immediately
registerChain(arcTestnet.id, arcTestnet.rpcUrls.default.http[0])
registerChain(arcMainnet.id, arcMainnet.rpcUrls.default.http[0])

export const config = createConfig({
  chains: [arcTestnet, arcMainnet, mainnet], // mainnet needed for ENS resolution
  connectors: [injected()],
  transports: {
    [arcTestnet.id]: http(),
    [arcMainnet.id]: http(),
    [mainnet.id]: http(), // ENS resolution uses mainnet
  },
})
