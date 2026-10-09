import type { Program } from "@anchor-lang/core";
import { type Connection, PublicKey, SystemProgram, type Transaction } from "@solana/web3.js";
import { CreateOfferError, fetchTokenBalance } from "@/lib/escrow/createOffer";
import type { Offer } from "@/lib/escrow/fetchOffers";
import { isUserRejection, toPlainErrorMessage, USER_REJECTED_MESSAGE } from "@/lib/errors/map";
import { fromBaseUnits } from "@/lib/solana/amounts";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  associatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
} from "@/lib/solana/ata";
import { offerAddress as deriveOfferAddress } from "@/lib/solana/pda";

export class TakeOfferError extends Error {}

interface DecodedOffer {
  offerId: { toString(): string };
  maker: PublicKey;
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  amountA: { toString(): string };
  amountB: { toString(): string };
}

// Re-fetches the offer right before building, since the copy the person is
// looking at may be stale: someone else may have taken or canceled it since
// the list was last loaded. Any account that no longer exists, or that
// fails to decode as an Offer, is treated the same way: it's gone.
//
// Goes through connection.getAccountInfo + program.coder directly rather
// than program.account.offer.fetchNullable: with the generic Program type
// this file works with (not one parameterized with the escrow IDL's exact
// literal type), TypeScript has no way to know "offer" is a valid account
// name on program.account, even though it's the same name the IDL's
// camelCased account entry resolves to at runtime.
export async function fetchFreshOffer(program: Program, offerAddress: PublicKey): Promise<Offer> {
  let info;
  try {
    info = await program.provider.connection.getAccountInfo(offerAddress);
  } catch {
    info = null;
  }

  if (!info) {
    throw new TakeOfferError("This offer is no longer available. It may have been taken or canceled.");
  }

  let decoded: DecodedOffer;
  try {
    decoded = program.coder.accounts.decode<DecodedOffer>("offer", info.data);
  } catch {
    throw new TakeOfferError("This offer is no longer available. It may have been taken or canceled.");
  }

  return {
    offerAddress,
    maker: decoded.maker,
    tokenA: decoded.tokenMintA,
    tokenB: decoded.tokenMintB,
    amountA: BigInt(decoded.amountA.toString()),
    amountB: BigInt(decoded.amountB.toString()),
    offerId: BigInt(decoded.offerId.toString()),
  };
}

export function assertNotOwnOffer(offer: Offer, taker: PublicKey): void {
  if (offer.maker.equals(taker)) {
    throw new TakeOfferError("You made this offer. Use My Offers to cancel it.");
  }
}

// Checks the taker's balance of the token they would pay, before anything
// is sent to the wallet. The amounts in the message are plain decimals, not
// base units.
export async function assertSufficientTakerBalance(
  connection: Connection,
  taker: PublicKey,
  offer: Offer,
  decimalsB: number
): Promise<void> {
  const balance = await fetchTokenBalance(connection, taker, offer.tokenB);
  if (balance < offer.amountB) {
    throw new TakeOfferError(
      `You need ${fromBaseUnits(offer.amountB, decimalsB)} of this token to take this offer, but you have ${fromBaseUnits(balance, decimalsB)}.`
    );
  }
}

// True when the taker has no token account yet for the token they would
// receive, meaning one needs to be created as part of the transaction.
export async function needsTakerTokenAccountA(
  connection: Connection,
  taker: PublicKey,
  tokenA: PublicKey
): Promise<boolean> {
  const info = await connection.getAccountInfo(associatedTokenAddress(tokenA, taker));
  return info === null;
}

export interface BuildTakeOfferTransactionInput {
  program: Program;
  taker: PublicKey;
  offer: Offer;
  createsTakerTokenAccountA: boolean;
}

export interface BuildTakeOfferTransactionResult {
  transaction: Transaction;
}

// Builds (but does not sign or send) the take_offer transaction. Every
// account is derived here, never trusted from the caller, and the offer
// address is checked against the program's seeds before it's used — the
// same defense used when building the create-offer transaction.
export async function buildTakeOfferTransaction({
  program,
  taker,
  offer,
  createsTakerTokenAccountA,
}: BuildTakeOfferTransactionInput): Promise<BuildTakeOfferTransactionResult> {
  assertNotOwnOffer(offer, taker);

  const expectedOfferAddress = deriveOfferAddress(program.programId, offer.maker, offer.offerId);
  if (!expectedOfferAddress.equals(offer.offerAddress)) {
    throw new TakeOfferError("This offer is no longer available. It may have been taken or canceled.");
  }

  const vault = associatedTokenAddress(offer.tokenA, offer.offerAddress);
  const takerTokenAccountA = associatedTokenAddress(offer.tokenA, taker);
  const takerTokenAccountB = associatedTokenAddress(offer.tokenB, taker);
  const makerTokenAccountB = associatedTokenAddress(offer.tokenB, offer.maker);

  const preInstructions = createsTakerTokenAccountA
    ? [createAssociatedTokenAccountIdempotentInstruction(taker, taker, offer.tokenA)]
    : [];

  const transaction = await program.methods
    .takeOffer()
    .accountsPartial({
      taker,
      maker: offer.maker,
      tokenMintA: offer.tokenA,
      tokenMintB: offer.tokenB,
      offer: offer.offerAddress,
      vault,
      takerTokenAccountA,
      takerTokenAccountB,
      makerTokenAccountB,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .preInstructions(preInstructions)
    .transaction();

  return { transaction };
}

// Maps any error from the pre-send steps (re-fetching the offer, checking a
// balance, checking a token's decimals) to a message safe to show on
// screen. TakeOfferError and the shared token-lookup errors are already
// plain-language; anything else — including a bug — is never shown raw.
export function toTakeOfferFormMessage(error: unknown): string {
  if (error instanceof TakeOfferError || error instanceof CreateOfferError) {
    return error.message;
  }
  if (isUserRejection(error)) {
    return USER_REJECTED_MESSAGE;
  }
  return toPlainErrorMessage(error);
}
