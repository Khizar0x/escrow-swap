# Security review: Anchor program (`programs/escrow/src`)

Review only. No source file was changed, nothing was deployed, no transaction was sent, nothing was committed.

Scope: `lib.rs`, `state.rs`, `error.rs`, `constants.rs`, `instructions/{make_offer,take_offer,cancel_offer,initialize,increment}.rs`, the hardening tests (`programs/escrow/tests/hardening.rs`, `tests/hardening.ts`), the general tests (`programs/escrow/tests/test_initialize.rs`, `tests/escrow.ts`, `tests/utils.ts`), and the "For the contract review" section of `SECURITY_REVIEW_FRONTEND.md`. `initialize`/`increment` are a separate hello-world counter feature, unrelated to the escrow's fund safety; they're covered briefly under "the program as a whole" and are clean.

Program ID: `WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b`. The source reviewed here is the **hardened, not-yet-deployed** version (`InterfaceAccount`/`Interface` for Token-2022 support, `reject_transfer_fee_mint`, the `SameMint`/`ZeroAmount`/`TransferAmountMismatch` checks) — this is what `SECURITY_REVIEW_FRONTEND.md` area 8 was looking ahead to, not the currently-deployed devnet program.

---

## 1. Signer and ownership checks

**Clean**, with one informational gap (self-take).

- `make_offer`: `maker: Signer<'info>` (`make_offer.rs:31`) — only the maker can create an offer and only by spending their own tokens (`maker_token_account_a` is constrained to `associated_token::authority = maker`, `make_offer.rs:41`).
- `take_offer`: `taker: Signer<'info>` (`take_offer.rs:15`) — only the taker can trigger a take, using their own `taker_token_account_b` (`associated_token::authority = taker`, `take_offer.rs:55`). `maker` is a plain `SystemAccount` (not a signer) — correct, since the maker already consented by creating the offer; the take doesn't need a second maker signature.
- `cancel_offer`: `maker: Signer<'info>` (`cancel_offer.rs:15`) — only the maker can cancel, and `has_one = maker` (`cancel_offer.rs:22`) ties the signer to the specific offer's recorded maker, so a different signer can't cancel someone else's offer. Confirmed by `tests/escrow.ts` test 4 ("wrong user cancel failure": a taker tries to sign as `maker` on someone else's real offer and the call fails, balances unchanged).
- **Maker is never validated to differ from the taker** (`take_offer.rs:13-18` has no `require_keys_neq!(taker.key(), maker.key())` or equivalent). **Severity: info.** Exploit walkthrough: a maker could sign a `take_offer` call naming themselves as both `taker` and `maker`. `taker_token_account_b` (authority = taker) and `maker_token_account_b` (authority = maker) would then resolve to the *same* ATA address, and SPL Token's `transfer_checked` special-cases a transfer where source and destination are the same account (no net balance change — confirmed in Token/Token-2022's `process_transfer`, which treats `source == destination` as a no-op after validation, not a double-apply). The `vault → taker_token_account_a` leg then returns the maker their own `amount_a` to their own account. **Net effect is identical to calling `cancel_offer`** — the maker gets back exactly what they locked, at no cost, since the "payment" leg cancels against itself. No value is extracted that wasn't already the maker's own. Not exploitable for theft; a `require_keys_neq!` would only remove a redundant path, not close a hole. No fix required before redeploy; optional for clarity.

## 2. Account validation

**Clean.** No account-substitution path found in any of the three instructions.

- **Seeds and bump**: every `Offer` reference re-derives the PDA from `[OFFER_SEED, maker.key(), offer_id.to_le_bytes()]` with `bump = offer.bump` (`make_offer.rs:50-52`, `take_offer.rs:30-31`, `cancel_offer.rs:24-25`). Since the seeds include the real maker's key, an attacker cannot name a different maker and still have the PDA check pass — the derived address simply wouldn't match a real `init`'d account for a maker they don't control.
- **`has_one`**: `take_offer` additionally pins `has_one = token_mint_a` and `has_one = token_mint_b` (`take_offer.rs:28-29`) against the offer's own recorded mints, and `cancel_offer` pins `has_one = token_mint_a` (`cancel_offer.rs:23`) — so passing a mint account that doesn't match what's stored on the offer fails before any transfer is attempted. Confirmed by `tests/escrow.ts` test 5 ("wrong mint failure").
- **Token account owner/mint and vault authority**: every token account in all three instructions uses Anchor's `associated_token::{mint, authority, token_program}` constraint set (`make_offer.rs:38-43,55-61`; `take_offer.rs:35-67`; `cancel_offer.rs:29-43`), which independently re-derives the expected ATA address and rejects any account that isn't exactly that address. The vault's authority is the `offer` PDA itself (`associated_token::authority = offer`), never a human key, and the signer seeds used to authorize the vault's outgoing CPIs (`take_offer.rs:101-106`, `cancel_offer.rs:57-62`) are the same seeds that derived the `offer` account's own address — there is no way to sign for the vault with anything other than the exact matching offer PDA. Confirmed by `tests/escrow.ts` test 6 ("wrong vault failure": a real, validly-owned token account is substituted for the vault slot and the call fails).
- **No account substitution** more generally: every account slot that matters (vault, maker/taker token accounts, the offer itself) is independently constraint-checked by Anchor; none of the three instructions pass an account through un-checked.

