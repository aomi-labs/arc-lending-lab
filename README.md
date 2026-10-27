# Arc Lending Lab

An educational, deliberately vulnerable native-USDC lending market, a patched comparison contract, Foundry tests, and a web app to try both on Arc Testnet. It is a security benchmark for stateful fuzzers, not a production lending product.

> Intentionally vulnerable educational demo — test funds only. The patched contract only repairs the three known defects. It is unaudited and is not claimed to be safe.

Built with [Arc Studio](https://studio.arc.io)

## What is in the box

- `LabLendingMarket`: the vulnerable market with exactly three intentional defects, each labeled in code.
- `FixedLabLendingMarket`: the same market with those three defects repaired.
- A web app to switch between the two, view liquidity, collateral and debt, and run normal supply, withdraw, deposit, borrow and repay flows.
- `docs/FUZZING.md`: each defect mapped to actors, setup, an ordered trace, the expected property, atomic amounts, and the patched result.

Amounts are native USDC in 18-decimal units (1 USDC = 1e18 atomic units).

Fuzzing is fork-only and never broadcasts exploits. The traces in the docs are fixtures with expected outcomes. They are not findings from any fuzzing campaign; no Aomi campaign has been run yet.

## Tech stack

React, Vite, TypeScript, Tailwind CSS, wagmi, viem, ConnectKit. Solidity 0.8.28 with Foundry.

## Development

Prerequisites: [Bun](https://bun.sh) and [Foundry](https://book.getfoundry.sh).

```bash
bun install
forge install foundry-rs/forge-std   # only needed in a fresh checkout without lib/
bun run dev
```

Environment variables are all optional. The app ships with the public Arc Testnet deployments built in (`src/lib/deployments.ts`), so it runs without an `.env`. Set these (see `.env.example`) only to point at other deployments:

- `VITE_VULNERABLE_MARKET_ADDRESS`: address of the vulnerable market on Arc Testnet.
- `VITE_VULNERABLE_MARKET_TX`: its deployment transaction hash (optional, shown in Evidence).
- `VITE_FIXED_MARKET_ADDRESS`: address of the patched market on Arc Testnet.
- `VITE_FIXED_MARKET_TX`: its deployment transaction hash (optional, shown in Evidence).

You can also paste different addresses in the app under Deployment addresses.

Commands:

```bash
bun run contracts:build   # forge build
bun run contracts:test    # forge test
bun run check             # lint and typecheck
bun run build             # typecheck and production build
bun run export:clean      # clean copy in export/arc-lending-lab (no credentials or logs)
```

## Layout

- `contracts/`: Solidity sources and Foundry tests.
- `artifacts/compiled/`: ABI and deployed bytecode for both contracts.
- `artifacts/test-logs/`: exact test output.
- `docs/FUZZING.md`: fuzzing guide.
- `src/`: web app.
