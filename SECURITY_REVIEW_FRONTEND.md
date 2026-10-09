# Phase 10: Security review — frontend

Review only. No source file was changed, no transaction was sent, nothing was deployed, nothing was committed. `git status --short` was clean before and after. `npm run typecheck` and `npm run test -- --run` (170/170) both pass, unchanged, confirming nothing in this review altered behavior.

Context: the devnet-deployed program predates the hardening commit (`694f4bc`); the frontend's bundled IDL matches a fresh local rebuild exactly (`IDL_CHECK_REPORT.md`). Program ID `WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b`.

---

## 1. Account derivation

**Clean.** Every account the three flows pass is either a hardcoded program ID, derived from a PDA/ATA formula, or re-validated against one — never taken from user input or from fetched offer data unchecked.

- **Offer address**: `frontend/src/lib/solana/pda.ts:18` (`offerAddress`) derives `[OFFER_SEED, maker, offer_id_le]` via `findProgramAddressSync`, mirroring `make_offer.rs:50`'s seeds exactly. Both `buildTakeOfferTransaction` (`takeOffer.ts:124-127`) and `buildCancelOfferTransaction` (`cancelOffer.ts:44-47`) re-derive this from the *fetched* offer's own `maker`/`offerId` fields and `require` it to equal the offer address being acted on, before building anything — a `fetchFreshOffer` result that doesn't match its own seeds is treated as "no longer available," never acted on.
- **Vault / token accounts**: `associatedTokenAddress(mint, owner)` (`ata.ts:19-25`) derives the ATA via the standard `[owner, token_program, mint]` seeds under the Associated Token Program. Every vault, maker-token-account, and taker-token-account passed in `createOffer.ts:125-126`, `takeOffer.ts:129-132`, and `cancelOffer.ts:49-50` is produced this way — there is no code path anywhere in these three files that accepts a token-account address as a raw parameter from a caller or from parsed user text. "Belongs to the right owner and mint" is not just asserted but *structurally* true: the Associated Token Program's own PDA derivation makes it cryptographically impossible for `associatedTokenAddress(mintX, ownerY)` to collide with the real ATA of a different mint/owner pair.
- **Defense in depth on the program side**: every one of these accounts also carries an explicit `associated_token::mint = ...`, `associated_token::authority = ...` constraint in the Rust account structs (`make_offer.rs:38-43`, `take_offer.rs:35-67`, `cancel_offer.rs:29-44`), and the `Offer` PDA itself carries `has_one = maker`, `has_one = token_mint_a`, `has_one = token_mint_b`, `seeds = [...]`, `bump = offer.bump`. Even a hypothetical client bug that computed one of these addresses wrong would be rejected by the program's own constraint check before any transfer runs, not silently accepted. Evidence: `take_offer.rs:24-67`, `cancel_offer.rs:19-44`.

No finding to raise here.

---

## 2. Amounts

**Clean**, with one low-severity gap in a defensive-only check's message.

- **BigInt only, no float**: `solana/amounts.ts` is the sole entry/exit point for amount text ↔ base units, and uses only `BigInt`/string-slicing (`toBaseUnits`/`fromBaseUnits`, `amounts.ts:12-52`). Searched the whole `src/` tree for `parseFloat`/`Number(` used on an amount value — none found outside this file, and this file uses neither.
- **Zero rejected**: `toBaseUnits` throws `AmountError("Enter an amount greater than zero.")` for `baseUnits <= 0n` (`amounts.ts:29-31`) — client-side. The program independently rejects zero amounts too: `require!(amount_a > 0, ErrorCode::ZeroAmount)` / same for `amount_b` (`make_offer.rs:75-76`). Double-checked, both sides agree.
- **Overflow rejected**: `toBaseUnits` rejects anything `> u64::MAX` (`amounts.ts:32-34`, `MAX_U64` computed as `2n**64n - 1n`, not a floating-point approximation).
- **Decimals read from the real mint, never assumed**: `fetchMintDecimals` (`createOffer.ts:58-76`) reads the mint account's actual decimals byte (`MINT_DECIMALS_OFFSET = 44`, the real byte offset in a classic SPL `Mint` account) and explicitly never falls back to `0` on any failure path — a failed lookup throws, it never returns a guessed value. This offset is for a *classic* SPL mint only; see the Token-2022 note under "For the contract review" below for what this means for amount correctness if a Token-2022 mint is ever presented to this code path (it currently can't be, since this function rejects Token-2022 mints by owner-program check first, at `createOffer.ts:69-71`).
- **String→base-units conversion precision**: `toBaseUnits` rejects any input with more fractional digits than the mint's `decimals` outright (`amounts.ts:19-25`) rather than rounding or truncating, and pads the fraction with zeros using plain string ops before `BigInt(...)`ing the whole thing — no floating-point step exists in this path at all, so there is no rounding to lose.

