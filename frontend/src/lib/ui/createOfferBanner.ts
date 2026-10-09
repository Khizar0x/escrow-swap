import type { PublicKey } from "@solana/web3.js";

export type CreateOfferResult =
  | { type: "success"; offerAddress: PublicKey; signature: string }
  | { type: "error"; message: string };

export type CreateOfferBannerAction =
  | { type: "submit-started" }
  | { type: "submit-result"; result: CreateOfferResult }
  | { type: "dismissed" };

// The banner shows the outcome of the last create-offer submission, above
// the form. It is not tied to the form's fields — clearing them after a
// success never clears this on its own. Only a new submit starting, a new
// result arriving, or an explicit dismiss does.
export function reduceCreateOfferBanner(
  current: CreateOfferResult | null,
  action: CreateOfferBannerAction
): CreateOfferResult | null {
  switch (action.type) {
    case "submit-started":
    case "dismissed":
      return null;
    case "submit-result":
      return action.result;
  }
}

export interface CreateOfferFormFields {
  giveMint: string;
  giveAmount: string;
  wantMint: string;
  wantAmount: string;
}

export const EMPTY_CREATE_OFFER_FORM: CreateOfferFormFields = {
  giveMint: "",
  giveAmount: "",
  wantMint: "",
  wantAmount: "",
};

// After a successful create, the fields are cleared so the form can't look
// like it still holds an offer that was already submitted. After an error,
// the fields are left alone so the person can fix the problem without
// retyping everything.
export function clearFormOnSuccess(
  fields: CreateOfferFormFields,
  result: CreateOfferResult
): CreateOfferFormFields {
  return result.type === "success" ? EMPTY_CREATE_OFFER_FORM : fields;
}
