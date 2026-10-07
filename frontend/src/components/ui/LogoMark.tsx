import { useId } from "react";

// The app mark: two overlapping circles, violet and mint. The overlap is filled with
// a gradient between the two colors, so the shared area blends both.
// Colors come from the theme tokens, so the mark works in light and dark.
export function LogoMark({ size = 22 }: { size?: number }) {
  const clipId = `logo-clip-${useId().replace(/:/g, "")}`;
  const gradientId = `logo-blend-${useId().replace(/:/g, "")}`;

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
    >
      <defs>
        <clipPath id={clipId}>
          <circle cx="9" cy="12" r="6.5" />
        </clipPath>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" style={{ stopColor: "var(--accent)" }} />
          <stop offset="1" style={{ stopColor: "var(--success)" }} />
        </linearGradient>
      </defs>
      <circle cx="9" cy="12" r="6.5" style={{ fill: "var(--accent)" }} />
      <circle cx="15" cy="12" r="6.5" style={{ fill: "var(--success)" }} />
      <circle cx="15" cy="12" r="6.5" fill={`url(#${gradientId})`} clipPath={`url(#${clipId})`} />
    </svg>
  );
}
