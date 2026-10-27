import { ConnectKitButton } from 'connectkit'
import { useAccount, useSwitchChain } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { NetworkArc } from '@web3icons/react'
import { Landmark } from 'lucide-react'
import { requireChain } from '@/onchain-facts'

export function Header() {
  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending } = useSwitchChain()
  const wrong = isConnected && chainId !== arcTestnet.id
  const chain = requireChain(arcTestnet.id)

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
        <div
          className="flex min-h-11 items-center gap-2 rounded-2xl px-3 text-xs font-semibold"
          style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
        >
          <NetworkArc variant="branded" size={18} />
          <span>
            {chain.name} <span className="mono" style={{ color: 'var(--subtle)' }}>#{chain.chainId}</span>
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
            onClick={() => switchChain({ chainId: arcTestnet.id })}
          >
            {isPending ? 'Switching...' : 'Switch to Arc Testnet'}
          </button>
        )}
        <ConnectKitButton />
      </div>
    </header>
  )
}
