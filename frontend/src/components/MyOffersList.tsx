"use client";

import { useEffect, useReducer, useRef } from "react";
import Link from "next/link";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { CancelOfferAction } from "@/components/CancelOfferAction";
import { OfferCard, OfferCardSkeleton } from "@/components/OfferCard";
import { Button } from "@/components/ui/Button";
import { useOffers } from "@/hooks/useOffers";
import { myOffers } from "@/lib/escrow/fetchOffers";
import { explorerTransactionUrl } from "@/lib/solana/explorer";
import { reduceCancelOfferBanner } from "@/lib/ui/cancelOfferBanner";

const SKELETON_COUNT = 3;

// The offers the connected wallet made. Asks the person to connect first,
// since there is nothing to show as "mine" without a wallet.
export function MyOffersList() {
  const { publicKey, connecting } = useWallet();
  const { setVisible } = useWalletModal();
  const { loading, error, data, refresh } = useOffers();

  const [banner, dispatchBanner] = useReducer(reduceCancelOfferBanner, null);
  const bannerRef = useRef<HTMLDivElement>(null);

  // A refresh never clears the cancel-result banner by itself — not even
  // one that removes the offer card whose action produced it. Only a new
  // attempt starting, a new result, or a dismiss does.
  useEffect(() => {
    dispatchBanner({ type: "offers-refreshed" });
  }, [data]);

  useEffect(() => {
    if (banner) {
      bannerRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [banner]);

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
  // Only the very first load shows skeletons, so a refresh after a
  // successful cancel can't replace the grid the instant it starts — the
  // same fix applied to the marketplace's Available Offers list.
  const showSkeleton = loading && !data;

  return (
    <section className="flex flex-col gap-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={refresh} disabled={loading}>
          Refresh
        </Button>
      </div>

      {banner && (
        <div
          ref={bannerRef}
          className={`flex items-start justify-between gap-3 rounded-control border px-4 py-3 text-sm ${
            banner.type === "success" ? "border-success/40 text-ink" : "border-error/40 text-error"
          }`}
        >
          <div className="flex flex-col gap-2">
            {banner.type === "success" ? (
              <>
                <p>Offer canceled. Your tokens are back in your wallet.</p>
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
          <Button variant="secondary" size="sm" onClick={refresh}>
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

      {!error && data && offers.length === 0 && (
        <div className="flex flex-col items-start gap-3 rounded-control border border-border bg-surface px-6 py-10 text-sm text-muted">
          <p>You haven&apos;t created any offers yet.</p>
          <Link href="/create-offer" className="text-accent underline underline-offset-2">
            Create an offer
          </Link>
        </div>
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
                <CancelOfferAction
                  offer={offer}
                  decimals={data.decimals}
                  unavailableMints={data.unavailableMints}
                  onRefresh={refresh}
                  onResult={(result) =>
                    dispatchBanner(result ? { type: "cancel-result", result } : { type: "cancel-started" })
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
