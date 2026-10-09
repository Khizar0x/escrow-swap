import { describe, expect, it } from "vitest";
import { reduceCancelOfferBanner } from "./cancelOfferBanner";

const SUCCESS = { type: "success", signature: "abc123" } as const;
const ERROR = { type: "error", message: "Only the person who made this offer can cancel it." } as const;

describe("reduceCancelOfferBanner", () => {
  it("sets the banner to a success result", () => {
    expect(reduceCancelOfferBanner(null, { type: "cancel-result", result: SUCCESS })).toEqual(SUCCESS);
  });

  it("sets the banner to an error result", () => {
    expect(reduceCancelOfferBanner(null, { type: "cancel-result", result: ERROR })).toEqual(ERROR);
  });

  it("clears the banner when a new attempt starts", () => {
    expect(reduceCancelOfferBanner(SUCCESS, { type: "cancel-started" })).toBeNull();
  });

  it("clears the banner when dismissed", () => {
    expect(reduceCancelOfferBanner(SUCCESS, { type: "dismissed" })).toBeNull();
    expect(reduceCancelOfferBanner(ERROR, { type: "dismissed" })).toBeNull();
  });

  it("keeps a success result when the offers list refreshes, even if that removed the offer's card", () => {
    expect(reduceCancelOfferBanner(SUCCESS, { type: "offers-refreshed" })).toEqual(SUCCESS);
  });

  it("keeps an error result when the offers list refreshes", () => {
    expect(reduceCancelOfferBanner(ERROR, { type: "offers-refreshed" })).toEqual(ERROR);
  });

  it("stays null on a refresh when there is nothing to show", () => {
    expect(reduceCancelOfferBanner(null, { type: "offers-refreshed" })).toBeNull();
  });

  it("replaces a stale result with a new one", () => {
    expect(reduceCancelOfferBanner(ERROR, { type: "cancel-result", result: SUCCESS })).toEqual(SUCCESS);
  });
});
