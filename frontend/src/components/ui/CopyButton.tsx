"use client";

import { useState } from "react";
import { CheckIcon, CopyIcon } from "@/components/ui/icons";

const CONFIRM_MS = 1500;

// Copies a value to the clipboard. The icon changes to a check mark for a moment.
export function CopyButton({ value, label = "Copy address" }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);

  async function handleClick() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      window.setTimeout(() => setCopied(false), CONFIRM_MS);
    } catch {
      // The browser blocked the clipboard. The value stays visible, so nothing is lost.
    }
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={copied ? "Copied" : label}
      className={`inline-flex size-8 flex-none items-center justify-center rounded-control border border-control bg-raised transition-colors duration-200 ease-out hover:bg-surface focus-visible:outline-2 focus-visible:outline-offset-2 ${copied ? "text-success" : "text-muted"}`}
    >
      {copied ? <CheckIcon /> : <CopyIcon />}
    </button>
  );
}
