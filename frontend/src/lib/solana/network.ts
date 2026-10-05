// Every Solana network has a fixed genesis hash. Comparing the hash tells us
// which network the connection is actually serving, whatever the URL says.
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

// Public address of the devnet service. Set NEXT_PUBLIC_RPC_URL to use another.
export const RPC_URL =
  process.env.NEXT_PUBLIC_RPC_URL ?? "https://api.devnet.solana.com";

export function isDevnetGenesisHash(genesisHash: string): boolean {
  return genesisHash === DEVNET_GENESIS_HASH;
}