## 3. Math

**Clean.** The program does no addition or multiplication on token amounts anywhere — confirmed by grep: the only arithmetic touching amounts in `instructions/` is `take_offer.rs:94`'s `checked_sub` (used to compute the delta on `maker_token_account_b`, already returning `ErrorCode::TransferAmountMismatch` via `.ok_or(...)` on underflow rather than panicking) and `increment.rs:23`'s unrelated `count += 1` on the hello-world counter, which is itself guarded by `require!(count < MAX_COUNT, ...)` immediately above it (`increment.rs:18-21`), so it can never actually overflow `u64`.

- **Zero-amount rejection**: `require!(amount_a > 0, ...)` / `require!(amount_b > 0, ...)` (`make_offer.rs:75-76`). Confirmed by `hardening.rs`'s `make_offer_rejects_zero_amount_a`/`_b` and `hardening.ts` tests 9/10.
- **Overflow**: not reachable — there is no summing of amounts anywhere a malicious value could be chosen to overflow.
- **The counter**: out of scope for escrow funds, but noted clean above.

## 4. State handling

**Clean.**

- **Offer closure**: both `take_offer` (`close = maker`, `take_offer.rs:26`) and `cancel_offer` (`close = maker`, `cancel_offer.rs:21`) close the `Offer` account to the maker, who also receives the vault's rent back via the vault's own `close_account` CPI (`destination: ctx.accounts.maker.to_account_info()`, `take_offer.rs:120`, `cancel_offer.rs:76`) — rent always returns to the maker, who paid it, never to the taker or a third party.
- **Double take / double cancel / reuse of a closed address**: Anchor's `close` constraint zeroes the account's data (writing the closed-account discriminator) and drains its lamports to the destination. A second call referencing the same offer address then fails the account-deserialization/owner check before any of the instruction's own logic runs. Confirmed directly by `tests/escrow.ts` test 8 ("completed offer reuse failure": a second `take_offer` on an already-closed offer fails, and the taker's balance from the first, successful take is unaffected by the second, failed attempt).
- **Reuse of an offer address after close, for a *new* offer**: possible by design — once an address is closed (0 lamports, zeroed data), a later `make_offer` with the same `(maker, offer_id)` pair can `init` a fresh account at that same PDA. This is safe: the account is fully reinitialized via `set_inner` (`make_offer.rs:80-88`), so no state leaks from the old offer to the new one at that address.
- **Partial/stuck state from a race (maker cancels while a take is in flight)**: not possible — Solana transactions are atomic, so if the offer is already closed by the time a competing `take_offer` lands, that transaction fails outright (the `seeds`+`bump` re-derivation against a nonexistent account fails) with no partial effect; this mirrors what `SECURITY_REVIEW_FRONTEND.md` area 3 already confirmed from the frontend's side.

## 5. Token handling

This is where the real findings are. Token-2022 support is **only partially gated** — one extension (`TransferFeeConfig`) is explicitly rejected; several others that matter for an escrow specifically are not checked at all, and one risk (freeze authority) applies to classic SPL mints too, not just Token-2022.

