import { describe, expect, it } from "vitest";
import type { Connection } from "@solana/web3.js";
import { Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import { WalletSignTransactionError } from "@solana/wallet-adapter-base";
import { createEscrowProgram } from "@/lib/anchor/program";
import { CreateOfferError } from "@/lib/escrow/createOffer";
import type { Offer } from "@/lib/escrow/fetchOffers";
import { GENERIC_ERROR_MESSAGE, USER_REJECTED_MESSAGE } from "@/lib/errors/map";
import { ASSOCIATED_TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID, associatedTokenAddress } from "@/lib/solana/ata";
import { offerAddress } from "@/lib/solana/pda";
import { TokenProgramError } from "@/lib/solana/tokenProgram";
import {
  CancelOfferError,
  assertIsMaker,
  buildCancelOfferTransaction,
  toCancelOfferFormMessage,
} from "./cancelOffer";

function testWallet() {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
}

const MAKER = Keypair.generate().publicKey;
const OTHER = Keypair.generate().publicKey;
const MINT_A = Keypair.generate().publicKey;
const MINT_B = Keypair.generate().publicKey;

function makeOffer(overrides: Partial<Offer> = {}, programId: PublicKey): Offer {
  const offerId = overrides.offerId ?? BigInt(11);
  return {
    offerAddress: overrides.offerAddress ?? offerAddress(programId, overrides.maker ?? MAKER, offerId),
    maker: overrides.maker ?? MAKER,
    tokenA: overrides.tokenA ?? MINT_A,
    tokenB: overrides.tokenB ?? MINT_B,
    amountA: overrides.amountA ?? BigInt(1_000_000),
    amountB: overrides.amountB ?? BigInt(2_000_000),
    offerId,
  };
}

describe("assertIsMaker", () => {
  it("blocks anyone who is not the maker", () => {
    const offer = makeOffer({ maker: MAKER }, PublicKey.default);
    expect(() => assertIsMaker(offer, OTHER)).toThrow(
      "Only the person who made this offer can cancel it."
    );
  });

  it("allows the maker", () => {
    const offer = makeOffer({ maker: MAKER }, PublicKey.default);
    expect(() => assertIsMaker(offer, MAKER)).not.toThrow();
  });
});

describe("buildCancelOfferTransaction", () => {
  function program() {
    const connection = {} as unknown as Connection;
    return createEscrowProgram(connection, testWallet());
  }

  it("rejects canceling someone else's offer", async () => {
    const p = program();
    const offer = makeOffer({ maker: MAKER }, p.programId);

    await expect(
      buildCancelOfferTransaction({ program: p, maker: OTHER, offer, tokenProgram: TOKEN_PROGRAM_ID })
    ).rejects.toThrow("Only the person who made this offer can cancel it.");
  });

  it("stops if the given offer address no longer matches the program's seeds (gone or already canceled)", async () => {
    const p = program();
    const offer = makeOffer({ offerAddress: Keypair.generate().publicKey }, p.programId);

    await expect(
      buildCancelOfferTransaction({ program: p, maker: MAKER, offer, tokenProgram: TOKEN_PROGRAM_ID })
    ).rejects.toThrow("This offer is no longer available. It may have been taken or canceled.");
  });

  it("orders the cancel_offer accounts exactly as the IDL declares them", async () => {
    const p = program();
    const offer = makeOffer({}, p.programId);

    const result = await buildCancelOfferTransaction({
      program: p,
      maker: MAKER,
      offer,
      tokenProgram: TOKEN_PROGRAM_ID,
    });

    expect(result.transaction.instructions).toHaveLength(1);
    const cancelIx = result.transaction.instructions[0];
    expect(cancelIx.programId.equals(p.programId)).toBe(true);

    const expected = [
      MAKER,
      offer.tokenA,
      offer.offerAddress,
      associatedTokenAddress(offer.tokenA, MAKER, TOKEN_PROGRAM_ID),
      associatedTokenAddress(offer.tokenA, offer.offerAddress, TOKEN_PROGRAM_ID),
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      SystemProgram.programId,
    ];

    expect(cancelIx.keys).toHaveLength(expected.length);
    cancelIx.keys.forEach((key, index) => {
      expect(key.pubkey.equals(expected[index])).toBe(true);
    });
  });

  it("uses the Token-2022 program throughout when the offer's token is Token-2022", async () => {
    const p = program();
    const offer = makeOffer({}, p.programId);

    const result = await buildCancelOfferTransaction({
      program: p,
      maker: MAKER,
      offer,
      tokenProgram: TOKEN_2022_PROGRAM_ID,
    });

    const cancelIx = result.transaction.instructions[0];
    expect(
      cancelIx.keys[3].pubkey.equals(associatedTokenAddress(offer.tokenA, MAKER, TOKEN_2022_PROGRAM_ID))
    ).toBe(true);
    expect(cancelIx.keys[6].pubkey.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
  });
});

describe("toCancelOfferFormMessage", () => {
  it("passes through a CancelOfferError's own message unchanged", () => {
    expect(
      toCancelOfferFormMessage(new CancelOfferError("Only the person who made this offer can cancel it."))
    ).toBe("Only the person who made this offer can cancel it.");
  });

  it("passes through a reused CreateOfferError's own message unchanged", () => {
    expect(
      toCancelOfferFormMessage(new CreateOfferError("These two tokens can't be combined. Choose a different pair."))
    ).toBe("These two tokens can't be combined. Choose a different pair.");
  });

  it("passes through a TokenProgramError's own message unchanged", () => {
    expect(
      toCancelOfferFormMessage(new TokenProgramError("This token can be frozen by its creator. It isn't supported here."))
    ).toBe("This token can be frozen by its creator. It isn't supported here.");
  });

  it("never shows a raw error for an unexpected failure", () => {
    expect(toCancelOfferFormMessage(new TypeError("offerIdBytes.writeBigUInt64LE is not a function"))).toBe(
      GENERIC_ERROR_MESSAGE
    );
  });

  it("maps a wallet rejection to the plain cancel message, not the generic one", () => {
    expect(toCancelOfferFormMessage(new WalletSignTransactionError("User rejected the request."))).toBe(
      USER_REJECTED_MESSAGE
    );
  });
});
