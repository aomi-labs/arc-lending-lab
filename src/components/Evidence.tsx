import { ExternalLink, FlaskConical } from 'lucide-react'
import { arcTestnet } from 'viem/chains'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/onchain-facts'
import { VARIANTS, type DeploymentRecord, type VariantId } from '@/lib/deployments'
import { shortAddress } from '@/lib/errors'
import { AOMI_VULNERABLE_CAMPAIGN as CAMPAIGN, DEFECT_EVIDENCE, PUBLIC_LINKS } from '@/lib/evidence'

interface Props {
  deployments: Record<VariantId, DeploymentRecord>
}

/** Recorded result of `forge test -vv` run in Arc Studio; full log in artifacts/test-logs/. */
const LOCAL_REGRESSION = { passed: 94, failed: 0, log: 'artifacts/test-logs/forge-test-vv.log' }

const external = { target: '_blank', rel: 'noopener noreferrer' } as const

export function Evidence({ deployments }: Props) {
  return (
    <section className="card p-5" aria-label="Evidence">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4" style={{ color: 'var(--accent)' }} aria-hidden />
        <h2 className="display text-lg font-semibold">Evidence</h2>
      </div>

      <div className="label mt-4">Aomi campaign: vulnerable market</div>
      <div className="inner mt-2 p-4 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: 'rgba(242,198,109,0.14)', color: 'var(--warn)' }}
          >
            1 confirmed finding
          </span>
          <span
            className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
            style={{ background: 'var(--surface-strong)', color: 'var(--muted)' }}
          >
            Interrupted campaign, not a completed audit
          </span>
        </div>
        <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-xs">
          <dt style={{ color: 'var(--subtle)' }}>Campaign</dt>
          <dd className="mono break-all">{CAMPAIGN.campaignId}</dd>
          <dt style={{ color: 'var(--subtle)' }}>Target</dt>
          <dd>
            <a
              className="mono inline-flex items-center gap-1"
              style={{ color: 'var(--accent)' }}
              href={buildAddressExplorerUrl(arcTestnet.id, CAMPAIGN.target)}
              {...external}
            >
              {CAMPAIGN.targetName} {shortAddress(CAMPAIGN.target)} <ExternalLink className="size-3" aria-hidden />
            </a>
          </dd>
          <dt style={{ color: 'var(--subtle)' }}>Run</dt>
          <dd className="tabular-nums">
            {CAMPAIGN.executions} executions, corpus {CAMPAIGN.corpus}, round {CAMPAIGN.round}
          </dd>
          <dt style={{ color: 'var(--subtle)' }}>Property</dt>
          <dd>
            &ldquo;{CAMPAIGN.property}&rdquo; reproduced {CAMPAIGN.reproductions} times
          </dd>
        </dl>
        <div className="label mt-3">Minimized trace (atomic units)</div>
        <ol className="mono mt-1 list-decimal space-y-0.5 pl-5 text-xs" style={{ color: 'var(--ink-2)' }}>
          {CAMPAIGN.trace.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
        <p className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
          {CAMPAIGN.observed}
        </p>
        <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--subtle)' }}>
          {CAMPAIGN.caveat}
        </p>
      </div>

      <div className="label mt-5">Per-defect status</div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-sm">
          <thead>
            <tr className="label">
              <th className="py-2 pr-3 font-semibold">Defect</th>
              <th className="py-2 pr-3 font-semibold">Aomi result</th>
              <th className="py-2 font-semibold">Note</th>
            </tr>
          </thead>
          <tbody>
            {DEFECT_EVIDENCE.map((item) => {
              const confirmed = item.kind === 'aomi-confirmed'
              return (
                <tr key={item.fn} style={{ borderTop: '1px solid var(--border)' }}>
                  <td className="py-2.5 pr-3 align-top">
                    <span className="label block">{item.label}</span>
                    <span className="mono text-xs">{item.fn}</span>
                  </td>
                  <td className="py-2.5 pr-3 align-top">
                    <span
                      className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold"
                      style={{
                        background: confirmed ? 'rgba(242,198,109,0.14)' : 'var(--surface-strong)',
                        color: confirmed ? 'var(--warn)' : 'var(--muted)',
                      }}
                    >
                      {confirmed ? 'Confirmed' : 'No finding'}
                    </span>
                  </td>
                  <td className="py-2.5 align-top text-xs" style={{ color: 'var(--subtle)' }}>
                    {item.note}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div className="label mt-5">Aomi campaign: patched market</div>
      <p className="mt-1 text-sm">
        <span
          className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
          style={{ background: 'rgba(242,198,109,0.14)', color: 'var(--warn)' }}
        >
          Pending
        </span>{' '}
        <span className="text-xs" style={{ color: 'var(--subtle)' }}>
          No result has been supplied for FixedLabLendingMarket.
        </span>
      </p>
      <p className="mt-3 text-[11px] leading-relaxed" style={{ color: 'var(--subtle)' }}>
        Bugs 2 and 3 are ground-truth fixtures covered by Foundry tests. They are not Aomi findings, and this page does
        not claim all three defects were found.
      </p>

      <div className="label mt-5">Local regression suite</div>
      <p className="mt-1 text-sm">
        <span className="tabular-nums font-semibold" style={{ color: 'var(--success)' }}>
          {LOCAL_REGRESSION.passed} passed
        </span>
        , {LOCAL_REGRESSION.failed} failed (Foundry, exploit and blocked-by-patch cases). Recorded run; not live. Log:{' '}
        <span className="mono text-xs">{LOCAL_REGRESSION.log}</span>
      </p>

      <div className="label mt-5">Deployment receipts (Arc Testnet #{arcTestnet.id})</div>
      <ul className="mt-2 space-y-2">
        {(Object.keys(VARIANTS) as VariantId[]).map((id) => {
          const record = deployments[id]
          return (
            <li key={id} className="inner flex flex-wrap items-center justify-between gap-2 p-3 text-xs">
              <span className="font-semibold">{VARIANTS[id].contractName}</span>
              <span className="flex flex-wrap items-center gap-3">
                {record.address ? (
                  <a
                    className="mono inline-flex items-center gap-1"
                    style={{ color: 'var(--accent)' }}
                    href={buildAddressExplorerUrl(arcTestnet.id, record.address)}
                    {...external}
                  >
                    {shortAddress(record.address)} <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : (
                  <span style={{ color: 'var(--subtle)' }}>No address</span>
                )}
                {record.txHash ? (
                  <a
                    className="mono inline-flex items-center gap-1"
                    style={{ color: 'var(--accent)' }}
                    href={buildTxExplorerUrl(arcTestnet.id, record.txHash)}
                    {...external}
                  >
                    tx {shortAddress(record.txHash)} <ExternalLink className="size-3" aria-hidden />
                  </a>
                ) : (
                  <span style={{ color: 'var(--subtle)' }}>Custom address: no receipt on file</span>
                )}
              </span>
            </li>
          )
        })}
      </ul>

      <div className="label mt-5">Public links</div>
      <div className="mt-2 flex flex-wrap gap-3 text-xs">
        <a className="inline-flex items-center gap-1" style={{ color: 'var(--accent)' }} href={PUBLIC_LINKS.app} {...external}>
          Live app <ExternalLink className="size-3" aria-hidden />
        </a>
        <a className="inline-flex items-center gap-1" style={{ color: 'var(--accent)' }} href={PUBLIC_LINKS.repo} {...external}>
          GitHub repository <ExternalLink className="size-3" aria-hidden />
        </a>
      </div>
    </section>
  )
}