**Low — info-level note, not a bug**: `fromBaseUnits` (`amounts.ts:42-52`) is used to render "you need X, you have Y" messages (`takeOffer.ts:85`), and it is only ever called with amounts and decimals that were already validated upstream; it has no defensive bound-check of its own (e.g., a negative `BigInt` would produce a malformed string via `padStart`). This is unreachable today (nothing in the codebase ever constructs a negative amount), so this is purely a note for future-proofing, not a current risk.

---

## 3. Fresh state

**Clean**, and the underlying guarantee is stronger than "re-fetch catches most cases" — it's structural.

- Both `TakeOfferAction.handleConfirm` (`TakeOfferAction.tsx:110-141`) and `CancelOfferAction.handleConfirm` (`CancelOfferAction.tsx:101-124`) call `fetchFreshOffer` as the very first step, before building anything. `fetchFreshOffer` (`takeOffer.ts:37-65`) treats a missing account *or* a decode failure identically: "This offer is no longer available. It may have been taken or canceled." — so an offer taken/canceled between page-load and the Confirm click is always caught before a transaction is built.
- **Could the maker change the terms between display and take?** No — not possible, structurally, not just "unlikely." Checked `programs/escrow/src/lib.rs:14-42`: the program exposes exactly five instructions — `initialize`, `increment`, `make_offer`, `take_offer`, `cancel_offer`. There is no instruction that writes to an existing `Offer` account's fields. The only two things that can ever happen to a given offer address after creation are: it gets taken (closed, with the maker/taker's tokens moved), or it gets canceled (closed, tokens returned to the maker). Both close the account. There is no "edit amount" or "edit mint" path. So the amounts and mints shown in a `TakeOfferAction`/`CancelOfferAction` confirmation panel — which come from the *list-load-time* `offer` prop, not the fresh re-fetch — cannot have silently drifted from what's on-chain for that same address; the only possible drift is "gone entirely," which is exactly what the fresh re-fetch checks for.
- The one way a maker could effectively "change terms" is cancel the old offer and create a brand new one — but that produces a different PDA address entirely (`offer_id` is part of the seeds, and `pickOfferId`, `createOffer.ts:39-52`, always samples a fresh random ID), so a taker still looking at the old offer address would simply find it gone (closed account → "no longer available"), never silently re-interpreted as the new offer.

No finding to raise here.

---

## 4. Wallet and network

**One finding worth fixing, low-to-medium severity; everything else checked out.**

