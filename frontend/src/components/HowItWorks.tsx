import { Card } from "@/components/ui/Card";
import { IconTile } from "@/components/ui/IconTile";
import { PlusIcon, SwapIcon, WalletIcon } from "@/components/ui/icons";

const STEPS = [
  {
    title: "Connect your wallet",
    text: "Use Phantom or another wallet that supports Solana.",
    tone: "violet" as const,
    Icon: WalletIcon,
    detailKey: "Network",
    detailValue: "Solana Devnet",
  },
  {
    title: "Create an offer",
    text: "Choose the token and amount you give, and the token and amount you want back.",
    tone: "green" as const,
    Icon: PlusIcon,
    detailKey: "Tokens",
    detailValue: "Classic tokens",
  },
  {
    title: "Take or cancel",
    text: "Someone else can take your offer. You can cancel it to get your tokens back.",
    tone: "blue" as const,
    Icon: SwapIcon,
    detailKey: "Cancel",
    detailValue: "Maker only",
  },
];

// Three steps, each with an icon tile, a short text, and a key-value line.
export function HowItWorks() {
  return (
    <section aria-labelledby="how-it-works" className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">Guide</p>
        <h2 id="how-it-works" className="text-2xl font-semibold tracking-tight">
          How it works
        </h2>
      </div>
      <div className="grid gap-4 md:grid-cols-3">
        {STEPS.map(({ title, text, tone, Icon, detailKey, detailValue }, index) => (
          <Card key={title} className="flex flex-col gap-5 p-6">
            <div className="flex items-start justify-between gap-4">
              <IconTile tone={tone}>
                <Icon />
              </IconTile>
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
                Step {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <h3 className="text-lg font-semibold text-ink">{title}</h3>
              <p className="text-sm leading-relaxed text-muted">{text}</p>
            </div>
            <div className="mt-auto flex items-center justify-between gap-4 border-t border-border pt-4 font-mono text-xs uppercase tracking-[0.12em]">
              <span className="text-muted">{detailKey}</span>
              <span className="text-ink">{detailValue}</span>
            </div>
          </Card>
        ))}
      </div>
    </section>
  );
}
