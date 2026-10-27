/**
 * Browser-wallet deploy flow for FixedLabLendingMarket on Arc mainnet (chain 5042).
 *
 * Steps:
 *  1. Wallet must be on chain 5042 — caller shows a "Switch" button before calling deploy().
 *  2. deployContract() sends the creation bytecode; we wait for the receipt.
 *  3. Verify isPatched() === true at the new address via a read call.
 *  4. Save the address + tx hash as a mainnet override for the 'patched' variant.
 *  5. Return the result so the UI can show explorer links.
 *
 * Only FixedLabLendingMarket is ever deployed here. LabLendingMarket (vulnerable) must
 * never be deployed to mainnet from this flow.
 */
import { useCallback, useState } from 'react'
import { usePublicClient, useAccount, useSwitchChain, useDeployContract } from 'wagmi'
import type { Address, Hash } from 'viem'
import { marketAbi } from '@/lib/abi'
import { FIXED_MARKET_CREATION_BYTECODE } from '@/lib/fixedMarketArtifact'
import { arcMainnet } from '@/config'
import { parseTxError } from '@/lib/errors'

export type DeployPhase =
  | 'idle'
  | 'switching'
  | 'signing'
  | 'confirming'
  | 'verifying'
  | 'done'
  | 'error'

export interface DeployResult {
  address: Address
  txHash: Hash
}

export interface MainnetDeployState {
  phase: DeployPhase
  result: DeployResult | null
  error: string | null
  /** Call this to start the deploy. No-ops unless phase === 'idle' | 'error'. */
  deploy: () => Promise<void>
  reset: () => void
}

const CHAIN_ID = arcMainnet.id

export function useMainnetDeploy(onDeployed: (address: string, txHash: string) => void): MainnetDeployState {
  const { chainId, isConnected } = useAccount()
  const { switchChainAsync } = useSwitchChain()
  const { deployContractAsync } = useDeployContract()
  const publicClient = usePublicClient({ chainId: CHAIN_ID })

  const [phase, setPhase] = useState<DeployPhase>('idle')
  const [result, setResult] = useState<DeployResult | null>(null)
  const [error, setError] = useState<string | null>(null)

  const deploy = useCallback(async () => {
    if (!isConnected || !publicClient) return
    if (phase !== 'idle' && phase !== 'error') return

    setError(null)
    setResult(null)

    try {
      // Step 1 — ensure the wallet is on Arc mainnet
      if (chainId !== CHAIN_ID) {
        setPhase('switching')
        await switchChainAsync({ chainId: CHAIN_ID })
      }

      // Step 2 — send the creation transaction
      setPhase('signing')
      const hash = await deployContractAsync({
        abi: marketAbi,
        bytecode: FIXED_MARKET_CREATION_BYTECODE,
        chainId: CHAIN_ID,
        args: [],
      })

      // Step 3 — wait for the receipt
      setPhase('confirming')
      const receipt = await publicClient.waitForTransactionReceipt({ hash })
      if (receipt.status !== 'success') {
        throw new Error('Deploy transaction was mined but reverted.')
      }
      const contractAddress = receipt.contractAddress
      if (!contractAddress) {
        throw new Error('Receipt has no contractAddress — unexpected.')
      }

      // Step 4 — verify isPatched() === true
      setPhase('verifying')
      const isPatched = await publicClient.readContract({
        address: contractAddress,
        abi: marketAbi,
        functionName: 'isPatched',
      })
      if (!isPatched) {
        throw new Error(
          `isPatched() returned false at ${contractAddress} — this does not look like FixedLabLendingMarket.`,
        )
      }

      // Step 5 — persist + surface result
      const deployed: DeployResult = { address: contractAddress, txHash: hash }
      setResult(deployed)
      setPhase('done')
      onDeployed(contractAddress, hash)
    } catch (caught) {
      const message = parseTxError(caught) ?? String(caught)
      setError(message)
      setPhase('error')
    }
  }, [isConnected, chainId, phase, publicClient, switchChainAsync, deployContractAsync, onDeployed])

  const reset = useCallback(() => {
    setPhase('idle')
    setResult(null)
    setError(null)
  }, [])

  return { phase, result, error, deploy, reset }
}
