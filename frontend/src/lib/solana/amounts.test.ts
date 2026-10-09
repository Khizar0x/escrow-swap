import { describe, expect, it } from "vitest";
import { AmountError, fromBaseUnits, toBaseUnits } from "./amounts";

describe("toBaseUnits", () => {
  it("converts a whole number", () => {
    expect(toBaseUnits("5", 6)).toBe(BigInt(5_000_000));
  });

  it("converts an exact fraction", () => {
    expect(toBaseUnits("1.5", 6)).toBe(BigInt(1_500_000));
  });

  it("pads a fraction shorter than the token's decimals", () => {
    expect(toBaseUnits("0.1", 6)).toBe(BigInt(100_000));
  });

  it("rejects more decimal places than the token allows, with the exact count", () => {
    expect(() => toBaseUnits("1.2345678", 6)).toThrow(
      "This token allows up to 6 decimal places."
    );
  });

  it("uses singular wording for a single decimal place", () => {
    expect(() => toBaseUnits("1.23", 1)).toThrow("This token allows up to 1 decimal place.");
  });

  it("rejects any decimal places on a zero-decimal token", () => {
    expect(() => toBaseUnits("3.5", 0)).toThrow("This token does not allow decimal places.");
  });

  it("rejects an amount that is exactly zero, including trailing zero decimals", () => {
    expect(() => toBaseUnits("0.000000", 6)).toThrow(AmountError);
    expect(() => toBaseUnits("0", 6)).toThrow(AmountError);
  });

  it("works at zero decimals", () => {
    expect(toBaseUnits("3", 0)).toBe(BigInt(3));
  });

  it("accepts the largest valid u64 amount", () => {
    expect(toBaseUnits("18446744073709551615", 0)).toBe(BigInt(2) ** BigInt(64) - BigInt(1));
  });

  it("rejects an amount above u64::MAX", () => {
    expect(() => toBaseUnits("18446744073709551616", 0)).toThrow(AmountError);
  });

  it("rejects text that is not a number", () => {
    expect(() => toBaseUnits("abc", 6)).toThrow(AmountError);
  });

  it("rejects a negative amount", () => {
    expect(() => toBaseUnits("-1", 6)).toThrow(AmountError);
  });
});

describe("fromBaseUnits", () => {
  it("is the inverse of toBaseUnits for an exact fraction", () => {
    expect(fromBaseUnits(BigInt(1_500_000), 6)).toBe("1.5");
  });

  it("works at zero decimals", () => {
    expect(fromBaseUnits(BigInt(3), 0)).toBe("3");
  });

  it("trims trailing zeros but keeps the whole number at 6 decimals", () => {
    expect(fromBaseUnits(BigInt(5_000_000), 6)).toBe("5");
  });

  it("shows amounts below 1 with their leading zero", () => {
    expect(fromBaseUnits(BigInt(100_000), 6)).toBe("0.1");
    expect(fromBaseUnits(BigInt(1), 9)).toBe("0.000000001");
  });

  it("handles 9 decimals", () => {
    expect(fromBaseUnits(BigInt(1_234_567_890), 9)).toBe("1.23456789");
  });

  it("handles u64 max", () => {
    expect(fromBaseUnits(BigInt(2) ** BigInt(64) - BigInt(1), 6)).toBe("18446744073709.551615");
  });

  it("handles zero itself", () => {
    expect(fromBaseUnits(BigInt(0), 6)).toBe("0");
  });
});
