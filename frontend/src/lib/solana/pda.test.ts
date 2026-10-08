import { afterEach, describe, expect, it } from "vitest";
import { PublicKey } from "@solana/web3.js";
import escrowIdl from "@/idl/escrow.json";
import { offerAddress } from "./pda";

// The browser's Buffer polyfill does not implement Buffer's BigInt
// read/write methods. Stubbing them out here reproduces that gap so a
// regression back to using them fails in Vitest instead of in the browser.
const bufferProto = Buffer.prototype as unknown as Record<string, unknown>;
const bigIntMethodNames = [
  "writeBigUInt64LE",
  "writeBigUInt64BE",
  "readBigUInt64LE",
  "readBigUInt64BE",
];

const PROGRAM_ID = new PublicKey(escrowIdl.address);
const MAKER = new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU");

describe("offerAddress", () => {
  it("matches the program's seeds (computed independently with findProgramAddressSync)", () => {
    expect(offerAddress(PROGRAM_ID, MAKER, BigInt(42)).toBase58()).toBe(
      "5M4qxypJ2bfotK3hbr9vzS1AaCqVrRuUJAjXmDH5bUec"
    );
  });

  it("matches at the largest possible offer ID (u64 max)", () => {
    expect(
      offerAddress(PROGRAM_ID, MAKER, BigInt(2) ** BigInt(64) - BigInt(1)).toBase58()
    ).toBe("CZSzpNQWhaT3TGT4mNc7Q8Ag3Coikz5wp3GdQ6TvJhJ");
  });

  it("gives a different address for a different offer ID", () => {
    const a = offerAddress(PROGRAM_ID, MAKER, BigInt(1));
    const b = offerAddress(PROGRAM_ID, MAKER, BigInt(2));
    expect(a.equals(b)).toBe(false);
  });

  it("gives a different address for a different maker", () => {
    const other = new PublicKey("9xQeWvG816bUx9EPjHmaT23yvVM2ZWbrrpZb9PusVFin");
    const a = offerAddress(PROGRAM_ID, MAKER, BigInt(1));
    const b = offerAddress(PROGRAM_ID, other, BigInt(1));
    expect(a.equals(b)).toBe(false);
  });
});

describe("offerAddress without Buffer's BigInt methods (simulating the browser)", () => {
  const originals: Record<string, unknown> = {};

  for (const name of bigIntMethodNames) {
    originals[name] = bufferProto[name];
  }

  afterEach(() => {
    for (const name of bigIntMethodNames) {
      bufferProto[name] = originals[name];
    }
  });

  it("still matches the reference address with those methods removed", () => {
    for (const name of bigIntMethodNames) {
      delete bufferProto[name];
    }

    expect(offerAddress(PROGRAM_ID, MAKER, BigInt(42)).toBase58()).toBe(
      "5M4qxypJ2bfotK3hbr9vzS1AaCqVrRuUJAjXmDH5bUec"
    );
  });
});