### Finding 5a — Permanent delegate extension is not checked (vault-draining theft vector)
- **File/line**: `make_offer.rs:16-25` (`reject_transfer_fee_mint`) is the *only* extension check present, for *either* mint. There is no equivalent check for `PermanentDelegate` anywhere in `make_offer.rs`, `take_offer.rs`, or `cancel_offer.rs`.
- **Risk (plain language)**: Token-2022's permanent delegate extension lets a designated authority transfer tokens out of *any* holder's account for that mint — including the vault PDA's own token account — completely bypassing the escrow's own signer/authority model. The vault's authority is the `offer` PDA and nothing else is supposed to be able to move its tokens; a permanent delegate on `token_mint_a` breaks that assumption entirely.
- **Severity: High.**
- **Exploit scenario**: an attacker (or anyone colluding with the party holding the permanent-delegate key) creates `token_mint_a` with a permanent delegate set to a key they control, gets a victim maker to lock real value of that mint in an offer (or simply uses it as mint A themselves with real value on the other side), then calls the delegate's `transfer_checked`/`burn` authority directly against the vault's token account at any time — draining the escrowed `amount_a` without ever calling `take_offer` or `cancel_offer`, and without needing the offer PDA's signature at all.
- **Not currently exploitable via this specific deployed frontend** only because the frontend's `resolveTokenProgram`/extension checks reject this mint client-side before building any transaction (`PHASE11A_REPORT.md`) — but that is a client-side convenience check only. Anyone constructing the transaction directly (not through the frontend) is unaffected by it, and the delegate doesn't even need to go through `make_offer`/`take_offer` to drain the vault — it can act on the token account directly at any time after funds arrive.
- **Fix**: reject any mint carrying `PermanentDelegate` at `make_offer` time, for both `token_mint_a` and `token_mint_b`, the same way `reject_transfer_fee_mint` already does for `TransferFeeConfig`.

### Finding 5b — Freeze authority is not checked, on either classic or Token-2022 mints (vault fund-lockup)
- **File/line**: same absence as above — no code anywhere reads `token_mint_a.freeze_authority` (available directly on `InterfaceAccount<'info, Mint>` since `freeze_authority` is a field of the *base* SPL Mint layout, not a Token-2022 extension — classic SPL mints have always had an optional freeze authority).
- **Risk**: whoever holds `token_mint_a`'s freeze authority can freeze the **vault's own token account** at any point after `make_offer` succeeds and before `take_offer`/`cancel_offer` runs. A frozen token account cannot be the source of a `transfer_checked`, so once frozen, **neither `take_offer` nor `cancel_offer` can ever move `amount_a` out of the vault again** — the escrowed funds are locked indefinitely, with no recovery path in the program. This is a fund-lockup (denial of access), not direct theft, but the practical outcome for the maker/taker is the same: the money is gone.
- **Severity: High** (irreversible loss of access to real funds, even though no one profits from it directly — unless the freeze authority is itself the attacker extorting an unfreeze, which raises it further).
- **Exploit scenario**: a malicious or compromised freeze authority for `token_mint_a` waits for a maker to lock a meaningful `amount_a` in the vault, then calls Token's `freeze_account` directly on the vault's ATA (something they can always do, independent of the escrow program, since freeze authority is a mint-level power over every account of that mint). The maker can never cancel, and no taker can ever take; the tokens sit frozen in the vault forever.
- **Fix**: reject any `token_mint_a` with a non-`None` `freeze_authority` at `make_offer` time. (`token_mint_b`'s funds are never escrowed — they move directly taker→maker within a single atomic `take_offer` call — so a frozen `token_mint_b` account can only cause a *specific* take attempt to fail cleanly, not a permanent lockup; still worth the same rejection for consistency and because the frontend already promises "Can be frozen by its creator" is blocked for both sides.)

### Finding 5c — Transfer hook extension is not checked (unpredictable code in the critical path)
- **File/line**: no `TransferHook` check anywhere; same gap as above.
- **Risk**: a transfer hook runs arbitrary, attacker-chosen program logic via CPI on *every* transfer of that mint — including the `make_offer` deposit, the `take_offer` payout, and the `cancel_offer` refund. There's no way to know in advance what that code does; at minimum it can make the transfer fail unpredictably (consuming the instruction's compute budget and causing the whole transaction to fail, a per-call DoS) or behave in ways the escrow's own correctness reasoning doesn't account for.
- **Severity: Medium.** No direct vault-draining path was found — Solana's CPI call graph prevents a hook program from re-entering the `escrow` program while `escrow` is already on the call stack, so a hook can't call back into `take_offer`/`cancel_offer` mid-transfer to double-spend. The risk is unpredictable failure/behavior, not a known theft vector.
- **Fix**: reject `TransferHook` the same way, for both mints, at `make_offer` time — matching the "block anything unrecognized" policy the frontend already documents in `README.md`.

