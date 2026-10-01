# Escrow Swap

An Anchor program for peer-to-peer SPL token swaps on Solana, plus a Next.js frontend for it. A maker locks up tokens in an escrow; anyone can take the offer, or the maker can cancel and get their tokens back.

**Live demo (devnet):** https://escrow-swap.vercel.app
**Program (devnet):** [`WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b`](https://explorer.solana.com/address/WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b?cluster=devnet)

> Devnet only, unaudited. Don't point this at mainnet without a proper review.

## How it works

The maker deposits Token A into a vault and says how much Token B they want back. That vault is a token account owned by the offer's own PDA, not by a person — so the only way tokens leave it is through this program's own instructions.

| Instruction | Caller | What it does |
|---|---|---|
| `make_offer` | Maker | Deposits Token A into the vault, records the terms on-chain. |
| `take_offer` | Anyone | Pays the maker in Token B and receives Token A from the vault, in one transaction. Offer and vault both close afterward, rent goes back to the maker. |
| `cancel_offer` | Maker only | Refunds the vault to the maker and closes the offer. Nobody else can call this on your offer. |

Since `take_offer` and `cancel_offer` close the accounts when they're done, there's no on-chain record of past offers once they're settled. The "My Offers" page in the frontend only shows what's currently open for that reason — it's not trying to show history it doesn't have.

## Repo layout

```
programs/escrow/       The Anchor program (make_offer, take_offer, cancel_offer)
programs/escrow/tests/ Rust unit tests (litesvm, no validator needed)
tests/                 TypeScript tests against a local validator
app/                   Next.js frontend
```

## Setup

### You'll need
- Rust, per `rust-toolchain.toml`
- Solana CLI + `anchor-cli` 1.1.2 (`avm install 1.1.2 && avm use 1.1.2`)
- Node 20+

### Program

```bash
anchor build
anchor deploy --provider.cluster devnet   # or localnet, see Anchor.toml
```

### Tests

```bash
cargo test                 # Rust unit tests, no validator needed

npm install                # TS tests — need a local validator running
solana-test-validator --reset --quiet &
npm test
```

If `solana-test-validator` crashes with an `io_uring_supported()` panic (happens on some older WSL2 kernels), use an older installed release instead, e.g. `~/.local/share/solana/install/releases/2.1.21/solana-release/bin/solana-test-validator`.

### Frontend

```bash
cd app
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_RPC_URL
npm run dev
```

Then open `http://localhost:3000` and connect a devnet wallet. The IDL and types under `app/src/lib/anchor/` are just copies of `target/idl/` and `target/types/` — re-copy them after rebuilding the program.

The public `api.devnet.solana.com` endpoint is shared and gets rate-limited, so you'll sometimes see "blockhash not found" errors under load (the frontend retries once automatically, but a free key from Helius, QuickNode, or Triton is more reliable).

## Deployment

`app/` is deployed on Vercel, connected to this repo's `master` branch — pushes deploy automatically. `NEXT_PUBLIC_RPC_URL` is set directly in Vercel, not in the repo.

## What's missing on purpose

- No history of past offers (accounts close on completion — a real product would want an indexer for this).
- No taker allowlisting, partial fills, or fees — just make/take/cancel.
- No price oracle. Rates are whatever the maker sets, and the UI doesn't show USD values or price impact it can't actually back up.
