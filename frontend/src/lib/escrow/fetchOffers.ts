import type { Program } from "@anchor-lang/core";
import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { fetchMintDecimals } from "@/lib/escrow/createOffer";

export interface Offer {
  offerAddress: PublicKey;
  maker: PublicKey;
  tokenA: PublicKey;
  tokenB: PublicKey;
  amountA: bigint;
  amountB: bigint;
  offerId: bigint;
}

export interface FetchOffersResult {
  offers: Offer[];
  skipped: number;
}

interface DecodedOffer {
  offerId: { toString(): string };
  maker: PublicKey;
  tokenMintA: PublicKey;
  tokenMintB: PublicKey;
  amountA: { toString(): string };
  amountB: { toString(): string };
}

// Fetches every account the program owns and keeps the ones that decode as
// an Offer. The IDL camel-cases "Offer" to "offer" for the coder, the same
// name program.account.offer uses internally.
//
// program.account.offer.all() cannot be used here: it decodes every result
// in one .map() with no per-item try/catch, so a single account that fails
// to decode (wrong size, wrong discriminator, or any other account type the
// program owns) would throw and take the whole list down with it. Fetching
// the raw accounts and decoding them one at a time lets a bad one be skipped
// instead, with `skipped` reporting how many were left out.
export async function fetchOffers(program: Program): Promise<FetchOffersResult> {
  const raw = await program.provider.connection.getProgramAccounts(program.programId);

  let skipped = 0;
  const offers: Offer[] = [];

  for (const { pubkey, account } of raw) {
    try {
      const decoded = program.coder.accounts.decode<DecodedOffer>("offer", account.data);
      offers.push({
        offerAddress: pubkey,
        maker: decoded.maker,
        tokenA: decoded.tokenMintA,
        tokenB: decoded.tokenMintB,
        amountA: BigInt(decoded.amountA.toString()),
        amountB: BigInt(decoded.amountB.toString()),
        offerId: BigInt(decoded.offerId.toString()),
      });
    } catch {
      skipped++;
    }
  }

  return { offers, skipped };
}

export interface OfferTokenDecimals {
  decimals: Map<string, number>;
  unavailable: Set<string>;
}

// Looks up decimals once per distinct token across every offer, reusing the
// same classic-token-only check used when creating an offer. A token whose
// lookup fails is recorded in `unavailable` rather than guessed at, so its
// amount can be shown as "unavailable" instead of silently as 0 decimals.
export async function fetchOfferTokenDecimals(
  connection: Connection,
  offers: Offer[]
): Promise<OfferTokenDecimals> {
  const mints = new Set<string>();
  for (const offer of offers) {
    mints.add(offer.tokenA.toBase58());
    mints.add(offer.tokenB.toBase58());
  }

  const decimals = new Map<string, number>();
  const unavailable = new Set<string>();

  await Promise.all(
    Array.from(mints).map(async (mint) => {
      try {
        decimals.set(mint, await fetchMintDecimals(connection, new PublicKey(mint)));
      } catch {
        unavailable.add(mint);
      }
    })
  );

  return { decimals, unavailable };
}

// There is no timestamp on an Offer account, so a true newest-first order
// isn't possible. Sorting by offer ID descending at least gives every
// viewer the same stable order on every load (offer IDs are random, not
// sequential, so this is not actually chronological).
function sortByOfferIdDescending(offers: Offer[]): Offer[] {
  return [...offers].sort((a, b) => {
    if (a.offerId === b.offerId) return 0;
    return a.offerId > b.offerId ? -1 : 1;
  });
}

// Offers for the marketplace: everyone's offers except the connected
// wallet's own. With no wallet connected, every offer is available.
export function availableOffers(offers: Offer[], wallet: PublicKey | null): Offer[] {
  const visible = wallet ? offers.filter((offer) => !offer.maker.equals(wallet)) : offers;
  return sortByOfferIdDescending(visible);
}

// Only the connected wallet's own offers.
export function myOffers(offers: Offer[], wallet: PublicKey): Offer[] {
  return sortByOfferIdDescending(offers.filter((offer) => offer.maker.equals(wallet)));
}

export type MarketplaceEmptyState = "none" | "none-from-others" | null;

// Decides which empty-state message the marketplace should show, if any.
// "none": there are no offers at all. "none-from-others": every existing
// offer belongs to the connected wallet, so there is nothing for them to
// take, but the marketplace isn't really empty. null: there is at least
// one offer from someone else to show.
export function marketplaceEmptyState(offers: Offer[], wallet: PublicKey | null): MarketplaceEmptyState {
  if (offers.length === 0) {
    return "none";
  }
  if (availableOffers(offers, wallet).length > 0) {
    return null;
  }
  const mine = wallet ? myOffers(offers, wallet) : [];
  return mine.length > 0 ? "none-from-others" : "none";
}
