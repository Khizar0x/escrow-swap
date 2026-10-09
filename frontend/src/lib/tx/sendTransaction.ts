import { parseIdlErrors, translateError, type Idl, type Program } from "@anchor-lang/core";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { SendTransactionError, type Connection, type Transaction } from "@solana/web3.js";
import {
  EXPIRED_REQUEST_MESSAGE,
  expiredSignature,
  isExpiredRequestError,
  isUserRejection,
  toPlainErrorMessage,
  USER_REJECTED_MESSAGE,
} from "@/lib/errors/map";

export type TransactionStatus = "awaiting-approval" | "sending" | "confirming";

// Thrown when the wallet, not the program, is why nothing was sent (the
// person declined the approval). Carries the plain message to show —
// callers should display it, but never log it to the console, since a
// normal cancel isn't a bug.
export class QuietRejection extends Error {
  constructor() {
    super(USER_REJECTED_MESSAGE);
    this.name = "QuietRejection";
  }
}

export interface SendTransactionInput {
  connection: Connection;
  wallet: AnchorWallet;
  program: Program<Idl>;
  buildTransaction: () => Promise<Transaction>;
  onStatus: (status: TransactionStatus) => void;
}

// Signs, sends, and confirms a transaction, reporting each step through
// onStatus so the UI can show it. Every account the transaction touches was
// already derived and validated by the caller; this function only carries
// it through the wallet and the network.
export async function sendAndConfirmTransaction({
  connection,
  wallet,
  program,
  buildTransaction,
  onStatus,
}: SendTransactionInput): Promise<string> {
  // Read outside the try block's scope so the catch block can still reach it
  // if sending itself succeeded but confirmation expired afterward.
  let signature: string | undefined;

  try {
    onStatus("awaiting-approval");
    const transaction = await buildTransaction();
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = transaction.feePayer ?? wallet.publicKey;
    transaction.recentBlockhash = latest.blockhash;

    // The wallet can sit open for a long time before the person approves —
    // long enough for this blockhash to expire before it's even sent.
    const signed = await wallet.signTransaction(transaction);

    onStatus("sending");
    signature = await connection.sendRawTransaction(signed.serialize());

    onStatus("confirming");
    const confirmation = await connection.confirmTransaction(
      {
        signature,
        blockhash: latest.blockhash,
        lastValidBlockHeight: latest.lastValidBlockHeight,
      },
      "confirmed"
    );

    if (confirmation.value.err) {
      throw await toConfirmationError(connection, signature, confirmation.value.err);
    }

    return signature;
  } catch (error) {
    if (isUserRejection(error)) {
      throw new QuietRejection();
    }

    if (isExpiredRequestError(error)) {
      if (process.env.NODE_ENV === "development") {
        const name = error instanceof Error ? error.name : "UnknownError";
        const message = error instanceof Error ? error.message : String(error);
        console.warn(`[sendAndConfirmTransaction] request expired: ${name}: ${message}`);
      }

      // Expiry (a stale blockhash, or confirmation that never finished) does
      // not mean the transaction failed — it may have landed anyway. Check
      // before telling the person nothing happened.
      const landedSignature = signature ?? expiredSignature(error);
      if (landedSignature && (await hasLanded(connection, landedSignature))) {
        return landedSignature;
      }

      throw new Error(EXPIRED_REQUEST_MESSAGE);
    }

    const translated = translateError(error, parseIdlErrors(program.idl));
    throw new Error(toPlainErrorMessage(translated));
  }
}

async function hasLanded(connection: Connection, signature: string): Promise<boolean> {
  try {
    const status = await connection.getSignatureStatus(signature);
    return status.value !== null && status.value.err === null;
  } catch {
    return false;
  }
}

// A confirmed-but-failed transaction does not carry logs on the
// confirmation result itself, so this fetches them the same way
// AnchorProvider does, and wraps them so Anchor's own log parser can find
// the program's error inside.
async function toConfirmationError(
  connection: Connection,
  signature: string,
  err: unknown
): Promise<Error> {
  const tx = await connection.getTransaction(signature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const logs = tx?.meta?.logMessages;
  if (!logs) {
    return new Error(JSON.stringify(err));
  }
  return new SendTransactionError({
    action: "send",
    signature,
    transactionMessage: JSON.stringify(err),
    logs,
  });
}
