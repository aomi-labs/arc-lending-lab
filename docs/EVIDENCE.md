# Evidence: Arc Lending Lab

Public, non-secret record of the fuzzing results supplied so far. Machine-readable copy: [`evidence.json`](evidence.json).

- Live app: https://arc-lending-lab.vercel.app
- Repository: https://github.com/aomi-labs/arc-lending-lab
- Network: Arc Testnet (chain ID 5042002). Test funds only.

## Read this first

- This is a **confirmed individual finding from an interrupted campaign, not a completed audit.** The overall agent turn failed after round 6.
- **Only planted defect 1 (`withdrawSupply`) has an Aomi finding.** Defects 2 and 3 are ground-truth fixtures covered by Foundry tests. They are not Aomi findings, and nothing here claims all three bugs were found.
- A reported "untracked borrow" trace had a **failed borrow** and is **not a finding**.
- The **patched-contract campaign is pending.** No result has been supplied.
- `FixedLabLendingMarket` is an unaudited comparison fixture, not a safety claim.

## Campaign: vulnerable market

| Field | Value |
| --- | --- |
| Campaign | `0x0d19bafcf5fd5acff8a0b720571a7fc34a886893b931c26ce00efb76d970e851` |
| Target | `LabLendingMarket` at `0xb4c00fc759aeff83f693f7c24420771d84e65a77` |
| Executions | 21 |
| Corpus | 4 |
| Round reached | 6 (interrupted) |
| Property | "attacker cannot withdraw another user's supply" |
| Reproduced | 2 times |
| Environment | held testnet fork; no live broadcast |

### Minimized trace (atomic units, native USDC with 18 decimals)

1. `victim`: `supply()` with value `10000000000000000000` (10 USDC)
2. `attacker`: `withdrawSupply(victim, 10000000000000000000)`

Observed: attacker balance increased by 10 USDC and victim balance fell by 10 USDC.

This matches planted defect 1: `withdrawSupply` debits the named supplier but never checks that the caller is that supplier. The patched contract reverts the same call with `NotSupplier` in the Foundry tests.

## Status by planted defect

| Defect | Function | Aomi result | Other evidence |
| --- | --- | --- | --- |
| 1 | `withdrawSupply` | Confirmed (interrupted campaign, 2 reproductions) | Foundry regression and patched-blocked test |
| 2 | `borrowUntracked` | No finding (reported trace had a failed borrow) | Foundry regression, ground truth |
| 3 | `withdrawCollateral` | No finding | Foundry regression, ground truth |

## Campaign: patched market

Pending. `FixedLabLendingMarket` at `0x0e813ccf3a9bcf05df1cd39e2f848fedc6cf6129`. No result supplied.

## Local regression suite

94 Foundry tests passed, 0 failed. Exact log: `artifacts/test-logs/forge-test-vv.log`.
