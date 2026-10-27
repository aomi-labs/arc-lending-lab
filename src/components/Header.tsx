import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { NetworkArc } from '@web3icons/react'
import { Landmark } from 'lucide-react'
import { requireChain } from '@/onchain-facts'
import { arcMainnet } from '@/config'
import { useNetwork, type NetworkId } from '@/lib/network'

const NETWORKS: { id: NetworkId; label: string; badge: string }[] = [
  { id: 'testnet', label: 'Arc Testnet', badge: 'Testnet' },
  { id: 'mainnet', label: 'Arc Mainnet', badge: 'Mainnet' },
]

export function Header() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const { network, setNetwork } = useNetwork()

  const selectedChainId = network === 'mainnet' ? arcMainnet.id : arcTestnet.id
  const chainFact = requireChain(selectedChainId)
  const wrong = isConnected && chainId !== selectedChainId

  return (
    <header className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-3 px-4 pb-2 pt-6 sm:px-6">
      <div className="flex items-center gap-3">
        <div
          className="flex size-11 items-center justify-center rounded-2xl"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
        >
          <Landmark className="size-5" style={{ color: 'var(--accent)' }} aria-hidden />
        </div>
        <div>
          <h1 className="display text-2xl font-bold leading-tight text-balance sm:text-3xl">Arc Lending Lab</h1>
          <p className="text-xs" style={{ color: 'var(--subtle)' }}>
            Native-USDC lending market for stateful-fuzzer benchmarks
          </p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {/* Network selector */}
        <div
          className="flex items-center gap-1 rounded-2xl p-1"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
          role="group"
          aria-label="Select network"
        >
          {NETWORKS.map((n) => {
            const active = network === n.id
            return (
              <button
                key={n.id}
                onClick={() => setNetwork(n.id)}
                aria-pressed={active}
                className="rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors"
                style={{
                  background: active ? 'var(--surface-strong)' : 'transparent',
                  color: active ? 'var(--ink)' : 'var(--subtle)',
                  border: active ? '1px solid var(--border-strong)' : '1px solid transparent',
                }}
              >
                {n.badge}
              </button>
            )
          })}
        </div>

        {/* Chain badge */}
        <div
          className="flex min-h-11 items-center gap-2 rounded-2xl px-3 text-xs font-semibold"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <NetworkArc variant="branded" size={18} />
          <span>
            {chainFact.name} <span className="mono" style={{ color: 'var(--subtle)' }}>#{chainFact.chainId}</span>
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wider"
            style={{
              background: wrong ? 'rgba(232,109,122,0.15)' : 'rgba(141,216,159,0.15)',
              color: wrong ? 'var(--danger)' : isConnected ? 'var(--success)' : 'var(--subtle)',
            }}
          >
            {!isConnected ? 'Wallet not connected' : wrong ? 'Wrong network' : 'Connected'}
          </span>
        </div>

        {wrong && (
          <button
            className="btn-ghost text-xs"
            disabled={isPending}
            onClick={() => switchChain({ chainId: selectedChainId })}
          >
            {isPending ? 'Switching...' : `Switch to ${chainFact.name}`}
          </button>
        )}
        <ConnectKitButton />
      </div>
    </header>
  )
}
