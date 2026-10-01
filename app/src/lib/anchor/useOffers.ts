"use client";

import { useCallback, useEffect, useState } from "react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { getMint, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@solana/spl-token";
import { useConnection } from "@solana/wallet-adapter-react";
import { useProgram } from "./program";
import type { OfferRow } from "@/components/OfferCard";

const decimalsCache = new Map<string, number>();

async function getDecimals(connection: anchor.web3.Connection, mint: PublicKey): Promise<number> {
  const key = mint.toBase58();
  const cached = decimalsCache.get(key);
  if (cached !== undefined) return cached;

  try {
    const info = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
    decimalsCache.set(key, info.decimals);
    return info.decimals;
  } catch {
    try {
      const info = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
      decimalsCache.set(key, info.decimals);
      return info.decimals;
    } catch {
      decimalsCache.set(key, 0);
      return 0;
    }
  }
}

export function useOffers() {
  const { program } = useProgram();
  const { connection } = useConnection();
  const [offers, setOffers] = useState<OfferRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!program) return;
    setLoading(true);
    setError(null);
    try {
      const accounts = await program.account.offer.all();
      const rows = await Promise.all(
        accounts.map(async ({ publicKey, account }) => {
          const a = account as {
            offerId: anchor.BN;
            maker: PublicKey;
            tokenMintA: PublicKey;
            tokenMintB: PublicKey;
            amountA: anchor.BN;
            amountB: anchor.BN;
          };
          const [decimalsA, decimalsB] = await Promise.all([
            getDecimals(connection, a.tokenMintA),
            getDecimals(connection, a.tokenMintB),
          ]);
          const row: OfferRow = {
            publicKey,
            offerId: a.offerId,
            maker: a.maker,
            tokenMintA: a.tokenMintA,
            tokenMintB: a.tokenMintB,
            amountA: a.amountA,
            amountB: a.amountB,
            decimalsA,
            decimalsB,
          };
          return row;
        })
      );
      setOffers(rows);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load offers");
    } finally {
      setLoading(false);
    }
  }, [program, connection]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { offers, loading, error, refresh };
}
