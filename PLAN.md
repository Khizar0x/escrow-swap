# Frontend rebuild plan

Status: approved. Phase 1 (Frontend Setup) is complete. Phase 2 (Wallet Connection) is built and tested by hand. Phase 3 (Anchor Client) is complete. Phase 4 (PDA Utilities) is complete, with tests comparing derivations against independently computed reference addresses. Phase 5 (Create Offer) is built at the `/create-offer` route, with validation, error mapping, and transaction-state tests, and has been tested by hand on devnet: a real offer was created successfully. A bug found in that test — the only confirmation was a small panel beside an unchanged, still-filled-in form and a still-live "Create offer" button, so a success looked like nothing had happened — was fixed the same way as the Phase 7 banner bug: the result (success or error) now shows in a banner above the form, held in state that isn't tied to the form's fields, so clearing the fields after a success can't also clear it. The fields are cleared on success (left alone on error, so the person can fix and resubmit), and the button is relabeled "Create another offer" while the success banner is showing, instead of staying labeled "Create offer" as if nothing had changed. Phase 6 (Fetch Offers) is built: the marketplace (`/`) lists open offers with real stats, and `/my-offers` lists the connected wallet's own; both are read-only and have not yet been tested by hand on devnet with real offer accounts. Phase 7 (Take Offer) is built and tested by hand on devnet: the marketplace's "Take offer" button opens a confirmation panel and sends `take_offer` through `lib/escrow/takeOffer.ts`, re-checking the offer, the taker's balance, and both tokens right before sending, and creating the taker's receiving token account when needed. A real swap on devnet moved both tokens correctly. A bug found in that test — the "Swap complete" message was rendered inside the offer card, so it disappeared the instant the list refresh removed that card — was fixed by moving the result (success or error) to a banner above the list, held in state that isn't tied to the offers list, so it survives any refresh and is cleared only by a new swap starting or an explicit dismiss.

## Goal

Rebuild the escrow frontend from scratch in a new `frontend/` folder, following the mentor's workbook phases. The existing `app/` folder is read-only reference.

## Ground rules

- All new code lives in `frontend/`.
- `app/` is read-only reference. Do not edit it, and do not copy code from it.
- The program's build output (`target/idl/escrow.json`) is an allowed input.
- Unit tests use Vitest. Playwright is not used.
- Manual testing is on devnet with two wallets.
- Available Offers hides the connected wallet's own offers. My Offers shows them.
- Before writing Next.js code, read the docs for the Next.js version we install.
- Token-2022 support is an optional phase (11A) after Testing and before UI Polish.
- The program upgrade with the hardening changes is not decided. Classic flows work on the current deployment.
- Wording: use a clear, professional tone that a non-technical person understands. Use plain words and short sentences, and keep the tone calm and confident. Avoid slang and childish phrasing.
- No technical jargon in the UI. Avoid "trustless", "atomic", "non-custodial", "PDA", "vault", "on-chain", "instruction", "mint", and "escrow program". Say "token" and "swap". Explain things in terms of what the user gets or gives.
- Errors say what happened and what to do next, in one short sentence.
- Do not copy any wording from `app/`.

## Decisions

1. **ESLint stays on version 9 (9.39.5).** ESLint 10 fails with `eslint-config-next` 16.3.8. The React lint plugin bundled with it calls `getFilename`, which ESLint 10 removed, so `npm run lint` crashes. npm marks ESLint 9 as no longer supported, which conflicts with the rule against deprecated packages. Revisit when `eslint-config-next` supports ESLint 10.
2. **npm audit warnings are accepted for now.** There are 5 high-severity findings, all in dev-only lint tooling: `eslint-config-next`, `@next/eslint-plugin-next`, `braces`, `fast-glob`, and `micromatch`. Production dependencies have 0 findings. npm's suggested fix is to downgrade to `eslint-config-next` 14.2.35, which was not applied. Re-check when `eslint-config-next` is updated.
3. **Wallet adapter packages are kept, and their audit findings are accepted for now.** The packages are `@solana/wallet-adapter-react`, `@solana/wallet-adapter-react-ui`, `@solana/wallet-adapter-base`, and `@solana/web3.js`. The production audit reports 23 findings: 13 high and 10 moderate. Two causes:
   - `@solana/web3.js` 1.99.0 depends on `jayson`, which has a moderate advisory. npm offers no fix. This affects any 1.x web3.js app, including the Anchor client planned for Phase 3.
   - `@solana/wallet-adapter-react` depends on the Solana Mobile packages, which depend on React Native and carry high-severity advisories. npm offers no fix. This app has no mobile wallet support.

   Re-check in Phase 10.
4. **The Anchor TypeScript client is `@anchor-lang/core` 1.2.0, pinned exactly (no caret) in `package.json`.** The program and the Anchor CLI are both Anchor 1.x, so the client should be from the same line. This package also depends on `@solana/web3.js` 1.x, which the wallet packages use. The smoke test passed: the IDL loads, the program client builds with the program ID from the IDL, and an `Offer` round-trips through the coder with every field intact. Fallback if this fails later: `@coral-xyz/anchor` 0.32.1, which the root test suite already uses successfully with this IDL.

