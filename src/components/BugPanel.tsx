import { useState } from 'react'
import { BookOpen, ChevronDown } from 'lucide-react'
import clsx from 'clsx'
import { BUGS } from '@/lib/bugs'

/** Educational only. Contains no transaction buttons: nothing here can execute an exploit. */
export function BugPanel() {
  const [open, setOpen] = useState<number | null>(null)

  return (
    <section className="card p-5" aria-label="Educational bug descriptions">
      <div className="flex items-center gap-2">
        <BookOpen className="size-4" style={{ color: 'var(--accent)' }} aria-hidden />
        <h2 className="display text-lg font-semibold">The three deliberate defects</h2>
      </div>
      <p className="mt-1 text-xs leading-relaxed" style={{ color: 'var(--subtle)' }}>
        Read-only explanations for learning and for fuzzer benchmarking. The controls above only perform honest flows.
        Amounts are native atomic units (1 USDC = 1e18).
      </p>

      <div className="mt-4 space-y-2">
        {BUGS.map((bug) => {
          const expanded = open === bug.id
          return (
            <div key={bug.id} className="inner overflow-hidden">
              <button
                aria-expanded={expanded}
                aria-controls={`bug-${bug.id}`}
                onClick={() => setOpen(expanded ? null : bug.id)}
                className="flex min-h-12 w-full items-center justify-between gap-3 px-4 py-3 text-left"
              >
                <span>
                  <span className="label">Bug {bug.id}</span>
                  <span className="block text-sm font-semibold text-balance">{bug.title}</span>
                </span>
                <ChevronDown
                  className={clsx('size-4 shrink-0 transition-transform', expanded && 'rotate-180')}
                  aria-hidden
                />
              </button>
              {expanded && (
                <div id={`bug-${bug.id}`} className="space-y-3 px-4 pb-4 text-sm">
                  <p className="mono text-xs" style={{ color: 'var(--accent)' }}>
                    {bug.fn}
                  </p>
                  <p className="text-pretty" style={{ color: 'var(--muted)' }}>
                    {bug.summary}
                  </p>
                  <div>
                    <div className="label">Trace</div>
                    <ol className="mono mt-1 list-decimal space-y-0.5 pl-5 text-xs" style={{ color: 'var(--ink-2)' }}>
                      {bug.trace.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="rounded-xl p-3" style={{ background: 'rgba(242,198,109,0.1)' }}>
                      <div className="label" style={{ color: 'var(--warn)' }}>
                        Vulnerable
                      </div>
                      <p className="mt-1 text-xs">{bug.vulnerableResult}</p>
                    </div>
                    <div className="rounded-xl p-3" style={{ background: 'rgba(172,198,233,0.1)' }}>
                      <div className="label" style={{ color: 'var(--accent)' }}>
                        Patched
                      </div>
                      <p className="mt-1 text-xs">{bug.patchedResult}</p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}
