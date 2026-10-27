import clsx from 'clsx'
import { ShieldAlert, ShieldCheck } from 'lucide-react'
import { VARIANTS, type VariantId } from '@/lib/deployments'

interface Props {
  value: VariantId
  onChange: (id: VariantId) => void
  /** Variant IDs that are blocked on the current network (e.g. vulnerable on mainnet). */
  disabledVariants?: VariantId[]
}

export function VariantSelector({ value, onChange, disabledVariants = [] }: Props) {
  return (
    <div role="radiogroup" aria-label="Contract variant" className="grid grid-cols-2 gap-2">
      {(Object.keys(VARIANTS) as VariantId[]).map((id) => {
        const variant = VARIANTS[id]
        const active = value === id
        const blocked = disabledVariants.includes(id)
        const Icon = id === 'vulnerable' ? ShieldAlert : ShieldCheck
        return (
          <button
            key={id}
            role="radio"
            aria-checked={active}
            aria-disabled={blocked}
            disabled={blocked}
            onClick={() => !blocked && onChange(id)}
            title={blocked ? 'Disabled on Arc mainnet — vulnerable contract must not hold real value' : undefined}
            className={clsx(
              'flex min-h-[88px] flex-col items-start gap-1 rounded-2xl p-3 text-left transition-colors',
              blocked ? 'cursor-not-allowed opacity-40' : active ? 'ring-1' : 'hover:bg-white/5',
            )}
            style={{
              background: active && !blocked ? 'var(--surface-strong)' : 'transparent',
              border: `1px solid ${active && !blocked ? 'var(--border-strong)' : 'var(--border)'}`,
            }}
          >
            <span className="flex items-center gap-1.5 text-sm font-semibold">
              <Icon
                className="size-4"
                style={{ color: id === 'vulnerable' ? 'var(--warn)' : 'var(--accent)' }}
                aria-hidden
              />
              {variant.label}
              {blocked && (
                <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ background: 'rgba(232,109,122,0.15)', color: 'var(--danger)' }}>
                  Disabled
                </span>
              )}
            </span>
            <span className="mono text-[11px]" style={{ color: 'var(--subtle)' }}>
              {variant.contractName}
            </span>
            <span className="text-[11px] leading-snug" style={{ color: 'var(--muted)' }}>
              {blocked ? 'Must never hold real value on mainnet.' : variant.blurb}
            </span>
          </button>
        )
      })}
    </div>
  )
}
