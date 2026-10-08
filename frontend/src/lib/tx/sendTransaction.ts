import { parseIdlErrors, translateError, type Idl, type Program } from "@anchor-lang/core";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import { SendTransactionError, type Connection, type Transaction } from "@solana/web3.js";
import { isUserRejection, toPlainErrorMessage } from "@/lib/errors/map";

export type TransactionStatus = "awaiting-approval" | "sending" | "confirming";

// Thrown when the wallet, not the program, is why nothing was sent. Callers
// should treat this as a silent cancel, not an error to display.
export class QuietRejection extends Error {}

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
  try {
    onStatus("awaiting-approval");
    const transaction = await buildTransaction();
    const latest = await connection.getLatestBlockhash("confirmed");
    transaction.feePayer = transaction.feePayer ?? wallet.publicKey;
    transaction.recentBlockhash = latest.blockhash;

    const signed = await wallet.signTransaction(transaction);

    onStatus("sending");
    const signature = await connection.sendRawTransaction(signed.serialize());

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
    const translated = translateError(error, parseIdlErrors(program.idl));
    throw new Error(toPlainErrorMessage(translated));
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
