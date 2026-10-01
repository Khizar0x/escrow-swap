export const ESCROW_PROGRAM_ID = "WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b";

export const RPC_ENDPOINT =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export const CLUSTER_LABEL = process.env.NEXT_PUBLIC_RPC_URL
  ? "Custom RPC"
  : "Devnet";
