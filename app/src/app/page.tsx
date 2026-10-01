"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Header } from "@/components/Header";
import { StatusStrip } from "@/components/StatusStrip";
import { Hero } from "@/components/Hero";
import { OfferGrid } from "@/components/OfferGrid";
import { ExplainerSection } from "@/components/ExplainerSection";
import { Footer } from "@/components/Footer";
import { CreateOfferModal } from "@/components/CreateOfferModal";
import { useOffers } from "@/lib/anchor/useOffers";

export default function MarketplacePage() {
  const { publicKey } = useWallet();
  const { offers, loading, error, refresh } = useOffers();
  const [showCreate, setShowCreate] = useState(false);

  const distinctMints = useMemo(() => {
    const set = new Set<string>();
    offers.forEach((o) => {
      set.add(o.tokenMintA.toBase58());
      set.add(o.tokenMintB.toBase58());
    });
    return set.size;
  }, [offers]);

  const myOffersCount = useMemo(() => {
    if (!publicKey) return 0;
    return offers.filter((o) => o.maker.equals(publicKey)).length;
  }, [offers, publicKey]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header
        active="marketplace"
        myOffersCount={myOffersCount}
        onCreateOffer={() => setShowCreate(true)}
      />
      <StatusStrip />
      <main className="flex-1 max-w-[1280px] mx-auto px-[24px] py-[32px] w-full flex flex-col gap-[24px]">
        <Hero
          openOffersCount={offers.length}
          distinctMintsCount={distinctMints}
          myOffersCount={myOffersCount}
          onCreateOffer={() => setShowCreate(true)}
        />
        <OfferGrid offers={offers} loading={loading} error={error} onChanged={refresh} />
        <ExplainerSection />
      </main>
      <Footer />

      {showCreate && (
        <CreateOfferModal onClose={() => setShowCreate(false)} onCreated={refresh} />
      )}
    </div>
  );
}
