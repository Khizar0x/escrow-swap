import { PublicKey } from "@solana/web3.js";
import * as anchor from "@coral-xyz/anchor";

export function truncateAddress(address: string): string {
  return `${address.slice(0, 4)}...${address.slice(-4)}`;
}

const TOKEN_COLORS = [
  { bg: "bg-[rgba(0,236,145,0.2)]", text: "text-[#a0ffc3]", dot: "bg-[#14f195]" },
  { bg: "bg-[rgba(39,117,202,0.2)]", text: "text-[#2775ca]", dot: "bg-[#2775ca]" },
  { bg: "bg-[rgba(243,156,18,0.2)]", text: "text-[#f39c12]", dot: "bg-[#f39c12]" },
  { bg: "bg-[rgba(59,178,233,0.2)]", text: "text-[#3bb2e9]", dot: "bg-[#3bb2e9]" },
  { bg: "bg-[rgba(232,62,140,0.2)]", text: "text-[#e83e8c]", dot: "bg-[#e83e8c]" },
  { bg: "bg-[rgba(216,185,255,0.2)]", text: "text-[#d8b9ff]", dot: "bg-[#d8b9ff]" },
];

export function colorForMint(mint: PublicKey | string) {
  const key = typeof mint === "string" ? mint : mint.toBase58();
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) & 0xffffffff;
  }
  const idx = Math.abs(hash) % TOKEN_COLORS.length;
  return TOKEN_COLORS[idx];
}

export function formatTokenAmount(amount: anchor.BN, decimals: number): string {
  const divisor = new anchor.BN(10).pow(new anchor.BN(decimals));
  const whole = amount.div(divisor);
  const frac = amount.mod(divisor);
  if (frac.isZero()) return whole.toString();
  const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
  return `${whole.toString()}.${fracStr || "0"}`;
}
