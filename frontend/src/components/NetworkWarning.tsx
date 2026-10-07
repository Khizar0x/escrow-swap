"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

const WARNING_CLASS =
  "flex w-full items-start gap-3 rounded-control border border-warning/40 bg-surface px-4 py-3 text-sm text-ink shadow-card";

// Shows a warning when the site is not connected to the Devnet test network.
export function NetworkWarning() {
  const status = useNetworkStatus();

  if (status !== "other" && status !== "unknown") {
    return null;
  }

  const message =
    status === "other"
      ? "This site is not connected to the Solana Devnet test network. Please try again later."
      : "Could not check the network. Refresh the page to try again.";

  return (
    <div role="alert" className={WARNING_CLASS}>
      <svg
        aria-hidden="true"
        width="18"
        height="18"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="mt-0.5 flex-none text-warning"
      >
        <path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </svg>
      <p>{message}</p>
    </div>
  );
}
