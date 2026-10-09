import { BN } from "@anchor-lang/core";
import { describe, expect, it, vi } from "vitest";
import type { Connection } from "@solana/web3.js";
import { Keypair, PublicKey } from "@solana/web3.js";
import { createEscrowProgram } from "@/lib/anchor/program";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/solana/ata";
import {
  availableOffers,
  fetchOfferTokenDecimals,
  fetchOffers,
  marketplaceEmptyState,
  myOffers,
  type Offer,
} from "./fetchOffers";

function testWallet() {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
}

const MAKER = Keypair.generate().publicKey;
const OTHER_MAKER = Keypair.generate().publicKey;
const MINT_A = Keypair.generate().publicKey;
const MINT_B = Keypair.generate().publicKey;

describe("fetchOffers", () => {
  it("decodes every valid Offer account and skips the ones that fail to decode", async () => {
    const getProgramAccounts = vi.fn();
    const connection = { getProgramAccounts } as unknown as Connection;
    const program = createEscrowProgram(connection, testWallet());

    const good = await program.coder.accounts.encode("offer", {
      offerId: new BN(42),
      maker: MAKER,
      tokenMintA: MINT_A,
      tokenMintB: MINT_B,
      amountA: new BN(1_000_000),
      amountB: new BN(2_000_000),
      bump: 1,
    });

    const goodPubkey = Keypair.generate().publicKey;
    const badPubkey = Keypair.generate().publicKey;

    getProgramAccounts.mockResolvedValue([
      { pubkey: goodPubkey, account: { data: good } },
      // A non-Offer account the program owns (e.g. the Counter account, or
      // anything else that fails the discriminator check).
      { pubkey: badPubkey, account: { data: Buffer.from([1, 2, 3, 4]) } },
    ]);

    const result = await fetchOffers(program);

    expect(result.skipped).toBe(1);
    expect(result.offers).toHaveLength(1);
    const offer = result.offers[0];
    expect(offer.offerAddress.equals(goodPubkey)).toBe(true);
    expect(offer.maker.equals(MAKER)).toBe(true);
    expect(offer.tokenA.equals(MINT_A)).toBe(true);
    expect(offer.tokenB.equals(MINT_B)).toBe(true);
    expect(offer.amountA).toBe(BigInt(1_000_000));
    expect(offer.amountB).toBe(BigInt(2_000_000));
    expect(offer.offerId).toBe(BigInt(42));
  });

  it("returns no offers and no error when the program owns nothing", async () => {
    const getProgramAccounts = vi.fn().mockResolvedValue([]);
    const connection = { getProgramAccounts } as unknown as Connection;
    const program = createEscrowProgram(connection, testWallet());

    const result = await fetchOffers(program);

    expect(result.offers).toEqual([]);
    expect(result.skipped).toBe(0);
  });
});

describe("fetchOfferTokenDecimals", () => {
  function mintAccountInfo(owner: PublicKey, decimals: number) {
    const data = Buffer.alloc(82);
    data.writeUInt8(decimals, 44);
    return { data, owner };
  }

  it("looks up each distinct token once and reuses the result for every offer that shares it", async () => {
    const getAccountInfo = vi.fn().mockResolvedValue(mintAccountInfo(TOKEN_PROGRAM_ID, 6));
    const connection = { getAccountInfo } as unknown as Connection;

    const offers: Offer[] = [
      { offerAddress: Keypair.generate().publicKey, maker: MAKER, tokenA: MINT_A, tokenB: MINT_B, amountA: BigInt(1), amountB: BigInt(1), offerId: BigInt(1) },
      { offerAddress: Keypair.generate().publicKey, maker: MAKER, tokenA: MINT_A, tokenB: MINT_B, amountA: BigInt(1), amountB: BigInt(1), offerId: BigInt(2) },
    ];

    const result = await fetchOfferTokenDecimals(connection, offers);

    expect(getAccountInfo).toHaveBeenCalledTimes(2); // once for MINT_A, once for MINT_B
    expect(result.decimals.get(MINT_A.toBase58())).toBe(6);
    expect(result.decimals.get(MINT_B.toBase58())).toBe(6);
    expect(result.unavailable.size).toBe(0);
  });

  it("marks a token unavailable instead of falling back to 0 decimals", async () => {
    const getAccountInfo = vi
      .fn()
      .mockResolvedValueOnce(mintAccountInfo(TOKEN_PROGRAM_ID, 6))
      .mockResolvedValueOnce(mintAccountInfo(Keypair.generate().publicKey, 0));
    const connection = { getAccountInfo } as unknown as Connection;

    const offers: Offer[] = [
      { offerAddress: Keypair.generate().publicKey, maker: MAKER, tokenA: MINT_A, tokenB: MINT_B, amountA: BigInt(1), amountB: BigInt(1), offerId: BigInt(1) },
    ];

    const result = await fetchOfferTokenDecimals(connection, offers);

    expect(result.decimals.has(MINT_B.toBase58())).toBe(false);
    expect(result.unavailable.has(MINT_B.toBase58())).toBe(true);
  });

  it("reads decimals for a plain Token-2022 token the same as a classic one", async () => {
    const getAccountInfo = vi
      .fn()
      .mockResolvedValueOnce(mintAccountInfo(TOKEN_PROGRAM_ID, 6))
      .mockResolvedValueOnce(mintAccountInfo(TOKEN_2022_PROGRAM_ID, 9));
    const connection = { getAccountInfo } as unknown as Connection;

    const offers: Offer[] = [
      { offerAddress: Keypair.generate().publicKey, maker: MAKER, tokenA: MINT_A, tokenB: MINT_B, amountA: BigInt(1), amountB: BigInt(1), offerId: BigInt(1) },
    ];

    const result = await fetchOfferTokenDecimals(connection, offers);

    expect(result.decimals.get(MINT_B.toBase58())).toBe(9);
    expect(result.unavailable.has(MINT_B.toBase58())).toBe(false);
  });
});

