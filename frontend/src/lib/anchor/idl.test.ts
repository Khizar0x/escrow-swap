import { describe, expect, it } from "vitest";
import idl from "@/idl/escrow.json";

// The program ID as declared in programs/escrow/src/lib.rs (declare_id!).
const EXPECTED_PROGRAM_ID = "WGR3TkneAhURGhPTLqS1TKejNWDQYAQu3QaMDiF4i5b";

describe("escrow IDL copy", () => {
  it("has the program ID from the program source", () => {
    expect(idl.address).toBe(EXPECTED_PROGRAM_ID);
  });

  it("lists the offer instructions", () => {
    const names = idl.instructions.map((instruction) => instruction.name);
    expect(names).toContain("make_offer");
    expect(names).toContain("take_offer");
    expect(names).toContain("cancel_offer");
  });

  it("describes the Offer account", () => {
    expect(idl.accounts.map((account) => account.name)).toContain("Offer");
  });
});
