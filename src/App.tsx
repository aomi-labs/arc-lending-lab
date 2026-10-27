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
import { loadOverrides, resolveDeployments, saveOverrides, type VariantId } from '@/lib/deployments'

export default function App() {
  const { address, isConnected } = useAccount()
  const [variant, setVariant] = useState<VariantId>('vulnerable')
  const [overrides, setOverrides] = useState(loadOverrides)

  const deployments = useMemo(() => resolveDeployments(overrides), [overrides])
  const selected = deployments[variant]
  const state = useMarketState(selected.address, address)
  const wallet = useBalance({ address, chainId: arcTestnet.id, query: { enabled: isConnected } })

  const saveAddresses = useCallback((next: Partial<Record<VariantId, string>>) => {
    setOverrides(next)
    saveOverrides(next)
  }, [])

  return (
    <div className="min-h-dvh pb-24">
      <Banner />
      <Header />

      <main className="mx-auto grid w-full max-w-6xl gap-4 px-4 py-4 sm:px-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <div className="space-y-4 lg:sticky lg:top-16 lg:self-start">
          <section className="card p-5" aria-label="Contract selector">
            <div className="label mb-2">Contract under test</div>
            <VariantSelector value={variant} onChange={setVariant} />
          </section>
          <Overview
            variant={variant}
            address={selected.address}
            state={state}
            connected={isConnected}
            walletBalance={wallet.data?.value}
          />
        </div>

        <div className="space-y-4">
          <Controls address={selected.address} state={state} />
          <BugPanel />
          <Evidence deployments={deployments} />
          <DeploymentConfig key={JSON.stringify(overrides)} overrides={overrides} onSave={saveAddresses} />
          <p className="px-1 text-center text-[11px] leading-relaxed" style={{ color: 'var(--subtle)' }}>
            Educational security benchmark. Test funds only; Arc Testnet only. The patched contract is an unaudited
            comparison fixture, not a safety claim.
          </p>
        </div>
      </main>
    </div>
  )
}
