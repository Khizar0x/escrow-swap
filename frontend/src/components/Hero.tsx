"use client";

import { useWallet } from "@solana/wallet-adapter-react";
import { useWalletModal } from "@solana/wallet-adapter-react-ui";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ArrowRightIcon } from "@/components/ui/icons";

// The first thing on the page: a short badge, the headline with one gradient phrase,
// one plain sentence, and one large gradient button on the right on wide screens.
export function Hero() {
  const { connected, connecting } = useWallet();
  const { setVisible } = useWalletModal();

  return (
    <section className="flex flex-col gap-8 pt-10 md:flex-row md:items-end md:gap-10 md:pt-16">
      <div className="flex max-w-xl flex-col gap-5">
        <Badge tone="success" dot className="self-start">
          Solana Devnet test app
        </Badge>
        <h1 className="text-4xl font-semibold leading-tight tracking-tight sm:text-5xl lg:text-5xl">
          Swap tokens with{" "}
          <span className="whitespace-nowrap text-brand-gradient">other people.</span>
        </h1>
        <p className="max-w-xl text-lg text-muted">
          Create an offer, or take one that someone else has made.
        </p>
      </div>

      {/* Hidden once a wallet is connected. The Create Offer button comes with Phase 5. */}
      {!connected && (
        <Button
          size="lg"
          onClick={() => setVisible(true)}
          disabled={connecting}
          className="md:shrink-0"
        >
          {connecting ? "Connecting…" : "Connect Wallet"}
          {!connecting && <ArrowRightIcon />}
        </Button>
      )}
    </section>
  );
}
