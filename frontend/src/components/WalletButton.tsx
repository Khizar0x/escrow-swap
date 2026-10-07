"use client";

import type { ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Button } from "@/components/ui/Button";
import { CopyButton } from "@/components/ui/CopyButton";
import { PowerIcon } from "@/components/ui/icons";
import { Skeleton } from "@/components/ui/Skeleton";
import { useSolBalance } from "@/hooks/useSolBalance";
import { shortenAddress } from "@/lib/format/address";
import { formatSol } from "@/lib/format/sol";

// Shows a "Connect Wallet" button when no wallet is connected. When one is, it shows
// the balance, the short address with a copy button, and a round disconnect button.
export function WalletButton() {
  const { connected, connecting, disconnect, publicKey } = useWallet();
  const { setVisible } = useWalletModal();
  const balance = useSolBalance();

  if (!connected || !publicKey) {
    return (
      <Button onClick={() => setVisible(true)} disabled={connecting}>
        {connecting ? "Connecting…" : "Connect Wallet"}
      </Button>
    );
  }

  const address = publicKey.toBase58();

  let balanceText: ReactNode;
  if (balance.error) {
    balanceText = "—";
  } else if (balance.lamports === null) {
    balanceText = <Skeleton className="h-4 w-16" />;
  } else {
    balanceText = formatSol(balance.lamports);
  }

  return (
    <div className="flex items-center gap-2">
      <span className="hidden h-10 items-center rounded-full border border-border bg-raised px-4 font-mono text-sm tabular-nums text-ink sm:inline-flex">
        {balanceText}
      </span>
      <span className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-raised pl-3 pr-1 font-mono text-sm text-ink">
        <span aria-hidden="true" className="size-2 rounded-full bg-success" />
        <span>{shortenAddress(address)}</span>
        <CopyButton value={address} />
      </span>
      <Button
        variant="secondary"
        size="icon"
        shape="round"
        aria-label="Disconnect Wallet"
        title="Disconnect Wallet"
        onClick={() => void disconnect()}
      >
        <PowerIcon />
      </Button>
    </div>
  );
}
