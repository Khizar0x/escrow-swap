// u64::MAX, the largest amount the program can store.
const MAX_U64 = BigInt(2) ** BigInt(64) - BigInt(1);

export class AmountError extends Error {}

// Converts a decimal string (e.g. "1.5") typed by the user into base units
// for a mint with the given decimal count. Uses only BigInt, never a
// floating-point Number, so no precision is lost. An amount with more
// decimal places than the token allows is rejected outright, never
// silently cut off. Also rejects an amount that is zero and one above
// u64::MAX.
export function toBaseUnits(amount: string, decimals: number): bigint {
  const trimmed = amount.trim();
  if (!/^\d+(\.\d+)?$/.test(trimmed)) {
    throw new AmountError("Enter a valid amount.");
  }

  const [wholePart, fractionPart = ""] = trimmed.split(".");
  if (fractionPart.length > decimals) {
    throw new AmountError(
      decimals === 0
        ? "This token does not allow decimal places."
        : `This token allows up to ${decimals} decimal place${decimals === 1 ? "" : "s"}.`
    );
  }

  const baseUnits = BigInt(wholePart + fractionPart.padEnd(decimals, "0"));

  if (baseUnits <= BigInt(0)) {
    throw new AmountError("Enter an amount greater than zero.");
  }
  if (baseUnits > MAX_U64) {
    throw new AmountError("That amount is too large.");
  }
  return baseUnits;
}

// The inverse of toBaseUnits: turns base units back into a decimal string
// for display, e.g. 1_500_000n at 6 decimals -> "1.5". Uses only BigInt and
// string slicing, never a floating-point Number, and trims trailing zeros
// so whole numbers don't show a bare decimal point.
export function fromBaseUnits(amount: bigint, decimals: number): string {
  if (decimals === 0) {
    return amount.toString();
  }

  const digits = amount.toString().padStart(decimals + 1, "0");
  const wholePart = digits.slice(0, digits.length - decimals);
  const fractionPart = digits.slice(digits.length - decimals).replace(/0+$/, "");

  return fractionPart.length > 0 ? `${wholePart}.${fractionPart}` : wholePart;
}
