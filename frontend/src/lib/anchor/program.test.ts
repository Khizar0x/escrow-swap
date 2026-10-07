import { describe, expect, it } from "vitest";
import anchor from "@anchor-lang/core";
import { Connection, Keypair } from "@solana/web3.js";
import { createEscrowProgram, escrowIdl } from "./program";

const { BN, BorshAccountsCoder } = anchor;

// A signer that never leaves this test. It exists only so the client can be built.
function testWallet() {
  const keypair = Keypair.generate();
  return {
    publicKey: keypair.publicKey,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
}

describe("createEscrowProgram", () => {
  it("builds a client that uses the program ID from the IDL", () => {
    // No request is made here. The connection is never used.
    const connection = new Connection("http://127.0.0.1:1", "confirmed");
    const program = createEscrowProgram(connection, testWallet());

    expect(program.programId.toBase58()).toBe(escrowIdl.address);
    expect(Object.keys(program.methods)).toEqual(
      expect.arrayContaining(["makeOffer", "takeOffer", "cancelOffer"])
    );
  });
});

describe("Offer account layout", () => {
  it("round-trips every field, including the largest u64", async () => {
    const coder = new BorshAccountsCoder(escrowIdl);
    const input = {
      offer_id: new BN(42),
      maker: Keypair.generate().publicKey,
      token_mint_a: Keypair.generate().publicKey,
      token_mint_b: Keypair.generate().publicKey,
      amount_a: new BN("18446744073709551615"),
      amount_b: new BN(7),
      bump: 254,
    };

    const encoded = await coder.encode("Offer", input);
    const output = coder.decode("Offer", encoded);

    expect(output.offer_id.toString()).toBe("42");
    expect(output.maker.equals(input.maker)).toBe(true);
    expect(output.token_mint_a.equals(input.token_mint_a)).toBe(true);
    expect(output.token_mint_b.equals(input.token_mint_b)).toBe(true);
    expect(output.amount_a.toString()).toBe("18446744073709551615");
    expect(output.amount_b.toString()).toBe("7");
    expect(output.bump).toBe(254);
  });
});
