import { BN } from "@anchor-lang/core";
import { describe, expect, it, vi } from "vitest";
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
  TakeOfferError,
  assertNotOwnOffer,
  assertSufficientTakerBalance,
  buildTakeOfferTransaction,
  fetchFreshOffer,
  needsTakerTokenAccountA,
  toTakeOfferFormMessage,
} from "./takeOffer";

function testWallet() {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
}

const MAKER = Keypair.generate().publicKey;
const TAKER = Keypair.generate().publicKey;
const MINT_A = Keypair.generate().publicKey;
const MINT_B = Keypair.generate().publicKey;

function makeOffer(overrides: Partial<Offer> = {}, programId: PublicKey): Offer {
  const offerId = overrides.offerId ?? BigInt(7);
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

describe("fetchFreshOffer", () => {
  it("decodes the offer when it still exists", async () => {
    const getAccountInfo = vi.fn();
    const connection = { getAccountInfo } as unknown as Connection;
    const program = createEscrowProgram(connection, testWallet());
    const offer = makeOffer({}, program.programId);

    const data = await program.coder.accounts.encode("offer", {
      offerId: new BN(offer.offerId.toString()),
      maker: offer.maker,
      tokenMintA: offer.tokenA,
      tokenMintB: offer.tokenB,
      amountA: new BN(offer.amountA.toString()),
      amountB: new BN(offer.amountB.toString()),
      bump: 1,
    });
    getAccountInfo.mockResolvedValue({ data });

    const result = await fetchFreshOffer(program, offer.offerAddress);
    expect(result.maker.equals(offer.maker)).toBe(true);
    expect(result.amountA).toBe(offer.amountA);
  });

  it("stops with a plain message when the offer no longer exists", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue(null);
    const connection = { getAccountInfo } as unknown as Connection;
    const program = createEscrowProgram(connection, testWallet());

    await expect(fetchFreshOffer(program, Keypair.generate().publicKey)).rejects.toThrow(
      "This offer is no longer available. It may have been taken or canceled."
    );
  });

  it("treats a decode failure the same as the offer not existing", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue({ data: Buffer.from([1, 2, 3, 4]) });
    const connection = { getAccountInfo } as unknown as Connection;
    const program = createEscrowProgram(connection, testWallet());

    await expect(fetchFreshOffer(program, Keypair.generate().publicKey)).rejects.toThrow(TakeOfferError);
  });
});

describe("assertNotOwnOffer", () => {
  it("blocks the maker from taking their own offer", () => {
    const offer = makeOffer({ maker: TAKER }, PublicKey.default);
    expect(() => assertNotOwnOffer(offer, TAKER)).toThrow(
      "You made this offer. Use My Offers to cancel it."
    );
  });

  it("allows anyone else", () => {
    const offer = makeOffer({ maker: MAKER }, PublicKey.default);
    expect(() => assertNotOwnOffer(offer, TAKER)).not.toThrow();
  });
});

describe("assertSufficientTakerBalance", () => {
  it("passes when the taker holds enough", async () => {
    const getTokenAccountBalance = vi.fn().mockResolvedValue({ value: { amount: "2000000" } });
    const connection = { getTokenAccountBalance } as unknown as Connection;
    const offer = makeOffer({}, PublicKey.default);

    await expect(
      assertSufficientTakerBalance(connection, TAKER, offer, 6, TOKEN_PROGRAM_ID)
    ).resolves.toBeUndefined();
  });

  it("rejects with the amounts in plain decimals when the balance is too low", async () => {
    const getTokenAccountBalance = vi.fn().mockResolvedValue({ value: { amount: "500000" } });
    const connection = { getTokenAccountBalance } as unknown as Connection;
    const offer = makeOffer({ amountB: BigInt(2_000_000) }, PublicKey.default);

    await expect(
      assertSufficientTakerBalance(connection, TAKER, offer, 6, TOKEN_PROGRAM_ID)
    ).rejects.toThrow("You need 2 of this token to take this offer, but you have 0.5.");
  });
});

describe("needsTakerTokenAccountA", () => {
  it("is true when the taker has no account for that token yet", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue(null);
    const connection = { getAccountInfo } as unknown as Connection;
    await expect(needsTakerTokenAccountA(connection, TAKER, MINT_A, TOKEN_PROGRAM_ID)).resolves.toBe(true);
  });

  it("is false when the account already exists", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue({ data: Buffer.alloc(0) });
    const connection = { getAccountInfo } as unknown as Connection;
    await expect(needsTakerTokenAccountA(connection, TAKER, MINT_A, TOKEN_PROGRAM_ID)).resolves.toBe(false);
  });

  it("checks under the given token program, not always the classic one", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue(null);
    const connection = { getAccountInfo } as unknown as Connection;

    await needsTakerTokenAccountA(connection, TAKER, MINT_A, TOKEN_2022_PROGRAM_ID);

    expect(getAccountInfo).toHaveBeenCalledWith(associatedTokenAddress(MINT_A, TAKER, TOKEN_2022_PROGRAM_ID));
  });
});

