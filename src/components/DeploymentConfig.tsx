import { useState } from 'react'
import { isAddress } from 'viem'
import { Settings2 } from 'lucide-react'
import { VARIANTS, defaultDeployments, type VariantId } from '@/lib/deployments'

interface Props {
  overrides: Partial<Record<VariantId, string>>
  onSave: (next: Partial<Record<VariantId, string>>) => void
}

const IDS: VariantId[] = ['vulnerable', 'patched']

export function DeploymentConfig({ overrides, onSave }: Props) {
  const defaults = defaultDeployments()
  const [draft, setDraft] = useState<Record<VariantId, string>>({
    vulnerable: overrides.vulnerable ?? defaults.vulnerable.address,
    patched: overrides.patched ?? defaults.patched.address,
  })
  const bad = IDS.filter((id) => draft[id].trim() !== '' && !isAddress(draft[id].trim()))

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

  return (
    <section className="card p-5" aria-label="Deployment addresses">
      <div className="flex items-center gap-2">
        <Settings2 className="size-4" style={{ color: 'var(--accent)' }} aria-hidden />
        <h2 className="display text-lg font-semibold">Deployment addresses</h2>
      </div>
      <p className="mt-1 text-xs" style={{ color: 'var(--subtle)' }}>
        Arc Testnet only. Defaults come from this project&apos;s deployments; overrides are stored in this browser.
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
          Reset to project defaults
        </button>
      </div>
    </section>
  )
}
