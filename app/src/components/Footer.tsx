import Link from "next/link";
import Image from "next/image";
import { ShieldCheck } from "lucide-react";
import { ESCROW_PROGRAM_ID } from "@/lib/anchor/constants";

export function Footer() {
  return (
    <footer className="bg-[#0b0e14] w-full">
      <div className="flex flex-col max-w-[1280px] mx-auto px-[24px] py-[40px] w-full">
        <div className="flex gap-[40px] items-start justify-center pb-[24px] w-full flex-wrap">
          <div className="flex flex-col gap-[8px] items-start flex-1 min-w-[220px]">
            <div className="flex gap-[8px] items-center">
              <Image src="/escrow-swap-logo.png" alt="Escrow Swap" width={24} height={24} />
              <p className="font-semibold text-[#e1e2eb] text-[20px] tracking-[-0.2px]">
                Escrow Swap
              </p>
            </div>
            <p className="text-[#cec2d8] text-[12px] leading-[16px]">
              Trustless atomic peer-to-peer token swaps enforced by an
              auditable Solana PDA escrow program.
            </p>
            <div className="bg-[#191c22] flex gap-[4px] items-center px-[10px] py-[4px] rounded-full mt-[8px]">
              <ShieldCheck size={12} className="text-[#a0ffc3]" />
              <span className="font-mono text-[#a0ffc3] text-[11px]">
                Secured by On-Chain Program
              </span>
            </div>
          </div>

          <div className="flex flex-col gap-[4px] items-start flex-1 min-w-[160px]">
            <p className="font-mono font-semibold text-[#978da1] text-[11px] tracking-[0.66px] uppercase">
              Protocol
            </p>
            <Link href="/" className="text-[#cec2d8] text-[12px] hover:text-[#e1e2eb]">
              Escrow Marketplace
            </Link>
            <Link href="/my-offers" className="text-[#cec2d8] text-[12px] hover:text-[#e1e2eb]">
              My Offers
            </Link>
          </div>

          <div className="flex flex-col gap-[4px] items-start flex-1 min-w-[160px]">
            <p className="font-mono font-semibold text-[#978da1] text-[11px] tracking-[0.66px] uppercase">
              Program
            </p>
            <a
              href={`https://explorer.solana.com/address/${ESCROW_PROGRAM_ID}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="text-[#cec2d8] text-[12px] hover:text-[#e1e2eb]"
            >
              View on Solana Explorer
            </a>
            <a
              href="https://faucet.solana.com"
              target="_blank"
              rel="noreferrer"
              className="text-[#cec2d8] text-[12px] hover:text-[#e1e2eb]"
            >
              Devnet Faucet
            </a>
          </div>
        </div>

        <div className="flex items-center justify-between pt-[16px] w-full flex-wrap gap-[8px]">
          <p className="font-mono text-[#978da1] text-[11px]">
            Escrow Swap Protocol. Fully decentralized &amp; non-custodial.
          </p>
          <p className="font-mono text-[#978da1] text-[11px]">
            Network: Devnet
          </p>
        </div>
      </div>
    </footer>
  );
}
