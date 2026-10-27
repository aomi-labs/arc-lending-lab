import { useCallback, useMemo, useState } from 'react'
import { useAccount, useBalance } from 'wagmi'
import { arcTestnet } from 'viem/chains'
import { Banner } from '@/components/Banner'
import { Header } from '@/components/Header'
import { VariantSelector } from '@/components/VariantSelector'
import { Overview } from '@/components/Overview'
import { Controls } from '@/components/Controls'
import { BugPanel } from '@/components/BugPanel'
import { Evidence } from '@/components/Evidence'
import { DeploymentConfig } from '@/components/DeploymentConfig'
import { useMarketState } from '@/hooks/useMarketState'
import { arcMainnet } from '@/config'
import {
  loadOverrides,
  resolveDeployments,
  saveOverrides,
  type VariantId,
  type DeploymentRecord,
} from '@/lib/deployments'
import { NetworkContext, type NetworkId } from '@/lib/network'

// localStorage key for the tx hashes produced by wallet-initiated deploys
const MAINNET_TX_KEY = 'arc-lending-lab:mainnet-tx:v1'

function loadMainnetTxHashes(): Partial<Record<VariantId, string>> {
  try {
    const raw = window.localStorage.getItem(MAINNET_TX_KEY)
    if (!raw) return {}
    const parsed: unknown = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null) return {}
    const out: Partial<Record<VariantId, string>> = {}
    for (const id of ['vulnerable', 'patched'] as const) {
      const v = (parsed as Record<string, unknown>)[id]
      if (typeof v === 'string') out[id] = v
    }
    return out
  } catch { return {} }
}

function saveMainnetTxHashes(hashes: Partial<Record<VariantId, string>>): void {
  try { window.localStorage.setItem(MAINNET_TX_KEY, JSON.stringify(hashes)) } catch { /* unavailable */ }
}

export default function App() {
  const { address, isConnected } = useAccount()
  const [network, setNetwork] = useState<NetworkId>('testnet')
  const [variant, setVariant] = useState<VariantId>('patched')
  const [overrides, setOverrides] = useState(() => loadOverrides('testnet'))
  const [mainnetOverrides, setMainnetOverrides] = useState(() => loadOverrides('mainnet'))
  // Tx hashes from wallet-initiated mainnet deploys, stored separately because
  // the address-override map accepts only address strings.
  const [mainnetTxHashes, setMainnetTxHashes] = useState(loadMainnetTxHashes)

  const isMainnet = network === 'mainnet'
  const selectedChainId = isMainnet ? arcMainnet.id : arcTestnet.id

  // When switching to mainnet force the variant to 'patched' — vulnerable is blocked there
  const handleSetNetwork = useCallback((n: NetworkId) => {
    setNetwork(n)
    if (n === 'mainnet') setVariant('patched')
  }, [])

  const currentOverrides = isMainnet ? mainnetOverrides : overrides

  // Merge wallet-deploy tx hashes into the resolved mainnet deployment records
  const deployments = useMemo((): Record<VariantId, DeploymentRecord> => {
    const base = resolveDeployments(currentOverrides, network)
    if (!isMainnet) return base
    const merged = { ...base }
    for (const id of ['vulnerable', 'patched'] as const) {
      const tx = mainnetTxHashes[id]
      if (tx && !merged[id].txHash) {
        merged[id] = { ...merged[id], txHash: tx }
      }
    }
    return merged
  }, [currentOverrides, network, isMainnet, mainnetTxHashes])

  const selected = deployments[variant]

  // "Not deployed yet" means we are on mainnet and the selected address is empty
  const notDeployedYet = isMainnet && !selected.address

  const state = useMarketState(selected.address, address, selectedChainId)
  const wallet = useBalance({ address, chainId: selectedChainId, query: { enabled: isConnected } })

  const saveAddresses = useCallback(
    (next: Partial<Record<VariantId, string>>) => {
      if (isMainnet) {
        setMainnetOverrides(next)
        saveOverrides(next, 'mainnet')
      } else {
        setOverrides(next)
        saveOverrides(next, 'testnet')
      }
    },
    [isMainnet],
  )

  // Called by DeploymentConfig after a successful wallet-initiated mainnet deploy
  const handleMainnetDeployed = useCallback((deployedAddress: string, txHash: string) => {
    // Save the address as a mainnet override for 'patched'
    const nextOverrides = { ...mainnetOverrides, patched: deployedAddress }
    setMainnetOverrides(nextOverrides)
    saveOverrides(nextOverrides, 'mainnet')
    // Save the tx hash separately
    const nextTxHashes = { ...mainnetTxHashes, patched: txHash }
    setMainnetTxHashes(nextTxHashes)
    saveMainnetTxHashes(nextTxHashes)
  }, [mainnetOverrides, mainnetTxHashes])

  const networkCtx = useMemo(() => ({ network, setNetwork: handleSetNetwork }), [network, handleSetNetwork])

  return (
    <NetworkContext.Provider value={networkCtx}>
      <div className="min-h-dvh pb-24">
        <Banner />
        <Header />

        <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
          <div className="space-y-4 lg:sticky lg:top-16 lg:self-start">
            <section className="card p-5" aria-label="Contract selector">
              <div className="label mb-2">Contract under test</div>
              <VariantSelector
                value={variant}
                onChange={setVariant}
                disabledVariants={isMainnet ? ['vulnerable'] : []}
              />
            </section>
            <Overview
              variant={variant}
              address={selected.address}
              state={state}
              connected={isConnected}
              walletBalance={wallet.data?.value}
              chainId={selectedChainId}
              notDeployedYet={notDeployedYet}
            />
          </div>

          <div className="space-y-4">
            <Controls
              address={selected.address}
              state={state}
              chainId={selectedChainId}
              notDeployedYet={notDeployedYet}
            />
            <BugPanel />
            <Evidence deployments={deployments} />
            <DeploymentConfig
              key={`${network}:${JSON.stringify(currentOverrides)}`}
              overrides={currentOverrides}
              onSave={saveAddresses}
              network={network}
              onMainnetDeployed={handleMainnetDeployed}
            />
            <p className="px-1 text-center text-[11px] leading-relaxed" style={{ color: 'var(--subtle)' }}>
              {isMainnet
                ? 'Arc mainnet — real USDC. Only FixedLabLendingMarket should be deployed here. The vulnerable contract must never hold real value.'
                : 'Educational security benchmark. Test funds only; Arc Testnet only. The patched contract is an unaudited comparison fixture, not a safety claim.'}
            </p>
          </div>
        </main>
      </div>
    </NetworkContext.Provider>
  )
}
