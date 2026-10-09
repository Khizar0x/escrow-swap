import type { ReactNode } from "react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { CopyButton } from "@/components/ui/CopyButton";
import { Skeleton } from "@/components/ui/Skeleton";
import type { Offer } from "@/lib/escrow/fetchOffers";
import { shortenAddress } from "@/lib/format/address";
import { fromBaseUnits } from "@/lib/solana/amounts";
import { explorerAddressUrl } from "@/lib/solana/explorer";
import type { PublicKey } from "@solana/web3.js";

export const UNAVAILABLE_LABEL = "Amount unavailable";

export function formatOfferAmount(
  amount: bigint,
  mint: PublicKey,
  decimals: Map<string, number>,
  unavailableMints: Set<string>
): string {
  const key = mint.toBase58();
  if (unavailableMints.has(key)) {
    return UNAVAILABLE_LABEL;
  }
  const decimalCount = decimals.get(key);
  if (decimalCount === undefined) {
    return UNAVAILABLE_LABEL;
  }
  return fromBaseUnits(amount, decimalCount);
}

// A disabled action with an explanatory note underneath, for placeholders
// (My Offers' "Cancel offer") and for Take Offer when it isn't available
// right now (no wallet, wrong network, or a token that couldn't be checked).
export function DisabledOfferAction({ label, note }: { label: string; note?: string }) {
  return (
    <div className="flex flex-col items-stretch gap-1.5">
      <Button disabled title={note} className="w-full">
        {label}
      </Button>
      {note && <p className="text-center text-xs text-muted">{note}</p>}
    </div>
  );
}

export function OfferCard({
  offer,
  decimals,
  unavailableMints,
  action,
}: {
  offer: Offer;
  decimals: Map<string, number>;
  unavailableMints: Set<string>;
  action: ReactNode;
}) {
  const giveAmount = formatOfferAmount(offer.amountA, offer.tokenA, decimals, unavailableMints);
  const wantAmount = formatOfferAmount(offer.amountB, offer.tokenB, decimals, unavailableMints);
  const anyUnavailable = giveAmount === UNAVAILABLE_LABEL || wantAmount === UNAVAILABLE_LABEL;

  return (
    <Card className="flex flex-col gap-4">
      <dl className="flex flex-col gap-2 text-sm">
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Gives</dt>
          <dd className={`text-right ${giveAmount === UNAVAILABLE_LABEL ? "text-muted" : "text-ink"}`}>
            {giveAmount} of {shortenAddress(offer.tokenA.toBase58())}
          </dd>
        </div>
        <div className="flex items-center justify-between gap-4">
          <dt className="text-muted">Wants</dt>
          <dd className={`text-right ${wantAmount === UNAVAILABLE_LABEL ? "text-muted" : "text-ink"}`}>
            {wantAmount} of {shortenAddress(offer.tokenB.toBase58())}
          </dd>
        </div>
      </dl>

      {anyUnavailable && (
        <p className="text-xs text-muted">
          We could not check one of these tokens, so its amount is not shown.
        </p>
      )}

      <div className="flex items-center justify-between gap-4 border-t border-border pt-4 text-sm">
        <div className="flex items-center gap-2">
          <span className="text-muted">Maker</span>
          <span className="font-mono text-ink">{shortenAddress(offer.maker.toBase58())}</span>
          <CopyButton value={offer.maker.toBase58()} label="Copy maker address" />
        </div>
        <a
          className="text-accent underline underline-offset-2"
          href={explorerAddressUrl(offer.offerAddress.toBase58())}
          target="_blank"
          rel="noreferrer"
        >
          View offer
        </a>
      </div>

      {action}
    </Card>
  );
}

export function OfferCardSkeleton() {
  return (
    <Card className="flex flex-col gap-4" aria-hidden="true">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-4/5" />
      </div>
      <div className="flex items-center justify-between gap-4 border-t border-border pt-4">
        <Skeleton className="h-6 w-28" />
        <Skeleton className="h-4 w-16" />
      </div>
      <Skeleton className="h-10 w-full" />
    </Card>
  );
}
