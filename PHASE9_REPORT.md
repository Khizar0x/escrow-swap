# Phase 9 (shared send-path bug fixes) — report

No transaction was sent, nothing was committed. All three bugs are in `src/lib/tx/sendTransaction.ts` / `useSendTransaction.ts`, fixed once in the shared path so create, take, and cancel all get the fix.

## 1. Double-click

Added `src/lib/tx/inFlightGuard.ts`: a tiny factory (`createInFlightGuard()`) holding a plain boolean, not React state — checked and set synchronously before any `await`, so two calls made in the same tick can't both get through (a disabled-while-busy button only takes effect after a render, which is too late for a fast double-click). Wired into `useSendTransaction.send` via a stable `useRef`, so all three flows get it from one place. Also added the same guard directly around each flow's own Confirm/Create handler (`CreateOfferForm.handleSubmit`, `TakeOfferAction.handleConfirm`, `CancelOfferAction.handleConfirm`) — this stops the pre-send checks each one does (re-fetching the offer, checking balance, picking an offer ID) from running twice too, not just the final send. Tests in `inFlightGuard.test.ts`: two rapid calls → only the first runs; a throw still clears the guard for the next call; two separate guard instances don't block each other.

## 2. Slow approval (blockhash expiry)

Added `isExpiredRequestError`/`expiredSignature`/`EXPIRED_REQUEST_MESSAGE` to `lib/errors/map.ts`. Recognizes web3.js's own `TransactionExpiredBlockheightExceededError` and `TransactionExpiredTimeoutError` (confirmation already uses `lastValidBlockHeight` internally to produce the first one — that's the real mechanism "use lastValidBlockHeight for expiry detection" asks for), plus a message-text fallback for "Blockhash not found" if the RPC rejects an already-stale blockhash at send time. In `sendAndConfirmTransaction`'s catch block: dev-only (`NODE_ENV === "development"`) `console.warn` with the real error's name and message, then — since sending can succeed even if confirmation times out — a `getSignatureStatus` check on the signature (from the successful `sendRawTransaction` call, or off the expiry error itself) before giving up; if it landed, returns the signature normally instead of showing an error at all. Only then does it throw the plain message: "The request expired before it was approved. Nothing was sent. Please try again."

## 3. Rejection

Strengthened `isUserRejection` in `lib/errors/map.ts` to check, in order: the `WalletSignTransactionError`/`WalletSendTransactionError` classes, `error.name` matching those names (for an error that looks the same but isn't literally that class), a Phantom-style numeric code 4001 (direct on the error or nested under `.error`/`.cause`, matching how `WalletError` wraps the provider's original error), and finally the message text. `QuietRejection` now carries the plain message "You canceled the request in your wallet. Nothing was sent." as its own `.message`, and `useSendTransaction` surfaces it as `{status: "error", message}` instead of silently resetting to idle — so it's now shown (calmly) in the banner in all three flows, through the exact same banner pipeline normal errors already use. No field-clearing or list-refresh happens on this path (same as any other error), so form fields and offer cards are untouched. Also added the same `isUserRejection` check directly into each flow's own `toXFormMessage` (`createOffer.ts`, `takeOffer.ts`, `cancelOffer.ts`), so a rejection is mapped the same way even if one were ever raised from a flow's own pre-send steps, not just from inside `send()`.

**The actual source of the stray console output**, found by reading `@solana/wallet-adapter-react`'s `WalletProviderBase.js`: the library's own `WalletProvider` calls `console.error(error, adapter)` by default for every wallet error it emits (including a normal rejection) unless an `onError` prop is supplied. `SolanaProvider.tsx` didn't pass one. Added `onError` to `WalletProvider`, using the same shared `isUserRejection` helper to silently swallow just the rejection case; anything else still logs normally.

## Decisions made without asking

1. **Rejection is no longer fully silent — it's shown, just calmly, with zero console output.** This changes `QuietRejection`'s old contract ("treat as a silent cancel, not an error to display"); the doc comments on the class and on `useSendTransaction` were updated to match. "Quiet" now describes the console, not the UI.
2. **Reused the existing error-banner styling for the rejection message** rather than inventing a separate neutral/non-red style for it. The request only specified the message text and the no-console-output requirement, not a distinct visual treatment; introducing one felt like unrequested scope.
3. **Rejection (now an "error" status) closes the open confirmation panel**, in `TakeOfferAction`/`CancelOfferAction`, the same as any other error does via the existing `prevStatusRef` effect. Not explicitly requested either way; treated as consistent with how every other terminal outcome of an attempt is already handled.
4. **`TransactionExpiredTimeoutError` is treated the same as `TransactionExpiredBlockheightExceededError`**, even though the current `confirmTransaction` call (using the blockhash/lastValidBlockHeight strategy) only actually throws the blockheight-exceeded one in this web3.js version — added defensively in case that ever changes or in case an RPC surfaces timeout differently.
5. **The flow-specific `toXFormMessage` rejection check is defensive, not reachable today.** Rejection only happens inside `wallet.signTransaction`, deep inside `sendAndConfirmTransaction` — never inside the pre-send steps these functions actually see errors from. Added anyway since each flow's message mapping was explicitly asked to be tested, and it costs nothing to be consistent everywhere `isUserRejection` could apply.

## Anything I was unsure about

- Whether "confirmation timeout" in the bug report refers to `TransactionExpiredTimeoutError` specifically, or a generic RPC-level timeout with a different shape. Only the blockheight-exceeded path is reachable from this code today; the timeout class is handled the same way as a defensive measure (see decision 4) in case it ever is.

## Test counts

`npm run test -- --run`: **21 test files, 170 tests, all passing** (up from 20 files / 147 tests — 23 new: 4 in `inFlightGuard.test.ts`, ~16 in `map.test.ts` (rejection + expiry helpers), 3 in `sendTransaction.test.ts` (expiry not landed, landed anyway, dev-only logging), 3 one-per-flow in `createOffer.test.ts`/`takeOffer.test.ts`/`cancelOffer.test.ts`, plus the existing rejection test in `sendTransaction.test.ts` strengthened to also assert the exact message).
`npm run typecheck`: clean. `npm run lint`: clean. `npm run build`: clean (`/`, `/create-offer`, `/my-offers` all generated).

## Files changed

- `frontend/src/lib/tx/inFlightGuard.ts` (new), `inFlightGuard.test.ts` (new).
- `frontend/src/lib/errors/map.ts`, `map.test.ts` — stronger `isUserRejection`; new `isExpiredRequestError`, `expiredSignature`, `EXPIRED_REQUEST_MESSAGE`, `USER_REJECTED_MESSAGE`.
- `frontend/src/lib/tx/sendTransaction.ts`, `sendTransaction.test.ts` — `QuietRejection` carries its message; expiry detection, dev-only logging, landed-anyway check.
- `frontend/src/lib/tx/useSendTransaction.ts` — in-flight guard; rejection surfaces as a visible, calm "error" instead of silent idle.
- `frontend/src/lib/escrow/createOffer.ts`, `takeOffer.ts`, `cancelOffer.ts` (+ their `.test.ts` files) — each flow's `toXFormMessage` also maps a rejection to the plain message.
- `frontend/src/components/CreateOfferForm.tsx`, `TakeOfferAction.tsx`, `CancelOfferAction.tsx` — each confirm/submit handler wrapped in its own in-flight guard.
- `frontend/src/providers/SolanaProvider.tsx` — `WalletProvider` given an `onError` that silences console output for a normal rejection only.

PLAN.md was not touched — this request didn't ask for a status update.
