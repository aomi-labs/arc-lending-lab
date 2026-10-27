import { ExternalLink, Loader2 } from 'lucide-react'
import { TokenUSDC } from '@web3icons/react'
import { buildAddressExplorerUrl } from '@/onchain-facts'
import { fmtUsdc } from '@/lib/format'
import { shortAddress } from '@/lib/errors'
import { VARIANTS, type VariantId } from '@/lib/deployments'
import type { MarketState } from '@/hooks/useMarketState'

interface Props {
  variant: VariantId
  address: string
  state: MarketState
  connected: boolean
  walletBalance: bigint | undefined
  chainId: number
  /** When true the market address came from config but was empty — mainnet not deployed yet. */
  notDeployedYet?: boolean
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="inner p-3">
      <div className="label">{label}</div>
      <div className="display mt-1 flex items-baseline gap-1 text-xl font-bold tabular-nums">
        {value}
        <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
          USDC
        </span>
      </div>
      {hint && (
        <div className="mt-0.5 text-[11px]" style={{ color: 'var(--subtle)' }}>
          {hint}
        </div>
      )}
    </div>
  )
}

export function Overview({ variant, address, state, connected, walletBalance, chainId, notDeployedYet }: Props) {
  const info = VARIANTS[variant]
  const mismatch = state.status === 'ready' && state.isPatched !== info.expectedPatched
  const mine = (raw: bigint | undefined) => (connected ? fmtUsdc(raw) : '--')
  const networkLabel = chainId === 5042 ? 'Arc mainnet' : 'Arc Testnet'

  return (
    <section className="card p-5" aria-label="Market balances">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <TokenUSDC variant="branded" size={22} />
          <h2 className="display text-lg font-semibold">{info.contractName}</h2>
        </div>
        {address && !notDeployedYet && (
          <a
            href={buildAddressExplorerUrl(chainId, address)}
            target="_blank"
            rel="noopener noreferrer"
            className="mono inline-flex items-center gap-1 text-xs"
            style={{ color: 'var(--accent)' }}
          >
            {shortAddress(address)} <ExternalLink className="size-3" aria-hidden />
          </a>
        )}
      </div>

      {notDeployedYet && (
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          Not deployed on Arc mainnet yet. Add an address under Deployment addresses below.
        </p>
      )}
      {!notDeployedYet && state.status === 'no-address' && (
        <p className="mt-3 text-sm" style={{ color: 'var(--muted)' }}>
          No address configured for this variant. Add one under Deployment addresses below.
        </p>
      )}
      {!notDeployedYet && state.status === 'loading' && (
        <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <Loader2 className="size-4 animate-spin" aria-hidden /> Reading market state from {networkLabel}...
        </p>
      )}
      {!notDeployedYet && state.status === 'no-contract' && (
        <p className="mt-3 text-sm" style={{ color: 'var(--danger)' }}>
          No compatible contract answered at this address on {networkLabel}. Check the address under Deployment
          addresses.
        </p>
      )}
      {mismatch && (
        <p
          className="mt-3 rounded-xl p-3 text-sm"
          style={{ background: 'rgba(242,198,109,0.12)', color: 'var(--warn)' }}
        >
          This address reports {state.isPatched ? 'a patched' : 'a vulnerable'} contract, but the selector says{' '}
          {info.label}. Fix the address before trusting any result.
        </p>
      )}

      {state.status === 'ready' && (
        <>
          <div className="label mt-4">Market (all accounts)</div>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label="Available liquidity" value={fmtUsdc(state.availableLiquidity)} hint="Lendable supply only" />
            <Stat label="Total collateral" value={fmtUsdc(state.totalCollateral)} hint="Never lent out" />
            <Stat label="Total supplied" value={fmtUsdc(state.totalSupplied)} />
            <Stat label="Recorded debt" value={fmtUsdc(state.totalDebt)} />
          </div>

          <div className="label mt-5">Your position</div>
          {!connected && (
            <p className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
              Connect a wallet to see your supplied, collateral and debt balances.
            </p>
          )}
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Stat label="Supplied" value={mine(state.supplyBalance)} />
            <Stat label="Collateral" value={mine(state.collateralBalance)} />
            <Stat label="Debt" value={mine(state.debt)} />
            <Stat label="Borrowing room" value={mine(state.maxBorrowable)} hint="50% of collateral minus debt" />
          </div>
        </>
      )}

      <p className="mt-4 text-[11px] leading-relaxed" style={{ color: 'var(--subtle)' }}>
        Wallet: {connected ? `${fmtUsdc(walletBalance)} USDC` : '--'}. Amounts are native USDC in 18-decimal units
        (1 USDC = 1,000,000,000,000,000,000 atomic units), the same pool of funds as the 6-decimal ERC-20 view.
      </p>
    </section>
  )
}
