# Escrow Swap

Swap tokens with other people, with nothing changing hands until both sides agree. Create an offer saying what you'll give and what you want back; anyone can take it, or you can cancel it yourself and get your tokens back.

This app runs on Solana Devnet only. It isn't connected to real money, and it hasn't been reviewed for production use.

**Program:** [`WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b`](https://explorer.solana.com/address/WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b?cluster=devnet) (Devnet)

## Supported tokens

Classic tokens work, and so do newer-standard ("Token-2022") tokens — as long as they don't carry a feature this app can't safely support. A token is blocked if it:

- **Takes a fee on every transfer** — the amount that arrives wouldn't match what was offered.
- **Lets someone else move tokens out of your account** — that works against the whole point of this app.
- **Runs extra code on every transfer** — there's no way to know in advance what that code does.
- **Can be closed by its creator** — it could stop existing while someone's still relying on it.
- **Starts new accounts out frozen** — unusable from the moment you'd receive it.
- **Can be frozen by its creator** — yours could get frozen in the middle of a swap.
- **Has any other feature this app doesn't recognize yet** — blocked by default rather than risking something unknown.

A token with none of the above, classic or newer-standard, works normally.

## Running it

```bash
cd frontend
npm install
cp .env.example .env.local
npm run dev
```

Then open the address it prints (`http://localhost:3000` by default) and connect a Devnet wallet.

## Running tests

```bash
npm test
npm run typecheck
```

## Testing on devnet

You'll need two wallets — one to create an offer, a different one to take it, since you can't take your own offer — and a little of two different test tokens on Devnet in each wallet. To just check the cancel path, one wallet and one test token is enough.

## More detail

- [`PLAN.md`](PLAN.md) — the build plan and the decisions made along the way.
- [`SECURITY_REVIEW_FRONTEND.md`](SECURITY_REVIEW_FRONTEND.md) — a security review of the frontend.
- [`IDL_CHECK_REPORT.md`](IDL_CHECK_REPORT.md) — comparing what the frontend expects against what's actually deployed.
- [`PHASE11A_REPORT.md`](PHASE11A_REPORT.md) — how the newer-standard token support above was built and verified.
