"use client";

import { useNetworkStatus } from "@/hooks/useNetworkStatus";

// Shows a warning when the site is not connected to the Devnet test network.
export function NetworkWarning() {
  const status = useNetworkStatus();

  if (status === "other") {
    return (
      <p role="alert" className="max-w-md text-sm text-amber-700 dark:text-amber-400">
        This site is not connected to the Solana Devnet test network. Please try again later.
      </p>
    );
  }

  if (status === "unknown") {
    return (
      <p role="alert" className="max-w-md text-sm text-amber-700 dark:text-amber-400">
        Could not check the network. Refresh the page to try again.
      </p>
    );
  }

  return null;
}
