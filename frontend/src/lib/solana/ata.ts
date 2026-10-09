import { PublicKey, SystemProgram, TransactionInstruction } from "@solana/web3.js";

// The classic SPL Token program, Token-2022, and the Associated Token
// Account program. Every derivation below takes the real token program as
// its own parameter (see lib/solana/tokenProgram.ts, which reads which one
// actually owns a given token) rather than assuming the classic one.
export const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
export const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey(
  "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
);
export const TOKEN_2022_PROGRAM_ID = new PublicKey("TokenzQdBNbLqP5VEhdkAS6EPFLC1PHnBqCXEpPxuEb");

// The associated token account for an owner and a mint, under the given
// token program (classic or Token-2022 — a token's real owning program,
// never assumed). The program makes the offer PDA the authority of the
// vault (associated_token::authority = offer), so this same function
// derives both a wallet's own token account and a vault: the "owner" is
// just whichever account holds the tokens.
export function associatedTokenAddress(mint: PublicKey, owner: PublicKey, tokenProgramId: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), tokenProgramId.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return ata;
}

// Creates a token account for `owner` if it doesn't already exist, paid by
// `payer`, under the given token program. Idempotent: if the account is
// already there, the associated token program's CreateIdempotent
// instruction succeeds without changing anything, so this is safe to
// include even when the account might already exist. Built by hand (no
// @solana/spl-token dependency), matching every other derivation in this
// file: a single data byte, 1, selects CreateIdempotent over the original
// zero-byte Create instruction.
export function createAssociatedTokenAccountIdempotentInstruction(
  payer: PublicKey,
  owner: PublicKey,
  mint: PublicKey,
  tokenProgramId: PublicKey
): TransactionInstruction {
  const associatedToken = associatedTokenAddress(mint, owner, tokenProgramId);
  return new TransactionInstruction({
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SystemProgram.programId, isSigner: false, isWritable: false },
      { pubkey: tokenProgramId, isSigner: false, isWritable: false },
    ],
    data: Buffer.from([1]),
  });
}
