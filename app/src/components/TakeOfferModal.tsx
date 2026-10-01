"use client";

import { useState } from "react";
import { ShieldCheck, ArrowLeftRight, Zap, User, Wallet, Fuel, GitCompareArrows, X } from "lucide-react";
import { SystemProgram } from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { useProgram } from "@/lib/anchor/program";
import { retryOnBlockhashError } from "@/lib/anchor/retry";
import { useToast } from "./Toast";
import { formatTokenAmount, truncateAddress } from "@/lib/format";
import type { OfferRow } from "./OfferCard";
import { ESCROW_PROGRAM_ID } from "@/lib/anchor/constants";

export function TakeOfferModal({
  offer,
  vault,
  onClose,
  onTaken,
}: {
  offer: OfferRow;
  vault: import("@solana/web3.js").PublicKey;
  onClose: () => void;
  onTaken: () => void;
}) {
  const { program, provider } = useProgram();
  const { pushToast } = useToast();
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!program || !provider?.publicKey) return;
    setSubmitting(true);
    try {
      const taker = provider.publicKey;
      const takerTokenAccountA = getAssociatedTokenAddressSync(offer.tokenMintA, taker);
      const takerTokenAccountB = getAssociatedTokenAddressSync(offer.tokenMintB, taker);
      const makerTokenAccountB = getAssociatedTokenAddressSync(offer.tokenMintB, offer.maker);

      const sig = await retryOnBlockhashError(() =>
        program.methods
          .takeOffer()
          .accountsPartial({
            taker,
            maker: offer.maker,
            tokenMintA: offer.tokenMintA,
            tokenMintB: offer.tokenMintB,
            offer: offer.publicKey,
            vault,
            takerTokenAccountA,
            takerTokenAccountB,
            makerTokenAccountB,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
      );

      pushToast({
        kind: "success",
        title: "Swap executed!",
        message: `You received ${formatTokenAmount(offer.amountA, offer.decimalsA)} of the escrowed token.`,
        signature: sig,
      });
      onTaken();
      onClose();
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Take offer failed",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-[16px]">
      <div className="relative bg-[#272a31] flex flex-col gap-[16px] max-h-[90vh] overflow-y-auto p-[24px] rounded-[12px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)] w-full max-w-[512px]">
        <button onClick={onClose} className="absolute right-[16px] top-[16px] text-[#978da1] z-10">
          <X size={18} />
        </button>
        <div className="flex flex-col gap-[8px] items-start w-full">
          <div className="flex items-center justify-between w-full pr-[24px]">
            <div className="flex gap-[8px] items-center">
              <ShieldCheck size={22} className="text-[#a0ffc3]" />
              <h2 className="font-semibold text-[#e1e2eb] text-[22px] tracking-[-0.6px]">
                Confirm Take &amp; Swap
              </h2>
            </div>
            <span className="bg-[#0b0e14] px-[10px] py-[4px] rounded-full font-mono text-[#cec2d8] text-[11px]">
              Offer #{offer.offerId.toString()}
            </span>
          </div>
          <div className="bg-[#0b0e14] flex gap-[8px] items-center px-[12px] py-[8px] rounded-[8px] w-full">
            <ShieldCheck size={14} className="text-[#d8b9ff] shrink-0" />
            <div className="flex flex-col">
              <span className="font-mono font-semibold text-[#e1e2eb] text-[11px]">
                Verified Solana Escrow Program
              </span>
              <span className="font-mono text-[#d8b9ff] text-[11px]">
                {truncateAddress(ESCROW_PROGRAM_ID)}
              </span>
            </div>
          </div>
        </div>

        <div className="bg-[#0b0e14] flex gap-[8px] items-center px-[16px] py-[24px] rounded-[12px] w-full flex-wrap justify-center">
          <div className="bg-[#1d2026] flex flex-col gap-[4px] p-[16px] rounded-[8px] flex-1 min-w-[150px]">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-[#cec2d8] text-[11px] tracking-[0.66px]">
                YOU PAY
              </span>
              <span className="font-mono text-[#d8b9ff] text-[11px]">From Wallet</span>
            </div>
            <p className="font-semibold text-[#e1e2eb] text-[28px] tracking-[-0.9px] truncate">
              {formatTokenAmount(offer.amountB, offer.decimalsB)}
            </p>
            <span className="font-mono text-[#75d1ff] text-[11px]">
              {truncateAddress(offer.tokenMintB.toBase58())}
            </span>
          </div>

          <div className="flex flex-col items-center p-[4px]">
            <div className="bg-[#272a31] flex items-center justify-center rounded-full size-[40px]">
              <ArrowLeftRight size={18} className="text-[#a0ffc3]" />
            </div>
            <span className="font-mono font-semibold text-[#a0ffc3] text-[10px] tracking-[1px] uppercase mt-[8px]">
              1-TX Atomic
            </span>
          </div>

          <div className="bg-[#1d2026] flex flex-col gap-[4px] p-[16px] rounded-[8px] flex-1 min-w-[150px]">
            <div className="flex items-center justify-between">
              <span className="font-mono font-semibold text-[#cec2d8] text-[11px] tracking-[0.66px]">
                YOU RECEIVE
              </span>
              <span className="font-mono text-[#a0ffc3] text-[11px]">Instant</span>
            </div>
            <p className="font-semibold text-[#56ffa8] text-[28px] tracking-[-0.9px] truncate">
              {formatTokenAmount(offer.amountA, offer.decimalsA)}
            </p>
            <span className="font-mono text-[#d8b9ff] text-[11px]">
              {truncateAddress(offer.tokenMintA.toBase58())}
            </span>
          </div>
        </div>

        <div className="bg-[rgba(29,32,38,0.6)] flex gap-[8px] items-start px-[12px] py-[8px] rounded-[8px] w-full">
          <Zap size={14} className="text-[#a0ffc3] shrink-0 mt-[2px]" />
          <p className="text-[#e1e2eb] text-[12px]">
            <span className="font-medium">Atomic trade execution:</span>{" "}
            <span className="text-[#cec2d8]">
              both transfers happen in one transaction. If either fails, nothing moves.
            </span>
          </p>
        </div>

        <div className="bg-[#0b0e14] flex flex-col gap-[10px] px-[16px] pt-[16px] pb-[24px] rounded-[12px] w-full">
          <DetailRow icon={User} label="Maker Counterparty" value={truncateAddress(offer.maker.toBase58())} />
          <DetailRow icon={Wallet} label="Escrow Vault PDA" value={truncateAddress(vault.toBase58())} valueClass="text-[#d8b9ff]" />
          <DetailRow icon={Fuel} label="Solana Network Fee" value="~0.000005 SOL" />
          <DetailRow icon={GitCompareArrows} label="Contract Slippage" value="0.00% (fixed terms)" valueClass="text-[#a0ffc3]" />
        </div>

        <button
          onClick={handleConfirm}
          disabled={submitting}
          className="bg-gradient-to-r from-[#9945ff] via-[#7f21e5] to-[#00ec91] disabled:opacity-40 flex gap-[8px] h-[48px] items-center justify-center rounded-[12px] shadow-[0px_10px_15px_-3px_rgba(0,0,0,0.1)] w-full"
        >
          <Zap size={16} className="text-white" />
          <span className="font-mono font-semibold text-[11px] text-white tracking-[0.55px] uppercase">
            {submitting ? "Confirming..." : "Confirm & Take Offer"}
          </span>
        </button>
      </div>
    </div>
  );
}

function DetailRow({
  icon: Icon,
  label,
  value,
  valueClass = "text-[#e1e2eb]",
}: {
  icon: typeof User;
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <div className="flex gap-[4px] items-center">
        <Icon size={13} className="text-[#cec2d8]" />
        <span className="text-[#cec2d8] text-[12px]">{label}</span>
      </div>
      <span className={`font-mono text-[11px] ${valueClass}`}>{value}</span>
    </div>
  );
}
