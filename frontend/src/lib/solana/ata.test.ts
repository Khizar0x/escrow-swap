import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { offerAddress } from "./pda";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  associatedTokenAddress,
  createAssociatedTokenAccountIdempotentInstruction,
} from "./ata";
import escrowIdl from "@/idl/escrow.json";

const PROGRAM_ID = new PublicKey(escrowIdl.address);
const MAKER = new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");
const MINT_A = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");

describe("associatedTokenAddress", () => {
  it("matches a wallet's own token account (computed independently)", () => {
    expect(associatedTokenAddress(MINT_A, MAKER).toBase58()).toBe(
      "C4PRXFV6Gf5mytVZb6RoeLsG8CjcFWzR2EJ3dvwPTUJH"
    );
  });

  it("matches the vault for an offer PDA, using the offer as the owner", () => {
    const offer = offerAddress(PROGRAM_ID, MAKER, BigInt(42));
    expect(associatedTokenAddress(MINT_A, offer).toBase58()).toBe(
      "JNxjPXuWHeKHk52TJ8DtfiJJ5KiCUPeBekL2rzGEKSA"
    );
  });

  it("gives a different address for a different mint", () => {
    const other = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
    const a = associatedTokenAddress(MINT_A, MAKER);
    const b = associatedTokenAddress(other, MAKER);
    expect(a.equals(b)).toBe(false);
  });
});

describe("createAssociatedTokenAccountIdempotentInstruction", () => {
  it("targets the associated token program, with the CreateIdempotent selector and the derived account", () => {
    const ix = createAssociatedTokenAccountIdempotentInstruction(MAKER, MAKER, MINT_A);

    expect(ix.programId.equals(ASSOCIATED_TOKEN_PROGRAM_ID)).toBe(true);
    expect(ix.data).toEqual(Buffer.from([1]));
    expect(ix.keys).toHaveLength(6);
    expect(ix.keys[0]).toMatchObject({ pubkey: MAKER, isSigner: true, isWritable: true });
    expect(ix.keys[1].pubkey.equals(associatedTokenAddress(MINT_A, MAKER))).toBe(true);
    expect(ix.keys[1]).toMatchObject({ isSigner: false, isWritable: true });
    expect(ix.keys[2]).toMatchObject({ pubkey: MAKER, isSigner: false, isWritable: false });
    expect(ix.keys[3]).toMatchObject({ pubkey: MINT_A, isSigner: false, isWritable: false });
    expect(ix.keys[5]).toMatchObject({ pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false });
  });
});
