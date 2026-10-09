import { IconTile } from "@/components/ui/IconTile";
import { Skeleton } from "@/components/ui/Skeleton";
import { CoinsIcon, TagIcon } from "@/components/ui/icons";

interface StatsRowProps {
  openOffers: number;
  tokensListed: number;
  loading: boolean;
}

// Two real numbers from the offers that are open right now: how many there
// are, and how many distinct tokens appear across them.
export function StatsRow({ openOffers, tokensListed, loading }: StatsRowProps) {
  const stats = [
    { label: "Open offers", value: openOffers, Icon: TagIcon, tone: "violet" as const },
    { label: "Tokens listed", value: tokensListed, Icon: CoinsIcon, tone: "blue" as const },
  ];

  return (
    <section aria-label="Overview" className="flex flex-col gap-3">
      <div className="grid gap-3 rounded-container border border-border bg-surface p-3 shadow-card sm:grid-cols-2">
        {stats.map(({ label, value, Icon, tone }) => (
          <div key={label} className="flex items-center gap-4 rounded-inner bg-raised p-5">
            <IconTile tone={tone}>
              <Icon />
            </IconTile>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-xs uppercase tracking-[0.12em] text-muted">{label}</span>
              {loading ? (
                <Skeleton className="h-8 w-14" />
              ) : (
                <span className="text-3xl font-semibold tabular-nums text-ink">{value}</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
