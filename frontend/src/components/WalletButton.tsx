"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";

// Shows "Connect Wallet" when no wallet is connected, and
// "Disconnect Wallet" when one is.
export function WalletButton() {
  const { connected, connecting, disconnect } = useWallet();
  const { setVisible } = useWalletModal();

  if (!connected) {
    return (
      <button
        type="button"
        onClick={() => setVisible(true)}
        disabled={connecting}
        className="rounded-full bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:opacity-60 dark:bg-zinc-50 dark:text-zinc-900"
      >
        {connecting ? "Connecting…" : "Connect Wallet"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void disconnect()}
      className="rounded-full border border-zinc-300 px-5 py-2 text-sm font-medium text-zinc-900 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-50 dark:hover:bg-zinc-900"
    >
      Disconnect Wallet
    </button>
  );
}
