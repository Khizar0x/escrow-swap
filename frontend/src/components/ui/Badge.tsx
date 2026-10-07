import type { HTMLAttributes } from "react";

type Tone = "neutral" | "accent" | "success" | "warning" | "error";

const tones: Record<Tone, string> = {
  neutral: "border-border text-muted",
  accent: "border-accent/40 text-accent",
  success: "border-success/40 text-success",
  warning: "border-warning/40 text-warning",
  error: "border-error/40 text-error",
};

const dotTones: Record<Tone, string> = {
  neutral: "bg-muted",
  accent: "bg-accent",
  success: "bg-success",
  warning: "bg-warning",
  error: "bg-error",
};

// A small pill label in the monospace style. Set dot to show a status dot first.
export function Badge({
  tone = "neutral",
  dot = false,
  className = "",
  children,
  ...props
}: HTMLAttributes<HTMLSpanElement> & { tone?: Tone; dot?: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full border bg-raised px-3 py-1 font-mono text-xs uppercase tracking-[0.12em] ${tones[tone]} ${className}`}
      {...props}
    >
      {dot && <span aria-hidden="true" className={`size-1.5 rounded-full ${dotTones[tone]}`} />}
      {children}
    </span>
  );
}
