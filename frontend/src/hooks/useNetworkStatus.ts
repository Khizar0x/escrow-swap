"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { isDevnetGenesisHash } from "@/lib/solana/network";

export type NetworkStatus = "checking" | "devnet" | "other" | "unknown";

// Asks the network for its genesis hash once, to confirm it is Devnet.
export function useNetworkStatus(): NetworkStatus {
  const { connection } = useConnection();
  const [status, setStatus] = useState<NetworkStatus>("checking");

  useEffect(() => {
    let cancelled = false;

    connection.getGenesisHash().then(
      (hash) => {
        if (!cancelled) setStatus(isDevnetGenesisHash(hash) ? "devnet" : "other");
      },
      () => {
        if (!cancelled) setStatus("unknown");
      }
    );

    return () => {
      cancelled = true;
    };
  }, [connection]);

  return status;
}
