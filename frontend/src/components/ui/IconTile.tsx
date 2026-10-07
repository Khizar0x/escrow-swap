import type { ReactNode } from "react";

type Tone = "violet" | "green" | "blue";

const tiles: Record<Tone, string> = {
  violet: "bg-tile-violet text-icon-violet",
  green: "bg-tile-green text-icon-green",
  blue: "bg-tile-blue text-icon-blue",
};

// A colored square behind an icon. Violet, green and blue are the three tones.
export function IconTile({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span
      className={`inline-flex size-11 flex-none items-center justify-center rounded-control ${tiles[tone]}`}
    >
      {children}
    </span>
  );
}
