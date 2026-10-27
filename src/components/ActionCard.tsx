import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { fmtExact, parseNative } from '@/lib/format'

interface Props {
  title: string
  description: string
  buttonLabel: string
  /** Optional ceiling shown as a Max shortcut (atomic units). */
  max?: bigint
  maxLabel?: string
  disabledReason?: string
  busy: boolean
  onSubmit: (amount: bigint) => void
}

export function ActionCard({ title, description, buttonLabel, max, maxLabel, disabledReason, busy, onSubmit }: Props) {
  const [text, setText] = useState('')
  const amount = parseNative(text)
  const invalid = text.trim() !== '' && amount === null
  const tooLarge = amount !== null && max !== undefined && amount > max
  const blocked = Boolean(disabledReason) || amount === null || busy

  return (
    <div className="inner p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <p className="mt-0.5 text-xs leading-snug" style={{ color: 'var(--subtle)' }}>
        {description}
      </p>
      <div className="mt-3 flex items-center gap-2 rounded-xl px-3" style={{ background: 'rgba(0,0,0,0.25)' }}>
        <input
          aria-label={`${title} amount in USDC`}
          inputMode="decimal"
          autoComplete="off"
          placeholder="0.0"
          value={text}
          onChange={(event) => {
            const next = event.target.value
            if (next === '' || /^\d*\.?\d*$/.test(next)) setText(next)
          }}
          className="display min-h-11 w-full bg-transparent text-lg font-semibold tabular-nums outline-none placeholder:opacity-40"
        />
        <span className="text-xs font-medium" style={{ color: 'var(--subtle)' }}>
          USDC
        </span>
        {max !== undefined && (
          <button
            type="button"
            className="text-xs font-semibold"
            style={{ color: 'var(--accent)' }}
            disabled={max === 0n}
            onClick={() => setText(fmtExact(max))}
          >
            Max
          </button>
        )}
      </div>
      <div className="mono mt-1.5 min-h-4 text-[11px]" style={{ color: invalid || tooLarge ? 'var(--danger)' : 'var(--subtle)' }}>
        {invalid
          ? 'Up to 18 decimal places, numbers only.'
          : amount !== null
            ? `${amount.toString()} atomic units${tooLarge ? ` (above ${maxLabel ?? 'your limit'})` : ''}`
            : max !== undefined && maxLabel
              ? `${maxLabel}: ${fmtExact(max)} USDC`
              : '1 USDC = 1e18 atomic units'}
      </div>
      <button
        className="btn-primary mt-3 flex w-full items-center justify-center gap-2 text-sm"
        disabled={blocked}
        title={disabledReason}
        onClick={() => amount !== null && onSubmit(amount)}
      >
        {busy ? (
          <>
            <Loader2 className="size-4 animate-spin" aria-hidden /> Working...
          </>
        ) : (
          (disabledReason ?? buttonLabel)
        )}
      </button>
    </div>
  )
}
