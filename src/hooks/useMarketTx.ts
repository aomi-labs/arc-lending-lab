import { useCallback, useState } from 'react'
import type { Address, Hash } from 'viem'
import { usePublicClient, useAccount, useSwitchChain, useWriteContract } from 'wagmi'
import { toast } from 'sonner'
import { marketAbi } from '@/lib/abi'
import { parseTxError } from '@/lib/errors'

export type ActionName =
  | 'supply'
  | 'withdrawSupply'
  | 'depositCollateral'
  | 'borrow'
  | 'repay'
  | 'withdrawCollateral'

interface Tracked {
  label: string
  hash: Hash
}

/** Sends one market write at a time, switching to the selected chain first and refetching once the receipt is real. */
export function useMarketTx(market: Address | undefined, onConfirmed: () => void, chainId: number) {
  const { address, chainId: walletChainId, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { writeContractAsync, isPending: isSigning } = useWriteContract()
  const publicClient = usePublicClient({ chainId })
  const [pending, setPending] = useState<Tracked | null>(null)
  const [lastConfirmed, setLastConfirmed] = useState<Tracked | null>(null)
  const [error, setError] = useState<string | null>(null)

  const send = useCallback(
    async (label: string, functionName: ActionName, args: readonly unknown[], value?: bigint): Promise<void> => {
      if (!market || !isConnected || !address || !publicClient) return
      setError(null)
      let tracked: Tracked | null = null
      try {
        if (walletChainId !== chainId) await switchChainAsync({ chainId })
        const hash = await writeContractAsync({
          address: market,
          abi: marketAbi,
          chainId,
          functionName,
          args,
          value,
        } as Parameters<typeof writeContractAsync>[0])
        tracked = { label, hash }
        setPending(tracked)
        const receipt = await publicClient.waitForTransactionReceipt({ hash })
        if (receipt.status === 'success') {
          setLastConfirmed(tracked)
          toast.success(`${label} confirmed`)
        } else {
          setError(`${label} was mined but reverted.`)
        }
      } catch (caught) {
        const message = parseTxError(caught)
        if (message) setError(message)
      } finally {
        setPending(null)
        if (tracked) onConfirmed()
      }
    },
    [market, isConnected, address, walletChainId, chainId, publicClient, switchChainAsync, writeContractAsync, onConfirmed],
  )

  return { send, isSigning, isConfirming: Boolean(pending), pending, lastConfirmed, error }
}
