# Phase 11A part 1: Token-2022 support in the frontend — report

Read PLAN.md's Phase 11A section, `SECURITY_REVIEW_FRONTEND.md` (area 8's Token-2022 contract-side note), `IDL_CHECK_REPORT.md`, and the previous Token-2022 rejection code (`createOffer.ts`'s old `fetchMintDecimals`, which rejected every Token-2022 token outright by owner-program check) before writing anything. No transaction was sent, nothing was deployed.

## What changed

**New file: `frontend/src/lib/solana/tokenProgram.ts`** — `resolveTokenProgram(connection, mint)`. Fetches a token's account, confirms it's owned by a known token program (classic or Token-2022, otherwise "This address is not a token."), rejects a freeze authority on either kind of token, and — for Token-2022 — reads every extension present and rejects anything this app doesn't specifically support. Returns `{ programId, decimals }`. Replaces `createOffer.ts`'s old `fetchMintDecimals`, which is now removed entirely (every call site updated, not left as a wrapper).

**`frontend/src/lib/solana/ata.ts`** — `associatedTokenAddress` and `createAssociatedTokenAccountIdempotentInstruction` now take the real token program as a parameter instead of hardcoding the classic one. Grepped the whole `lib/escrow`/`components` tree afterward for `TOKEN_PROGRAM_ID`: the only remaining references are the constant's own definition and test fixtures that deliberately exercise the classic path — no hardcoded assumption is left in any account-derivation or transaction-building path.

**`frontend/src/lib/escrow/createOffer.ts`** — `fetchTokenBalance` takes the resolved token program. `buildCreateOfferTransaction` takes `tokenProgramA`/`tokenProgramB` and uses them for every account it derives and for the instruction's own `tokenProgram` field. New `assertSameTokenProgram(a, b)` — see "both tokens must share one program" below. `toCreateOfferFormMessage` recognizes `TokenProgramError`.

**`frontend/src/lib/escrow/takeOffer.ts`** — `needsTakerTokenAccountA` and `assertSufficientTakerBalance` take the resolved token program. `buildTakeOfferTransaction` takes `tokenProgramA`/`tokenProgramB`, asserts they match (see below), and uses the shared value for all four of its token accounts and the instruction's `tokenProgram` field. `toTakeOfferFormMessage` recognizes `TokenProgramError`.

**`frontend/src/lib/escrow/cancelOffer.ts`** — `buildCancelOfferTransaction` takes `tokenProgram` and uses it for the maker's token account, the vault, and the instruction's `tokenProgram` field. `toCancelOfferFormMessage` recognizes `TokenProgramError`.

**`frontend/src/lib/escrow/fetchOffers.ts`** — `fetchOfferTokenDecimals` (the marketplace's display-only decimals lookup) now uses `resolveTokenProgram` too, so a plain Token-2022 token's amount displays correctly instead of being marked "unavailable."

**`CreateOfferForm.tsx`, `TakeOfferAction.tsx`, `CancelOfferAction.tsx`** — each resolves every token's program via `resolveTokenProgram` right before building a transaction (the same place they already re-fetched the offer and re-checked balances), and threads the result into the builder functions above. `TakeOfferAction`'s panel-open preview (the "this will also create a token account" note) resolves the token program too, so it checks the real associated-token account, not always the classic one.

## Which Token-2022 extensions are allowed or blocked, and why

A token with **no extensions at all** is allowed, classic or Token-2022. Every extension this app recognizes is blocked with its own message; anything it doesn't recognize is blocked too (default deny), never silently allowed:

| Extension | Blocked because | Message |
|---|---|---|
| Transfer fee | Withholds part of every transfer; the design in this app assumes the full amount moves | "This token takes a fee on every transfer. It isn't supported here." |
| Permanent delegate | Lets a third party move tokens out of *any* holder's account for that token, bypassing the app's own authority model entirely — flagged as a specific concern in `SECURITY_REVIEW_FRONTEND.md` area 8 | "This token lets someone else move tokens out of your account. It isn't supported here." |
| Transfer hook | Runs arbitrary extra program logic on every transfer; this app has no way to know what that logic does or whether it could fail or behave unexpectedly | "This token runs extra code on every transfer. It isn't supported here." |
| Mint close authority ("close authority") | Lets the token be closed out from under anyone still holding it | "This token can be closed by its creator. It isn't supported here." |
| Default account state = frozen | New token accounts for the token would start out unusable | "New token accounts for this token start out frozen. It isn't supported here." |
| Any other/unknown extension | Default deny — an extension this code has never been taught about is never assumed safe | "This token has a feature that isn't supported yet." |

**Freeze authority** is blocked too ("This token can be frozen by its creator. It isn't supported here."), but it isn't a Token-2022 extension — it's a field in the base token layout that both classic and Token-2022 tokens share. **Judgment call:** applied this check to classic tokens as well as Token-2022 ones, not just Token-2022, since the risk (the token's creator can freeze any account for it, including one this app relies on staying usable) is identical regardless of which program owns the token, and the field exists in both layouts at the same byte offset. This is a genuinely new restriction — previously, a classic token was never checked for a freeze authority at all.

## Another judgment call: both tokens in an offer must share one token program

Read `take_offer.rs` closely: it declares exactly **one** `token_program` account, and every one of its four token accounts (the vault and taker's receiving account, both tied to token A; the taker's paying account and maker's receiving account, both tied to token B) constrains itself with `associated_token::token_program = token_program` — that single shared account. This means an offer whose two tokens are owned by *different* programs (one classic, one Token-2022) could never actually be taken — `take_offer` would fail, no matter what. `make_offer.rs`, by contrast, doesn't check this at all (it has no token-B-tied account), so nothing stops a maker from creating exactly that kind of broken offer today. Added `assertSameTokenProgram`, called inside both `buildCreateOfferTransaction` and `buildTakeOfferTransaction`, so this is caught at create time with a plain "These two tokens can't be combined. Choose a different pair." instead of silently producing an offer nobody could ever take (the maker's only recourse would be canceling it).

## Tests

`npm run test -- --run`: **22 test files, 193 tests, all passing** (up from 21 files / 170 tests — 23 new). Highlights, matching every scenario asked for:

- Classic token still works (`tokenProgram.test.ts`, `createOffer.test.ts`, `takeOffer.test.ts`, `cancelOffer.test.ts` — existing classic-path tests updated to pass `TOKEN_PROGRAM_ID` explicitly, all still green).
- A plain Token-2022 token (no extensions) resolves and works, in `resolveTokenProgram` directly and in a full `buildCreateOfferTransaction`/`buildTakeOfferTransaction`/`buildCancelOfferTransaction` round trip using `TOKEN_2022_PROGRAM_ID` throughout.
- Each of the six blocked extensions/conditions produces its own distinct message (`tokenProgram.test.ts`), built from hand-crafted TLV byte buffers mirroring the real spl-token-2022 mint layout — no real RPC or network call anywhere; every test mocks `connection.getAccountInfo`.
- An extension type this code doesn't recognize (`9999`) is blocked by the default-deny branch, and a test confirms a *second*, later extension in the list still gets checked even after an earlier one already passed (so the scan doesn't stop early).
- A token owned by neither known program, and a token account too short to even be a token, are both rejected as "This address is not a token."
- `associatedTokenAddress`/`createAssociatedTokenAccountIdempotentInstruction` are tested with both token programs, confirming they derive *different* addresses/instructions depending on which one is passed (the whole point of threading it through).

## What still needed devnet verification (before hand-testing — see "Devnet verification" below for results)

This was built and reasoned through, but had not yet been exercised against a real cluster:

1. **The TLV extension-parsing byte layout** (the account-type tag, the 4-byte type+length header per entry) was written from the spl-token-2022 account spec, not validated against bytes actually returned by `getAccountInfo` for a real Token-2022 mint.
2. **The currently-deployed devnet program may already structurally support Token-2022.** Checked `git show 0b7b810:programs/escrow/src/instructions/make_offer.rs` (the very first commit, still what's deployed per `IDL_CHECK_REPORT.md`): it already uses `token_interface::{Mint, TokenAccount, TokenInterface}`, the same generic types the hardened version uses — it was never classic-only at the account level, even before hardening. This meant a plain Token-2022 offer (no extensions) might already work end to end against today's deployed program, without waiting for the hardening upgrade.
3. **The new freeze-authority rejection applies to classic tokens too.** If any token already used for hand-testing on devnet happens to have a freeze authority set, it would now be rejected where it wasn't before.
4. **The "both tokens must share a token program" guard** reflects a real constraint read from the Rust source, but hadn't been confirmed against a real mixed-program attempt.

PLAN.md's original Phase 11A entry notes its dependency as "the program upgrade with the hardening changes must be on devnet first." This part was built ahead of that, at explicit instruction — per point 2 above, the account-level Token-2022 support doesn't actually require the hardening upgrade, but the hardening commit's own Token-2022-specific check (`reject_transfer_fee_mint`) is a *program-side* backstop this frontend work doesn't depend on, since every one of the six blocked conditions above is enforced client-side regardless of which program version is live.

## Devnet verification

Hand-tested on devnet after the extension-parsing fix in `9902cd2`.

**Tokens used:** two Token-2022 test tokens with no extensions (one at 6 decimals, one at 9), one Token-2022 token with a 1% transfer fee (`4hCSTsZWboKxb9LcYGDXfSmY7pxQmYHmCHmdTRqcXwYU`, the same token that exposed the bug below), and the existing classic test tokens.

**Results:**
- Create, take, and cancel all passed with a plain Token-2022 pair (no extensions) on the deployed, pre-hardening program — confirming point 2 above directly: no program upgrade is needed for Token-2022 support to work. Balances matched expectations on both wallets afterward.
- A mixed pair (one classic token, one Token-2022 token) was blocked at Create Offer with "These two tokens can't be combined. Choose a different pair." — confirming the `assertSameTokenProgram` guard fires correctly on a real pair of tokens, not just in a mocked test.
- The transfer-fee Token-2022 token was blocked with "This token takes a fee on every transfer. It isn't supported here." — confirming the fix.
- Normal (non-extension) tokens, both classic and Token-2022, still worked after the fix — the fix didn't regress the plain case.

**Bug found:** the extension parser looked for extensions starting at byte offset 83 (right after a mint's own 82 bytes), but Token-2022 actually pads every mint out to 165 bytes before placing the account-type tag, so the parser was reading padding and finding nothing — a transfer-fee token slipped through, opening the wallet pop-up instead of being blocked. Fixed in `9902cd2` by moving the start offset to 166. The original unit tests were built from the same wrong layout assumption as the code they were testing, so they passed anyway and gave false confidence. The lesson: a test built from the same assumption as the code it's testing cannot catch that assumption being wrong — only a real devnet test, using real on-chain bytes, actually caught this one.

**Known small issue:** My Offers can briefly keep showing a canceled offer until Refresh is clicked.

**Still not tested:** the other blocked extensions — permanent delegate, transfer hook, freeze authority, mint close authority, and default-account-state-frozen — are covered by unit tests only; none of them have been exercised against a real Token-2022 token on devnet yet.

## Verification

`npm run typecheck`: clean. `npm run lint`: clean. `npm run test -- --run`: 204/204 (as of `9902cd2`). `npm run build`: clean (`/`, `/create-offer`, `/my-offers` all generated). Committed as "Phase 11A part 1: Token-2022 support" only after all of the above passed, with a follow-up fix commit ("Fix transfer fee extension detection") once the devnet bug above was found and corrected.
