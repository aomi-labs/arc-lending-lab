/**
 * Verified Aomi campaign facts, as supplied by the benchmark owner. Public and non-secret.
 * Mirrors docs/EVIDENCE.md and docs/evidence.json. Do not add results that were not supplied.
 */
export const PUBLIC_LINKS = {
  app: 'https://arc-lending-lab.vercel.app',
  repo: 'https://github.com/aomi-labs/arc-lending-lab',
} as const

export const AOMI_VULNERABLE_CAMPAIGN = {
  campaignId: '0x0d19bafcf5fd5acff8a0b720571a7fc34a886893b931c26ce00efb76d970e851',
  target: '0xb4c00fc759aeff83f693f7c24420771d84e65a77',
  targetName: 'LabLendingMarket',
  executions: 21,
  corpus: 4,
  round: 6,
  property: "attacker cannot withdraw another user's supply",
  reproductions: 2,
  trace: [
    'victim: supply() with 10000000000000000000 (10 native USDC)',
    'attacker: withdrawSupply(victim, 10000000000000000000)',
  ],
  observed: 'Attacker balance increased by 10 USDC and victim balance fell by 10 USDC on the held testnet fork.',
  caveat:
    'Confirmed individual finding from an interrupted campaign, not a completed audit. The overall agent turn failed after round 6.',
} as const

export type DefectEvidenceKind = 'aomi-confirmed' | 'not-an-aomi-finding'

export interface DefectEvidence {
  fn: string
  label: string
  kind: DefectEvidenceKind
  note: string
}

export const DEFECT_EVIDENCE: DefectEvidence[] = [
  {
    fn: 'withdrawSupply',
    label: 'Bug 1',
    kind: 'aomi-confirmed',
    note: 'Confirmed by Aomi in an interrupted campaign (2 reproductions).',
  },
  {
    fn: 'borrowUntracked',
    label: 'Bug 2',
    kind: 'not-an-aomi-finding',
    note: 'Not an Aomi finding. The reported untracked-borrow trace had a failed borrow. Ground truth is covered by Foundry tests.',
  },
  {
    fn: 'withdrawCollateral',
    label: 'Bug 3',
    kind: 'not-an-aomi-finding',
    note: 'Not an Aomi finding. Ground truth is covered by Foundry tests.',
  },
]
