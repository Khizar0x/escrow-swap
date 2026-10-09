"use client";

import { useNetworkStatus, type NetworkStatus } from "@/hooks/useNetworkStatus";
import { escrowIdl } from "@/lib/anchor/program";
import { shortenAddress } from "@/lib/format/address";
import { PAGE_CONTAINER } from "@/lib/ui/container";

const STATUS_LABELS: Record<NetworkStatus, { text: string; dot: string }> = {
  checking: { text: "Checking network", dot: "bg-muted" },
  devnet: { text: "Solana Devnet", dot: "bg-success" },
  other: { text: "Not on Devnet", dot: "bg-warning" },
  unknown: { text: "Network unavailable", dot: "bg-error" },
};

// One line of monospace text under the header: the network the site is using,
// checked live, and the short address of the program.
export function StatusStrip() {
  const status = useNetworkStatus();
  const { text, dot } = STATUS_LABELS[status];

  return (
    <div className={`${PAGE_CONTAINER} pt-6`}>
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-xs uppercase tracking-[0.12em] text-muted">
        <span className="inline-flex items-center gap-2">
          <span aria-hidden="true" className={`size-2 rounded-full ${dot}`} />
          <span>{text}</span>
        </span>
        <span>
          Program <span className="normal-case text-ink">{shortenAddress(escrowIdl.address)}</span>
        </span>
      </div>
    </div>
  );
}
