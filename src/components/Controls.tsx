import { ExternalLink, Loader2 } from 'lucide-react'
import { isAddress } from 'viem'
import { useAccount } from 'wagmi'
import { buildTxExplorerUrl } from '@/onchain-facts'
import { useMarketTx } from '@/hooks/useMarketTx'
import type { MarketState } from '@/hooks/useMarketState'
import { ActionCard } from './ActionCard'

interface Props {
  address: string
  state: MarketState
  chainId: number
  /** When true the market is not deployed — all controls show a "not deployed" reason. */
  notDeployedYet?: boolean
}

const min = (a: bigint, b: bigint) => (a < b ? a : b)

/** Normal, honest-user controls only. Exploit sequences are described in the bug panel, never wired to buttons. */
export function Controls({ address, state, chainId, notDeployedYet }: Props) {
  const { address: account, isConnected } = useAccount()
  const market = isAddress(address) ? (address) : undefined
  const tx = useMarketTx(market, state.refetch, chainId)

  const busy = tx.isSigning || tx.isConfirming
  const reason = notDeployedYet
    ? 'Not deployed on this network'
    : !isConnected
      ? 'Connect wallet first'
      : state.status !== 'ready'
        ? 'Market unavailable'
        : undefined

  const supplied = state.supplyBalance ?? 0n
  const withdrawableSupply = min(supplied, state.availableLiquidity ?? 0n)
  const borrowable = min(state.maxBorrowable ?? 0n, state.availableLiquidity ?? 0n)

  return (
    <section className="card p-5" aria-label="Market controls">
      <div className="flex items-baseline justify-between">
        <h2 className="display text-lg font-semibold">Normal controls</h2>
        <span className="text-xs" style={{ color: 'var(--subtle) ' }}>
          Honest flows only
        </span>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
        Every amount is native USDC. Supply, deposit and repay send value with the transaction; withdraw and borrow
        move funds out of the market.
      </p>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <ActionCard
          title="Supply"
          description="Add lendable liquidity. Credited to your supplier balance."
          buttonLabel="Supply USDC"
          disabledReason={reason}
          busy={busy}
          onSubmit={(value) => void tx.send('Supply', 'supply', [], value)}
        />
        <ActionCard
          title="Withdraw supply"
          description="Take your own supplied USDC back, limited by available liquidity."
          buttonLabel="Withdraw supply"
          max={withdrawableSupply}
          maxLabel="Withdrawable"
          disabledReason={reason}
          busy={busy}
          onSubmit={(value) => account && void tx.send('Withdraw supply', 'withdrawSupply', [account, value])}
        />
        <ActionCard
          title="Deposit collateral"
          description="Collateral backs your borrowing and is never lent to others."
          buttonLabel="Deposit collateral"
          disabledReason={reason}
          busy={busy}
          onSubmit={(value) => void tx.send('Deposit collateral', 'depositCollateral', [], value)}
        />
        <ActionCard
          title="Borrow"
          description="Borrow up to 50% of your collateral, limited by market liquidity."
          buttonLabel="Borrow USDC"
          max={borrowable}
          maxLabel="Borrowable now"
          disabledReason={reason}
          busy={busy}
          onSubmit={(value) => void tx.send('Borrow', 'borrow', [value])}
        />
        <ActionCard
          title="Repay"
          description="Pay down your debt. Overpaying is rejected, not refunded."
          buttonLabel="Repay debt"
          max={state.debt ?? 0n}
          maxLabel="Your debt"
          disabledReason={reason}
          busy={busy}
          onSubmit={(value) => void tx.send('Repay', 'repay', [], value)}
        />
        <ActionCard
          title="Withdraw collateral"
          description="Take collateral back. Keep enough to cover your debt."
          buttonLabel="Withdraw collateral"
          max={state.collateralBalance ?? 0n}
          maxLabel="Your collateral"
          disabledReason={reason}
          busy={busy}
          onSubmit={(value) => void tx.send('Withdraw collateral', 'withdrawCollateral', [value])}
        />
      </div>

      <div aria-live="polite" className="mt-4 space-y-2">
        {tx.isSigning && (
          <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Confirm in your wallet...
          </p>
        )}
        {tx.pending && (
          <p className="flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
            <Loader2 className="size-4 animate-spin" aria-hidden /> {tx.pending.label} submitted, waiting for
            confirmation...
            <a
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: 'var(--accent)' }}
              href={buildTxExplorerUrl(chainId, tx.pending.hash)}
              target="_blank"
              rel="noopener noreferrer"
            >
              Explorer <ExternalLink className="size-3" aria-hidden />
            </a>
          </p>
        )}
        {tx.error && (
          <p className="rounded-xl p-3 text-sm" style={{ background: 'rgba(232,109,122,0.12)', color: 'var(--danger)' }}>
            {tx.error}
          </p>
        )}
        {tx.lastConfirmed && !tx.pending && !tx.error && (
          <p className="text-sm" style={{ color: 'var(--success)' }}>
            {tx.lastConfirmed.label} confirmed.{' '}
            <a
              className="inline-flex items-center gap-1 text-xs"
              style={{ color: 'var(--accent)' }}
              href={buildTxExplorerUrl(chainId, tx.lastConfirmed.hash)}
              target="_blank"
              rel="noopener noreferrer"
            >
              View receipt <ExternalLink className="size-3" aria-hidden />
            </a>
          </p>
        )}
      </div>
    </section>
  )
}
