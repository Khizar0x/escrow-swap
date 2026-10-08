"use client";

import { useCallback, useState } from "react";
import type { Idl, Program } from "@anchor-lang/core";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import type { Transaction } from "@solana/web3.js";
import { QuietRejection, sendAndConfirmTransaction, type TransactionStatus } from "./sendTransaction";

export type SendState =
  | { status: "idle" }
  | { status: TransactionStatus }
  | { status: "success"; signature: string }
  | { status: "error"; message: string };

// Drives a single transaction through signing, sending, and confirming,
// exposing each step so the UI can show it. A wallet rejection resets to
// idle quietly, with no error shown.
export function useSendTransaction() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [state, setState] = useState<SendState>({ status: "idle" });

  const send = useCallback(
    async (program: Program<Idl>, buildTransaction: () => Promise<Transaction>) => {
      if (!wallet) {
        setState({ status: "error", message: "Connect your wallet first." });
        return null;
      }

      try {
        const signature = await sendAndConfirmTransaction({
          connection,
          wallet,
          program,
          buildTransaction,
          onStatus: (status) => setState({ status }),
        });
        setState({ status: "success", signature });
        return signature;
      } catch (error) {
        if (error instanceof QuietRejection) {
          setState({ status: "idle" });
          return null;
        }
        setState({
          status: "error",
          message: error instanceof Error ? error.message : "Something went wrong. Please try again.",
        });
        return null;
      }
    },
    [connection, wallet]
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, send, reset };
}
