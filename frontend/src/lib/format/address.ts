// Shortens a wallet address for display, e.g. "7xKq…9mPa".
export function shortenAddress(address: string, visibleChars = 4): string {
  if (address.length <= visibleChars * 2 + 1) {
    return address;
  }
  return `${address.slice(0, visibleChars)}…${address.slice(-visibleChars)}`;
}
