"use client";

import { useEffect, useState } from "react";
import { X, ShieldCheck, ArrowDownUp, Lock, Info } from "lucide-react";
import { PublicKey, SystemProgram } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  getAccount,
  getAssociatedTokenAddressSync,
  getMint,
} from "@solana/spl-token";
import { useProgram, offerPda } from "@/lib/anchor/program";
import { retryOnBlockhashError } from "@/lib/anchor/retry";
import { useToast } from "./Toast";
import { truncateAddress } from "@/lib/format";

async function resolveMint(connection: anchor.web3.Connection, mint: PublicKey) {
  try {
    const info = await getMint(connection, mint, "confirmed", TOKEN_PROGRAM_ID);
    return { decimals: info.decimals, programId: TOKEN_PROGRAM_ID };
  } catch {
    const info = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
    return { decimals: info.decimals, programId: TOKEN_2022_PROGRAM_ID };
  }
}

function toBaseUnits(humanAmount: string, decimals: number): anchor.BN {
  const [whole, frac = ""] = humanAmount.trim().split(".");
  const fracPadded = frac.padEnd(decimals, "0").slice(0, decimals);
  const combined = `${whole || "0"}${fracPadded}`;
  return new anchor.BN(combined || "0");
}

export function CreateOfferModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const { program, provider, connection, isConnected } = useProgram();
  const { pushToast } = useToast();

  const [mintA, setMintA] = useState("");
  const [amountA, setAmountA] = useState("");
  const [mintB, setMintB] = useState("");
  const [amountB, setAmountB] = useState("");
  const [balanceA, setBalanceA] = useState<string | null>(null);
  const [decimalsA, setDecimalsA] = useState<number | null>(null);
  const [decimalsB, setDecimalsB] = useState<number | null>(null);
  const [mintAError, setMintAError] = useState<string | null>(null);
  const [mintBError, setMintBError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    if (!mintA) {
      setDecimalsA(null);
      setBalanceA(null);
      setMintAError(null);
      return;
    }
    (async () => {
      try {
        const mintKey = new PublicKey(mintA);
        const { decimals, programId } = await resolveMint(connection, mintKey);
        if (cancelled) return;
        setDecimalsA(decimals);
        setMintAError(null);
        if (provider?.publicKey) {
          try {
            const ata = getAssociatedTokenAddressSync(
              mintKey,
              provider.publicKey,
              false,
              programId,
              ASSOCIATED_TOKEN_PROGRAM_ID
            );
            const account = await getAccount(connection, ata, "confirmed", programId);
            if (!cancelled) {
              setBalanceA(
                (Number(account.amount) / 10 ** decimals).toLocaleString(undefined, {
                  maximumFractionDigits: decimals,
                })
              );
            }
          } catch {
            if (!cancelled) setBalanceA("0");
          }
        }
      } catch {
        if (!cancelled) {
          setDecimalsA(null);
          setBalanceA(null);
          setMintAError("Not a valid mint on this cluster");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mintA, connection, provider?.publicKey]);

  useEffect(() => {
    let cancelled = false;
    if (!mintB) {
      setDecimalsB(null);
      setMintBError(null);
      return;
    }
    (async () => {
      try {
        const mintKey = new PublicKey(mintB);
        const { decimals } = await resolveMint(connection, mintKey);
        if (!cancelled) {
          setDecimalsB(decimals);
          setMintBError(null);
        }
      } catch {
        if (!cancelled) {
          setDecimalsB(null);
          setMintBError("Not a valid mint on this cluster");
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [mintB, connection]);

  const canSubmit =
    isConnected &&
    decimalsA !== null &&
    decimalsB !== null &&
    Number(amountA) > 0 &&
    Number(amountB) > 0 &&
    !submitting;

  const handleSubmit = async () => {
    if (!program || !provider?.publicKey || decimalsA === null || decimalsB === null) return;
    setSubmitting(true);
    try {
      const maker = provider.publicKey;
      const mintAKey = new PublicKey(mintA);
      const mintBKey = new PublicKey(mintB);
      const offerId = new anchor.BN(Date.now());
      const amountABn = toBaseUnits(amountA, decimalsA);
      const amountBBn = toBaseUnits(amountB, decimalsB);

      const offer = offerPda(program.programId, maker, offerId);
      const vault = getAssociatedTokenAddressSync(
        mintAKey,
        offer,
        true,
        TOKEN_PROGRAM_ID,
        ASSOCIATED_TOKEN_PROGRAM_ID
      );
      const makerTokenAccountA = getAssociatedTokenAddressSync(mintAKey, maker);

      const sig = await retryOnBlockhashError(() =>
        program.methods
          .makeOffer(offerId, amountABn, amountBBn)
          .accountsPartial({
            maker,
            tokenMintA: mintAKey,
            tokenMintB: mintBKey,
            makerTokenAccountA,
            offer,
            vault,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .rpc()
      );

      pushToast({
        kind: "success",
        title: "Offer created!",
        message: "Your tokens are now locked in the escrow vault.",
        signature: sig,
      });
      onCreated();
      onClose();
    } catch (err) {
      pushToast({
        kind: "error",
        title: "Failed to create offer",
        message: err instanceof Error ? err.message : "Unknown error",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-[16px]">
      <div className="bg-[#10131c] border border-[#1f2536] rounded-[20px] w-full max-w-[896px] max-h-[90vh] overflow-y-auto">
        <div className="border-[#1f2536] border-b flex items-start justify-between pb-[17px] pt-[24px] px-[32px]">
          <div className="flex flex-col gap-[4px] items-start">
            <div className="flex gap-[8px] items-center">
              <div className="bg-[#1b2030] border border-[#2b334a] flex gap-[6px] items-center px-[11px] py-[3px] rounded-full">
                <Lock size={11} className="text-[#d8b9ff]" />
                <span className="font-mono text-[#d8b9ff] text-[12px]">Escrow v1</span>
              </div>
              <div className="flex gap-[4px] items-center">
                <span className="bg-[#56ffa8] rounded-full size-[6px]" />
                <span className="font-mono text-[#56ffa8] text-[12px]">Non-Custodial</span>
              </div>
            </div>
            <h2 className="font-bold text-[#e1e2eb] text-[24px] tracking-[-0.6px]">
              Create Escrow Swap Offer
            </h2>
            <p className="text-[#cec2d8] text-[14px]">
              Deposit assets securely into an on-chain vault until a taker fulfills your terms.
            </p>
          </div>
          <button onClick={onClose} className="text-[#978da1]">
            <X size={20} />
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr] gap-[32px] p-[32px]">
          <div className="flex flex-col gap-[16px] items-start">
            <div className="bg-[#181d2c] border border-[#262e45] flex flex-col gap-[8px] p-[17px] rounded-[12px] w-full">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-[#978da1] text-[11px] tracking-[0.55px] uppercase">
                  You Deposit (Token A — Maker)
                </span>
                {balanceA && (
                  <span className="font-mono text-[#e1e2eb] text-[12px]">
                    Balance: {balanceA}
                  </span>
                )}
              </div>
              <input
                value={mintA}
                onChange={(e) => setMintA(e.target.value.trim())}
                placeholder="Token A mint address"
                className="bg-[#0d101a] border border-[#2b334c] rounded-[8px] font-mono text-[12px] text-[#e1e2eb] px-[12px] py-[8px] outline-none w-full"
              />
              {mintAError && <p className="text-[#ff6b6b] text-[11px]">{mintAError}</p>}
              <input
                value={amountA}
                onChange={(e) => setAmountA(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
                className="bg-transparent font-bold text-[#e1e2eb] text-[24px] outline-none w-full"
              />
            </div>

            <div className="bg-[#1e2436] border border-[#2f3954] flex items-center justify-center rounded-full size-[32px] self-center">
              <ArrowDownUp size={14} className="text-[#d8b9ff]" />
            </div>

            <div className="bg-[#181d2c] border border-[#262e45] flex flex-col gap-[8px] p-[17px] rounded-[12px] w-full">
              <div className="flex items-center justify-between">
                <span className="font-mono font-semibold text-[#978da1] text-[11px] tracking-[0.55px] uppercase">
                  You Receive (Token B — Demanded)
                </span>
                <span className="font-mono text-[#56ffa8] text-[12px]">
                  Required to unlock escrow
                </span>
              </div>
              <input
                value={mintB}
                onChange={(e) => setMintB(e.target.value.trim())}
                placeholder="Token B mint address"
                className="bg-[#0d101a] border border-[#2b334c] rounded-[8px] font-mono text-[12px] text-[#e1e2eb] px-[12px] py-[8px] outline-none w-full"
              />
              {mintBError && <p className="text-[#ff6b6b] text-[11px]">{mintBError}</p>}
              <input
                value={amountB}
                onChange={(e) => setAmountB(e.target.value)}
                placeholder="0.0"
                inputMode="decimal"
                className="bg-transparent font-bold text-[#e1e2eb] text-[24px] outline-none w-full"
              />
              {Number(amountA) > 0 && Number(amountB) > 0 && (
                <p className="font-mono text-[#a0ffc3] text-[12px]">
                  Rate: 1 {truncateAddress(mintA || "mint A")} ={" "}
                  {(Number(amountB) / Number(amountA)).toLocaleString(undefined, {
                    maximumFractionDigits: 6,
                  })}{" "}
                  {truncateAddress(mintB || "mint B")}
                </p>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-[16px] justify-between">
            <div className="bg-[#151926] border border-[#232a3d] flex flex-col gap-[14px] p-[21px] rounded-[12px] w-full">
              <div className="border-[#232a3d] border-b flex items-center justify-between pb-[9px] w-full">
                <span className="font-mono font-semibold text-[#978da1] text-[12px] tracking-[0.6px] uppercase">
                  Terms Summary
                </span>
              </div>
              <div className="flex flex-col gap-[10px] w-full">
                <Row
                  label="Locking in PDA"
                  value={amountA ? `${amountA} ${truncateAddress(mintA || "")}` : "—"}
                />
                <Row
                  label="Counterparty Pays"
                  value={amountB ? `${amountB} ${truncateAddress(mintB || "")}` : "—"}
                  valueClass="text-[#a0ffc3]"
                />
                <div className="bg-[#232a3d] h-px w-full" />
                <Row label="Vault ATA Rent" value="~0.00204 SOL (refundable)" />
                <Row label="Protocol Fee" value="0.00% (free)" valueClass="text-[#56ffa8]" />
                <Row label="Cancel Window" value="Anytime before taken" valueClass="text-[#75d1ff]" />
              </div>
              <div className="bg-[#0c101a] border border-[#1f283d] flex gap-[8px] items-center p-[11px] rounded-[8px] w-full">
                <ShieldCheck size={16} className="text-[#a0ffc3] shrink-0" />
                <span className="font-mono text-[#cec2d8] text-[11px]">
                  Deterministic PDA vault enforcement
                </span>
              </div>
            </div>

            <div className="bg-[#121824] border border-[#202738] flex gap-[10px] p-[15px] rounded-[12px] w-full">
              <Info size={16} className="text-[#75d1ff] shrink-0 mt-[2px]" />
              <p className="text-[#cec2d8] text-[12px] leading-[19.5px]">
                Assets stay locked in a Program Derived Address. You retain cancel
                authority with full restitution up until a taker fulfills this offer.
              </p>
            </div>
          </div>
        </div>

        <div className="bg-[#0e111a] border-[#1f2536] border-t flex items-center justify-between py-[20px] px-[32px] flex-wrap gap-[12px]">
          <button onClick={onClose} className="font-mono text-[#978da1] text-[12px]">
            Cancel &amp; Return
          </button>
          <div className="flex flex-col gap-[4px] items-end">
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="bg-gradient-to-r from-[#9945ff] via-[#7f21e5] to-[#00ec91] disabled:opacity-40 flex gap-[8px] items-center justify-center px-[28px] py-[12px] rounded-[12px] shadow-[0px_0px_24px_-4px_rgba(153,69,255,0.45)]"
            >
              <Lock size={14} className="text-white" />
              <span className="font-mono font-semibold text-[12px] text-white tracking-[0.6px]">
                {submitting
                  ? "CREATING..."
                  : !isConnected
                  ? "CONNECT WALLET FIRST"
                  : `CREATE ESCROW & DEPOSIT ${amountA || "0"}`}
              </span>
            </button>
            <p className="font-mono text-[#978da1] text-[10px]">
              Non-custodial: funds locked until taken or cancelled by you
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  valueClass = "text-[#e1e2eb]",
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div className="flex items-center justify-between w-full">
      <span className="text-[#cec2d8] text-[12px]">{label}</span>
      <span className={`font-mono font-semibold text-[12px] ${valueClass}`}>{value}</span>
    </div>
  );
}
