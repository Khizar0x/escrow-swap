"use client";

import { Lock, Repeat, Sparkles, Plus } from "lucide-react";

export function Hero({
  openOffersCount,
  distinctMintsCount,
  myOffersCount,
  onCreateOffer,
}: {
  openOffersCount: number;
  distinctMintsCount: number;
  myOffersCount: number;
  onCreateOffer: () => void;
}) {
  return (
    <div className="flex flex-col gap-[24px] w-full">
      <div className="flex items-end justify-between w-full flex-wrap gap-[16px]">
        <div className="flex flex-col gap-[8px] items-start max-w-[768px]">
          <div className="bg-[#272a31] flex gap-[8px] items-center px-[12px] py-[4px] rounded-full">
            <span className="bg-[#a0ffc3] rounded-full size-[8px]" />
            <span className="font-mono font-semibold text-[#a0ffc3] text-[11px] tracking-[0.55px] uppercase">
              Zero Custodial Risk • PDA Anchor Escrow
            </span>
          </div>
          <h1 className="font-bold text-[#e1e2eb] text-[48px] leading-[56px] tracking-[-1.2px]">
            Trustless P2P Swaps via{" "}
            <span className="bg-clip-text bg-gradient-to-r from-[#d8b9ff] via-[#eddcff] to-[#a0ffc3] text-transparent">
              Solana Escrow
            </span>
          </h1>
          <p className="text-[#cec2d8] text-[16px] leading-[26px] tracking-[-0.08px] max-w-[672px]">
            Lock any SPL token into a non-custodial smart contract. Anyone can
            fulfill the exact maker terms, or the maker can cancel anytime
            with zero counterparty risk.
          </p>
        </div>
        <div className="flex gap-[8px] items-center">
          <button
            onClick={onCreateOffer}
            className="bg-gradient-to-r from-[#9945ff] via-[#7052ff] to-[#14f195] flex gap-[8px] items-center justify-center px-[24px] py-[14px] rounded-[12px] shadow-[0px_0px_28px_-6px_rgba(153,69,255,0.6)]"
          >
            <Plus size={16} className="text-[#0b0e14]" />
            <span className="font-bold text-[#0b0e14] text-[14px] tracking-[-0.35px]">
              Create Escrow Offer
            </span>
          </button>
        </div>
      </div>

      <div className="bg-[#191c22] flex gap-[16px] items-stretch justify-center p-[16px] rounded-[16px] w-full shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] flex-wrap">
        <StatTile
          icon={<Lock size={16} className="text-[#9945ff]" />}
          iconBg="bg-[rgba(153,69,255,0.2)]"
          label="Open Offers"
          value={String(openOffersCount)}
        />
        <StatTile
          icon={<Repeat size={16} className="text-[#00ec91]" />}
          iconBg="bg-[rgba(0,236,145,0.2)]"
          label="Distinct Mints"
          value={String(distinctMintsCount)}
        />
        <StatTile
          icon={<Sparkles size={16} className="text-[#0080a9]" />}
          iconBg="bg-[rgba(0,128,169,0.2)]"
          label="Your Offers"
          value={String(myOffersCount)}
        />
      </div>
    </div>
  );
}

function StatTile({
  icon,
  iconBg,
  label,
  value,
}: {
  icon: React.ReactNode;
  iconBg: string;
  label: string;
  value: string;
}) {
  return (
    <div className="bg-[#1d2026] flex gap-[16px] items-center p-[8px] rounded-[12px] flex-1 min-w-[220px]">
      <div className={`${iconBg} flex items-center justify-center rounded-[12px] size-[48px]`}>
        {icon}
      </div>
      <div className="flex flex-col items-start">
        <p className="font-mono font-semibold text-[#978da1] text-[11px] tracking-[0.55px] uppercase">
          {label}
        </p>
        <p className="font-mono font-semibold text-[#e1e2eb] text-[16px] tracking-[-0.32px]">
          {value}
        </p>
      </div>
    </div>
  );
}
