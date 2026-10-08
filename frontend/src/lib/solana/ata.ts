import { PublicKey } from "@solana/web3.js";

// Classic SPL Token program and the Associated Token Account program. Every
// derivation here assumes the classic program; Token-2022 is a later, optional
// phase (11A).
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);

// Used only to recognize a Token-2022 mint and show a clear "not supported
// yet" message. Phase 11A adds real support.
export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

// The associated token account for an owner and a mint. The program makes the
// offer PDA the authority of the vault (associated_token::authority = offer),
// so this same function derives both a wallet's own token account and a
// vault: the "owner" is just whichever account holds the tokens.
export function associatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}
