# IDL check report (hardening step 2)

Read-only. No transaction was sent, the program was not deployed, no file was changed except this report. `anchor build` was run to regenerate `target/idl/escrow.json` locally (a build, not a deploy — it only compiles and writes build artifacts under the gitignored `target/` directory).

## Summary

**The frontend's IDL (`frontend/src/idl/escrow.json`) and a freshly rebuilt local IDL (`target/idl/escrow.json`) are byte-for-byte identical.** Comparing both of those against the IDL actually stored on-chain for `WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b` on devnet (fetched via `anchor idl fetch`, which succeeded — an on-chain IDL account exists, so no fallback to behavioral testing was needed) turned up exactly **one difference, and only one**: the on-chain IDL's `errors` array has 2 entries where the local/frontend IDL has 6. Every instruction — name, discriminator, every argument (name, type, order), and every account (name, order, signer/writable flags) — matches exactly across all three sources. The `Offer` and `Counter` account struct fields, and the `constants` section, also match exactly.

This is consistent with, and confirms, what earlier phase reports already established from git history: the devnet-deployed program predates the hardening commit (`694f4bc`). It does not mean any instruction's accounts or arguments changed — they didn't, anywhere in the codebase's git history for this program. It means the deployed bytecode is missing the four new validation checks hardening added (zero-amount, same-mint, transfer-fee-mint, transfer-amount-mismatch rejections), so the *program itself* doesn't know how to produce those four errors yet, and its on-chain IDL record (which Anchor keeps as a separate account, written at `anchor idl init`/`upgrade` time, not automatically kept in sync with the program binary) was never updated to declare them.

## 1 & 2. Where each IDL came from

| Source | Method | Result |
|---|---|---|
| `frontend/src/idl/escrow.json` | Read directly | Baseline for comparison |
| `target/idl/escrow.json` | `anchor build` (compiles only; `skip_local_validator = true` in `Anchor.toml`; no deploy step was run) | Byte-identical to the frontend copy after JSON-normalizing both (0 diff lines) |
| On-chain, devnet | `anchor idl fetch WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b --provider.cluster devnet` | Succeeded — an on-chain IDL account exists. Diverges from the other two only in `errors` (see below) |

Since an on-chain IDL exists and was fetched cleanly, no fallback to devnet test-result inference was needed for structural comparison. (The devnet-deployed-program's actual *behavior*, as opposed to its declared IDL, still can't be fully verified without sending a transaction with an invalid input, which this check was explicitly told not to do; the prior Phase 7/8 devnet hand-testing already confirmed `make_offer`/`take_offer` work for valid inputs against the currently-deployed program.)

## 3. Per-instruction comparison

Legend: ✅ match across frontend IDL / local rebuild / on-chain IDL. All three instructions below show ✅ everywhere except the error catalog, which is reported separately underneath.

### `make_offer` (the frontend calls this "Create Offer")

| Field | Frontend IDL | Local rebuild | On-chain | Status |
|---|---|---|---|---|
| Discriminator | `[214,98,97,35,59,12,44,178]` | same | same | ✅ |
| Args (name: type, in order) | `offer_id: u64`, `amount_a: u64`, `amount_b: u64` | same | same | ✅ |
| Accounts (name, order, signer/writable) | `maker` (signer, writable) → `token_mint_a` → `token_mint_b` → `maker_token_account_a` (writable) → `offer` (writable) → `vault` (writable) → `associated_token_program` → `token_program` → `system_program` | same | same | ✅ |

**Frontend call** (`lib/escrow/createOffer.ts`): `.makeOffer(offerId, amountA, amountB)` with `.accountsPartial({ maker, tokenMintA, tokenMintB, makerTokenAccountA, offer, vault, associatedTokenProgram, tokenProgram, systemProgram })` — args and every account name match the IDL exactly, in the same order. ✅

### `take_offer`

| Field | Frontend IDL | Local rebuild | On-chain | Status |
|---|---|---|---|---|
| Discriminator | `[128,156,242,207,237,192,103,240]` | same | same | ✅ |
| Args | none | none | none | ✅ |
| Accounts (name, order, signer/writable) | `taker` (signer, writable) → `maker` (writable) → `token_mint_a` → `token_mint_b` → `offer` (writable) → `vault` (writable) → `taker_token_account_a` (writable) → `taker_token_account_b` (writable) → `maker_token_account_b` (writable) → `associated_token_program` → `token_program` → `system_program` | same | same | ✅ |

**Frontend call** (`lib/escrow/takeOffer.ts`): `.takeOffer()` (no args) with `.accountsPartial({ taker, maker, tokenMintA, tokenMintB, offer, vault, takerTokenAccountA, takerTokenAccountB, makerTokenAccountB, associatedTokenProgram, tokenProgram, systemProgram })` — all 12 accounts match the IDL by name, in the same order. ✅

### `cancel_offer`

