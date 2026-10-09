import type { CancelOfferResult } from "@/components/CancelOfferAction";

export type CancelOfferBannerAction =
  | { type: "cancel-started" }
  | { type: "cancel-result"; result: CancelOfferResult }
  | { type: "dismissed" }
  | { type: "offers-refreshed" };

// The banner shows the outcome of the last cancel-offer attempt, above the
// offer cards. It is not tied to the offers list, so refreshing that list —
// including a refresh that removes the very card whose action produced this
// result — never clears it on its own. Only a new attempt starting, a new
// result arriving, or an explicit dismiss does. Same shape as
// reduceTakeOfferBanner / reduceCreateOfferBanner.
export function reduceCancelOfferBanner(
  current: CancelOfferResult | null,
  action: CancelOfferBannerAction
): CancelOfferResult | null {
  switch (action.type) {
    case "cancel-started":
    case "dismissed":
      return null;
    case "cancel-result":
      return action.result;
    case "offers-refreshed":
      return current;
  }
}