- **Wrong network**: `useNetworkStatus` (`useNetworkStatus.ts`) compares the connection's actual genesis hash against Devnet's known hash (`network.ts:3-11`), not the RPC URL string — so it can't be fooled by a misleading URL. All three flows gate on `networkStatus !== "devnet"` and show a disabled action with "Switch to Solana Devnet to continue." (confirmed in `CreateOfferForm.tsx:76`, `TakeOfferAction.tsx:78-79`, `CancelOfferAction.tsx:75-76`). Worth noting: this guards *our own* `Connection` object, which is entirely independent of whatever network the wallet extension (e.g. Phantom) displays in its own UI — our app always submits via its own fixed `RPC_URL`, so a mismatched wallet-UI network setting can't route a transaction somewhere unexpected; it can only affect what the wallet extension shows the person while they review the popup.
- **Wallet disconnect mid-flow**: `useSendTransaction.send` checks `if (!wallet)` at the very start of each call (`useSendTransaction.ts`) and shows "Connect your wallet first." — but this check uses the `wallet` reference captured at the moment `send` was invoked. If the wallet disconnects *during* an in-flight `wallet.signTransaction(...)` call, the adapter itself will reject that promise (typically a `WalletNotConnectedError` or similar from `@solana/wallet-adapter-base`), which isn't a user rejection (doesn't match `isUserRejection`'s checks) and isn't an expiry shape, so it falls through to the generic "Something went wrong. Please try again." — safe (no crash, no stuck state, no funds at risk), but not a specific, reassuring message for this specific case. **Severity: low.** Proposed fix: add the adapter's disconnect-shaped error names (`WalletDisconnectedError`, `WalletNotConnectedError`) to a small check in `lib/errors/map.ts`, mapped to something like "Your wallet disconnected. Nothing was sent. Reconnect and try again."
- **Account switch mid-flow** (the one explicitly asked about: *"the in-flight flow must not sign for a different account than the one that was confirmed"*): confirmed by reading all three handlers (`CreateOfferForm.handleSubmit`, `TakeOfferAction.handleConfirm`, `CancelOfferAction.handleConfirm`) — each reads `publicKey` once, from `useWallet()`, at the top of the async function, and uses that single captured value for every address derivation and for the `maker`/`taker` account field in the built transaction; none of them re-read or re-check `publicKey` again immediately before calling `send()`. If the person switches the active account in their wallet extension while the confirmation panel is open but before clicking Confirm, the *next* render will show the new account's state (the panel's displayed amounts, "Connect wallet" gating, etc. all react live), so that case is fine. The narrower case — switching accounts in the *instant between* clicking Confirm and the wallet popup resolving — means the transaction was built naming the *original* account as signer/fee-payer, while the wallet extension might then try to sign with the *new* account's key. **This cannot move the wrong account's funds**: Solana's signature scheme ties a signature cryptographically to a specific public key, so a signature produced by the new account's private key simply does not validate for the original account's pubkey slot — the network would reject the transaction outright on signature verification, not execute it against the wrong wallet. The actual exposure is a confusing failure message, not a fund-safety issue. **Severity: low** (correctness is enforced by Solana itself; this is a UX/clarity gap, not a security hole). Proposed fix: capture the confirming account in a ref when the confirmation panel opens / when Confirm is first clicked, and if `wallet.publicKey` no longer matches that ref immediately before calling `send()`, abort with a clear "Your wallet account changed. Please review and try again." instead of letting it fail generically.

---

## 5. Secrets and logging

**Clean.** Checked:

- `git ls-files | grep -iE "id\.json|keypair|\.env($|[^.])|private.*key|secret"` across the whole repo: no hits.
- `git log --all -p -- .` scanned for secret-shaped patterns (PEM private-key headers, long comma-separated integer arrays matching a 64-byte Solana keypair JSON, `secretKey`/`privateKey` identifiers): no hits, anywhere in history, not just the current tree.
- `.gitignore` (root) excludes `target`, `node_modules`, `.anchor`, etc. `frontend/.gitignore` explicitly excludes `.env*` with a carved-out exception for `.env.example`, and that `.env.example` file itself contains an explicit warning comment: *"Anything starting with NEXT_PUBLIC_ is sent to every visitor's browser, so never put a secret or a private API key here."* (`frontend/.env.example`). Good practice, already in place.
- `app/.env.local` exists on disk but is untracked (confirmed via `git ls-files`) and gitignored by `app/.gitignore`; its only key is `NEXT_PUBLIC_RPC_URL` (a public RPC address, not a secret).
- RPC URL is read from env with a public fallback, never hardcoded to anything private: `process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com"` (`network.ts:6-7`). No API keys anywhere in the frontend's dependency or source surface.
- Console output: searched the whole `src/` tree for `console.*` calls — exactly two, both already reviewed for safety in Phase 9: `sendTransaction.ts`'s dev-only (`NODE_ENV === "development"`) `console.warn` logging an expiry error's `name`/`message` (never a key, a signature, or a wallet address), and `SolanaProvider.tsx`'s `onError` passthrough for genuinely unexpected wallet errors (also never logs anything secret — a rejected/thrown JS `Error` object, not key material). No transaction payloads, no raw account data, no keys are ever logged.

No finding to raise here.

---

## 6. Input and rendering

**Clean.**

