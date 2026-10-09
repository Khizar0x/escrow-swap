import { describe, expect, it, vi } from "vitest";
import type { Connection } from "@solana/web3.js";
import { Connection as RealConnection, Keypair, PublicKey } from "@solana/web3.js";
import { WalletSignTransactionError } from "@solana/wallet-adapter-base";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/solana/ata";
import { AmountError } from "@/lib/solana/amounts";
import { offerAddress } from "@/lib/solana/pda";
import { TokenProgramError } from "@/lib/solana/tokenProgram";
import { createEscrowProgram } from "@/lib/anchor/program";
import { GENERIC_ERROR_MESSAGE, USER_REJECTED_MESSAGE } from "@/lib/errors/map";
import {
  CreateOfferError,
  assertDistinctMints,
  assertSameTokenProgram,
  assertSufficientBalance,
  buildCreateOfferTransaction,
  pickOfferId,
  randomOfferId,
  toCreateOfferFormMessage,
} from "./createOffer";

const MINT_A = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const MINT_B = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
const MAKER = new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
const PROGRAM_ID = new PublicKey("WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b");

describe("assertDistinctMints", () => {
  it("passes for two different mints", () => {
    expect(() => assertDistinctMints(MINT_A, MINT_B)).not.toThrow();
  });

  it("rejects the same mint for both sides", () => {
    expect(() => assertDistinctMints(MINT_A, MINT_A)).toThrow(CreateOfferError);
  });
});

describe("assertSameTokenProgram", () => {
  it("passes when both tokens share a token program", () => {
    expect(() => assertSameTokenProgram(TOKEN_PROGRAM_ID, TOKEN_PROGRAM_ID)).not.toThrow();
    expect(() => assertSameTokenProgram(TOKEN_2022_PROGRAM_ID, TOKEN_2022_PROGRAM_ID)).not.toThrow();
  });

  it("rejects a classic token paired with a Token-2022 token", () => {
    expect(() => assertSameTokenProgram(TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID)).toThrow(
      "These two tokens can't be combined. Choose a different pair."
    );
  });
});

describe("assertSufficientBalance", () => {
  it("passes when the wallet holds exactly enough", () => {
    expect(() => assertSufficientBalance(BigInt(100), BigInt(100))).not.toThrow();
  });

  it("passes when the wallet holds more than enough", () => {
    expect(() => assertSufficientBalance(BigInt(100), BigInt(150))).not.toThrow();
  });

  it("rejects a short balance", () => {
    expect(() => assertSufficientBalance(BigInt(100), BigInt(99))).toThrow(CreateOfferError);
  });
});

