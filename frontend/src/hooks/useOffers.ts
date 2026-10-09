"use client";

import { useCallback, useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { createReadOnlyEscrowProgram } from "@/lib/anchor/program";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors/map";
import { fetchOfferTokenDecimals, fetchOffers, type Offer } from "@/lib/escrow/fetchOffers";

export interface OffersData {
  offers: Offer[];
  skippedCount: number;
  decimals: Map<string, number>;
  unavailableMints: Set<string>;
}

export interface UseOffersResult {
  loading: boolean;
  error: string | null;
  data: OffersData | null;
  refresh: () => void;
}

// Loads every offer and the decimals needed to display them. Works without
// a connected wallet, since the marketplace list is read-only; My Offers
// filters the same data down to the connected wallet separately.
export function useOffers(): UseOffersResult {
  const { connection } = useConnection();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<OffersData | null>(null);
  const [requestId, setRequestId] = useState(0);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const program = createReadOnlyEscrowProgram(connection);
        const { offers, skipped } = await fetchOffers(program);
        const { decimals, unavailable } = await fetchOfferTokenDecimals(connection, offers);
        if (!cancelled) {
          setData({ offers, skippedCount: skipped, decimals, unavailableMints: unavailable });
        }
      } catch {
        if (!cancelled) setError(GENERIC_ERROR_MESSAGE);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [connection, requestId]);

  const refresh = useCallback(() => setRequestId((id) => id + 1), []);

  return { loading, error, data, refresh };
}