describe("buildTakeOfferTransaction", () => {
  function program() {
    const connection = {} as unknown as Connection;
    return createEscrowProgram(connection, testWallet());
  }

  it("rejects taking your own offer", async () => {
    const p = program();
    const offer = makeOffer({ maker: TAKER }, p.programId);

    await expect(
      buildTakeOfferTransaction({
        program: p,
        taker: TAKER,
        offer,
        tokenProgramA: TOKEN_PROGRAM_ID,
        tokenProgramB: TOKEN_PROGRAM_ID,
        createsTakerTokenAccountA: false,
      })
    ).rejects.toThrow("You made this offer. Use My Offers to cancel it.");
  });

  it("stops if the given offer address no longer matches the program's seeds (gone or stale)", async () => {
    const p = program();
    const offer = makeOffer({ offerAddress: Keypair.generate().publicKey }, p.programId);

    await expect(
      buildTakeOfferTransaction({
        program: p,
        taker: TAKER,
        offer,
        tokenProgramA: TOKEN_PROGRAM_ID,
        tokenProgramB: TOKEN_PROGRAM_ID,
        createsTakerTokenAccountA: false,
      })
    ).rejects.toThrow("This offer is no longer available. It may have been taken or canceled.");
  });

  it("rejects when the offer's two tokens don't share a token program", async () => {
    const p = program();
    const offer = makeOffer({}, p.programId);

    await expect(
      buildTakeOfferTransaction({
        program: p,
        taker: TAKER,
        offer,
        tokenProgramA: TOKEN_PROGRAM_ID,
        tokenProgramB: TOKEN_2022_PROGRAM_ID,
        createsTakerTokenAccountA: false,
      })
    ).rejects.toThrow("These two tokens can't be combined. Choose a different pair.");
  });

  it("adds a create-token-account instruction before take_offer when the taker needs one", async () => {
    const p = program();
    const offer = makeOffer({}, p.programId);

    const result = await buildTakeOfferTransaction({
      program: p,
      taker: TAKER,
      offer,
      tokenProgramA: TOKEN_PROGRAM_ID,
      tokenProgramB: TOKEN_PROGRAM_ID,
      createsTakerTokenAccountA: true,
    });

    expect(result.transaction.instructions).toHaveLength(2);
    expect(result.transaction.instructions[0].programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
    expect(result.transaction.instructions[0].data).toEqual(Buffer.from([1]));
    expect(result.transaction.instructions[1].programId.equals(p.programId)).toBe(true);
  });

  it("skips the create-token-account instruction when the taker already has one", async () => {
    const p = program();
    const offer = makeOffer({}, p.programId);

    const result = await buildTakeOfferTransaction({
      program: p,
      taker: TAKER,
      offer,
      tokenProgramA: TOKEN_PROGRAM_ID,
      tokenProgramB: TOKEN_PROGRAM_ID,
      createsTakerTokenAccountA: false,
    });

    expect(result.transaction.instructions).toHaveLength(1);
  });

  it("orders the take_offer accounts exactly as the IDL declares them", async () => {
    const p = program();
    const offer = makeOffer({}, p.programId);

    const result = await buildTakeOfferTransaction({
      program: p,
      taker: TAKER,
      offer,
      tokenProgramA: TOKEN_PROGRAM_ID,
      tokenProgramB: TOKEN_PROGRAM_ID,
      createsTakerTokenAccountA: false,
    });

    const takeIx = result.transaction.instructions[0];
    const expected = [
      TAKER,
      offer.maker,
      offer.tokenA,
      offer.tokenB,
      offer.offerAddress,
      associatedTokenAddress(offer.tokenA, offer.offerAddress, TOKEN_PROGRAM_ID),
      associatedTokenAddress(offer.tokenA, TAKER, TOKEN_PROGRAM_ID),
      associatedTokenAddress(offer.tokenB, TAKER, TOKEN_PROGRAM_ID),
      associatedTokenAddress(offer.tokenB, offer.maker, TOKEN_PROGRAM_ID),
      ASSOCIATED_TOKEN_PROGRAM_ID,
      TOKEN_PROGRAM_ID,
      SystemProgram.programId,
    ];

    expect(takeIx.keys).toHaveLength(expected.length);
    takeIx.keys.forEach((key, index) => {
      expect(key.pubkey.equals(expected[index])).toBe(true);
    });
  });

  it("uses the Token-2022 program throughout when both tokens are Token-2022", async () => {
    const p = program();
    const offer = makeOffer({}, p.programId);

    const result = await buildTakeOfferTransaction({
      program: p,
      taker: TAKER,
      offer,
      tokenProgramA: TOKEN_2022_PROGRAM_ID,
      tokenProgramB: TOKEN_2022_PROGRAM_ID,
      createsTakerTokenAccountA: false,
    });

    const takeIx = result.transaction.instructions[0];
    expect(takeIx.keys[5].pubkey.equals(associatedTokenAddress(offer.tokenA, offer.offerAddress, TOKEN_2022_PROGRAM_ID))).toBe(
      true
    );
    expect(takeIx.keys[10].pubkey.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
  });
});

describe("toTakeOfferFormMessage", () => {
  it("passes through a TakeOfferError's own message unchanged", () => {
    expect(
      toTakeOfferFormMessage(new TakeOfferError("You made this offer. Use My Offers to cancel it."))
    ).toBe("You made this offer. Use My Offers to cancel it.");
  });

  it("passes through a reused CreateOfferError's own message unchanged", () => {
    expect(toTakeOfferFormMessage(new CreateOfferError("These two tokens can't be combined. Choose a different pair."))).toBe(
      "These two tokens can't be combined. Choose a different pair."
    );
  });

  it("passes through a TokenProgramError's own message unchanged", () => {
    expect(
      toTakeOfferFormMessage(new TokenProgramError("This token takes a fee on every transfer. It isn't supported here."))
    ).toBe("This token takes a fee on every transfer. It isn't supported here.");
  });

  it("never shows a raw error for an unexpected failure", () => {
    expect(toTakeOfferFormMessage(new TypeError("offerIdBytes.writeBigUInt64LE is not a function"))).toBe(
      GENERIC_ERROR_MESSAGE
    );
  });

  it("maps a wallet rejection to the plain take message, not the generic one", () => {
    expect(toTakeOfferFormMessage(new WalletSignTransactionError("User rejected the request."))).toBe(
      USER_REJECTED_MESSAGE
    );
  });
});