| Field | Frontend IDL | Local rebuild | On-chain | Status |
|---|---|---|---|---|
| Discriminator | `[92,203,223,40,92,89,53,119]` | same | same | ✅ |
| Args | none | none | none | ✅ |
| Accounts (name, order, signer/writable) | `maker` (signer, writable) → `token_mint_a` → `offer` (writable) → `maker_token_account_a` (writable) → `vault` (writable) → `associated_token_program` → `token_program` → `system_program` | same | same | ✅ |

**Frontend call** (`lib/escrow/cancelOffer.ts`): `.cancelOffer()` (no args) with `.accountsPartial({ maker, tokenMintA, offer, makerTokenAccountA, vault, associatedTokenProgram, tokenProgram, systemProgram })` — all 8 accounts match the IDL by name, in the same order (this exact order is also pinned by a dedicated test in `cancelOffer.test.ts`). ✅

### Account struct fields (`Offer`, `Counter`)

Both account types' field lists are identical across all three IDL sources. `Offer`'s fields (`offer_id: u64`, `maker: pubkey`, `token_mint_a: pubkey`, `token_mint_b: pubkey`, `amount_a: u64`, `amount_b: u64`, `bump: u8`) match what `lib/escrow/fetchOffers.ts` decodes and reads (`offerId`, `maker`, `tokenMintA`→`tokenA`, `tokenMintB`→`tokenB`, `amountA`, `amountB`; `bump` is decoded but not used client-side, which is expected). ✅

### Error codes / names — the one mismatch

| Code | Name | In frontend IDL | In local rebuild | In on-chain IDL |
|---|---|---|---|---|
| 6000 | `Unauthorized` | ✅ | ✅ | ✅ |
| 6001 | `CounterOverflow` | ✅ | ✅ | ✅ |
| 6002 | `ZeroAmount` | ✅ | ✅ | ❌ missing |
| 6003 | `SameMint` | ✅ | ✅ | ❌ missing |
| 6004 | `TransferFeeNotSupported` | ✅ | ✅ | ❌ missing |
| 6005 | `TransferAmountMismatch` | ✅ | ✅ | ❌ missing |

**What differs:** the on-chain IDL account only declares the first two errors. The frontend/local IDL declares all six — the extra four (6002–6005) were added by the hardening commit alongside the new validation checks in `make_offer`/`take_offer`.

**Would it break the deployed program?** No. This is a declared-metadata difference, not a code-path difference that could crash or misbehave anything. The frontend never relies on the on-chain IDL account at runtime — it bundles its own copy (`frontend/src/idl/escrow.json`) and uses that to build instructions and decode accounts/errors locally; the on-chain IDL account is only consulted by tools like `anchor idl fetch`/`anchor idl upgrade`, not by the frontend's transaction-sending path. Nothing in the frontend's send path will ever actually receive error codes 6002–6005 from the *currently deployed* program, because that program's bytecode predates the checks that would produce them — the checks simply don't exist yet in what's running on devnet. The frontend's mapping for those four names in `lib/errors/map.ts` (confirmed: every name it maps — `Unauthorized`, `CounterOverflow`, `ZeroAmount`, `SameMint`, `TransferFeeNotSupported`, `TransferAmountMismatch` — exists in the IDL it uses, and nothing in that IDL goes unmapped) is simply unreachable dead weight against today's deployed program, not wrong.

**Does it matter after the planned redeploy?** It resolves itself once the hardening build is deployed, *provided* the on-chain IDL account is also updated at that time (typically via `anchor idl upgrade` as part of the same deploy step) — otherwise the on-chain IDL would still under-declare the error catalog even though the running program could then actually produce those four errors, which would only affect anyone diffing the on-chain IDL the way this report just did, not the frontend (which doesn't read the on-chain IDL account at all). Worth a one-line reminder in the redeploy checklist, not a blocker.

## 4. Frontend account/argument/error-name audit

- `createOffer.ts`, `takeOffer.ts`, `cancelOffer.ts`: every account passed to `.accountsPartial({...})` matches the IDL's declared account name and position for its instruction (verified above, per instruction). No extra accounts, no missing accounts, no reordering.
- `make_offer`'s three arguments (`offerId`, `amountA`, `amountB`, each wrapped in `new BN(...)`) are passed in the same order the IDL declares them (`offer_id`, `amount_a`, `amount_b`), all `u64`. `take_offer` and `cancel_offer` take no arguments, matching the IDL.
- `lib/errors/map.ts`'s `PLAIN_MESSAGES` keys are exactly `{Unauthorized, CounterOverflow, ZeroAmount, SameMint, TransferFeeNotSupported, TransferAmountMismatch}` — a 1:1 match against the frontend IDL's 6 error names, confirmed programmatically (no name mapped that the IDL doesn't declare, and no IDL error left unmapped).

## Verification run

`npm run typecheck`: clean. `npm run test -- --run`: **21 test files, 170 tests, all passing**, unchanged. Nothing was modified in the repo other than this report (`git status --short` is clean; `target/` is gitignored and was never going to show up regardless).
