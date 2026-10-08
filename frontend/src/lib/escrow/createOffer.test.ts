import { describe, expect, it, vi } from "vitest";
import type { Connection } from "@solana/web3.js";
import { Connection as RealConnection, Keypair, PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/solana/ata";
import { AmountError } from "@/lib/solana/amounts";
import { offerAddress } from "@/lib/solana/pda";
import { createEscrowProgram } from "@/lib/anchor/program";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors/map";
import {
  CreateOfferError,
  assertDistinctMints,
  assertSufficientBalance,
  buildCreateOfferTransaction,
  fetchMintDecimals,
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

describe("fetchMintDecimals", () => {
  it("reads the decimals byte from a classic SPL mint", async () => {
    const data = Buffer.alloc(82);
    data.writeUInt8(6, 44);
    const getAccountInfo = vi.fn().mockResolvedValue({ data, owner: TOKEN_PROGRAM_ID });
    const connection = { getAccountInfo } as unknown as Connection;

    await expect(fetchMintDecimals(connection, MINT_A)).resolves.toBe(6);
  });

  it("rejects a mint address that does not exist", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue(null);
    const connection = { getAccountInfo } as unknown as Connection;

    await expect(fetchMintDecimals(connection, MINT_A)).rejects.toThrow(
      "Could not find that token. Check the address."
    );
  });

  it("rejects a Token-2022 mint with a specific message, never falling back to 0 decimals", async () => {
    const data = Buffer.alloc(82);
    const getAccountInfo = vi
      .fn()
      .mockResolvedValue({ data, owner: TOKEN_2022_PROGRAM_ID });
    const connection = { getAccountInfo } as unknown as Connection;

    await expect(fetchMintDecimals(connection, MINT_A)).rejects.toThrow(
      "This token type is not supported yet."
    );
  });

  it("rejects an address owned by neither token program", async () => {
    const data = Buffer.alloc(82);
    const getAccountInfo = vi.fn().mockResolvedValue({ data, owner: PROGRAM_ID });
    const connection = { getAccountInfo } as unknown as Connection;

    await expect(fetchMintDecimals(connection, MINT_A)).rejects.toThrow(
      "This address is not a token."
    );
  });

  it("gives a clear error when the lookup itself fails, not a raw error", async () => {
    const getAccountInfo = vi.fn().mockRejectedValue(new Error("fetch failed"));
    const connection = { getAccountInfo } as unknown as Connection;

    await expect(fetchMintDecimals(connection, MINT_A)).rejects.toThrow(
      "Could not check this token. Try again."
    );
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
      amountA: BigInt(1_000_000),
      amountB: BigInt(2_000_000),
      offerId,
    });

    expect(result.transaction.instructions).toHaveLength(1);
    expect(result.transaction.instructions[0].programId.equals(program.programId)).toBe(true);
    expect(result.offerAddress.equals(offerAddress(PROGRAM_ID, MAKER, offerId))).toBe(true);
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
        amountA: BigInt(1),
        amountB: BigInt(1),
        offerId: BigInt(1),
      })
    ).rejects.toThrow(CreateOfferError);
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
});
