import type { HTMLAttributes } from "react";

// The outer container is a surface with a soft shadow. Pass bg-raised and
// rounded-inner for cards that sit inside another container.
export function Card({ className = "", ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-container border border-border bg-surface p-6 shadow-card ${className}`}
      {...props}
    />
  );
}