describe("randomOfferId", () => {
  it("stays within u64 bounds", () => {
    const id = randomOfferId();
    expect(id >= BigInt(0)).toBe(true);
    expect(id <= BigInt(2) ** BigInt(64) - BigInt(1)).toBe(true);
  });

  it("is not the same value every time", () => {
    const ids = new Set(Array.from({ length: 10 }, () => randomOfferId().toString()));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe("pickOfferId", () => {
  it("returns an offer ID with nothing already at its address", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue(null);
    const connection = { getAccountInfo } as unknown as Connection;

    const offerId = await pickOfferId(connection, PROGRAM_ID, MAKER);

    expect(typeof offerId).toBe("bigint");
    expect(getAccountInfo).toHaveBeenCalledTimes(1);
  });

  it("retries when the first candidate is already taken", async () => {
    const getAccountInfo = vi
      .fn()
      .mockResolvedValueOnce({ data: Buffer.alloc(0), owner: PROGRAM_ID })
      .mockResolvedValueOnce(null);
    const connection = { getAccountInfo } as unknown as Connection;

    await pickOfferId(connection, PROGRAM_ID, MAKER);

    expect(getAccountInfo).toHaveBeenCalledTimes(2);
  });
});

describe("buildCreateOfferTransaction", () => {
  function fakeWallet() {
    const keypair = Keypair.generate();
    return {
      publicKey: keypair.publicKey,
      signTransaction: async <T>(tx: T) => tx,
      signAllTransactions: async <T>(txs: T[]) => txs,
    };
  }

  it("builds a single instruction targeting the program, using the derived offer address", async () => {
    const connection = new RealConnection("http://127.0.0.1:1", "confirmed");
    const program = createEscrowProgram(connection, fakeWallet());
    const offerId = BigInt(42);

    const result = await buildCreateOfferTransaction({
      program,
      maker: MAKER,
      mintA: MINT_A,
      mintB: MINT_B,
      tokenProgramA: TOKEN_PROGRAM_ID,
      tokenProgramB: TOKEN_PROGRAM_ID,
      amountA: BigInt(1_000_000),
      amountB: BigInt(2_000_000),
      offerId,
    });

    expect(result.transaction.instructions).toHaveLength(1);
    expect(result.transaction.instructions[0].programId.equals(program.programId)).toBe(true);
    expect(result.offerAddress.equals(offerAddress(PROGRAM_ID, MAKER, offerId))).toBe(true);
  });

  it("builds a Token-2022 offer when both tokens are Token-2022", async () => {
    const connection = new RealConnection("http://127.0.0.1:1", "confirmed");
    const program = createEscrowProgram(connection, fakeWallet());

    const result = await buildCreateOfferTransaction({
      program,
      maker: MAKER,
      mintA: MINT_A,
      mintB: MINT_B,
      tokenProgramA: TOKEN_2022_PROGRAM_ID,
      tokenProgramB: TOKEN_2022_PROGRAM_ID,
      amountA: BigInt(1_000_000),
      amountB: BigInt(2_000_000),
      offerId: BigInt(43),
    });

    expect(result.transaction.instructions[0].keys.some((key) => key.pubkey.equals(TOKEN_2022_PROGRAM_ID))).toBe(
      true
    );
  });

  it("rejects building a transaction for the same mint on both sides", async () => {
    const connection = new RealConnection("http://127.0.0.1:1", "confirmed");
    const program = createEscrowProgram(connection, fakeWallet());

    await expect(
      buildCreateOfferTransaction({
        program,
        maker: MAKER,
        mintA: MINT_A,
        mintB: MINT_A,
        tokenProgramA: TOKEN_PROGRAM_ID,
        tokenProgramB: TOKEN_PROGRAM_ID,
        amountA: BigInt(1),
        amountB: BigInt(1),
        offerId: BigInt(1),
      })
    ).rejects.toThrow(CreateOfferError);
  });

  it("rejects building a transaction when the two tokens don't share a token program", async () => {
    const connection = new RealConnection("http://127.0.0.1:1", "confirmed");
    const program = createEscrowProgram(connection, fakeWallet());

    await expect(
      buildCreateOfferTransaction({
        program,
        maker: MAKER,
        mintA: MINT_A,
        mintB: MINT_B,
        tokenProgramA: TOKEN_PROGRAM_ID,
        tokenProgramB: TOKEN_2022_PROGRAM_ID,
        amountA: BigInt(1),
        amountB: BigInt(1),
        offerId: BigInt(1),
      })
    ).rejects.toThrow("These two tokens can't be combined. Choose a different pair.");
  });
});

describe("toCreateOfferFormMessage", () => {
  it("passes through an AmountError's own message unchanged", () => {
    expect(toCreateOfferFormMessage(new AmountError("Enter an amount greater than zero."))).toBe(
      "Enter an amount greater than zero."
    );
  });

  it("passes through a CreateOfferError's own message unchanged", () => {
    expect(toCreateOfferFormMessage(new CreateOfferError("Choose two different tokens."))).toBe(
      "Choose two different tokens."
    );
  });

  it("never shows a raw JavaScript error, including the bug that prompted this test", () => {
    const message = toCreateOfferFormMessage(
      new TypeError("offerIdBytes.writeBigUInt64LE is not a function")
    );
    expect(message).toBe(GENERIC_ERROR_MESSAGE);
    expect(message).not.toContain("writeBigUInt64LE");
  });

  it("never shows a raw error for an unexpected plain Error", () => {
    expect(toCreateOfferFormMessage(new Error("boom"))).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("passes through a TokenProgramError's own message unchanged", () => {
    expect(
      toCreateOfferFormMessage(new TokenProgramError("This token takes a fee on every transfer. It isn't supported here."))
    ).toBe("This token takes a fee on every transfer. It isn't supported here.");
  });

  it("maps a wallet rejection to the plain create message, not the generic one", () => {
    expect(toCreateOfferFormMessage(new WalletSignTransactionError("User rejected the request."))).toBe(
      USER_REJECTED_MESSAGE
    );
  });
});
