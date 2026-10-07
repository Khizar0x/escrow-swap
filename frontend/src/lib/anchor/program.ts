import { AnchorProvider, Program, type Idl } from "@anchor-lang/core";
import type { AnchorWallet } from "@solana/wallet-adapter-react";
import type { Connection } from "@solana/web3.js";
import idlJson from "@/idl/escrow.json";

// The IDL is the program's description. It comes from the Anchor build, and
// its address field holds the program ID, so no ID is typed in by hand.
export const escrowIdl = idlJson as Idl;

// Builds the program client. The wallet is used only to sign transactions
// that the user approves. The program client never sees a private key.
export function createEscrowProgram(connection: Connection, wallet: AnchorWallet): Program {
  const provider = new AnchorProvider(connection, wallet, { commitment: "confirmed" });
  return new Program(escrowIdl, provider);
}
