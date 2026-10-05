import { NetworkWarning } from "@/components/NetworkWarning";
import { WalletButton } from "@/components/WalletButton";
import { WalletInfo } from "@/components/WalletInfo";

export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-zinc-50 px-6 text-center font-sans dark:bg-black">
      <div className="flex flex-col items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
          Escrow Swap
        </h1>
        <p className="max-w-md text-base text-zinc-600 dark:text-zinc-400">
          Swap tokens with other people. Connect your wallet to get started.
        </p>
      </div>
      <NetworkWarning />
      <WalletButton />
      <WalletInfo />
    </main>
  );
}
