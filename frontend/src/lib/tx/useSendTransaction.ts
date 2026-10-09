"use client";

import { useCallback, useRef, useState } from "react";
import type { Idl, Program } from "@anchor-lang/core";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import type { Transaction } from "@solana/web3.js";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors/map";
import { createInFlightGuard } from "./inFlightGuard";
import { QuietRejection, sendAndConfirmTransaction, type TransactionStatus } from "./sendTransaction";

export type SendState =
  | { status: "idle" }
  | { status: TransactionStatus }
  | { status: "success"; signature: string }
  | { status: "error"; message: string };

// Drives a single transaction through signing, sending, and confirming,
// exposing each step so the UI can show it. A synchronous in-flight guard
// (shared by create, take, and cancel, since they all call this hook) makes
// a second call while one is already running a no-op, so a fast double
// click can't open a second wallet approval popup. A wallet rejection ends
// in "error" with a calm, specific message (see QuietRejection) — shown,
// not hidden — and nothing is ever printed to the console for it.
export function useSendTransaction() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();
  const [state, setState] = useState<SendState>({ status: "idle" });
  const guardRef = useRef(createInFlightGuard());

  const send = useCallback(
    (program: Program<Idl>, buildTransaction: () => Promise<Transaction>) =>
      guardRef.current(async () => {
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
            setState({ status: "error", message: error.message });
            return null;
          }
          setState({
            status: "error",
            message: error instanceof Error ? error.message : GENERIC_ERROR_MESSAGE,
          });
          return null;
        }
      }),
    [connection, wallet]
  );

  const reset = useCallback(() => setState({ status: "idle" }), []);

  return { state, send, reset };
}
