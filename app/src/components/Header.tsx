"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Copy, LogOut } from "lucide-react";
import { CLUSTER_LABEL, ESCROW_PROGRAM_ID } from "@/lib/anchor/constants";

function truncate(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function Header({
  active,
  myOffersCount,
  onCreateOffer,
}: {
  active: "marketplace" | "my-offers";
  myOffersCount: number;
  onCreateOffer?: () => void;
}) {
  const { connection } = useConnection();
  const { publicKey, disconnect, connected } = useWallet();
  const { setVisible } = useWalletModal();
  const [balance, setBalance] = useState<number | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!publicKey) {
      setBalance(null);
      return;
    }
    let cancelled = false;
    const load = async () => {
      try {
        const lamports = await connection.getBalance(publicKey);
        if (!cancelled) setBalance(lamports / 1e9);
      } catch {
        if (!cancelled) setBalance(null);
      }
    };
    load();
    const interval = setInterval(load, 15000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [publicKey, connection]);

  return (
    <div className="backdrop-blur-[12px] bg-[rgba(16,19,26,0.8)] flex flex-col items-start w-full shadow-[0px_1px_8px_0px_rgba(0,0,0,0.04)]">
      <div className="flex h-[64px] items-center justify-between max-w-[1280px] mx-auto px-[24px] w-full">
        <div className="flex gap-[16px] items-center">
          <Link href="/" className="flex gap-[8px] items-center">
            <Image
              src="/escrow-swap-logo.png"
              alt="Escrow Swap"
              width={32}
              height={32}
            />
            <div className="flex flex-col items-start">
              <p className="font-semibold text-[#e1e2eb] text-[20px] leading-[20px] tracking-[-0.5px]">
                Escrow Swap
              </p>
              <p className="font-mono font-medium text-[#978da1] text-[11px] leading-[13.75px]">
                Trustless P2P
              </p>
            </div>
          </Link>
          <div className="bg-[#272a31] flex items-center px-[8px] py-[2px] rounded-full">
            <p className="font-mono font-medium text-[#d8b9ff] text-[11px] leading-[14px]">
              {CLUSTER_LABEL}
            </p>
          </div>
        </div>

        <nav className="bg-[rgba(11,14,20,0.8)] flex gap-[4px] items-center p-[4px] rounded-[12px]">
          <Link
            href="/"
            className={`px-[16px] py-[6px] rounded-[8px] text-[16px] font-semibold ${
              active === "marketplace"
                ? "bg-[#9945ff] text-white shadow-[0px_0px_16px_-2px_rgba(153,69,255,0.4)]"
                : "text-[#cec2d8]"
            }`}
          >
            Marketplace
          </Link>
          {onCreateOffer ? (
            <button
              onClick={onCreateOffer}
              className="px-[16px] py-[6px] rounded-[8px] text-[14px] text-[#cec2d8] hover:text-[#e1e2eb]"
            >
              Create Escrow
            </button>
          ) : (
            <Link
              href="/"
              className="px-[16px] py-[6px] rounded-[8px] text-[14px] text-[#cec2d8] hover:text-[#e1e2eb]"
            >
              Create Escrow
            </Link>
          )}
          <Link
            href="/my-offers"
            className={`relative px-[16px] py-[6px] rounded-[8px] text-[14px] ${
              active === "my-offers"
                ? "bg-[#9945ff] text-white"
                : "text-[#cec2d8]"
            }`}
          >
            My Offers
            {myOffersCount > 0 && (
              <span className="ml-[6px] bg-[#272a31] text-[#a0ffc3] text-[10px] font-mono px-[6px] py-[2px] rounded-full">
                {myOffersCount}
              </span>
            )}
          </Link>
          <a
            href={`https://explorer.solana.com/address/${ESCROW_PROGRAM_ID}?cluster=devnet`}
            target="_blank"
            rel="noreferrer"
            className="px-[16px] py-[6px] rounded-[8px] text-[14px] text-[#cec2d8] hover:text-[#e1e2eb]"
          >
            Security &amp; Docs
          </a>
        </nav>

        <div className="flex gap-[8px] items-center">
          {connected && publicKey ? (
            <>
              <div className="bg-[#191c22] flex gap-[4px] items-center px-[12px] py-[6px] rounded-[12px]">
                <span className="font-mono font-medium text-[#978da1] text-[11px]">
                  BAL:
                </span>
                <span className="font-mono font-semibold text-[#56ffa8] text-[11px]">
                  {balance === null ? "..." : `${balance.toFixed(2)} SOL`}
                </span>
              </div>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(publicKey.toBase58());
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                }}
                className="bg-[#1d2026] flex gap-[6px] items-center px-[10px] py-[6px] rounded-[12px]"
              >
                <span className="bg-[#a0ffc3] rounded-full size-[8px]" />
                <span className="font-mono font-medium text-[#e1e2eb] text-[11px]">
                  {copied ? "Copied!" : truncate(publicKey.toBase58())}
                </span>
                <Copy size={11} className="text-[#978da1]" />
              </button>
              <button
                onClick={() => disconnect()}
                title="Disconnect"
                className="bg-[#d8b9ff] flex items-center justify-center rounded-full size-[32px]"
              >
                <LogOut size={14} className="text-[#0b0e14]" />
              </button>
            </>
          ) : (
            <button
              onClick={() => setVisible(true)}
              className="bg-gradient-to-r from-[#9945ff] to-[#00ec91] flex gap-[6px] items-center px-[16px] py-[8px] rounded-[12px]"
            >
              <span className="font-mono font-semibold text-[11px] text-white tracking-[0.55px]">
                CONNECT WALLET
              </span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
