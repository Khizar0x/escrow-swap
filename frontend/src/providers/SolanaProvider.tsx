"use client";

import type { ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { RPC_URL } from "@/lib/solana/network";

// Wallet setup only. No screen content lives here.
// The wallet list is empty on purpose. Phantom and other wallets that follow
// the Wallet Standard are found automatically.
// autoConnect reconnects a wallet the user already approved for this site.
export function SolanaProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
