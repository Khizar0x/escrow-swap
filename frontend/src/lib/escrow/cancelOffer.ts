import type { Program } from "@anchor-lang/core";
import { PublicKey, SystemProgram, type Transaction } from "@solana/web3.js";
import { CreateOfferError } from "@/lib/escrow/createOffer";
import type { Offer } from "@/lib/escrow/fetchOffers";
import { toPlainErrorMessage } from "@/lib/errors/map";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID, associatedTokenAddress } from "@/lib/solana/ata";
import { offerAddress as deriveOfferAddress } from "@/lib/solana/pda";

export class CancelOfferError extends Error {}

// Re-fetching the offer and treating a missing/undecodable account as "no
// longer available" is identical to Take Offer's own pre-send check, so
// that implementation is reused rather than duplicated here.
export { fetchFreshOffer } from "@/lib/escrow/takeOffer";

export function assertIsMaker(offer: Offer, wallet: PublicKey): void {
  if (!offer.maker.equals(wallet)) {
    throw new CancelOfferError("Only the person who made this offer can cancel it.");
  }
}

export interface BuildCancelOfferTransactionInput {
  program: Program;
  maker: PublicKey;
  offer: Offer;
}

export interface BuildCancelOfferTransactionResult {
  transaction: Transaction;
}

// Builds (but does not sign or send) the cancel_offer transaction. The
// program creates maker_token_account_a itself if it doesn't already exist
// (cancel_offer.rs: `init_if_needed, payer = maker`), so this never needs to
// add a create-account instruction the way Take Offer does for the taker's
// receiving account.
export async function buildCancelOfferTransaction({
  program,
  maker,
  offer,
}: BuildCancelOfferTransactionInput): Promise<BuildCancelOfferTransactionResult> {
  assertIsMaker(offer, maker);

  const expectedOfferAddress = deriveOfferAddress(program.programId, offer.maker, offer.offerId);
  if (!expectedOfferAddress.equals(offer.offerAddress)) {
    throw new CancelOfferError("This offer is no longer available. It may have been taken or canceled.");
  }

  const vault = associatedTokenAddress(offer.tokenA, offer.offerAddress);
  const makerTokenAccountA = associatedTokenAddress(offer.tokenA, maker);

  const transaction = await program.methods
    .cancelOffer()
    .accountsPartial({
      maker,
      tokenMintA: offer.tokenA,
      offer: offer.offerAddress,
      makerTokenAccountA,
      vault,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .transaction();

  return { transaction };
}

// Maps any error from the pre-send steps (re-fetching the offer, checking
// who the maker is, checking the token's decimals) to a message safe to
// show on screen.
export function toCancelOfferFormMessage(error: unknown): string {
  if (error instanceof CancelOfferError || error instanceof CreateOfferError) {
    return error.message;
  }
  return toPlainErrorMessage(error);
}
