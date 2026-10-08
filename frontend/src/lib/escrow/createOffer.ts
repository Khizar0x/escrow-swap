import { BN, type Program } from "@anchor-lang/core";
import { type Connection, PublicKey, SystemProgram, type Transaction } from "@solana/web3.js";
import { toPlainErrorMessage } from "@/lib/errors/map";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  associatedTokenAddress,
} from "@/lib/solana/ata";
import { AmountError } from "@/lib/solana/amounts";
import { offerAddress } from "@/lib/solana/pda";

// Byte offset of the decimals field in a classic SPL mint account.
const MINT_DECIMALS_OFFSET = 44;
const MAX_OFFER_ID_ATTEMPTS = 5;

export class CreateOfferError extends Error {}

export function assertDistinctMints(mintA: PublicKey, mintB: PublicKey): void {
  if (mintA.equals(mintB)) {
    throw new CreateOfferError("Choose two different tokens.");
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

// Reads a mint's decimal count, after confirming it is a classic SPL token.
// A Token-2022 mint is rejected with a clear message rather than guessed at,
// and a lookup that fails for any other reason never falls back to 0
// decimals, which would silently show the wrong amount.
export async function fetchMintDecimals(connection: Connection, mint: PublicKey): Promise<number> {
  let info;
  try {
    info = await connection.getAccountInfo(mint);
  } catch {
    throw new CreateOfferError("Could not check this token. Try again.");
  }

  if (!info) {
    throw new CreateOfferError("Could not find that token. Check the address.");
  }
  if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    throw new CreateOfferError("This token type is not supported yet.");
  }
  if (!info.owner.equals(TOKEN_PROGRAM_ID)) {
    throw new CreateOfferError("This address is not a token.");
  }
  return info.data.readUInt8(MINT_DECIMALS_OFFSET);
}

// The wallet's balance of a token, in base units. An account that does not
// exist yet (the wallet has never held this token) is treated as zero.
export async function fetchTokenBalance(
  connection: Connection,
  owner: PublicKey,
  mint: PublicKey
): Promise<bigint> {
  const ata = associatedTokenAddress(mint, owner);
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
  amountA,
  amountB,
  offerId,
}: BuildCreateOfferTransactionInput): Promise<BuildCreateOfferTransactionResult> {
  assertDistinctMints(mintA, mintB);

  const offer = offerAddress(program.programId, maker, offerId);
  const vault = associatedTokenAddress(mintA, offer);
  const makerTokenAccountA = associatedTokenAddress(mintA, maker);

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
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return { transaction, offerAddress: offer };
}

// Maps any error from the pre-send steps (parsing input, looking up a mint,
// checking a balance, picking an offer ID) to a message safe to show on
// screen. AmountError and CreateOfferError are already plain-language;
// anything else — including a bug — is never shown raw.
export function toCreateOfferFormMessage(error: unknown): string {
  if (error instanceof AmountError || error instanceof CreateOfferError) {
    return error.message;
  }
  return toPlainErrorMessage(error);
}
