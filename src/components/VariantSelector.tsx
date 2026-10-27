import clsx from 'clsx'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { VARIANTS, type VariantId } from '@/lib/deployments'

interface Props {
  value: VariantId
  onChange: (id: VariantId) => void
}

export function VariantSelector({ value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label="Contract variant" className="grid grid-cols-2 gap-2">
      {(Object.keys(VARIANTS) as VariantId[]).map((id) => {
        const variant = VARIANTS[id]
        const active = value === id
        const Icon = id === 'vulnerable' ? ShieldAlert : ShieldCheck
        return (
          <button
            key={id}
            role="radio"
            aria-checked={active}
            onClick={() => onChange(id)}
            className={clsx(
              'flex min-h-[88px] flex-col items-start gap-1 rounded-2xl p-3 text-left transition-colors',
              active ? 'ring-1' : 'hover:bg-white/5',
            )}
            style={{
              background: active ? 'var(--surface-strong)' : 'transparent',
              border: `1px solid ${active ? 'var(--border-strong)' : 'var(--border)'}`,
            }}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Icon
                className="size-4"
                style={{ color: id === 'vulnerable' ? 'var(--warn)' : 'var(--accent)' }}
                aria-hidden
              />
              {variant.label}
            </span>
            <span className="mono text-[11px]" style={{ color: 'var(--subtle)' }}>
              {variant.contractName}
            </span>
            <span className="text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>
              {variant.blurb}
            </span>
          </button>
        )
      })}
    </div>
  )
}
