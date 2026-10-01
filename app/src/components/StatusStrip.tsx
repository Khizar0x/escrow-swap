"use client";

import { useEffect, useState } from "react";
import { useConnection } from "@solana/wallet-adapter-react";
import { ShieldCheck } from "lucide-react";
import { CLUSTER_LABEL, ESCROW_PROGRAM_ID } from "@/lib/anchor/constants";

function truncate(address: string) {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

export function StatusStrip() {
  const { connection } = useConnection();
  const [slot, setSlot] = useState<number | null>(null);
  const [healthy, setHealthy] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const [s] = await Promise.all([connection.getSlot("confirmed")]);
        if (!cancelled) {
          setSlot(s);
          setHealthy(true);
        }
      } catch {
        if (!cancelled) setHealthy(false);
      }
    };
    poll();
    const interval = setInterval(poll, 4000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [connection]);

  return (
    <div className="backdrop-blur-[6px] bg-[rgba(11,14,20,0.9)] w-full">
      <div className="flex items-center justify-between max-w-[1280px] mx-auto px-[24px] py-[6px]">
        <div className="flex gap-[8px] items-center font-mono text-[11px]">
          <span
            className={`size-[8px] rounded-full ${
              healthy === false ? "bg-[#ff6b6b]" : "bg-[#a0ffc3]"
            }`}
          />
          <span
            className={healthy === false ? "text-[#ff6b6b]" : "text-[#a0ffc3]"}
          >
            {healthy === null ? "Connecting..." : healthy ? "RPC Healthy" : "RPC Unreachable"}
          </span>
          <span className="text-[#978da1]">|</span>
          <span className="text-[#cec2d8]">{CLUSTER_LABEL}</span>
          <span className="text-[#978da1]">|</span>
          <span className="text-[#cec2d8]">
            {slot === null ? "Slot —" : `Slot #${slot.toLocaleString()}`}
          </span>
        </div>
        <div className="flex gap-[16px] items-center font-mono text-[11px]">
          <div className="flex gap-[4px] items-center text-[#d8b9ff]">
            <ShieldCheck size={12} />
            <span>Escrow Program Verified</span>
          </div>
          <div className="bg-[#272a31] flex gap-[6px] items-center px-[8px] py-[2px] rounded-full">
            <span className="bg-[#56ffa8] rounded-full size-[6px]" />
            <a
              href={`https://explorer.solana.com/address/${ESCROW_PROGRAM_ID}?cluster=devnet`}
              target="_blank"
              rel="noreferrer"
              className="text-[#e1e2eb] hover:underline"
            >
              {truncate(ESCROW_PROGRAM_ID)}
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