## Findings in `app/` (reference only, not to be fixed there)

1. **Token-2022 mints break every instruction.** Create, take, and cancel hardcode `TOKEN_PROGRAM_ID`.
2. **Taker's token-B account is never created.** `take_offer` requires it, and the take modal does not create it.
3. **Stale IDL copy.** `src/lib/anchor/escrow.json` has lowercase error names and only codes 6000–6001.
4. **Create form gaps.** It accepts amounts that round to 0 base units and identical mints. It does not check for transfer-fee mints.
5. **Silent decimals fallback.** Failed mint lookups set decimals to 0 with no warning, so amounts display wrong.
6. **Raw error strings.** Every modal shows `err.message`. Anchor error codes are never mapped.
7. **Coarse transaction status.** The UI knows only "sent" or "failed."
8. **No test tooling** in `app/`.
9. **Secret exposure via RPC URL.** `NEXT_PUBLIC_RPC_URL` is compiled into the browser bundle, so a paid RPC key in it is public.
10. **`scripts/take-offer.cjs`** reads the default keypair file and hardcodes a maker address. Left alone by decision.
11. **Client-side ID collisions.** The offer ID is `Date.now()`, so two creates in the same millisecond collide.

## Phases

### 1. Frontend Setup
- **Goal:** Scaffold `frontend/` with Next.js, React, TypeScript, and Tailwind. Add ESLint, Vitest, an env example, and a git-ignore rule for env files.
- **Files:** `frontend/package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `.env.example`, `.gitignore`, placeholder page and test.
- **Dependencies:** None.
- **Test:** `dev`, `build`, `lint`, and `vitest` all pass.
- **Must work first:** Nothing else.

### 2. Wallet Connection
- **Goal:** Phantom connect and disconnect through the Wallet Standard. Show the address and live SOL balance. Warn if the RPC's genesis hash is not devnet's.
- **Files:** `frontend/src/app/providers.tsx`, `components/WalletButton.tsx`, `components/WalletInfo.tsx`, `lib/solana/network.ts`
- **Dependencies:** Phase 1.
- **Test:** Manual with Phantom on devnet: connect, disconnect, switch accounts. Then point the site at a non-devnet RPC address and check that the warning appears.
- **Must work first:** The UI always reflects the active account.
- **Note:** The warning was checked with the testnet address (`https://api.testnet.solana.com`). The public mainnet address (`https://api.mainnet-beta.solana.com`) returned HTTP 403 to a browser-style request, so the page shows "Could not check the network. Refresh the page to try again."

### 3. Anchor Client
- **Goal:** Load the program from the build's IDL. Read one existing offer account.
- **Files:** `frontend/scripts/sync-idl.mjs` (copies `../target/idl/escrow.json` into `src/idl/`), `frontend/src/lib/anchor/client.ts`
- **Dependencies:** Phases 1–2, a rebuilt program.
- **Test:** Vitest checks the program ID and the offer layout. Manually decode a known devnet offer.
- **Must work first:** The frontend IDL matches the program build.

### 4. PDA Utilities
- **Goal:** Pure functions for the offer PDA, the vault ATA, each owner's ATA, and base-unit conversion. Conversion uses BigInt, never floating-point `Number`, and rejects zero results and values above u64.
- **Files:** `frontend/src/lib/solana/pda.ts`, `ata.ts`, `amounts.ts`
- **Dependencies:** Phase 3.
- **Test:** Vitest. Compare derivations against the on-chain test helpers. Cover `"0.0000001"` (rounds to 0), `"1.5"` at 6 decimals, uneven fractions, and values above `2^64 - 1`.
- **Must work first:** Every later phase imports derivations from here only.

### 5. Create Offer
- **Goal:** A form that validates before sending: base-unit amounts above zero, mints differ, and the wallet holds enough of token A. Use a unique offer ID (random u64, checked against the PDA). Classic mints only.
- **Files:** `frontend/src/components/CreateOfferForm.tsx`, `frontend/src/lib/escrow/createOffer.ts`
- **Dependencies:** Phases 2, 4, and a basic version of the phase 9 send hook.
- **Test:** Vitest for each validation rule. Manually on devnet, confirm each invalid input is blocked before a transaction is sent.
- **Must work first:** The program never receives an input it would reject.

### 6. Fetch Offers
- **Goal:** Load all offers and verify each one: owner is the program, discriminator matches, decimals are known. Show unknown decimals explicitly, never as 0.
- **Files:** `frontend/src/lib/escrow/fetchOffers.ts`, `frontend/src/lib/solana/mints.ts`
- **Dependencies:** Phases 3, 4.
- **Test:** Vitest with a fixture that includes a non-program account and an unknown mint. Manually, with two wallets on devnet: a closed offer disappears after refresh.
- **Must work first:** No amount displays with the wrong decimal count.

