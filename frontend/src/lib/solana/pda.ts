import { PublicKey } from "@solana/web3.js";

const OFFER_SEED = Buffer.from("offer");

// Encodes a u64 as 8 little-endian bytes using DataView, not Buffer's
// writeBigUInt64LE. The browser's Buffer polyfill does not implement that
// method (or its siblings: readBigUInt64LE/BE, writeBigUInt64BE), so code
// that runs in the browser must avoid them entirely.
export function encodeU64LE(value: bigint): Uint8Array {
  const bytes = new Uint8Array(8);
  new DataView(bytes.buffer).setBigUint64(0, value, true);
  return bytes;
}

// Mirrors the program's seeds exactly (programs/escrow/src/instructions/make_offer.rs):
// [OFFER_SEED, maker, offer_id as little-endian u64]. Any other derivation
// would not match the account the program expects.
export function offerAddress(programId: PublicKey, maker: PublicKey, offerId: bigint): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [OFFER_SEED, maker.toBuffer(), encodeU64LE(offerId)],
    programId
  );
  return pda;
}
