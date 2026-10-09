import { describe, expect, it } from "vitest";
import { reduceTakeOfferBanner } from "./takeOfferBanner";

const SUCCESS = { type: "success", signature: "abc123" } as const;
const ERROR = { type: "error", message: "This offer is no longer available. It may have been taken or canceled." } as const;

describe("reduceTakeOfferBanner", () => {
  it("sets the banner to a success result", () => {
    expect(reduceTakeOfferBanner(null, { type: "swap-result", result: SUCCESS })).toEqual(SUCCESS);
  });

  it("sets the banner to an error result", () => {
    expect(reduceTakeOfferBanner(null, { type: "swap-result", result: ERROR })).toEqual(ERROR);
  });

  it("clears the banner when a new swap starts", () => {
    expect(reduceTakeOfferBanner(SUCCESS, { type: "swap-started" })).toBeNull();
  });

  it("clears the banner when dismissed", () => {
    expect(reduceTakeOfferBanner(SUCCESS, { type: "dismissed" })).toBeNull();
    expect(reduceTakeOfferBanner(ERROR, { type: "dismissed" })).toBeNull();
  });

  it("keeps a success result when the offers list refreshes, even if that removed the offer's card", () => {
    expect(reduceTakeOfferBanner(SUCCESS, { type: "offers-refreshed" })).toEqual(SUCCESS);
  });

  it("keeps an error result when the offers list refreshes", () => {
    expect(reduceTakeOfferBanner(ERROR, { type: "offers-refreshed" })).toEqual(ERROR);
  });

  it("stays null on a refresh when there is nothing to show", () => {
    expect(reduceTakeOfferBanner(null, { type: "offers-refreshed" })).toBeNull();
  });

  it("replaces a stale result with a new one", () => {
    expect(reduceTakeOfferBanner(ERROR, { type: "swap-result", result: SUCCESS })).toEqual(SUCCESS);
  });
});