### Finding 5d — Default account state (frozen) extension is not checked (self-lockout of the maker's own refund)
- **File/line**: `cancel_offer.rs:29-36` (`maker_token_account_a`, `init_if_needed`); `take_offer.rs:43-50` (`taker_token_account_a`, `init_if_needed`) and `take_offer.rs:60-67` (`maker_token_account_b`, `init_if_needed`).
- **Risk**: if `token_mint_a` has `DefaultAccountState = Frozen`, any ATA created fresh by `init_if_needed` is born frozen. Concretely: a maker who does **not already hold a pre-existing, unfrozen ATA for `token_mint_a`** and later wants to `cancel_offer` will have `maker_token_account_a` created frozen by `init_if_needed`, and the `transfer_checked` into it (`cancel_offer.rs:64-72`) then fails — the maker can never get their own escrowed `amount_a` back. The same mechanism can block a taker's `take_offer` via `taker_token_account_a`.
- **Severity: Medium.** It's a self-lockout/DoS on the maker's own funds, not theft by a third party, but "the maker can become permanently unable to retrieve their own locked tokens" is a serious correctness/safety gap for an escrow specifically.
- **Fix**: reject `DefaultAccountState` (at least when set to `Frozen`) on `token_mint_a` at `make_offer` time.

### Finding 5e — Mint close authority is not checked, but is not independently exploitable against escrowed funds
- **File/line**: same absence as above.
- **Risk** (as stated in `SECURITY_REVIEW_FRONTEND.md`'s own framing): "it could stop existing while someone's still relying on it."
- **Not exploitable against the vault specifically**, because: SPL Token/Token-2022 requires a mint's total supply to be zero before `close_account` can close it. While an offer is open, the vault holds a nonzero balance of `token_mint_a`'s supply — so the mint cannot be closed until that balance (and every other holder's) is first reduced to zero, which itself would require the vault's tokens to move via a normal `take_offer`/`cancel_offer` first. The mint-close-authority power therefore cannot reach into an active escrow and destroy funds already locked in the vault.
- **Severity: Low** (info-level risk to the token's long-term usability outside the scope of any single offer, not to this program's fund safety).
- **Fix**: reject it anyway, for consistency with the "block unknown/unvetted features by default" policy and because it costs nothing — but this is a lower priority than 5a–5d.

### Finding 5f — Vault-outflow transfers don't independently re-verify the moved amount
*(This restates and confirms, with exact lines, a point `SECURITY_REVIEW_FRONTEND.md` area 8 already flagged from the frontend side.)*
- **File/line**: `take_offer.rs:108-116` (vault → `taker_token_account_a`) and `cancel_offer.rs:64-72` (vault → `maker_token_account_a`) are each followed immediately by a `close_account` call with no balance check in between. Contrast with the two *inflow* transfers, both of which do reload-and-compare: `make_offer.rs:100-105` (`vault.reload()` + `require_eq!`) and `take_offer.rs:89-96` (`maker_token_account_b.reload()` + checked-sub + `require_eq!`).
- **Risk**: currently safe only because `token_mint_a` was already confirmed fee-extension-free at `make_offer` time, and Token-2022 extensions generally can't be added to a mint after its initial space is reserved — so the amount moved by `transfer_checked` out of the vault is expected to always equal the requested amount. This is an *implicit* invariant (true because of how `make_offer` gates things today), not one directly re-verified at the point of outflow.
- **Severity: Low** (defense-in-depth, not a currently-reachable discrepancy given finding 5a/5b/5c/5d are fixed as recommended — if any of those mints extensions were allowed through, this is the second line of defense that's currently missing).
- **Fix**: add the same reload-and-`require_eq!` pattern to both outflow transfers.

## 6. Same-mint offers, self-take, and griefing/DoS paths

- **Same-mint offers**: rejected (`ErrorCode::SameMint`, `make_offer.rs:35`). Confirmed by `hardening.rs::make_offer_rejects_same_mint_for_a_and_b` and `hardening.ts` test 11.
- **Maker taking their own offer**: covered in finding under §1 above — not exploitable for value extraction, net effect equals `cancel_offer`.
- **Rent-griefing of a third party**: not possible — `payer = maker` for both the `Offer` account and the vault (`make_offer.rs:48,57`), so a maker can only spend their own rent creating offers, never someone else's.
- **Freeze-based griefing / DoS**: covered in finding 5b (the most serious DoS path found) and 5d.
- **Transfer-hook-based griefing**: covered in finding 5c.
- **No instruction-level rate limiting or offer-count cap** exists for `make_offer` — noted, matching `SECURITY_REVIEW_FRONTEND.md` area 8's existing note, as something to explicitly decide is out of scope rather than overlook; each offer only costs the maker their own rent, so this isn't a resource-exhaustion attack on anyone else, just an open design question.

## 7. Error handling

**Clean** — every validation failure path returns a proper Anchor error (`require!`, `require_eq!`, `has_one`, `seeds`+`bump`, and `associated_token::*` constraint mismatches all resolve to an `AnchorError`, never a panic or an unchecked unwrap in the instruction logic itself). No `.unwrap()`/`.expect()` was found in any instruction handler on a path reachable by instruction arguments or account data (the only "logic" arithmetic, `take_offer.rs:94`'s `checked_sub`, already uses `.ok_or(...)` instead of unwrapping).

**Where `msg!` logs currently go, and where they should be added** (this feeds the separate hardening step 1 on logging):
- Today, every instruction only logs on its *success* path, at the very end: `initialize.rs:31`, `increment.rs:24`, `make_offer.rs:107-112`, `take_offer.rs:130-135`, `cancel_offer.rs:86-90`. None of the instructions emit an explicit `msg!` on a rejection — though Anchor already auto-logs the `#[msg("...")]` text from `error.rs` whenever a `require!`/`require_eq!`/`has_one` check fails, so rejections are not silent today, just not *additionally* logged by hand.
- **Recommended additions, specifically**:
  1. In `reject_transfer_fee_mint` (`make_offer.rs:16-25`) and wherever findings 5a–5e's new checks are added: a `msg!` naming which mint (A or B) and which extension triggered the rejection, since Anchor's auto-logged error message alone won't say *which* of the two mints was the problem.
  2. Immediately before each vault-outflow transfer in `take_offer.rs` (around line 108) and `cancel_offer.rs` (around line 64): a `msg!` of the vault's balance just before the transfer, pairing with the balance check recommended in finding 5f — useful for confirming the invariant holds, and for diagnosis if it's ever violated.
  3. Nothing is needed for the inflow transfers (`make_offer.rs:100-105`, `take_offer.rs:89-96`) — they already have an explicit check immediately after them; a `msg!` there would be redundant with the `require_eq!` failure message.

---

## Summary table

| Area | Status | Highest severity |
|---|---|---|
| 1. Signer and ownership | Clean (1 info note: self-take) | Info |
| 2. Account validation | Clean | — |
| 3. Math | Clean | — |
| 4. State handling | Clean | — |
| 5. Token handling | 6 findings (5a–5f) | High |
| 6. Same-mint / self-take / griefing | Covered by §1 and §5 findings; no new issue | High (via §5) |
| 7. Error handling | Clean; logging recommendations only | Info |

## Prioritized fix list

### Fix before redeploy
1. **Reject `PermanentDelegate`** on both `token_mint_a` and `token_mint_b` at `make_offer` time (finding 5a, High — direct vault-draining theft vector, bypasses the escrow's authority model entirely).
2. **Reject a non-`None` `freeze_authority`** on `token_mint_a` at minimum, ideally both mints, at `make_offer` time (finding 5b, High — irreversible fund lockup, applies to classic SPL mints too, not just Token-2022).
3. **Reject `TransferHook`** on both mints at `make_offer` time (finding 5c, Medium — unpredictable third-party code in the transfer critical path).
4. **Reject `DefaultAccountState = Frozen`** on `token_mint_a` at `make_offer` time (finding 5d, Medium — can permanently lock a maker out of their own refund via `cancel_offer`'s `init_if_needed` account creation).

### Later
5. **Reject `MintCloseAuthority`** on both mints, for consistency with the "block unknown/unvetted features" policy (finding 5e, Low — not independently exploitable against escrowed funds today, since mint closure requires zero total supply).
6. **Add a reload-and-`require_eq!` balance check** to both vault-outflow transfers (`take_offer.rs:108-116`, `cancel_offer.rs:64-72`), matching the pattern already used on both inflow transfers (finding 5f, Low — defense-in-depth; not currently reachable if items 1–4 above are fixed first).
7. **Add `msg!` logging** at the three spots identified in §7, for observability (Info).
8. *(Optional, no real exploit)* Add `require_keys_neq!(taker.key(), maker.key())` to `take_offer` purely for clarity — the self-take path is already harmless (§1), so this removes a redundant path rather than closing a hole.
