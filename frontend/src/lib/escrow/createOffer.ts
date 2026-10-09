import { BN, type Program } from "@anchor-lang/core";
import { type Connection, PublicKey, SystemProgram, type Transaction } from "@solana/web3.js";
import { isUserRejection, toPlainErrorMessage, USER_REJECTED_MESSAGE } from "@/lib/errors/map";
import { ASSOCIATED_TOKEN_PROGRAM_ID, associatedTokenAddress } from "@/lib/solana/ata";
import { AmountError } from "@/lib/solana/amounts";
import { offerAddress } from "@/lib/solana/pda";
import { TokenProgramError } from "@/lib/solana/tokenProgram";

const MAX_OFFER_ID_ATTEMPTS = 5;

export class CreateOfferError extends Error {}

export function assertDistinctMints(mintA: PublicKey, mintB: PublicKey): void {
  if (mintA.equals(mintB)) {
    throw new CreateOfferError("Choose two different tokens.");
  }
}

// take_offer has exactly one token-program account, shared by both mints'
// token accounts (see take_offer.rs), so an offer can only ever be taken if
// both of its tokens are owned by the same token program. Rejected here, at
// create time, rather than letting an offer end up impossible for anyone to
// take later.
export function assertSameTokenProgram(tokenProgramA: PublicKey, tokenProgramB: PublicKey): void {
  if (!tokenProgramA.equals(tokenProgramB)) {
    throw new CreateOfferError("These two tokens can't be combined. Choose a different pair.");
  }
}

export function assertSufficientBalance(amountA: bigint, available: bigint): void {
  if (amountA > available) {
    throw new CreateOfferError("You don't have enough of this token.");
  }
}

// A random u64 offer ID. The browser and Node both provide crypto.getRandomValues.
export function randomOfferId(): bigint {
  const bytes = crypto.getRandomValues(new Uint8Array(8));
  return new DataView(bytes.buffer).getBigUint64(0, true);
}

// Finds an offer ID with no existing offer at its address. A collision is
// 1 in 2^64, so a handful of attempts is enough to make this practically total.
export async function pickOfferId(
  connection: Connection,
  programId: PublicKey,
  maker: PublicKey
): Promise<bigint> {
  for (let attempt = 0; attempt < MAX_OFFER_ID_ATTEMPTS; attempt++) {
    const offerId = randomOfferId();
    const info = await connection.getAccountInfo(offerAddress(programId, maker, offerId));
    if (info === null) {
      return offerId;
    }
  }
  throw new CreateOfferError("Could not start the offer. Try again.");
}

// The wallet's balance of a token, in base units, under the given token
// program. An account that does not exist yet (the wallet has never held
// this token) is treated as zero.
export async function fetchTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey,
  tokenProgramId: PublicKey
): Promise<bigint> {
  const ata = associatedTokenAddress(mint, owner, tokenProgramId);
  try {
    const { value } = await connection.getTokenAccountBalance(ata);
    return BigInt(value.amount);
  } catch {
    return BigInt(0);
  }
}

export interface BuildCreateOfferTransactionInput {
  program: Program;
  maker: PublicKey;
  mintA: PublicKey;
  mintB: PublicKey;
  tokenProgramA: PublicKey;
  tokenProgramB: PublicKey;
  amountA: bigint;
  amountB: bigint;
  offerId: bigint;
}

export interface BuildCreateOfferTransactionResult {
  transaction: Transaction;
  offerAddress: PublicKey;
}

// Builds (but does not sign or send) the make_offer transaction. Every
// account is derived here from pda.ts and ata.ts rather than left to the
// client library to resolve, so the transaction only ever contains
// addresses this code has verified against the program's seeds.
export async function buildCreateOfferTransaction({
  program,
  maker,
  mintA,
  mintB,
  tokenProgramA,
  tokenProgramB,
  amountA,
  amountB,
  offerId,
}: BuildCreateOfferTransactionInput): Promise<BuildCreateOfferTransactionResult> {
  assertDistinctMints(mintA, mintB);
  assertSameTokenProgram(tokenProgramA, tokenProgramB);

  const offer = offerAddress(program.programId, maker, offerId);
  const vault = associatedTokenAddress(mintA, offer, tokenProgramA);
  const makerTokenAccountA = associatedTokenAddress(mintA, maker, tokenProgramA);

  const transaction = await program.methods
    .makeOffer(new BN(offerId.toString()), new BN(amountA.toString()), new BN(amountB.toString()))
    .accountsPartial({
      maker,
      tokenMintA: mintA,
      tokenMintB: mintB,
      makerTokenAccountA,
      offer,
      vault,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: tokenProgramA,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return { transaction, offerAddress: offer };
}

// Maps any error from the pre-send steps (parsing input, looking up a token,
// checking a balance, picking an offer ID) to a message safe to show on
// screen. AmountError, CreateOfferError, and TokenProgramError are already
// plain-language; anything else — including a bug — is never shown raw.
export function toCreateOfferFormMessage(error: unknown): string {
  if (error instanceof AmountError || error instanceof CreateOfferError || error instanceof TokenProgramError) {
    return error.message;
  }
  if (isUserRejection(error)) {
    return USER_REJECTED_MESSAGE;
  }
  return toPlainErrorMessage(error);
}