- **Token address validation**: every place a raw string becomes a `PublicKey` from user-typed input is wrapped in a try/catch with a friendly fallback — `CreateOfferForm.tsx:106-111` (`"Enter valid token addresses."`). The only other `new PublicKey(...)` call on a plain string, `fetchOffers.ts:91`, operates on a mint address that was itself decoded from on-chain account data (a fixed 32-byte field via the Anchor coder), never from free-text user input, so it can't be malformed.
- **`dangerouslySetInnerHTML`**: exactly one use in the whole frontend, `app/layout.tsx:32`, for the theme-init script. Confirmed its content, `themeInitScript` (`lib/theme.ts:49-51`), is a fixed template string built only from a hardcoded constant (`THEME_STORAGE_KEY`, JSON-stringified) — no runtime or user-controlled value is ever interpolated into it. No other `innerHTML`/`document.write`/`eval`/`new Function` usage anywhere in `src/` (grepped, zero hits).
- **Explorer links**: `explorerAddressUrl`/`explorerTransactionUrl` (`solana/explorer.ts`) interpolate a value directly into a template string with no `encodeURIComponent`, but every call site (grepped all of them: `OfferCard.tsx:91`, `CreateOfferForm.tsx:173,183`, `AvailableOffersList.tsx:71`, `MyOffersList.tsx:78`) passes either a `PublicKey.toBase58()` result or a transaction signature string — both are base58-encoded by construction (Solana's own base58 alphabet has no `&`, `?`, `/`, space, or any other URL-breaking character), and neither ever comes from free-text user input. Not exploitable as built, though adding `encodeURIComponent` would be a trivial, free hardening step since nothing here actually needs the unescaped form.
- No other user input is ever assembled into a URL, HTML attribute, or script context anywhere in the reviewed code.

**Info-only suggestion**: wrap the two explorer-URL builders' interpolated value in `encodeURIComponent` anyway, purely as defense-in-depth against a future call site that might pass something less constrained — zero behavior change today, costs nothing.

---

## 7. Dependencies

`npm audit` (run inside `frontend/`, the actual shipped app — the root/`app/` package.json's test/reference tooling is a separate, non-shipped surface and wasn't the target of this review): **0 critical, 18 high, 11 moderate, 0 info.**

All 18 high-severity findings were traced to their actual source package:

| Package flagged | Real source | Reachable in the shipped app? |
|---|---|---|
| `eslint-config-next`, `@next/eslint-plugin-next`, `braces`, `fast-glob`, `micromatch` | Lint tooling (`devDependencies`) | No — dev-only, never bundled |
| `@react-native/*`, `metro*`, `react-native`, `@solana-mobile/*` | Pulled in transitively by `@solana/wallet-adapter-react`'s optional React Native / mobile-wallet-adapter support | This app has no mobile wallet support wired up; these are inert dead weight in the dependency tree, not necessarily in the shipped bundle — not independently re-verified this session, consistent with the already-documented decision in `PLAN.md` (decision 3) |
| `@anchor-lang/core`, `toml` | `@anchor-lang/core` depends on `toml` (`^3.0.0`) solely for its `workspace.js` module, which reads a local `Anchor.toml` file from disk via Node's `fs`/`child_process` — a CLI/workspace-discovery helper, not anything this frontend calls | **Checked directly, not assumed**: grepped the actual compiled production bundle (`.next/static/chunks/*.js`) for `toml`/`resolveIdlFileName` after a clean rebuild — zero matches. The vulnerable code never ships to the browser; the audit finding is real at the dependency-declaration level but not reachable by anyone visiting the deployed site. |

This is a **newly identified** entry (`@anchor-lang/core`/`toml`) not previously itemized by name in `PLAN.md`'s existing audit-acceptance decisions (which cover the lint tooling and the mobile-wallet packages, decisions 2–3) — worth a one-line addition there for completeness, even though the practical risk is assessed as negligible given the bundle-contents check above. `fixAvailable` for this one requires a semver-major bump with no actual target version offered (`version: "0.0.0"`), so there's no clean upgrade path regardless.

- **`@anchor-lang/core` pin**: confirmed exactly `"1.2.0"` (no `^`/`~`) in `frontend/package.json:15`, matching `PLAN.md` decision 4.
- **Lockfile committed**: `frontend/package-lock.json` is tracked (`git ls-files` confirms it). The repo also tracks a root `package-lock.json` and `app/package-lock.json` for the other two package.json's in this monorepo-style layout — expected, not a concern.
- **Nothing unexpected**: the full `dependencies`/`devDependencies` list (`frontend/package.json`) is small and every entry is a well-known, expected package for this stack (Next, React, the Solana/wallet-adapter family, Tailwind, Vitest, ESLint, TypeScript) — no typosquat-shaped or unexplained package names.

---

## 8. For the contract review (feeds hardening steps 5–6)

These are things the client either cannot protect against at all, or can only partially mitigate — listed separately as requested, since they're program-side, not frontend bugs.

1. **Token-2022 is only partially rejected by the contract, not categorically.** The hardened (not-yet-deployed) account structs use `InterfaceAccount<'info, Mint>` / `Interface<'info, TokenInterface>` (`make_offer.rs:33,36`, similarly in `take_offer.rs`/`cancel_offer.rs`), which accepts *either* the classic Token program *or* Token-2022 — the contract itself doesn't hardcode classic-only. The only Token-2022-specific guard is `reject_transfer_fee_mint` (`make_offer.rs:16-25`), which checks for the `TransferFeeConfig` extension specifically, at offer-creation time only. Any other Token-2022 extension — permanent delegate, non-transferable, confidential transfer, default account state, mint close authority, metadata, etc. — is not checked at all. The **permanent delegate extension** in particular is a meaningful concern for an escrow design specifically: it lets a designated delegate move tokens out of *any* holder's account for that mint, including the vault PDA, bypassing the escrow's own authority model entirely. Today this is fully mitigated by the frontend (`fetchMintDecimals` rejects every Token-2022 mint outright by owner-program check, `createOffer.ts:69-71`, before any of the three flows will build a transaction for one) — but that's a client-side convenience check only; nothing stops a transaction built outside this frontend from using a Token-2022 mint with a dangerous extension today, once the hardened program is deployed. Recommend either an explicit allowlist of safe Token-2022 extensions, or rejecting all Token-2022 mints at the account-constraint level (e.g. requiring `token_program` to equal the classic Token program's address specifically), not just the mints that happen to carry a transfer fee.
2. **Vault-outflow transfers don't independently re-verify the transferred amount.** `make_offer.rs` re-checks its *inbound* transfer (`vault.reload()` + `require_eq!(vault.amount, amount_a, ...)`, lines 100-105) and `take_offer.rs` re-checks *its own* inbound transfer to `maker_token_account_b` (`take_offer.rs:89-96`) — both via a reload-and-compare-the-delta pattern. But `take_offer.rs`'s vault→taker transfer (lines 108-116) and `cancel_offer.rs`'s vault→maker transfer (lines 64-72) are not followed by an equivalent balance check. In practice this is safe today because `token_mint_a`'s fee-extension-freedom was already locked in at `make_offer` time and Token-2022 extensions can't be added to a mint after initialization — but it's an implicit invariant rather than a directly-enforced one, and it would be worth the same explicit reload-and-compare treatment as the other two transfers, for consistency and to not rely on an assumption holding forever.
3. **No instruction-level rate limiting / offer-count cap** exists for `make_offer` (not something the client can meaningfully help with either) — noting only because it's the kind of thing a contract-focused pass would want to explicitly decide is out of scope rather than overlook.

None of these are new findings about the *currently deployed* program's actual behavior — they're about the hardened source that hasn't been deployed yet, surfaced here because reviewing the client/program boundary for this task required reading that source closely.

---

## Summary table

| Area | Status | Highest severity |
|---|---|---|
| 1. Account derivation | Clean | — |
| 2. Amounts | Clean (one info-level note) | Info |
| 3. Fresh state | Clean | — |
| 4. Wallet and network | 2 findings | Low |
| 5. Secrets and logging | Clean | — |
| 6. Input and rendering | Clean (one info-level suggestion) | Info |
| 7. Dependencies | 18 high (all traced; none reachable in the shipped bundle) | High (declared), none exploitable as shipped |
| 8. Contract-side (informational, feeds hardening 5–6) | 2 findings, 1 note | High (program-side, not client-exploitable via this frontend today) |

## Prioritized fix list

1. **(Contract, not frontend — feeds hardening step 5/6)** Tighten Token-2022 handling beyond just the transfer-fee extension before any Token-2022 support is turned on for real (area 8, finding 1). Highest actual stakes of anything in this review, but it's a program change, out of scope for this frontend-only pass.
2. **(Frontend, low)** Detect an account switch between confirming and sending, and show a clear message instead of a generic failure (area 4). No fund-safety impact, but it's the one place this review found where the UI's own story ("the account you confirmed with") can get out of sync with what's about to be signed.
3. **(Frontend, low)** Give wallet-disconnect-mid-flow its own friendly message instead of the generic fallback (area 4).
4. **(Frontend, info, cheap)** Add `encodeURIComponent` to the explorer-URL builders as free defense-in-depth (area 6).
5. **(Process, info)** Add the `@anchor-lang/core`/`toml` audit finding to `PLAN.md`'s existing audit-acceptance decision list, noting it was confirmed absent from the actual production bundle (area 7).
6. **(Contract, info — feeds hardening step 5/6)** Add an explicit post-transfer balance check to the two vault-outflow transfers, matching the pattern already used for both inflow transfers (area 8, finding 2).
