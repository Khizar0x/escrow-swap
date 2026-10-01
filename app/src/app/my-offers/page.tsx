"use client";

import { useMemo, useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Plus, Wallet } from "lucide-react";
import { Header } from "@/components/Header";
import { StatusStrip } from "@/components/StatusStrip";
import { Footer } from "@/components/Footer";
import { CreateOfferModal } from "@/components/CreateOfferModal";
import { MyOfferCard } from "@/components/MyOfferCard";
import { useOffers } from "@/lib/anchor/useOffers";

export default function MyOffersPage() {
  const { publicKey, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const { offers, loading, refresh } = useOffers();
  const [showCreate, setShowCreate] = useState(false);

  const myOffers = useMemo(() => {
    if (!publicKey) return [];
    return offers.filter((o) => o.maker.equals(publicKey));
  }, [offers, publicKey]);

  return (
    <div className="flex flex-col min-h-screen">
      <Header active="my-offers" myOffersCount={myOffers.length} />
      <StatusStrip />
      <main className="flex-1 max-w-[1280px] mx-auto px-[24px] py-[32px] w-full flex flex-col gap-[24px]">
        <div className="flex items-end justify-between w-full flex-wrap gap-[16px]">
          <div className="flex flex-col gap-[4px] items-start">
            <span className="font-mono font-semibold text-[#978da1] text-[11px] tracking-[0.55px] uppercase">
              Escrow Protocol <span className="text-[#d8b9ff]">/ Account State</span>
            </span>
            <div className="flex gap-[8px] items-center">
              <h1 className="font-semibold text-[#e1e2eb] text-[36px] tracking-[-0.9px]">
                My Offers
              </h1>
              <div className="bg-[#272a31] flex gap-[6px] items-center px-[12px] py-[4px] rounded-full">
                <span className="bg-[#a0ffc3] rounded-full size-[6px]" />
                <span className="font-mono text-[#56ffa8] text-[11px]">
                  {myOffers.length} Open
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowCreate(true)}
            className="bg-gradient-to-r from-[#9945ff] to-[#00ec91] flex gap-[8px] items-center px-[24px] py-[10px] rounded-[12px]"
          >
            <Plus size={14} className="text-white" />
            <span className="font-mono font-semibold text-[11px] text-white tracking-[0.55px] uppercase">
              New Escrow Offer
            </span>
          </button>
        </div>

        {!connected ? (
          <div className="flex flex-col gap-[16px] items-center justify-center py-[64px] text-center">
            <Wallet size={32} className="text-[#978da1]" />
            <p className="text-[#cec2d8]">Connect your wallet to see the offers you've created.</p>
            <button
              onClick={() => setVisible(true)}
              className="bg-gradient-to-r from-[#9945ff] to-[#00ec91] px-[20px] py-[10px] rounded-[12px] font-mono font-semibold text-[11px] text-white tracking-[0.55px] uppercase"
            >
              Connect Wallet
            </button>
          </div>
        ) : loading ? (
          <div className="text-center text-[#978da1] py-[48px]">Loading your offers...</div>
        ) : myOffers.length === 0 ? (
          <div className="flex flex-col gap-[8px] items-center justify-center py-[64px] text-center">
            <p className="text-[#cec2d8]">You don't have any open escrow offers yet.</p>
            <button
              onClick={() => setShowCreate(true)}
              className="font-mono text-[#d8b9ff] text-[12px] underline"
            >
              Create your first offer
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-[16px] w-full">
            {myOffers.map((offer) => (
              <MyOfferCard key={offer.publicKey.toBase58()} offer={offer} onCancelled={refresh} />
            ))}
          </div>
        )}
      </main>
      <Footer />

      {showCreate && (
        <CreateOfferModal onClose={() => setShowCreate(false)} onCreated={refresh} />
      )}
    </div>
  );
}
