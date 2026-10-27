import { parseAbi } from 'viem'

/**
 * Shared external ABI of LabLendingMarket (vulnerable) and FixedLabLendingMarket (patched).
 * The two contracts expose an identical ABI; the compiled copy lives in artifacts/compiled/.
 * Amounts are native USDC in 18-decimal units (1 USDC = 1e18).
 */
export const marketAbi = parseAbi([
  'function supply() payable',
  'function withdrawSupply(address supplier, uint256 amount)',
  'function depositCollateral() payable',
  'function borrow(uint256 amount)',
  'function borrowUntracked(uint256 amount)',
  'function repay() payable',
  'function withdrawCollateral(uint256 amount)',
  'function supplyBalance(address) view returns (uint256)',
  'function collateralBalance(address) view returns (uint256)',
  'function debt(address) view returns (uint256)',
  'function availableLiquidity() view returns (uint256)',
  'function totalSupplied() view returns (uint256)',
  'function totalCollateral() view returns (uint256)',
  'function totalDebt() view returns (uint256)',
  'function maxBorrowable(address) view returns (uint256)',
  'function isPatched() pure returns (bool)',
  'function MAX_LTV_BPS() view returns (uint256)',
])
