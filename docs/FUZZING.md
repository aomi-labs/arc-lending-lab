# Fuzzing guide: Arc Lending Lab

Ground-truth fixtures for benchmarking a stateful fuzzer (such as Aomi) against `LabLendingMarket`, with `FixedLabLendingMarket` as the patched comparison.

**Rules of engagement**

- Fuzzing is **fork-only**. Run against a local fork of Arc Testnet or a fresh local deploy. Never broadcast any trace below to a live network, and never use mainnet.
- The traces and "expected" outcomes below are **fixtures written by the benchmark author**. They are ground truth, not Aomi findings. The only recorded Aomi result is the single confirmed finding for bug 1 in [`EVIDENCE.md`](EVIDENCE.md), from an interrupted campaign (not a completed audit). Bugs 2 and 3 are covered by Foundry tests only.
- `FixedLabLendingMarket` only repairs the three known defects. It is unaudited and is not claimed to be safe.
- Both contracts are intentionally vulnerable or unaudited; use test funds only.

## Units

Native USDC is used throughout (`msg.value`). Arc's native view has **18 decimals**, so `1 USDC = 1e18` atomic units. (The 6-decimal ERC-20 view of USDC is the same pool of funds but is not used by these contracts.)

| Name | Atomic units |
| --- | --- |
| 1 USDC | `1000000000000000000` |
| 2 USDC | `2000000000000000000` |
| 4 USDC | `4000000000000000000` |

Loan-to-collateral cap: `existingDebt + amount <= collateral / 2` (integer division).

## Interface (identical in both contracts)

Writable: `supply() payable`, `withdrawSupply(address supplier,uint256 amount)`, `depositCollateral() payable`, `borrow(uint256)`, `borrowUntracked(uint256)`, `repay() payable`, `withdrawCollateral(uint256)`.

Getters: `supplyBalance(address)`, `collateralBalance(address)`, `debt(address)`, `availableLiquidity()`, `totalSupplied()`, `totalCollateral()`, `totalDebt()`, `maxBorrowable(address)`, `isPatched()`.
`isPatched()` is metadata only (`false` for vulnerable, `true` for patched) so tools and the UI can tell the two apart. Behavior is otherwise identical except for the three repairs.

Events: `Supplied`, `SupplyWithdrawn`, `CollateralDeposited`, `Borrowed`, `Repaid`, `CollateralWithdrawn`.

ABI and `deployedBytecode`: `artifacts/compiled/LabLendingMarket.json`, `artifacts/compiled/FixedLabLendingMarket.json`.

## Actors

| Actor | Role |
| --- | --- |
| `victim` | Honest supplier whose funds are at risk (bug 1, bug 3) |
| `lender` | Honest supplier providing the liquidity that is borrowed (bug 2) |
| `attacker` | Unrelated account with no prior balances |

Each scenario starts from freshly deployed contracts and empty balances. Fund actors with enough native USDC for the amounts plus gas.

## Bug 1: unauthorized supply withdrawal

- **Function:** `withdrawSupply(address supplier, uint256 amount)`
- **Defect:** debits `supplier`'s balance, never checks `msg.sender == supplier`, pays `msg.sender`.
- **Setup:** fresh contract.
- **Ordered trace:**
  1. `victim`: `supply()` with value `4000000000000000000`
  2. `attacker`: `withdrawSupply(victim, 1000000000000000000)`
- **Property (violation on vulnerable):** a call where `msg.sender != supplier` succeeds and `attacker` native balance increases by `1000000000000000000` (before gas) while `supplyBalance(victim)` falls to `3000000000000000000` and `availableLiquidity` to `3000000000000000000`.
- **Patched result:** step 2 reverts with `NotSupplier`; no state change.

## Bug 2: borrow that never records debt

- **Function:** `borrowUntracked(uint256 amount)`
- **Defect:** enforces the collateral and liquidity limits and sends the funds, but never increases `debt` or `totalDebt`.
- **Setup:** fresh contract.
- **Ordered trace:**
  1. `lender`: `supply()` with value `4000000000000000000`
  2. `attacker`: `depositCollateral()` with value `2000000000000000000`
  3. `attacker`: `borrowUntracked(1000000000000000000)`, then read `debt(attacker)`
  4. `attacker`: `withdrawCollateral(2000000000000000000)`
