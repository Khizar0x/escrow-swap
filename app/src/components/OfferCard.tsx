"use client";

import { ArrowDownUp, Copy } from "lucide-react";
import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import { colorForMint, formatTokenAmount, truncateAddress } from "@/lib/format";

export interface OfferRow {
  publicKey: PublicKey;
  offerId: anchor.BN;
  maker: PublicKey;
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  amountA: anchor.BN;
  amountB: anchor.BN;
  decimalsA: number;
  decimalsB: number;
}

export function OfferCard({
  offer,
  isOwn,
  onTake,
}: {
  offer: OfferRow;
  isOwn: boolean;
  onTake: () => void;
}) {
  const colorA = colorForMint(offer.tokenMintA);
  const colorB = colorForMint(offer.tokenMintB);

  return (
    <article className="bg-[#191c22] flex flex-col items-start justify-between overflow-hidden p-[16px] rounded-[16px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)]">
      <div className="flex flex-col gap-[16px] items-start w-full">
        <div className="flex items-center justify-between w-full">
          <div className="bg-[rgba(160,255,195,0.1)] flex gap-[4px] items-center px-[8px] py-[2px] rounded-full">
            <span className="font-mono font-semibold text-[#a0ffc3] text-[10px]">
              SPL Token
            </span>
          </div>
          <span className="font-mono text-[#978da1] text-[11px]">
            #{offer.offerId.toString()}
          </span>
        </div>

        <div className="bg-[#0b0e14] flex items-center justify-between p-[12px] rounded-[12px] w-full">
          <div className="flex flex-col items-start">
            <p className="font-mono font-semibold text-[#978da1] text-[11px] tracking-[0.66px] uppercase">
              Maker Offers
            </p>
            <p className="font-mono font-semibold text-[#e1e2eb] text-[16px] tracking-[-0.4px]">
              {formatTokenAmount(offer.amountA, offer.decimalsA)}
            </p>
            <p className="font-mono text-[#978da1] text-[11px]">
              {truncateAddress(offer.tokenMintA.toBase58())}
            </p>
          </div>
          <div
            className={`${colorA.bg} flex items-center justify-center rounded-full size-[40px]`}
          >
            <span className={`font-mono font-semibold ${colorA.text} text-[10px]`}>
              {offer.tokenMintA.toBase58().slice(0, 3)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-center relative w-full">
          <div className="absolute flex items-center inset-0 justify-center">
            <div className="bg-[#32353c] flex-1 h-px" />
          </div>
          <div className="bg-[#272a31] flex gap-[4px] items-center px-[12px] py-[4px] relative rounded-full">
            <ArrowDownUp size={10} className="text-[#978da1]" />
            <span className="font-mono text-[#978da1] text-[10px] tracking-[0.5px] uppercase">
              Swapping For
            </span>
          </div>
        </div>

        <div className="bg-[#0b0e14] flex items-center justify-between p-[12px] rounded-[12px] w-full">
          <div className="flex flex-col items-start">
            <p className="font-mono font-semibold text-[#978da1] text-[11px] tracking-[0.66px] uppercase">
              Maker Wants
            </p>
            <p className="font-mono font-semibold text-[#56ffa8] text-[16px] tracking-[-0.4px]">
              {formatTokenAmount(offer.amountB, offer.decimalsB)}
            </p>
            <p className="font-mono text-[#978da1] text-[11px]">
              {truncateAddress(offer.tokenMintB.toBase58())}
            </p>
          </div>
          <div
            className={`${colorB.bg} flex items-center justify-center rounded-full size-[40px]`}
          >
            <span className={`font-mono font-semibold ${colorB.text} text-[10px]`}>
              {offer.tokenMintB.toBase58().slice(0, 3)}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between pt-[4px] w-full">
          <div className="flex gap-[4px] items-center">
            <span className="font-mono text-[#978da1] text-[11px]">Maker:</span>
            <span className="font-mono text-[#e1e2eb] text-[11px]">
              {truncateAddress(offer.maker.toBase58())}
            </span>
            <button
              onClick={() => navigator.clipboard.writeText(offer.maker.toBase58())}
              className="text-[#978da1]"
            >
              <Copy size={10} />
            </button>
          </div>
          <div className="bg-[#1d2026] px-[8px] py-[2px] rounded-[4px]">
            <span className="font-mono text-[#75d1ff] text-[11px]">
              PDA: {truncateAddress(offer.publicKey.toBase58())}
            </span>
          </div>
        </div>
      </div>

      <div className="flex flex-col items-start pt-[20px] w-full">
        {isOwn ? (
          <div className="bg-[#272a31] flex items-center justify-center py-[10px] rounded-[12px] w-full">
            <span className="font-mono font-semibold text-[11px] text-[#cec2d8] tracking-[0.55px] uppercase">
              Your Offer
            </span>
          </div>
        ) : (
          <button
            onClick={onTake}
            className="bg-[#9945ff] flex gap-[8px] items-center justify-center py-[10px] rounded-[12px] shadow-[0px_0px_16px_-4px_rgba(153,69,255,0.4)] w-full"
          >
            <span className="font-mono font-semibold text-[11px] text-white tracking-[0.55px] uppercase">
              Take Offer
            </span>
          </button>
        )}
      </div>
    </article>
  );
}
