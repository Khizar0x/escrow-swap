import { describe, expect, it } from "vitest";
import { AnchorError, ProgramError } from "@anchor-lang/core";
import { WalletSignTransactionError } from "@solana/wallet-adapter-base";
import escrowIdl from "@/idl/escrow.json";
import { GENERIC_ERROR_MESSAGE, isUserRejection, toPlainErrorMessage } from "./map";

function fakeAnchorError(name: string, code: number) {
  return new AnchorError({ code: name, number: code }, "raw message", ["log"], ["log"]);
}

describe("toPlainErrorMessage", () => {
  it("maps every documented program error (6000-6005) to its own plain message", () => {
    for (const entry of escrowIdl.errors) {
      const message = toPlainErrorMessage(fakeAnchorError(entry.name, entry.code));
      expect(message).not.toBe(GENERIC_ERROR_MESSAGE);
      expect(message.length).toBeGreaterThan(0);
    }
  });

  it("maps SameMint to the exact expected message", () => {
    expect(toPlainErrorMessage(fakeAnchorError("SameMint", 6003))).toBe(
      "Choose two different tokens."
    );
  });

  it("maps a ProgramError the same way as an AnchorError", () => {
    const programError = new ProgramError(6002, "Offer amounts must be greater than zero");
    expect(toPlainErrorMessage(programError)).toBe("Enter an amount greater than zero.");
  });

  it("falls back to the generic message for an unknown code", () => {
    expect(toPlainErrorMessage(fakeAnchorError("SomethingNew", 9999))).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("falls back to the generic message for a non-program error", () => {
    expect(toPlainErrorMessage(new Error("socket hang up"))).toBe(GENERIC_ERROR_MESSAGE);
  });

  it("never surfaces a raw error string for an unmapped error", () => {
    const message = toPlainErrorMessage(new Error("424: custom program error: 0x270f"));
    expect(message).toBe(GENERIC_ERROR_MESSAGE);
  });
});

describe("isUserRejection", () => {
  it("is true for a wallet sign rejection", () => {
    expect(isUserRejection(new WalletSignTransactionError("User rejected the request."))).toBe(
      true
    );
  });

  it("is true for a message that mentions rejection without the wrapper class", () => {
    expect(isUserRejection(new Error("User rejected the request."))).toBe(true);
  });

  it("is false for an unrelated error", () => {
    expect(isUserRejection(new Error("Network request failed"))).toBe(false);
  });
});
