import type { TakeOfferResult } from "@/components/TakeOfferAction";

export type TakeOfferBannerAction =
  | { type: "swap-started" }
  | { type: "swap-result"; result: TakeOfferResult }
  | { type: "dismissed" }
  | { type: "offers-refreshed" };

// The banner shows the outcome of the last take-offer attempt, above the
// offer cards. It is never tied to the offers list, so refreshing that list
// — including a refresh that removes the very card whose action produced
// this result — never clears it on its own. Only a new attempt starting, a
// new result arriving, or an explicit dismiss does.
export function reduceTakeOfferBanner(
  current: TakeOfferResult | null,
  action: TakeOfferBannerAction
): TakeOfferResult | null {
  switch (action.type) {
    case "swap-started":
    case "dismissed":
      return null;
    case "swap-result":
      return action.result;
    case "offers-refreshed":
      return current;
  }
}
