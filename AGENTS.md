# Arc Lending Lab

Project memory. Educational, deliberately vulnerable native-USDC lending market + patched comparison, for fuzzer benchmarking. Test funds only; Arc Testnet only; no mainnet.

## Tech Stack
- Frontend: React 18, Vite, TypeScript, Tailwind, wagmi v2, viem, ConnectKit
- Contracts: Solidity ^0.8.24 (solc 0.8.28), Foundry. `contracts/LabLendingBase.sol` (shared logic + 3 hooks), `LabLendingMarket.sol` (vulnerable), `FixedLabLendingMarket.sol` (patched). Tests: `contracts/test/LabLendingMarket.t.sol` (94 passing).
- Native USDC, 18 decimals (1 USDC = 1e18). Use `@/onchain-money` for amounts.

## Rules
- Do NOT fix the three intentional defects in `LabLendingMarket`.
- Both contracts keep an identical external ABI (`isPatched()` is metadata only).
- App has no exploit buttons. Evidence: only bug 1 has an Aomi finding (interrupted campaign, not a completed audit); bugs 2 and 3 are Foundry ground truth; the patched campaign stays "Pending" until the owner supplies a real result. Source of truth: `docs/evidence.json`, `src/lib/evidence.ts`. Never fabricate findings or hashes, never claim all three bugs found.
- Never commit `.env`, `.circle/`, recovery files, or traces/console logs. Use `bun run export:clean`.

## Deployments (Arc Testnet, chain ID 5042002, via Arc Studio platform deployer)
- LabLendingMarket: 0xb4c00fc759aeff83f693f7c24420771d84e65a77 (tx 0x58a6010b719c57b4965cc6bd8ff2044b7ddd7d393efdb2150403853ece188bfe)
- FixedLabLendingMarket: 0x0e813ccf3a9bcf05df1cd39e2f848fedc6cf6129 (tx 0x89092a77f89f3171e08a2d95cd0f36885cdf41962928de7123587608613c13e4)
Default addresses and hashes are built into `src/lib/deployments.ts`; `VITE_*` keys (see `.env.example`) override them.

## Key Files
- `src/App.tsx`, `src/components/`, `src/hooks/useMarketState.ts`, `src/hooks/useMarketTx.ts`, `src/lib/`
- `docs/FUZZING.md`, `artifacts/compiled/*.json`, `artifacts/test-logs/forge-test-vv.log`

## To Run
```bash
bun install
bun run dev
bun run contracts:test
```
