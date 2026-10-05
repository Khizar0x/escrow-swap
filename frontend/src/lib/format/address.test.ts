import { describe, expect, it } from "vitest";
import { shortenAddress } from "./address";

describe("shortenAddress", () => {
  it("keeps the first and last four characters", () => {
    expect(shortenAddress("7xKqAbCdEf9mPa")).toBe("7xKq…9mPa");
  });

  it("returns short values unchanged", () => {
    expect(shortenAddress("abc")).toBe("abc");
  });
});
