// Amounts are kept as bigint so no precision is lost. Floating-point numbers
// cannot represent every lamport value exactly.
const LAMPORTS_PER_SOL = BigInt(1000000000);
const SHOWN_DECIMALS = 4;

// Formats a lamport amount as SOL with up to four decimals.
// Extra decimals are cut off, not rounded, so the shown value never exceeds
// the real balance.
export function formatSol(lamports: bigint): string {
  const whole = lamports / LAMPORTS_PER_SOL;
  const fraction = lamports % LAMPORTS_PER_SOL;
  const digits = fraction
    .toString()
    .padStart(9, "0")
    .slice(0, SHOWN_DECIMALS)
    .replace(/0+$/, "");

  return digits ? `${whole}.${digits} SOL` : `${whole} SOL`;
}
