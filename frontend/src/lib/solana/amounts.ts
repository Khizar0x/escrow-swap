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
