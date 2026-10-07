"use client";

import { useMemo } from "react";
import type { Program } from "@anchor-lang/core";
import { useAnchorWallet, useConnection } from "@solana/wallet-adapter-react";
import { createEscrowProgram } from "@/lib/anchor/program";

export type EscrowProgramState =
  | { status: "not-connected" }
  | { status: "ready"; program: Program };

// Gives components the escrow program client once a wallet is connected.
// Until then, the state is "not-connected," and components should show
// a plain message asking the user to connect.
export function useEscrowProgram(): EscrowProgramState {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  return useMemo<EscrowProgramState>(() => {
    if (!wallet) {
      return { status: "not-connected" };
    }
    return { status: "ready", program: createEscrowProgram(connection, wallet) };
  }, [connection, wallet]);
}
