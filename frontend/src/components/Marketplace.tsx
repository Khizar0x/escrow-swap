"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { AvailableOffersList } from "@/components/AvailableOffersList";
import { StatsRow } from "@/components/StatsRow";
import { useOffers } from "@/hooks/useOffers";

// Owns the one useOffers() call for the home page, so the stats row and the
// offer list below it share a single fetch instead of each loading its own.
export function Marketplace() {
  const { publicKey } = useWallet();
  const { loading, error, data, refresh } = useOffers();

  const tokensListed = data
    ? new Set(data.offers.flatMap((offer) => [offer.tokenA.toBase58(), offer.tokenB.toBase58()])).size
    : 0;

  return (
    <div className="flex flex-col gap-10">
      <StatsRow openOffers={data?.offers.length ?? 0} tokensListed={tokensListed} loading={loading} />
      <AvailableOffersList
        wallet={publicKey}
        loading={loading}
        error={error}
        data={data}
        onRefresh={refresh}
      />
    </div>
  );
}
