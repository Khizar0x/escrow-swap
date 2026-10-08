import { describe, expect, it } from "vitest";
import { explorerAddressUrl, explorerTransactionUrl } from "./explorer";

describe("explorer links", () => {
  it("builds an address link on devnet", () => {
    expect(explorerAddressUrl("ABC123")).toBe(
      "https://explorer.solana.com/address/ABC123?cluster=devnet"
    );
  });

  it("builds a transaction link on devnet", () => {
    expect(explorerTransactionUrl("SIG123")).toBe(
      "https://explorer.solana.com/tx/SIG123?cluster=devnet"
    );
  });
});
