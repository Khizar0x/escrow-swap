# Escrow Swap

A trustless, non-custodial peer-to-peer SPL token swap protocol on Solana, built with Anchor, plus a Next.js frontend for it.

**Live demo (devnet):** https://escrow-swap.vercel.app
**Program (devnet):** [`WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b`](https://explorer.solana.com/address/WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b?cluster=devnet)

> **Status: devnet only, unaudited.** This is a learning/demo project. Do not point it at mainnet or real funds without an independent security review.

## How it works

A maker locks Token A into a per-offer vault (a PDA-owned associated token account) and specifies how much of Token B they want in return. Anyone can fulfill those exact terms, or the maker can reclaim their deposit at any time before that happens.

Three instructions, each a single atomic transaction:

| Instruction | Who calls it | What happens |
|---|---|---|
| `make_offer` | Maker | Deposits `amount_a` of Token A into a vault owned by the Offer PDA; records the terms (`amount_a`, `amount_b`, both mints) on-chain. |
| `take_offer` | Anyone (taker) | In one transaction: taker pays `amount_b` of Token B directly to the maker, and the vault releases `amount_a` of Token A to the taker. Offer and vault accounts close, rent refunds to the maker. |
| `cancel_offer` | Maker only | Refunds the vault's full balance back to the maker and closes the offer. Enforced by `has_one` constraints — no one else can call this on someone else's offer. |

The vault's authority is the Offer PDA itself (not a human keypair), so funds can only move via this program's own instruction logic — never by a maker or taker unilaterally grabbing them.

Because the program fully closes both the vault and offer accounts on settlement, there's no on-chain history of completed/cancelled offers after the fact — the frontend's "My Offers" page intentionally only shows currently-open offers rather than fabricating a history it can't actually derive.

## Repo layout

```
programs/escrow/       Anchor program (Rust) — make_offer, take_offer, cancel_offer
programs/escrow/tests/ Rust unit tests (litesvm, no live validator needed)
tests/                 TypeScript integration tests (Anchor client, run against a local validator)
app/                   Next.js frontend — wallet connect, create/take/cancel offer UI
```

## Setup

### Prerequisites
- Rust toolchain per `rust-toolchain.toml`
- Solana CLI + `anchor-cli` 1.1.2 (`avm install 1.1.2 && avm use 1.1.2`)
- Node 20+

### Program

```bash
anchor build
anchor deploy --provider.cluster devnet   # or localnet, see Anchor.toml
```

### Program tests

```bash
cargo test                 # Rust unit tests, no validator needed

npm install                # TS integration tests — needs a local validator running
solana-test-validator --reset --quiet &
npm test
```

> Note: if `solana-test-validator` panics with `io_uring_supported()` on your machine (seen on some older WSL2 kernels), fall back to an older installed release, e.g. `~/.local/share/solana/install/releases/2.1.21/solana-release/bin/solana-test-validator`.

### Frontend

```bash
cd app
npm install
cp .env.example .env.local   # set NEXT_PUBLIC_RPC_URL to your own devnet RPC (see note below)
npm run dev
```

Open `http://localhost:3000`, connect a devnet wallet, and go. The IDL/types in `app/src/lib/anchor/` are copied from `target/idl/` and `target/types/` after `anchor build` — re-copy them if you change the program.

**On the RPC endpoint:** the public `api.devnet.solana.com` endpoint is shared, rate-limited, and occasionally returns transient `blockhash not found` errors under load (the frontend retries automatically once, but a dedicated key from [Helius](https://dashboard.helius.dev), QuickNode, or Triton is far more reliable for anything beyond quick testing).

## Deployment

The `app/` directory is deployed to Vercel, connected to this GitHub repo's `master` branch (auto-deploys on push). `NEXT_PUBLIC_RPC_URL` is set as a Vercel environment variable, not committed to the repo.

## What's deliberately *not* here

- `take_offer`/`cancel_offer` close their accounts on completion — there's no built-in indexer or history of past offers. A real product would want an off-chain indexer for that.
- No taker allowlisting, partial fills, or fee mechanism — the program is intentionally minimal (make/take/cancel, nothing else).
- No price oracle — amounts and rates are fixed by the maker at offer-creation time; the frontend never fabricates USD values or price-impact figures it can't actually compute.
