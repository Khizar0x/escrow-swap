"use client";

import { useEffect, useReducer } from "react";
import Link from "next/link";
import { OfferCard, OfferCardSkeleton } from "@/components/OfferCard";
import { TakeOfferAction } from "@/components/TakeOfferAction";
import { Button } from "@/components/ui/Button";
import type { OffersData } from "@/hooks/useOffers";
import { availableOffers, marketplaceEmptyState } from "@/lib/escrow/fetchOffers";
import { explorerTransactionUrl } from "@/lib/solana/explorer";
import { reduceTakeOfferBanner } from "@/lib/ui/takeOfferBanner";
import type { PublicKey } from "@solana/web3.js";

const SKELETON_COUNT = 3;

// The marketplace list: every open offer except the connected wallet's own.
// Takes the shared offers data as props (from Marketplace, which owns the
// one useOffers() call) rather than fetching its own, so the stats row and
// this list never trigger two separate fetches.
export function AvailableOffersList({
  wallet,
  loading,
  error,
  data,
  onRefresh,
}: {
  wallet: PublicKey | null;
  loading: boolean;
  error: string | null;
  data: OffersData | null;
  onRefresh: () => void;
}) {
  const offers = data ? availableOffers(data.offers, wallet) : [];
  const emptyState = data ? marketplaceEmptyState(data.offers, wallet) : null;
  // Only the very first load shows skeletons. A refresh keeps the current
  // list on screen (the Refresh button disables itself meanwhile), so a
  // card's own success message — e.g. after taking an offer — has time to
  // be seen instead of being replaced by skeletons the instant it appears.
  const showSkeleton = loading && !data;

  const [banner, dispatchBanner] = useReducer(reduceTakeOfferBanner, null);

  // A refresh never clears the swap-result banner by itself — not even one
  // that removes the offer card whose action produced it. Only a new swap
  // starting, a new result, or a dismiss does (see reduceTakeOfferBanner).
  useEffect(() => {
    dispatchBanner({ type: "offers-refreshed" });
  }, [data]);

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-4">
        <h2 className="text-2xl font-semibold tracking-tight">Available offers</h2>
        <Button variant="secondary" size="sm" onClick={onRefresh} disabled={loading}>
          Refresh
        </Button>
      </div>

      {banner && (
        <div
          className={`flex items-start justify-between gap-3 rounded-control border px-4 py-3 text-sm ${
            banner.type === "success" ? "border-success/40 text-ink" : "border-error/40 text-error"
          }`}
        >
          <div className="flex flex-col gap-2">
            {banner.type === "success" ? (
              <>
                <p>Swap complete.</p>
                <a
                  className="text-accent underline underline-offset-2"
                  href={explorerTransactionUrl(banner.signature)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction on Solana Explorer
                </a>
              </>
            ) : (
              <p>{banner.message}</p>
            )}
          </div>
          <Button variant="secondary" size="sm" onClick={() => dispatchBanner({ type: "dismissed" })}>
            Dismiss
          </Button>
        </div>
      )}

      {error && (
        <div className="flex flex-col items-start gap-3 rounded-control border border-error/40 bg-surface px-4 py-3 text-sm text-error">
          <p>{error}</p>
          <Button variant="secondary" size="sm" onClick={onRefresh}>
            Try again
          </Button>
        </div>
      )}

      {showSkeleton && !error && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
            <OfferCardSkeleton key={index} />
          ))}
        </div>
      )}

      {!error && data && emptyState === "none" && (
        <p className="rounded-control border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
          No offers yet.{" "}
          <Link href="/create-offer" className="text-accent underline underline-offset-2">
            Create the first one.
          </Link>
        </p>
      )}

      {!error && data && emptyState === "none-from-others" && (
        <p className="rounded-control border border-border bg-surface px-4 py-10 text-center text-sm text-muted">
          No offers from other people right now.{" "}
          <Link href="/my-offers" className="text-accent underline underline-offset-2">
            See your offers
          </Link>
        </p>
      )}

      {!error && data && offers.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {offers.map((offer) => (
            <OfferCard
              key={offer.offerAddress.toBase58()}
              offer={offer}
              decimals={data.decimals}
              unavailableMints={data.unavailableMints}
              action={
                <TakeOfferAction
                  offer={offer}
                  decimals={data.decimals}
                  unavailableMints={data.unavailableMints}
                  onRefresh={onRefresh}
                  onResult={(result) =>
                    dispatchBanner(result ? { type: "swap-result", result } : { type: "swap-started" })
                  }
                />
              }
            />
          ))}
        </div>
      )}
    </section>
  );
}
