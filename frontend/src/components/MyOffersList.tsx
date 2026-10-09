"use client";

import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { DisabledOfferAction, OfferCard, OfferCardSkeleton } from "@/components/OfferCard";
import { Button } from "@/components/ui/Button";
import { useOffers } from "@/hooks/useOffers";
import { myOffers } from "@/lib/escrow/fetchOffers";

const SKELETON_COUNT = 3;

// The offers the connected wallet made. Asks the person to connect first,
// since there is nothing to show as "mine" without a wallet.
export function MyOffersList() {
  const { publicKey, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { loading, error, data, refresh } = useOffers();

  if (!publicKey) {
    return (
      <div className="flex flex-col items-start gap-4 rounded-control border border-border bg-surface px-6 py-10 text-sm text-muted">
        <p>Connect your wallet to see the offers you&apos;ve made.</p>
        <Button onClick={() => setVisible(true)} disabled={connecting}>
          {connecting ? "Connecting…" : "Connect Wallet"}
        </Button>
      </div>
    );
  }

  const offers = data ? myOffers(data.offers, publicKey) : [];

  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error && (
        <div className="flex flex-col items-start gap-3 rounded-control border border-error/40 bg-surface px-4 py-3 text-sm text-error">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={refresh}>
            Try again
          </Button>
        </div>
      )}

      {loading && !error && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <OfferCardSkeleton key={index} />
          ))}
        </div>
      )}

      {!loading && !error && data && offers.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-control border border-border bg-surface px-6 py-10 text-sm text-muted">
          <p>You haven&apos;t created any offers yet.</p>
          <Link href="/create-offer" className="text-accent underline underline-offset-2">
            Create an offer
          </Link>
        </div>
      )}

      {!loading && !error && data && offers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard
              key={offer.offerAddress.toBase58()}
              offer={offer}
              decimals={data.decimals}
              unavailableMints={data.unavailableMints}
              action={<DisabledOfferAction label="Cancel offer" note="Canceling an offer arrives later." />}
            />
          ))}
        </div>
      )}
    </section>
  );
}
