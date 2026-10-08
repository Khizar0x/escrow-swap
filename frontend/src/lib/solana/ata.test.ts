import { describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import { offerAddress } from "./pda";
import { associatedTokenAddress } from "./ata";
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
