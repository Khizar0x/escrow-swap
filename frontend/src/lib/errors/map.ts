import { AnchorError, ProgramError } from "@anchor-lang/core";
import { WalletSendTransactionError, WalletSignTransactionError } from "@solana/wallet-adapter-base";
import {
  TransactionExpiredBlockheightExceededError,
  TransactionExpiredTimeoutError,
} from "@solana/web3.js";
import escrowIdl from "@/idl/escrow.json";

// Plain-language text for each program error, keyed by the IDL's error name
// so the mapping survives the codes being renumbered.
const PLAIN_MESSAGES: Record<string, string> = {
  Unauthorized: "You're not allowed to do this.",
  CounterOverflow: "This counter cannot go any higher.",
  ZeroAmount: "Enter an amount greater than zero.",
  SameMint: "Choose two different tokens.",
  TransferFeeNotSupported: "This token type is not supported yet.",
  TransferAmountMismatch: "The transfer did not complete as expected. Try again.",
  PermanentDelegateNotSupported: "This token lets someone else move tokens out of your account. It's not supported.",
  TransferHookNotSupported: "This token runs extra code on every transfer. It's not supported.",
  DefaultFrozenNotSupported: "This token starts new accounts out frozen. It's not supported.",
  FreezeAuthorityNotSupported: "This token can be frozen by its creator. It's not supported.",
};

export const GENERIC_ERROR_MESSAGE = "Something went wrong. Please try again.";

const CODE_TO_MESSAGE = new Map<number, string>(
  escrowIdl.errors
    .filter((entry) => entry.name in PLAIN_MESSAGES)
    .map((entry) => [entry.code, PLAIN_MESSAGES[entry.name]])
);

// Maps a program error to a plain-language message. Pass the result of
// Anchor's translateError (or a raw caught error) in. Unknown or
// non-program errors get a generic message that says what to do next —
// never a raw error string.
export function toPlainErrorMessage(error: unknown): string {
  if (error instanceof AnchorError) {
    return CODE_TO_MESSAGE.get(error.error.errorCode.number) ?? GENERIC_ERROR_MESSAGE;
  }
  if (error instanceof ProgramError) {
    return CODE_TO_MESSAGE.get(error.code) ?? GENERIC_ERROR_MESSAGE;
  }
  return GENERIC_ERROR_MESSAGE;
}

export const USER_REJECTED_MESSAGE = "You canceled the request in your wallet. Nothing was sent.";

const REJECTION_ERROR_NAMES = new Set(["WalletSignTransactionError", "WalletSendTransactionError"]);

// Phantom, and most other wallets that follow the same convention, reject
// with this code (sometimes on the error itself, sometimes nested under
// .error or .cause, depending on how the adapter wraps the provider's own
// error) when the person declines in the approval popup.
const WALLET_USER_REJECTED_CODE = 4001;

function hasUserRejectedCode(value: unknown): boolean {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  if ((value as { code?: unknown }).code === WALLET_USER_REJECTED_CODE) {
    return true;
  }
  const nested = (value as { error?: unknown }).error ?? (value as { cause?: unknown }).cause;
  return (
    typeof nested === "object" &&
    nested !== null &&
    (nested as { code?: unknown }).code === WALLET_USER_REJECTED_CODE
  );
}

// True when the wallet, not the program, is why a transaction did not go
// through — e.g. the person closed the approval popup. Checks the wrapper
// class the wallet-adapter library throws, its .name (for an error that
// looks the same but isn't literally that class), Phantom's numeric
// rejection code (direct or nested under .error/.cause), and finally the
// message text itself, since not every wallet wraps its errors the same
// way. Callers should show a calm, specific message for this — never log it
// to the console — rather than treat it like an unexpected failure.
export function isUserRejection(error: unknown): boolean {
  if (error instanceof WalletSignTransactionError || error instanceof WalletSendTransactionError) {
    return true;
  }
  if (error instanceof Error && REJECTION_ERROR_NAMES.has(error.name)) {
    return true;
  }
  if (hasUserRejectedCode(error)) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /reject|declin|cancel/i.test(message);
}

export const EXPIRED_REQUEST_MESSAGE =
  "The request expired before it was approved. Nothing was sent. Please try again.";

const EXPIRED_ERROR_NAMES = new Set([
  "TransactionExpiredBlockheightExceededError",
  "TransactionExpiredTimeoutError",
]);

// True when the network says a transaction's blockhash expired, or
// confirmation never finished, before it could be approved and landed —
// e.g. the person took a long time to approve in their wallet. This is not
// a rejection and not a program error: nothing is known to have failed,
// only that the wallet took too long to come back. web3.js's own
// confirmTransaction already uses lastValidBlockHeight internally to
// detect this (that's what TransactionExpiredBlockheightExceededError
// means), so this mainly needs to recognize its two expiry error classes
// and, as a fallback, the RPC's own "blockhash not found" wording for a
// blockhash that was already stale by the time it was sent.
export function isExpiredRequestError(error: unknown): boolean {
  if (
    error instanceof TransactionExpiredBlockheightExceededError ||
    error instanceof TransactionExpiredTimeoutError
  ) {
    return true;
  }
  if (error instanceof Error) {
    if (EXPIRED_ERROR_NAMES.has(error.name)) {
      return true;
    }
    return /blockhash not found|block height exceeded|not confirmed in/i.test(error.message);
  }
  return false;
}

// Both TransactionExpired* classes carry the signature of the transaction
// that expired unconfirmed. Lets the caller check whether it landed anyway
// before showing an error.
export function expiredSignature(error: unknown): string | undefined {
  if (error && typeof error === "object" && "signature" in error) {
    const value = (error as { signature?: unknown }).signature;
    if (typeof value === "string") {
      return value;
    }
  }
  return undefined;
}
