import { escrowIdl } from "@/lib/anchor/program";
import { shortenAddress } from "@/lib/format/address";
import { PAGE_CONTAINER } from "@/lib/ui/container";

// Three columns: what the site is, where the program lives, and the network in use.
export function Footer() {
  const explorerUrl = `https://explorer.solana.com/address/${escrowIdl.address}?cluster=devnet`;

  return (
    <footer className="border-t border-border bg-surface">
      <div className={`${PAGE_CONTAINER} grid gap-8 py-10 sm:grid-cols-3`}>
        <div className="flex flex-col gap-3">
          <p className="text-base font-semibold text-ink">Escrow Swap</p>
          <p className="text-sm leading-relaxed text-muted">
            A test app for swapping tokens on the Solana Devnet network.
          </p>
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Program</p>
          <a
            href={explorerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="w-fit font-mono text-sm text-accent underline-offset-4 hover:underline"
          >
            {shortenAddress(escrowIdl.address)}
          </a>
          <p className="text-sm text-muted">View the program on Solana Explorer</p>
        </div>
        <div className="flex flex-col gap-3">
          <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Network</p>
          <p className="font-mono text-sm text-ink">Solana Devnet</p>
        </div>
      </div>
    </footer>
  );
}
