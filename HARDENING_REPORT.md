# Hardening step 1: reject unsafe token extensions, add logging

Implements the four "fix before redeploy" items from `SECURITY_REVIEW_PROGRAM.md`. Nothing was deployed and no transaction was sent while doing this work.

## What changed

### New shared check: `programs/escrow/src/token_guard.rs`
A single function, `assert_mint_is_supported(mint, label, instruction)`, replaces the old `make_offer.rs`-local `reject_transfer_fee_mint`. For a given mint it rejects, in this order:

1. **Transfer fee** (`TransferFeeNotSupported`, pre-existing, unchanged) — the vault would receive less than requested.
2. **Permanent delegate** (`PermanentDelegateNotSupported`, new) — a delegate could move tokens out of the vault without the offer's own authority.
3. **Transfer hook** (`TransferHookNotSupported`, new) — unknown third-party code would run on every transfer.
4. **Default account state = frozen** (`DefaultFrozenNotSupported`, new) — a freshly created token account (e.g. the maker's own refund account, via `cancel_offer`'s `init_if_needed`) would be born frozen.
5. **Freeze authority present at all, classic or Token-2022** (`FreezeAuthorityNotSupported`, new) — the vault's own token account could be frozen at any time after funds land, with no way for either `take_offer` or `cancel_offer` to ever move them out again.

**Why that order, specifically**: while writing the test for #4, discovered that Token-2022 itself requires a mint using `DefaultAccountState` to also carry a freeze authority (there has to be *someone* able to thaw a default-frozen account) — confirmed directly against the `spl-token-2022-interface` crate's own instruction docs, and empirically, by the mint failing to initialize at all without one. That means a default-frozen mint *always* also trips the freeze-authority check. Checking the extension-specific reasons first means the person sees the more specific, more useful message ("this token starts new accounts out frozen") instead of the generic one ("this token can be frozen by its creator") whenever both are true.

### Where it's called
- `make_offer.rs`: both `token_mint_a` and `token_mint_b`, right after the zero-amount checks, before the offer is created or any transfer is attempted.
- `take_offer.rs`: both mints again, as defense in depth — the payout path doesn't rely on a check made in a different instruction still holding by the time it runs.
- **Not added to `cancel_offer.rs`** — not asked for, and not needed the same way: a cancel only ever returns the maker their own funds, so a bad mint there fails the refund transfer cleanly rather than creating any new risk.
- **Not added**: a reload-and-compare balance check on the two vault-outflow transfers (`take_offer.rs`'s vault→taker leg, `cancel_offer.rs`'s vault→maker leg). `SECURITY_REVIEW_PROGRAM.md` listed that under "Later," not "Fix before redeploy," so per this task's own instruction it was left out of this pass.

### New error codes (`programs/escrow/src/error.rs`)
Appended after the existing ones, so none of the existing codes (6000–6005) changed:

| Code | Name | Message |
|---|---|---|
| 6006 | `PermanentDelegateNotSupported` | Mints with a permanent delegate are not supported |
| 6007 | `TransferHookNotSupported` | Mints with a transfer hook are not supported |
| 6008 | `DefaultFrozenNotSupported` | Mints that default new accounts to frozen are not supported |
| 6009 | `FreezeAuthorityNotSupported` | Mints with a freeze authority are not supported |

### Logging
- **Entry**: `make_offer` and `take_offer` each log their key accounts and amounts as their first line (offer id/offer address, maker, taker where applicable, both mints, both amounts) — never anything beyond public on-chain addresses and the amounts already being requested.
- **Each rejection**: the zero-amount checks, the mint-safety checks (inside `assert_mint_is_supported`, naming which mint — "A" or "B" — and which instruction), and the post-transfer amount checks in both instructions now log a short line before returning their error.
- **Success**: unchanged in spirit, reworded to the same `instruction: ...` style as the new lines for consistency.

## Tests

Followed red/green for each new check in `programs/escrow/tests/hardening.rs` (LiteSVM, no validator needed):

