"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { OfferCard, type OfferRow } from "./OfferCard";
import { TakeOfferModal } from "./TakeOfferModal";
import { FilterStrip, type SortOrder } from "./FilterStrip";
import { Loader2 } from "lucide-react";

export function OfferGrid({
  offers,
  loading,
  error,
  onChanged,
}: {
  offers: OfferRow[];
  loading: boolean;
  error: string | null;
  onChanged: () => void;
}) {
  const { publicKey } = useWallet();
  const [search, setSearch] = useState("");
  const [selectedMint, setSelectedMint] = useState<string | null>(null);
  const [sortOrder, setSortOrder] = useState<SortOrder>("id-desc");
  const [takeTarget, setTakeTarget] = useState<OfferRow | null>(null);

  const mints = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      set.add(o.tokenMintA.toBase58());
      set.add(o.tokenMintB.toBase58());
    });
    return Array.from(set);
  }, [offers]);

  const filtered = useMemo(() => {
    let rows = offers;
    if (selectedMint) {
      rows = rows.filter(
        (o) =>
          o.tokenMintA.toBase58() === selectedMint ||
          o.tokenMintB.toBase58() === selectedMint
      );
    }
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (o) =>
          o.maker.toBase58().toLowerCase().includes(q) ||
          o.tokenMintA.toBase58().toLowerCase().includes(q) ||
          o.tokenMintB.toBase58().toLowerCase().includes(q) ||
          o.publicKey.toBase58().toLowerCase().includes(q)
      );
    }
    return [...rows].sort((a, b) =>
      sortOrder === "id-desc"
        ? b.offerId.cmp(a.offerId)
        : a.offerId.cmp(b.offerId)
    );
  }, [offers, selectedMint, search, sortOrder]);

  return (
    <div className="flex flex-col gap-[24px] w-full pb-[40px]">
      <FilterStrip
        search={search}
        onSearchChange={setSearch}
        mints={mints}
        selectedMint={selectedMint}
        onSelectMint={setSelectedMint}
        sortOrder={sortOrder}
        onSortChange={setSortOrder}
      />

      {loading && (
        <div className="flex items-center justify-center py-[48px] text-[#978da1] gap-[8px]">
          <Loader2 size={18} className="animate-spin" />
          Loading open offers...
        </div>
      )}

      {error && (
        <div className="text-[#ff6b6b] text-center py-[24px]">{error}</div>
      )}

      {!loading && !error && filtered.length === 0 && (
        <div className="text-[#978da1] text-center py-[48px]">
          No open offers match your filters.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-[24px]">
          {filtered.map((offer) => (
            <OfferCard
              key={offer.publicKey.toBase58()}
              offer={offer}
              isOwn={publicKey?.equals(offer.maker) ?? false}
              onTake={() => setTakeTarget(offer)}
            />
          ))}
        </div>
      )}

      {takeTarget && (
        <TakeOfferModal
          offer={takeTarget}
          vault={getAssociatedTokenAddressSync(
            takeTarget.tokenMintA,
            takeTarget.publicKey,
            true,
            TOKEN_PROGRAM_ID,
            ASSOCIATED_TOKEN_PROGRAM_ID
          )}
          onClose={() => setTakeTarget(null)}
          onTaken={onChanged}
        />
      )}
    </div>
  );
}
