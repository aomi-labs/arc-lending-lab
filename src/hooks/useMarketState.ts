import { useMemo } from 'react'
import { isAddress, type Address } from 'viem'
import { useReadContracts } from 'wagmi'
import { marketAbi } from '@/lib/abi'

const ZERO_ADDRESS: Address = '0x0000000000000000000000000000000000000000'

export type MarketStatus = 'no-address' | 'loading' | 'no-contract' | 'ready'

export interface MarketState {
  status: MarketStatus
  /** Value of isPatched() read from the contract, when the call succeeded. */
  isPatched?: boolean
  availableLiquidity?: bigint
  totalSupplied?: bigint
  totalCollateral?: bigint
  totalDebt?: bigint
  supplyBalance?: bigint
  collateralBalance?: bigint
  debt?: bigint
  maxBorrowable?: bigint
  refetch: () => void
}

/** Live reads for one market deployment, plus the connected account's positions. */
export function useMarketState(address: string, account: Address | undefined, chainId: number): MarketState {
  const market = isAddress(address) ? address : undefined
  const user = account ?? ZERO_ADDRESS
  const target = market ?? ZERO_ADDRESS

  const contracts = useMemo(() => {
    const base = { address: target, abi: marketAbi, chainId } as const
    return [
      { ...base, functionName: 'isPatched' },
      { ...base, functionName: 'availableLiquidity' },
      { ...base, functionName: 'totalSupplied' },
      { ...base, functionName: 'totalCollateral' },
      { ...base, functionName: 'totalDebt' },
      { ...base, functionName: 'supplyBalance', args: [user] },
      { ...base, functionName: 'collateralBalance', args: [user] },
      { ...base, functionName: 'debt', args: [user] },
      { ...base, functionName: 'maxBorrowable', args: [user] },
    ] as const
  }, [target, user, chainId])

  const { data, isLoading, refetch } = useReadContracts({
    contracts,
    query: { enabled: Boolean(market), refetchInterval: 6000 },
  })

  if (!market) return { status: 'no-address', refetch: () => void refetch() }
  if (isLoading && !data) return { status: 'loading', refetch: () => void refetch() }

  const [patched, liquidity, supplied, collateral, totalDebt, mySupply, myCollateral, myDebt, myMax] = data ?? []
  if (!patched || patched.status !== 'success') return { status: 'no-contract', refetch: () => void refetch() }

  const hasAccount = Boolean(account)
  const pick = (entry: { status: string; result?: unknown } | undefined): bigint | undefined => {
    if (!entry || entry.status !== 'success') return undefined
    return typeof entry.result === 'bigint' ? entry.result : undefined
  }

  return {
    status: 'ready',
    isPatched: patched.result === true,
    availableLiquidity: pick(liquidity),
    totalSupplied: pick(supplied),
    totalCollateral: pick(collateral),
    totalDebt: pick(totalDebt),
    supplyBalance: hasAccount ? pick(mySupply) : undefined,
    collateralBalance: hasAccount ? pick(myCollateral) : undefined,
    debt: hasAccount ? pick(myDebt) : undefined,
    maxBorrowable: hasAccount ? pick(myMax) : undefined,
    refetch: () => void refetch(),
  }
}
