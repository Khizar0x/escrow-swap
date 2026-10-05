"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useSolBalance } from "@/hooks/useSolBalance";
import { shortenAddress } from "@/lib/format/address";
import { formatSol } from "@/lib/format/sol";

// Shows the connected wallet's short address and SOL balance.
export function WalletInfo() {
  const { publicKey, connected } = useWallet();
  const balance = useSolBalance();

  if (!connected || !publicKey) {
    return null;
  }

  let balanceText = "Loading…";
  if (balance.error) {
    balanceText = "Could not load your balance. Try again later.";
  } else if (balance.lamports !== null) {
    balanceText = formatSol(balance.lamports);
  }

  return (
    <dl className="flex flex-col gap-2 text-sm text-zinc-700 dark:text-zinc-300">
      <div className="flex gap-2">
        <dt className="font-medium">Wallet:</dt>
        <dd className="font-mono">{shortenAddress(publicKey.toBase58())}</dd>
      </div>
      <div className="flex gap-2">
        <dt className="font-medium">Balance:</dt>
        <dd>{balanceText}</dd>
      </div>
    </dl>
  );
}
