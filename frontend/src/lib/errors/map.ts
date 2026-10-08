import { AnchorError, ProgramError } from "@anchor-lang/core";
import { WalletSendTransactionError, WalletSignTransactionError } from "@solana/wallet-adapter-base";
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

// True when the wallet, not the program, is why a transaction did not go
// through — e.g. the person closed the approval popup. Callers should treat
// this as a silent cancel, not an error to show.
export function isUserRejection(error: unknown): boolean {
  if (error instanceof WalletSignTransactionError || error instanceof WalletSendTransactionError) {
    return true;
  }
  const message = error instanceof Error ? error.message : String(error);
  return /reject|declin|cancel/i.test(message);
}
