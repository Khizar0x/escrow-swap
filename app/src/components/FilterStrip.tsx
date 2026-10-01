"use client";

import { Search, ChevronDown } from "lucide-react";
import { colorForMint, truncateAddress } from "@/lib/format";

export type SortOrder = "id-desc" | "id-asc";

export function FilterStrip({
  search,
  onSearchChange,
  mints,
  selectedMint,
  onSelectMint,
  sortOrder,
  onSortChange,
}: {
  search: string;
  onSearchChange: (value: string) => void;
  mints: string[];
  selectedMint: string | null;
  onSelectMint: (mint: string | null) => void;
  sortOrder: SortOrder;
  onSortChange: (order: SortOrder) => void;
}) {
  return (
    <div className="backdrop-blur-[6px] bg-[rgba(39,42,49,0.6)] flex items-center justify-between p-[16px] rounded-[16px] flex-wrap gap-[12px]">
      <div className="relative flex-1 min-w-[260px]">
        <Search
          size={15}
          className="absolute left-[14px] top-1/2 -translate-y-1/2 text-[#978da1]"
        />
        <input
          value={search}
          onChange={(e) => onSearchChange(e.target.value)}
          placeholder="Filter by Maker wallet or Mint address..."
          className="bg-[#0b0e14] font-mono text-[11px] text-[#e1e2eb] placeholder:text-[#978da1] pl-[44px] pr-[16px] py-[10px] rounded-[12px] w-full shadow-[inset_0px_2px_4px_0px_rgba(0,0,0,0.05)] outline-none"
        />
      </div>
      <div className="flex gap-[6px] items-center overflow-x-auto">
        <button
          onClick={() => onSelectMint(null)}
          className={`px-[12px] py-[6px] rounded-[8px] text-[11px] font-mono font-semibold shrink-0 ${
            selectedMint === null
              ? "bg-[#9945ff] text-white"
              : "bg-[#1d2026] text-[#cec2d8]"
          }`}
        >
          All
        </button>
        {mints.map((mint) => {
          const color = colorForMint(mint);
          return (
            <button
              key={mint}
              onClick={() => onSelectMint(mint)}
              className={`flex gap-[6px] items-center px-[12px] py-[6px] rounded-[8px] text-[11px] font-mono shrink-0 ${
                selectedMint === mint
                  ? "bg-[#9945ff] text-white"
                  : "bg-[#1d2026] text-[#cec2d8]"
              }`}
            >
              <span className={`${color.dot} rounded-full size-[8px]`} />
              {truncateAddress(mint)}
            </button>
          );
        })}
      </div>
      <div className="flex gap-[4px] items-center">
        <span className="font-mono text-[#978da1] text-[11px]">Sort:</span>
        <div className="relative">
          <select
            value={sortOrder}
            onChange={(e) => onSortChange(e.target.value as SortOrder)}
            className="bg-[#1d2026] font-mono text-[#e1e2eb] text-[11px] pl-[12px] pr-[32px] py-[8px] rounded-[12px] appearance-none outline-none"
          >
            <option value="id-desc">Offer ID: High to Low</option>
            <option value="id-asc">Offer ID: Low to High</option>
          </select>
          <ChevronDown
            size={10}
            className="absolute right-[10px] top-1/2 -translate-y-1/2 text-[#978da1] pointer-events-none"
          />
        </div>
      </div>
    </div>
  );
}
