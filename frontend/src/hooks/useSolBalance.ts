"use client";

import { useEffect, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";

type BalanceResult = {
  lamports: bigint | null;
  error: boolean;
};

type StoredBalance = BalanceResult & {
  owner: string;
};

const EMPTY: BalanceResult = { lamports: null, error: false };

// Loads the connected wallet's SOL balance and keeps it up to date.
// Results are tagged with the owner's address, so a value from a previous
// wallet is never shown for the current one.
export function useSolBalance(): BalanceResult {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const [stored, setStored] = useState<StoredBalance | null>(null);

  useEffect(() => {
    if (!publicKey) return;

    const owner = publicKey.toBase58();
    let cancelled = false;

    connection.getBalance(publicKey, "confirmed").then(
      (lamports) => {
        if (!cancelled) setStored({ owner, lamports: BigInt(lamports), error: false });
      },
      () => {
        if (!cancelled) setStored({ owner, lamports: null, error: true });
      }
    );

    const subscriptionId = connection.onAccountChange(
      publicKey,
      (account) => {
        if (!cancelled) {
          setStored({ owner, lamports: BigInt(account.lamports), error: false });
        }
      },
      "confirmed"
    );

    return () => {
      cancelled = true;
      void connection.removeAccountChangeListener(subscriptionId);
    };
  }, [connection, publicKey]);

  if (!publicKey || !stored || stored.owner !== publicKey.toBase58()) {
    return EMPTY;
  }
  return { lamports: stored.lamports, error: stored.error };
}