- **Property (violation on vulnerable):** `debt(attacker) == 0` and `totalDebt == 0` after step 3 although `1000000000000000000` was paid out. After step 4 the attacker has **net native profit of +1000000000000000000** (before gas) with zero debt; `availableLiquidity == 3000000000000000000` while `supplyBalance(lender) == 4000000000000000000`.
- **Patched result:** step 3 records `debt(attacker) == 1000000000000000000`; step 4 reverts with `CollateralWouldBeUndercollateralized`. The attacker cannot extract the collateral while the debt exists.
- **Distinguishing from bug 3:** here `debt(attacker)` is `0` after a successful borrow-sized payout. In bug 3 the debt getter is `1000000000000000000`.

## Bug 3: collateral withdrawal ignores debt

- **Function:** `withdrawCollateral(uint256 amount)`
- **Defect:** checks only that the collateral balance covers `amount`; omits `debt <= remainingCollateral / 2`.
- **Setup:** fresh contract.
- **Ordered trace:**
  1. `victim`: `supply()` with value `4000000000000000000`
  2. `attacker`: `depositCollateral()` with value `2000000000000000000`
  3. `attacker`: `borrow(1000000000000000000)`, then read `debt(attacker)` (normal borrow, debt is recorded)
  4. `attacker`: `withdrawCollateral(2000000000000000000)`
- **Property (violation on vulnerable):** after step 4, `collateralBalance(attacker) == 0` and `debt(attacker) == 1000000000000000000` (uncollateralized debt); `debt > collateralBalance / 2`.
- **Patched result:** step 4 reverts with `CollateralWouldBeUndercollateralized`. Any positive withdrawal reverts while the debt is `1000000000000000000`; withdrawing becomes possible only after repaying.

## Cross-cutting properties worth checking

- Accounting: `address(market).balance == availableLiquidity + totalCollateral` after every flow, including all three exploit traces (the bugs do not break this equality, so it is a negative control).
- Authorization: a successful `withdrawSupply(supplier, x)` implies `msg.sender == supplier` (broken by bug 1; aggregate balances stay consistent, so only an authorization oracle catches it).
- Solvency: `totalSupplied <= availableLiquidity + totalDebt` (broken by bug 2 only).
- Debt coverage: `debt(a) <= collateralBalance(a) / 2` for every account (broken by bug 3).
- Recorded debt: a successful borrow of `x > 0` must increase `debt(msg.sender)` by `x` (broken by bug 2).

## Repair interaction (for scoring)

Per-bug isolation tests show that the repairs overlap on the bug 2 profit trace:

- Repairing only bug 2 still lets the attacker withdraw everything, because bug 3 is still present.
- Repairing only bug 3 does not stop bug 2, because `debt` stays `0`, so there is nothing for the collateral check to block.

The bug 2 profit trace is therefore blocked only when both repairs are present. The most specific bug 2 oracle is "`debt` did not increase after a successful `borrowUntracked`".

## Recorded Aomi result (vulnerable market only)

Campaign `0x0d19bafcf5fd5acff8a0b720571a7fc34a886893b931c26ce00efb76d970e851` against `0xb4c00fc759aeff83f693f7c24420771d84e65a77` (Arc Testnet, `LabLendingMarket`): 21 executions, corpus 4, round 6. Property "attacker cannot withdraw another user's supply" reproduced 2 times on a held testnet fork.

Minimized trace, matching the bug 1 shape with different amounts:

1. `victim`: `supply()` with value `10000000000000000000`
2. `attacker`: `withdrawSupply(victim, 10000000000000000000)`

Observed: attacker balance +10 USDC, victim balance -10 USDC.

Caveats:

- This is a **confirmed individual finding from an interrupted campaign, not a completed audit**. The overall agent turn failed after round 6.
- A reported "untracked borrow" trace had a **failed borrow** and is **not a finding**.
- Bugs 2 and 3 are **not Aomi findings**. They remain ground-truth fixtures covered by Foundry tests. All three defects were **not** found by Aomi.
- The patched-contract campaign is **pending**; no result has been supplied.

Details: [`EVIDENCE.md`](EVIDENCE.md), [`evidence.json`](evidence.json).

## Reproducing the local regression suite

```bash
forge test -vv
```

Exact recorded log: `artifacts/test-logs/forge-test-vv.log`.
