const EXPLORER_BASE_URL = "https://explorer.solana.com";

// Links always point at Devnet, matching this app's network (network.ts).
export function explorerAddressUrl(address: string): string {
  return `${EXPLORER_BASE_URL}/address/${address}?cluster=devnet`;
}

export function explorerTransactionUrl(signature: string): string {
  return `${EXPLORER_BASE_URL}/tx/${signature}?cluster=devnet`;
}
