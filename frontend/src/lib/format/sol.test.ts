import { describe, expect, it } from "vitest";
import { formatSol } from "./sol";

describe("formatSol", () => {
  it("shows zero as 0 SOL", () => {
    expect(formatSol(BigInt(0))).toBe("0 SOL");
  });

  it("drops trailing zeros", () => {
    expect(formatSol(BigInt(1000000000))).toBe("1 SOL");
    expect(formatSol(BigInt(1500000000))).toBe("1.5 SOL");
  });

  it("cuts off decimals past four places instead of rounding up", () => {
    expect(formatSol(BigInt(1234567891))).toBe("1.2345 SOL");
    expect(formatSol(BigInt(999999999))).toBe("0.9999 SOL");
  });

  it("shows the smallest displayed step", () => {
    expect(formatSol(BigInt(100000))).toBe("0.0001 SOL");
  });

  it("handles balances above the safe integer range of Number", () => {
    expect(formatSol(BigInt("18446744073709551615"))).toBe(
      "18446744073.7095 SOL"
    );
  });
});
