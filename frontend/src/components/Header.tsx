import { NavPills } from "@/components/NavPills";
import { WalletButton } from "@/components/WalletButton";
import { ThemeToggle } from "@/components/ui/ThemeToggle";
import { LogoMark } from "@/components/ui/LogoMark";

// The top bar. Its inner width matches the page content, so both share the same left edge.
// On phones, the navigation drops to a full-width row under the logo and the buttons.
export function Header() {
  return (
    <header className="border-b border-border bg-surface">
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-4 sm:px-6">
        <div className="flex items-center gap-3">
          <span className="inline-flex size-9 flex-none items-center justify-center rounded-control border border-border bg-raised">
            <LogoMark size={22} />
          </span>
          <span className="text-base font-semibold tracking-tight text-ink">Escrow Swap</span>
        </div>
        <div className="order-3 w-full md:order-none md:flex md:w-auto md:flex-1 md:justify-center">
          <NavPills />
        </div>
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <WalletButton />
        </div>
      </div>
    </header>
  );
}
