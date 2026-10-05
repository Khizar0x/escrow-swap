import { describe, expect, it } from "vitest";
import { DEVNET_GENESIS_HASH, isDevnetGenesisHash } from "./network";

describe("isDevnetGenesisHash", () => {
  it("accepts the devnet genesis hash", () => {
    expect(isDevnetGenesisHash(DEVNET_GENESIS_HASH)).toBe(true);
  });

  it("rejects any other genesis hash", () => {
    expect(isDevnetGenesisHash("not-the-devnet-hash")).toBe(false);
    expect(isDevnetGenesisHash("")).toBe(false);
  });
});
