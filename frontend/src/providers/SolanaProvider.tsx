"use client";

import type { ReactNode } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import "@solana/wallet-adapter-react-ui/styles.css";
import { isUserRejection } from "@/lib/errors/map";
import { RPC_URL } from "@/lib/solana/network";

// Wallet setup only. No screen content lives here.
// The wallet list is empty on purpose. Phantom and other wallets that follow
// the Wallet Standard are found automatically.
// autoConnect reconnects a wallet the user already approved for this site.
export function SolanaProvider({ children }: { children: ReactNode }) {
  return (
    <ConnectionProvider endpoint={RPC_URL}>
      <WalletProvider
        wallets={[]}
        autoConnect
        onError={(error) => {
          // Without this, the library's own default is to console.error
          // every wallet error, including a normal "I changed my mind" in
          // the approval popup. Our own send path already shows that
          // calmly in the UI, so it's silenced here; anything else still
          // logs normally.
          if (isUserRejection(error)) {
            return;
          }
          console.error(error);
        }}
      >
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