### 7. Take Offer
- **Goal:** Show what the taker pays and receives. Refetch the offer right before sending. Create the taker's token-B account idempotently in the same transaction. Send `take_offer`.
- **Files:** `frontend/src/lib/escrow/takeOffer.ts`, `frontend/src/components/TakeOfferDialog.tsx`
- **Dependencies:** Phases 4, 6, 9.
- **Test:** Manual with two wallets on devnet: a taker with no token-B account, and a taker with one. A short balance shows the right message. Taking a just-cancelled offer shows the stale-data message.
- **Must work first:** After a take, the maker's token-B balance rises by `amountB` and the taker's token-A balance by `amountA`.

### 8. Cancel Offer
- **Goal:** Maker-only cancel, refunding the full `amountA`. Show the refunded amount.
- **Files:** `frontend/src/lib/escrow/cancelOffer.ts`, `frontend/src/app/my-offers/page.tsx`, `components/MyOfferCard.tsx`
- **Dependencies:** Phases 6, 9.
- **Test:** Manual on devnet: create, cancel, check the refund, confirm the offer is gone. The second wallet has no cancel button for the first wallet's offer.
- **Must work first:** Only the maker sees the cancel action, and the refund equals the deposit.

### 9. Transaction UX
- **Goal:** One send hook with states: building, awaiting signature, sending, confirming, confirmed, failed. Each state is visible. Confirmed and failed transactions link to the explorer. Map errors to readable messages: wallet rejection, insufficient SOL or tokens, Anchor codes 6000–6005, blockhash expiry, and rate limits.
- **Files:** `frontend/src/lib/tx/useSendTransaction.ts`, `lib/errors/map.ts`, `components/TxStatus.tsx`, `lib/solana/explorer.ts`
- **Dependencies:** Phase 2.
- **Test:** Vitest for state transitions and error mapping, using error objects captured from real devnet failures. Manually, confirm the states appear in order and the link opens the right transaction.
- **Must work first:** No raw `Error:` strings reach the screen for mapped cases. Phases 5, 7, and 8 use this hook.

### 10. Security Review
The program validates on-chain, but the frontend must not rely on that alone for correctness or for the safety of user actions.

- **Trusting frontend input.** Every instruction's accounts are derived in the frontend. Verify each derived address against the program's seeds before sending.
- **Wrong PDA or ATA derivation.** Check that the token program used for each mint is the one that owns it. Add a test that derives the same vault as the on-chain helper.
- **Decimals and u64 handling.** No floating-point math on amounts. Amounts above `2^64 - 1` are rejected. Display uses BigInt-safe formatting. Decimals come from the mint, and an unknown mint blocks the action.
- **Stale offer data.** Refetch the offer before take and cancel. Treat "account not found" as "already taken or cancelled." Never show an offer as active without a fresh fetch.
- **Duplicate submission.** Disable the submit button while a transaction is pending. Before retrying after a timeout, check the first signature's status, so an earlier transaction that landed is not sent twice.
- **Exposed secrets.** Keep keypairs out of the frontend and the repo. Treat any `NEXT_PUBLIC_` value as public, so use a restricted RPC key or a server-side proxy. Confirm env files are ignored and no source map leaks secrets.
- **Mobile packages and audit.** Check the production build properly for the Solana Mobile / React Native packages, and recheck npm audit.
- **Files:** Review of all phases' files, plus `frontend/next.config.ts`, `.env.example`, and `frontend/docs/security-review.md`.
- **Dependencies:** Phases 1–9.
- **Test:** A written checklist with one line per item, each marked with its evidence (test name or manual step). A search of the production build for the RPC key.
- **Must work first:** Every item is checked or has a recorded decision.

### 11. Testing
- **Goal:** Vitest coverage of the pure logic, and a manual two-wallet devnet run of the full flow.
- **Files:** `frontend/src/**/*.test.ts`, `frontend/docs/e2e-checklist.md`
- **Dependencies:** Phases 1–10.
- **Test:** `vitest` passes. The checklist runs end to end on devnet with two funded wallets: maker creates, taker sees it under Available Offers, taker takes, balances change, a second offer cancels with a refund. Record each transaction link.
- **Must work first:** The checklist passes from a clean start.

### 11A. Token-2022 Support (optional)
- **Goal:** Support Token-2022 mints in every flow. Show a clear message for a mint with a transfer-fee extension, matching the program's rejection.
- **Files:** `frontend/src/lib/solana/tokenProgram.ts`, plus the flow files from phases 5, 7, and 8.
- **Dependencies:** Phase 11 passing. The program upgrade with the hardening changes must be on devnet first. This is not yet decided.
- **Test:** Repeat the phase 11 checklist with a Token-2022 pair and with a fee mint, which should be rejected with the right message.
- **Must work first:** Classic flows are unchanged.

### 12. UI Polish
- **Goal:** Layout, empty and loading states, responsive behaviour, and clear labels. No new behaviour.
- **Files:** Components across `frontend/src/components/` and `frontend/src/app/`
- **Dependencies:** Phase 11, and 11A if chosen.
- **Test:** Manual pass at phone and desktop widths. Re-run the phase 11 checklist to confirm nothing regressed.
- **Must work first:** The checklist still passes after the visual changes.
