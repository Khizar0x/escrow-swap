import { describe, expect, it } from "vitest";
import { AnchorError, ProgramError } from "@anchor-lang/core";
import { WalletSignTransactionError } from "@solana/wallet-adapter-base";
import {
  TransactionExpiredBlockheightExceededError,
  TransactionExpiredTimeoutError,
} from "@solana/web3.js";
import escrowIdl from "@/idl/escrow.json";
import {
  EXPIRED_REQUEST_MESSAGE,
  expiredSignature,
  GENERIC_ERROR_MESSAGE,
  isExpiredRequestError,
  isUserRejection,
  toPlainErrorMessage,
  USER_REJECTED_MESSAGE,
} from "./map";

function fakeAnchorError(name: string, code: number) {
  return new AnchorError({ code: name, number: code }, "raw message", ["log"], ["log"]);
}

describe("toPlainErrorMessage", () => {
  it("maps every documented program error (6000-6009) to its own plain message", () => {
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

  it("is true for an error with the wrapper class's name but not an actual instance of it", () => {
    const fakeWalletError = new Error("User rejected the request.");
    fakeWalletError.name = "WalletSignTransactionError";
    expect(isUserRejection(fakeWalletError)).toBe(true);
  });

  it("is true for Phantom's real error shape: a WalletSignTransactionError wrapping a code-4001 object", () => {
    // Phantom's underlying provider rejects with {code: 4001, message: "User
    // Rejected the Request"}; the wallet-adapter wraps it, keeping the
    // original on .error, same as WalletError's own constructor does.
    const phantomError = { code: 4001, message: "User Rejected the Request" };
    const wrapped = new WalletSignTransactionError("User rejected the request.", phantomError);
    expect(isUserRejection(wrapped)).toBe(true);
  });

  it("is true for a bare code-4001 object with no wrapper class at all", () => {
    expect(isUserRejection({ code: 4001, message: "User Rejected the Request" })).toBe(true);
  });

  it("is false for an unrelated error", () => {
    expect(isUserRejection(new Error("Network request failed"))).toBe(false);
  });

  it("is false for an unrelated object with an unrelated numeric code", () => {
    expect(isUserRejection({ code: 500, message: "Internal error" })).toBe(false);
  });
});

describe("isExpiredRequestError", () => {
  it("is true for TransactionExpiredBlockheightExceededError", () => {
    expect(isExpiredRequestError(new TransactionExpiredBlockheightExceededError("SIG123"))).toBe(true);
  });

  it("is true for TransactionExpiredTimeoutError", () => {
    expect(isExpiredRequestError(new TransactionExpiredTimeoutError("SIG123", 30))).toBe(true);
  });

  it("is true for a plain error reporting a stale blockhash at send time", () => {
    expect(isExpiredRequestError(new Error("failed to send transaction: Blockhash not found"))).toBe(
      true
    );
  });

  it("is false for an unrelated error", () => {
    expect(isExpiredRequestError(new Error("Network request failed"))).toBe(false);
  });

  it("is false for a user rejection", () => {
    expect(isExpiredRequestError(new WalletSignTransactionError("User rejected the request."))).toBe(
      false
    );
  });
});

describe("expiredSignature", () => {
  it("reads the signature off a TransactionExpiredBlockheightExceededError", () => {
    expect(expiredSignature(new TransactionExpiredBlockheightExceededError("SIG123"))).toBe("SIG123");
  });

  it("reads the signature off a TransactionExpiredTimeoutError", () => {
    expect(expiredSignature(new TransactionExpiredTimeoutError("SIG456", 30))).toBe("SIG456");
  });

  it("is undefined when the error carries no signature", () => {
    expect(expiredSignature(new Error("Blockhash not found"))).toBeUndefined();
  });
});

describe("USER_REJECTED_MESSAGE and EXPIRED_REQUEST_MESSAGE", () => {
  it("are distinct, plain-language, and never mention wallet/network jargon", () => {
    expect(USER_REJECTED_MESSAGE).toBe("You canceled the request in your wallet. Nothing was sent.");
    expect(EXPIRED_REQUEST_MESSAGE).toBe(
      "The request expired before it was approved. Nothing was sent. Please try again."
    );
    expect(USER_REJECTED_MESSAGE).not.toBe(EXPIRED_REQUEST_MESSAGE);
  });
});
