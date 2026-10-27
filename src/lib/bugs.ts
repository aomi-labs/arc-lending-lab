export interface BugInfo {
  id: 1 | 2 | 3
  title: string
  fn: string
  summary: string
  /** Ordered, atomic-unit trace. Fixture only; the app never sends these. */
  trace: string[]
  vulnerableResult: string
  patchedResult: string
}

/** Educational descriptions of the three intentional defects. Mirrors docs/FUZZING.md. */
export const BUGS: BugInfo[] = [
  {
    id: 1,
    title: 'Anyone can withdraw another supplier\'s balance',
    fn: 'withdrawSupply(address supplier, uint256 amount)',
    summary:
      'The function debits the named supplier but never checks that the caller is that supplier, and pays the caller.',
    trace: [
      'Victim: supply() with 4e18',
      'Attacker (unrelated): withdrawSupply(victim, 1e18)',
    ],
    vulnerableResult: 'Succeeds. Attacker gains +1e18 native; victim supplyBalance falls to 3e18.',
    patchedResult: 'Reverts with NotSupplier. No state changes.',
  },
  {
    id: 2,
    title: 'Borrow that never records debt',
    fn: 'borrowUntracked(uint256 amount)',
    summary:
      'It enforces the collateral and liquidity limits and sends the funds, but skips the debt increase. Compare debt(attacker) with the normal borrow.',
    trace: [
      'Lender: supply() with 4e18',
      'Attacker: depositCollateral() with 2e18',
      'Attacker: borrowUntracked(1e18), then read debt(attacker) == 0',
      'Attacker: withdrawCollateral(2e18)',
    ],
    vulnerableResult: 'Attacker nets +1e18 native with zero debt.',
    patchedResult: 'borrowUntracked records debt of 1e18, so the final withdrawal reverts. Attacker holds no free profit.',
  },
  {
    id: 3,
    title: 'Collateral withdrawal ignores outstanding debt',
    fn: 'withdrawCollateral(uint256 amount)',
    summary:
      'It checks only that the collateral balance covers the amount. It never checks debt against the remaining collateral, so a recorded debt is left uncollateralized.',
    trace: [
      'Victim: supply() with 4e18',
      'Attacker: depositCollateral() with 2e18',
      'Attacker: borrow(1e18), then read debt(attacker) == 1e18',
      'Attacker: withdrawCollateral(2e18)',
    ],
    vulnerableResult: 'Succeeds. Collateral is 0 while debt(attacker) stays 1e18.',
    patchedResult: 'Reverts with CollateralWouldBeUndercollateralized (requires debt <= remainingCollateral / 2).',
  },
]
