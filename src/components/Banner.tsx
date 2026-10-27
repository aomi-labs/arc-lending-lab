import { TriangleAlert } from 'lucide-react'
import { useNetwork } from '@/lib/network'

/** Permanent notice. Always rendered; there is no dismiss control by design. */
export function Banner() {
  const { network } = useNetwork()

  if (network === 'mainnet') {
    return (
      <div
        role="alert"
        className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2.5 text-center text-xs font-semibold sm:text-sm"
        style={{
          background: 'rgba(232,109,122,0.16)',
          color: 'var(--danger)',
          borderBottom: '1px solid rgba(232,109,122,0.4)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
        }}
      >
        <TriangleAlert className="size-4 shrink-0" aria-hidden />
        <span>
          Arc mainnet — real USDC. Only the patched comparison contract should be used here; the vulnerable contract
          must never hold real value.
        </span>
      </div>
    )
  }

  return (
    <div
      role="alert"
      className="sticky top-0 z-40 flex items-center justify-center gap-2 px-4 py-2.5 text-center text-xs font-semibold sm:text-sm"
      style={{
        background: 'rgba(242, 198, 109, 0.16)',
        color: 'var(--warn)',
        borderBottom: '1px solid rgba(242, 198, 109, 0.4)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      <TriangleAlert className="size-4 shrink-0" aria-hidden />
      <span>Intentionally vulnerable educational demo — test funds only</span>
    </div>
  )
}
