import { ExternalLink, FlaskConical } from 'lucide-react'
import { arcTestnet } from 'viem/chains'
import { buildAddressExplorerUrl, buildTxExplorerUrl } from '@/onchain-facts'
import { BUGS } from '@/lib/bugs'
import { VARIANTS, type DeploymentRecord, type VariantId } from '@/lib/deployments'
import { shortAddress } from '@/lib/errors'

interface Props {
  deployments: Record<VariantId, DeploymentRecord>
}

/** Recorded result of `forge test -vv` run in Arc Studio; full log in artifacts/test-logs/. */
const LOCAL_REGRESSION = { passed: 94, failed: 0, log: 'artifacts/test-logs/forge-test-vv.log' }

export function Evidence({ deployments }: Props) {
  return (
    <section className="card p-5" aria-label="Evidence">
      <div className="flex items-center gap-2">
        <FlaskConical className="size-4" style={{ color: 'var(--accent)' }} aria-hidden />
        <h2 className="display text-lg font-semibold">Evidence</h2>
      </div>

      <div className="label mt-4">Aomi fuzzing campaigns</div>
      <div className="mt-2 overflow-x-auto">
        <table className="w-full min-w-[440px] text-left text-sm">
          <thead>
            <tr className="label">
              <th className="py-2 pr-3 font-semibold">Defect</th>
              <th className="py-2 pr-3 font-semibold">Campaign</th>
              <th className="py-2 font-semibold">Finding</th>
            </tr>
          </thead>
          <tbody>
            {BUGS.map((bug) => (
              <tr key={bug.id} style={{ borderTop: '1px solid var(--border)' }}>
                <td className="py-2.5 pr-3">
                  <span className="mono text-xs">{bug.fn.split('(')[0]}</span>
                </td>
                <td className="py-2.5 pr-3">
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-semibold"
                    style={{ background: 'rgba(242,198,109,0.14)', color: 'var(--warn)' }}
                  >
                    Pending
                  </span>
                </td>
                <td className="py-2.5 text-xs" style={{ color: 'var(--subtle)' }}>
                  None reported
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-2 text-[11px] leading-relaxed" style={{ color: 'var(--subtle)' }}>
        No Aomi campaign has been run against these deployments. The bug descriptions in this app are fixtures with
        expected outcomes. They are not Aomi findings.
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
                    target="_blank"
                    rel="noopener noreferrer"
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
                    target="_blank"
                    rel="noopener noreferrer"
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
    </section>
  )
}