describe("availableOffers", () => {
  const mine: Offer = { offerAddress: Keypair.generate().publicKey, maker: MAKER, tokenA: MINT_A, tokenB: MINT_B, amountA: BigInt(1), amountB: BigInt(1), offerId: BigInt(5) };
  const theirs: Offer = { offerAddress: Keypair.generate().publicKey, maker: OTHER_MAKER, tokenA: MINT_A, tokenB: MINT_B, amountA: BigInt(1), amountB: BigInt(1), offerId: BigInt(9) };

  it("hides the connected wallet's own offers", () => {
    const result = availableOffers([mine, theirs], MAKER);
    expect(result).toEqual([theirs]);
  });

  it("shows every offer when no wallet is connected", () => {
    const result = availableOffers([mine, theirs], null);
    expect(result).toHaveLength(2);
  });

  it("sorts by offer ID descending", () => {
    const result = availableOffers([mine, theirs], null);
    expect(result.map((offer) => offer.offerId)).toEqual([BigInt(9), BigInt(5)]);
  });
});

describe("myOffers", () => {
  const mine: Offer = { offerAddress: Keypair.generate().publicKey, maker: MAKER, tokenA: MINT_A, tokenB: MINT_B, amountA: BigInt(1), amountB: BigInt(1), offerId: BigInt(1) };
  const theirs: Offer = { offerAddress: Keypair.generate().publicKey, maker: OTHER_MAKER, tokenA: MINT_A, tokenB: MINT_B, amountA: BigInt(1), amountB: BigInt(1), offerId: BigInt(2) };

  it("shows only the connected wallet's own offers", () => {
    const result = myOffers([mine, theirs], MAKER);
    expect(result).toEqual([mine]);
  });
});

describe("marketplaceEmptyState", () => {
  const mine: Offer = { offerAddress: Keypair.generate().publicKey, maker: MAKER, tokenA: MINT_A, tokenB: MINT_B, amountA: BigInt(1), amountB: BigInt(1), offerId: BigInt(1) };
  const theirs: Offer = { offerAddress: Keypair.generate().publicKey, maker: OTHER_MAKER, tokenA: MINT_A, tokenB: MINT_B, amountA: BigInt(1), amountB: BigInt(1), offerId: BigInt(2) };

  it("is 'none' when there are no offers at all", () => {
    expect(marketplaceEmptyState([], null)).toBe("none");
    expect(marketplaceEmptyState([], MAKER)).toBe("none");
  });

  it("is null when there is at least one offer from someone else", () => {
    expect(marketplaceEmptyState([theirs], MAKER)).toBeNull();
    expect(marketplaceEmptyState([mine, theirs], MAKER)).toBeNull();
  });

  it("is 'none-from-others' when every offer belongs to the connected wallet", () => {
    expect(marketplaceEmptyState([mine], MAKER)).toBe("none-from-others");
  });

  it("is null with no wallet connected whenever any offer exists", () => {
    expect(marketplaceEmptyState([mine], null)).toBeNull();
  });
});
