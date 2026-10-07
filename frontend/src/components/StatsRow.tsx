import { IconTile } from "@/components/ui/IconTile";
import { CheckCircleIcon, CoinsIcon, TagIcon } from "@/components/ui/icons";

const STATS = [
  { label: "Open offers", Icon: TagIcon, tone: "violet" as const },
  { label: "Completed swaps", Icon: CheckCircleIcon, tone: "green" as const },
  { label: "Tokens listed", Icon: CoinsIcon, tone: "blue" as const },
];

// Three numbers in one container. The values are placeholders until live data is added.
export function StatsRow() {
  return (
    <section aria-label="Overview" className="flex flex-col gap-3">
      <div className="grid gap-3 rounded-container border border-border bg-surface p-3 shadow-card sm:grid-cols-3">
        {STATS.map(({ label, Icon, tone }) => (
          <div key={label} className="flex items-center gap-4 rounded-inner bg-raised p-5">
            <IconTile tone={tone}>
              <Icon />
            </IconTile>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted">{label}</span>
              <span className="text-3xl font-semibold tabular-nums text-ink">0</span>
            </div>
          </div>
        ))}
      </div>
      <p className="font-mono text-xs uppercase tracking-[0.12em] text-muted">
        Placeholder values until live data is added
      </p>
    </section>
  );
}
