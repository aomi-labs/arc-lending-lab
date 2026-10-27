import { useState } from 'react'
import { isAddress } from 'viem'
import { useAccount, useSwitchChain } from 'wagmi'
import { Settings2, ExternalLink, Loader2, Rocket } from 'lucide-react'
import { VARIANTS, defaultDeployments, defaultMainnetDeployments, type VariantId } from '@/lib/deployments'
import { useMainnetDeploy } from '@/hooks/useMainnetDeploy'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/onchain-facts'
import { arcMainnet } from '@/config'
import type { NetworkId } from '@/lib/network'

interface Props {
  overrides: Partial<Record<VariantId, string>>
  onSave: (next: Partial<Record<VariantId, string>>) => void
  network: NetworkId
  /** Called when the mainnet deploy completes; parent uses this to persist the override. */
  onMainnetDeployed: (address: string, txHash: string) => void
}

const IDS: VariantId[] = ['vulnerable', 'patched']
const MAINNET_CHAIN_ID = arcMainnet.id

const PHASE_LABEL: Record<string, string> = {
  switching: 'Switching to Arc mainnet...',
  signing: 'Confirm in your wallet...',
  confirming: 'Waiting for confirmation...',
  verifying: 'Verifying contract...',
}

export function DeploymentConfig({ overrides, onSave, network, onMainnetDeployed }: Props) {
  const defaults = network === 'mainnet' ? defaultMainnetDeployments() : defaultDeployments()
  const [draft, setDraft] = useState<Record<VariantId, string>>({
    vulnerable: overrides.vulnerable ?? defaults.vulnerable.address,
    patched: overrides.patched ?? defaults.patched.address,
  })
  const bad = IDS.filter((id) => draft[id].trim() !== '' && !isAddress(draft[id].trim()))

  const { isConnected, chainId } = useAccount()
  const { switchChain, isPending: isSwitching } = useSwitchChain()

  const save = () => {
    const next: Partial<Record<VariantId, string>> = {}
    for (const id of IDS) {
      const value = draft[id].trim()
      if (value && isAddress(value)) next[id] = value
    }
    onSave(next)
  }

  const reset = () => {
    setDraft({ vulnerable: defaults.vulnerable.address, patched: defaults.patched.address })
    onSave({})
  }

  const networkLabel = network === 'mainnet' ? 'Arc mainnet' : 'Arc Testnet'

  // Mainnet deploy flow — only shown when on mainnet with no patched address configured
  const mainnetPatchedAddress = (overrides.patched ?? defaults.patched.address ?? '').trim()
  const showDeployButton = network === 'mainnet' && !isAddress(mainnetPatchedAddress)

  const handleDeployed = (address: string, txHash: string) => {
    // Also update the draft input so the address field reflects the newly deployed contract
    setDraft((prev) => ({ ...prev, patched: address }))
    onMainnetDeployed(address, txHash)
  }

  const { phase, result, error: deployError, deploy, reset: resetDeploy } = useMainnetDeploy(handleDeployed)
  const isBusy = phase === 'switching' || phase === 'signing' || phase === 'confirming' || phase === 'verifying'
  const wrongChain = isConnected && chainId !== MAINNET_CHAIN_ID

  return (
    <section className="card p-5" aria-label="Deployment addresses">
      <div className="flex items-center gap-2">
        <Settings2 className="size-4" style={{ color: 'var(--accent)' }} aria-hidden />
        <h2 className="display text-lg font-semibold">Deployment addresses</h2>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
        {network === 'mainnet'
          ? 'Arc mainnet. No default address is built in; set VITE_MAINNET_FIXED_MARKET_ADDRESS in .env or paste one below. Overrides are stored in this browser.'
          : 'Arc Testnet only. Defaults come from this project\u2019s deployments; overrides are stored in this browser.'}
      </p>
      <div className="mt-4 space-y-3">
        {IDS.map((id) => (
          <label key={id} className="block">
            <span className="label">{VARIANTS[id].contractName}</span>
            <input
              value={draft[id]}
              onChange={(event) => setDraft((prev) => ({ ...prev, [id]: event.target.value }))}
              spellCheck={false}
              autoComplete="off"
              placeholder="0x..."
              aria-invalid={bad.includes(id)}
              className="mono mt-1 min-h-11 w-full rounded-xl px-3 text-xs outline-none"
              style={{
                background: 'rgba(0,0,0,0.25)',
                border: `1px solid ${bad.includes(id) ? 'var(--danger)' : 'var(--border)'}`,
                color: 'var(--ink)',
              }}
            />
            {bad.includes(id) && (
              <span className="mt-1 block text-[11px]" style={{ color: 'var(--danger)' }}>
                Not a valid address.
              </span>
            )}
          </label>
        ))}
      </div>
      <div className="mt-4 flex gap-2">
        <button className="btn-primary text-sm" disabled={bad.length > 0} onClick={save}>
          Apply addresses
        </button>
        <button className="btn-ghost text-sm" onClick={reset}>
          {network === 'mainnet' ? 'Clear addresses' : 'Reset to project defaults'}
        </button>
      </div>
      <p className="mt-3 text-[11px]" style={{ color: 'var(--subtle)' }}>
        Addresses are scoped to {networkLabel}; switching networks restores that network&apos;s saved state.
      </p>

      {/* ---- Mainnet self-deploy panel ---- */}
      {showDeployButton && (
        <div
          className="mt-5 rounded-2xl p-4"
          style={{ background: 'var(--surface-strong)', border: '1px solid var(--border)' }}
        >
          <div className="flex items-center gap-2">
            <Rocket className="size-4" style={{ color: 'var(--accent)' }} aria-hidden />
            <span className="text-sm font-semibold">Deploy FixedLabLendingMarket to Arc mainnet</span>
          </div>
          <p className="mt-1.5 text-xs" style={{ color: 'var(--subtle)' }}>
            Deploys the patched contract from your connected wallet on Arc mainnet (chain {MAINNET_CHAIN_ID}). No
            constructor args, no value sent. Only FixedLabLendingMarket is deployed here — the vulnerable contract must
            never be deployed to mainnet.
          </p>

          {!isConnected && (
            <p className="mt-3 text-xs" style={{ color: 'var(--warn)' }}>
              Connect a wallet first.
            </p>
          )}

          {isConnected && wrongChain && phase === 'idle' && (
            <button
              className="btn-ghost mt-3 text-xs"
              disabled={isSwitching}
              onClick={() => switchChain({ chainId: MAINNET_CHAIN_ID })}
            >
              {isSwitching ? 'Switching...' : 'Switch to Arc mainnet'}
            </button>
          )}

          {isConnected && !wrongChain && phase === 'idle' && (
            <button className="btn-primary mt-3 text-sm" onClick={() => void deploy()}>
              Deploy FixedLabLendingMarket to Arc mainnet (your wallet)
            </button>
          )}

          {isBusy && (
            <p className="mt-3 flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
              <Loader2 className="size-4 animate-spin" aria-hidden />
              {PHASE_LABEL[phase] ?? 'Working...'}
            </p>
          )}

          {phase === 'done' && result && (
            <div className="mt-3 space-y-2">
              <p className="text-sm font-semibold" style={{ color: 'var(--success)' }}>
                Deployed and verified.
              </p>
              <div
                className="rounded-xl p-3 text-xs"
                style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">Address</span>
                  <a
                    className="mono inline-flex items-center gap-1"
                    style={{ color: 'var(--accent)' }}
                    href={buildAddressExplorerUrl(MAINNET_CHAIN_ID, result.address)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {result.address} <ExternalLink className="size-3" aria-hidden />
                  </a>
                </div>
                <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="font-semibold">Deploy tx</span>
                  <a
                    className="mono inline-flex items-center gap-1"
                    style={{ color: 'var(--accent)' }}
                    href={buildTxExplorerUrl(MAINNET_CHAIN_ID, result.txHash)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    {result.txHash.slice(0, 18)}... <ExternalLink className="size-3" aria-hidden />
                  </a>
                </div>
              </div>
              <p className="text-[11px] leading-relaxed" style={{ color: 'var(--subtle)' }}>
                Address and tx saved as your mainnet override for this browser. Send these to the maintainer so they
                become built-in defaults.
              </p>
            </div>
          )}

          {phase === 'error' && deployError && (
            <div className="mt-3 space-y-2">
              <p
                className="rounded-xl p-3 text-sm"
                style={{ background: 'rgba(232,109,122,0.12)', color: 'var(--danger)' }}
              >
                {deployError}
              </p>
              <button className="btn-ghost text-xs" onClick={resetDeploy}>
                Try again
              </button>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
