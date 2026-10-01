"use client";

import { useState } from "react";
import { SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { ArrowLeftRight, Copy, Undo2, Loader2 } from "lucide-react";
import { useProgram } from "@/lib/anchor/program";
import { retryOnBlockhashError } from "@/lib/anchor/retry";
import { useToast } from "./Toast";
import { colorForMint, formatTokenAmount, truncateAddress } from "@/lib/format";
import type { OfferRow } from "./OfferCard";

export function MyOfferCard({ offer, onCancelled }: { offer: OfferRow; onCancelled: () => void }) {
  const { program, provider } = useProgram();
  const { pushToast } = useToast();
  const [confirming, setConfirming] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const colorA = colorForMint(offer.tokenMintA);
  const colorB = colorForMint(offer.tokenMintB);

  const vault = getAssociatedTokenAddressSync(
    offer.tokenMintA,
    offer.publicKey,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );

  const handleCancel = async () => {
    if (!program || !provider?.publicKey) return;
    setSubmitting(true);
    try {
      const maker = provider.publicKey;
      const makerTokenAccountA = getAssociatedTokenAddressSync(offer.tokenMintA, maker);

      const sig = await retryOnBlockhashError(() =>
        program.methods
          .cancelOffer()
          .accountsPartial({
            maker,
            tokenMintA: offer.tokenMintA,
            offer: offer.publicKey,
            makerTokenAccountA,
            vault,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
      );

      pushToast({
        kind: "success",
        title: "Offer cancelled",
        message: `${formatTokenAmount(offer.amountA, offer.decimalsA)} refunded to your wallet.`,
        signature: sig,
      });
      onCancelled();
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Cancel failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
      setConfirming(false);
    }
  };

  return (
    <div className="bg-[#1d2026] flex flex-col items-start overflow-hidden p-[24px] relative rounded-[12px] shadow-[0px_4px_6px_-1px_rgba(0,0,0,0.1),0px_2px_4px_-2px_rgba(0,0,0,0.1)] w-full">
      <div className="absolute bg-[#56ffa8] bottom-0 left-0 top-0 w-[6px]" />
      <div className="flex items-center justify-between w-full flex-wrap gap-[16px]">
        <div className="flex flex-[2] gap-[24px] items-center min-w-[280px] flex-wrap">
          <div className="flex flex-col gap-[2px] items-start min-w-[180px]">
            <div className="bg-[rgba(0,236,145,0.2)] flex gap-[8px] items-center px-[10px] py-[4px] rounded-full">
              <span className="bg-[#56ffa8] rounded-full shadow-[0px_0px_8px_0px_rgba(86,255,168,0.8)] size-[8px]" />
              <span className="font-mono font-semibold text-[#56ffa8] text-[11px]">
                Open &amp; Awaiting Taker
              </span>
            </div>
            <div className="flex gap-[4px] items-center pt-[6px]">
              <span className="font-mono text-[#978da1] text-[11px]">PDA:</span>
              <span className="font-mono text-[#d8b9ff] text-[11px]">
                {truncateAddress(offer.publicKey.toBase58())}
              </span>
              <button
                onClick={() => navigator.clipboard.writeText(offer.publicKey.toBase58())}
                className="text-[#978da1]"
              >
                <Copy size={11} />
              </button>
            </div>
            <span className="font-mono text-[#978da1] text-[11px]">
              Offer ID: {offer.offerId.toString()}
            </span>
          </div>

          <div className="flex flex-1 gap-[16px] items-center min-w-[280px]">
            <div className="bg-[#0b0e14] flex flex-col gap-[2px] flex-1 p-[12px] rounded-[8px]">
              <span className="font-mono font-semibold text-[#978da1] text-[11px] tracking-[0.66px] uppercase">
                You Locked
              </span>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#e1e2eb] text-[20px]">
                  {formatTokenAmount(offer.amountA, offer.decimalsA)}
                </span>
                <span className={`${colorA.bg} ${colorA.text} px-[8px] py-[2px] rounded-[4px] font-mono text-[11px]`}>
                  {truncateAddress(offer.tokenMintA.toBase58())}
                </span>
              </div>
            </div>
            <div className="bg-[#272a31] flex items-center justify-center rounded-full shrink-0 size-[32px]">
              <ArrowLeftRight size={14} className="text-[#cec2d8]" />
            </div>
            <div className="bg-[#0b0e14] flex flex-col gap-[2px] flex-1 p-[12px] rounded-[8px]">
              <span className="font-mono font-semibold text-[#978da1] text-[11px] tracking-[0.66px] uppercase">
                Demanded Return
              </span>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#56ffa8] text-[20px]">
                  {formatTokenAmount(offer.amountB, offer.decimalsB)}
                </span>
                <span className={`${colorB.bg} ${colorB.text} px-[8px] py-[2px] rounded-[4px] font-mono text-[11px]`}>
                  {truncateAddress(offer.tokenMintB.toBase58())}
                </span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-end">
          {confirming ? (
            <div className="flex gap-[8px] items-center">
              <button
                onClick={() => setConfirming(false)}
                className="font-mono text-[#978da1] text-[11px] px-[12px] py-[10px]"
              >
                Keep offer
              </button>
              <button
                onClick={handleCancel}
                disabled={submitting}
                className="bg-[rgba(147,0,10,0.3)] disabled:opacity-50 flex gap-[8px] items-center justify-center px-[16px] py-[10px] rounded-[12px]"
              >
                {submitting ? (
                  <Loader2 size={14} className="text-[#ffb4ab] animate-spin" />
                ) : (
                  <Undo2 size={14} className="text-[#ffb4ab]" />
                )}
                <span className="font-mono font-semibold text-[#ffb4ab] text-[11px] tracking-[0.55px] uppercase">
                  Confirm Cancel
                </span>
              </button>
            </div>
          ) : (
            <button
              onClick={() => setConfirming(true)}
              className="bg-[rgba(147,0,10,0.2)] flex gap-[8px] items-center justify-center px-[16px] py-[10px] rounded-[12px]"
            >
              <Undo2 size={12} className="text-[#ffb4ab]" />
              <span className="font-mono font-semibold text-[#ffb4ab] text-[11px] tracking-[0.55px] uppercase">
                Cancel &amp; Claim {formatTokenAmount(offer.amountA, offer.decimalsA)}
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