1. Wrote `create_mint_with_permanent_delegate`, `create_mint_with_transfer_hook`, `create_mint_with_default_frozen`, and `create_mint_with_freeze_authority` (the last parameterized by token program, since freeze authority applies to classic SPL Token too), plus one test per extension expecting the new rejection — confirmed each one **failed** against the pre-fix code (the offer was wrongly accepted) before `token_guard.rs` existed.
2. Added `token_guard.rs` and wired it in; confirmed all four now **pass**.
3. Hit one real bug while doing this: `make_offer_rejects_default_frozen_mint_a` initially failed at mint-creation time (not at the assertion), with `Custom(16)` = `MintCannotFreeze` — Token-2022 refusing to let a mint use `DefaultAccountState` without a freeze authority. Fixed the test fixture to include one, which is what led to reordering the checks described above.
4. Added `make_offer_rejects_permanent_delegate_mint_b` for symmetry (confirms mint B is checked too, not just mint A), and `control_make_offer_succeeds_with_plain_token_2022_mints` (a plain Token-2022 mint, no extensions, must still work — the existing control test only covered classic SPL).

Final `programs/escrow/tests/hardening.rs`: **12 tests, all passing** (was 5 before this task). New: `make_offer_rejects_permanent_delegate_mint_a`, `make_offer_rejects_permanent_delegate_mint_b`, `make_offer_rejects_transfer_hook_mint_a`, `make_offer_rejects_default_frozen_mint_a`, `make_offer_rejects_freeze_authority_mint_a_classic`, `make_offer_rejects_freeze_authority_mint_a_token_2022`, `control_make_offer_succeeds_with_plain_token_2022_mints`.

```
cargo test
  unittests (IDL print tests): 7 passed
  tests/hardening.rs:          12 passed
  tests/test_initialize.rs:    1 passed
  doc-tests:                   0
```

**`take_offer`'s own copy of the check has no dedicated new test.** The only way to reach `take_offer` with a bad mint would be to forge an `Offer`/vault account directly (bypassing `make_offer` entirely, since `make_offer` already rejects every one of these mints before an offer can exist) — judged not worth the complexity and risk of a subtly-wrong forged account for what the check is explicitly defense-in-depth, not a reachable path in normal use. The existing `tests/hardening.ts` test 15 (full make→take→cancel regression with plain Token-2022 mints) already confirms the new call in `take_offer` doesn't break the normal path — see below for why it couldn't be re-run here.

**`tests/hardening.ts` and `tests/escrow.ts` (local-validator tests) were not run, and not modified.** Starting `solana-test-validator` in this sandbox fails immediately: `thread 'main' panicked at .../dirs.rs:27:9: assertion failed: io_uring_supported()` — the validator requires a kernel feature this environment doesn't have. This is an environment limitation, not a code issue, and matches the task's own "anchor test if it works locally" phrasing. Didn't add TypeScript-side tests for the new checks either, since "write a failing test, confirm it fails, then make it pass" isn't something that can be honestly done without a validator to run against.

## Frontend
- `anchor build` regenerated `target/idl/escrow.json` with the four new error entries (6006–6009); `npm run idl:sync` copied it to `frontend/src/idl/escrow.json` (20-line diff, additive only — no instruction/account changes).
- Added plain-language messages for the four new error names to `frontend/src/lib/errors/map.ts`'s `PLAIN_MESSAGES`, matching the wording already used in `README.md` for the same blocked cases (e.g. `FreezeAuthorityNotSupported` → "This token can be frozen by its creator. It's not supported.").
- `frontend/src/lib/errors/map.test.ts` already asserts, in a loop over `escrowIdl.errors`, that every IDL error has its own plain, non-generic message — so it automatically covers the four new ones with no new test needed; only updated a stale comment ("6000-6005" → "6000-6009").
- `npm run typecheck`: clean. `npm test`: **204/204 passed** (unchanged count — no new frontend tests were needed). `npm run lint`: clean.

## Deliberately not done this pass
Per `SECURITY_REVIEW_PROGRAM.md`'s own "Later" bucket, and per this task's instructions being conditional on "Fix before redeploy" only:
- Rejecting `MintCloseAuthority`.
- The reload-and-compare balance check on the two vault-outflow transfers.
- A `require_keys_neq!` self-take guard (harmless today, per the report).
