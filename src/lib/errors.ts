const CUSTOM_ERRORS: Record<string, string> = {
  ZeroAmount: 'Amount must be greater than zero.',
  InsufficientSupplyBalance: 'Your supplied balance is too low for that withdrawal.',
  InsufficientLiquidity: 'The market does not have enough supplier liquidity right now.',
  InsufficientCollateral: 'You do not have that much collateral deposited.',
  BorrowLimitExceeded: 'Debt would exceed 50% of your collateral.',
  RepayExceedsDebt: 'Repayment is larger than your debt.',
  NotSupplier: 'Only the supplier can withdraw this balance.',
  CollateralWouldBeUndercollateralized: 'Your remaining collateral would not cover your debt.',
  TransferFailed: 'The native USDC transfer failed.',
  Reentrancy: 'Reentrant call blocked.',
  EmptyTransfer: 'Plain transfers are rejected. Use a named function.',
}

/** Turns wallet/RPC failures into short user-facing copy. Returns null for a user rejection. */
export function parseTxError(error: unknown): string | null {
  const raw = error instanceof Error ? error.message : String(error)
  const lower = raw.toLowerCase()
  if (lower.includes('user rejected') || lower.includes('user denied') || lower.includes('rejected the request')) {
    return null
  }
  for (const [name, message] of Object.entries(CUSTOM_ERRORS)) {
    if (raw.includes(name)) return message
  }
  if (lower.includes('insufficient funds') || lower.includes('exceeds balance')) {
    return 'Your wallet does not have enough testnet USDC for this amount plus gas.'
  }
  if (lower.includes('network') || lower.includes('timeout')) {
    return 'Network issue. Check your connection and retry.'
  }
  if (lower.includes('reverted')) return 'The transaction would revert. Check the amount and your balances.'
  return 'The transaction could not be sent. Please try again.'
}

export const shortAddress = (value: string): string => `${value.slice(0, 6)}...${value.slice(-4)}`
