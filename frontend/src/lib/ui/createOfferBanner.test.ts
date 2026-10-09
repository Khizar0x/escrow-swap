import { Keypair } from "@solana/web3.js";
import { describe, expect, it } from "vitest";
import {
  EMPTY_CREATE_OFFER_FORM,
  clearFormOnSuccess,
  reduceCreateOfferBanner,
  type CreateOfferFormFields,
} from "./createOfferBanner";

const SUCCESS = { type: "success", offerAddress: Keypair.generate().publicKey, signature: "sig123" } as const;
const ERROR = { type: "error", message: "Enter valid token addresses." } as const;

const FILLED_FIELDS: CreateOfferFormFields = {
  giveMint: "So11111111111111111111111111111111111111112",
  giveAmount: "1.5",
  wantMint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v",
  wantAmount: "20",
};

describe("reduceCreateOfferBanner", () => {
  it("sets the banner to a success result", () => {
    expect(reduceCreateOfferBanner(null, { type: "submit-result", result: SUCCESS })).toEqual(SUCCESS);
  });

  it("sets the banner to an error result", () => {
    expect(reduceCreateOfferBanner(null, { type: "submit-result", result: ERROR })).toEqual(ERROR);
  });

  it("clears the banner when dismissed", () => {
    expect(reduceCreateOfferBanner(SUCCESS, { type: "dismissed" })).toBeNull();
    expect(reduceCreateOfferBanner(ERROR, { type: "dismissed" })).toBeNull();
  });

  it("clears a stale banner when a new submit starts", () => {
    expect(reduceCreateOfferBanner(SUCCESS, { type: "submit-started" })).toBeNull();
    expect(reduceCreateOfferBanner(ERROR, { type: "submit-started" })).toBeNull();
  });
});

describe("clearFormOnSuccess", () => {
  it("empties every field after a success", () => {
    expect(clearFormOnSuccess(FILLED_FIELDS, SUCCESS)).toEqual(EMPTY_CREATE_OFFER_FORM);
  });

  it("leaves the fields untouched after an error, so the person can fix and resubmit", () => {
    expect(clearFormOnSuccess(FILLED_FIELDS, ERROR)).toEqual(FILLED_FIELDS);
  });

  it("clearing the form on success does not depend on, or affect, the banner state", () => {
    const banner = reduceCreateOfferBanner(null, { type: "submit-result", result: SUCCESS });
    const fields = clearFormOnSuccess(FILLED_FIELDS, SUCCESS);
    expect(banner).toEqual(SUCCESS);
    expect(fields).toEqual(EMPTY_CREATE_OFFER_FORM);
  });
});
