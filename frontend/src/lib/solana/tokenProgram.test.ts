import { describe, expect, it, vi } from "vitest";
import type { Connection } from "@solana/web3.js";
import { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "./ata";
import { TokenProgramError, resolveTokenProgram } from "./tokenProgram";

const MINT = new PublicKey("EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v");
const OTHER_PROGRAM = new PublicKey("11111111111111111111111111111111");

function baseMintBuffer({ decimals = 6, freezeAuthority = false } = {}): Buffer {
  const data = Buffer.alloc(82);
  data.writeUInt8(decimals, 44);
  data.writeUInt8(1, 45); // isInitialized
  data.writeUInt32LE(freezeAuthority ? 1 : 0, 46); // freeze_authority_option
  return data;
}

function tlvEntry(type: number, value: Buffer): Buffer {
  const header = Buffer.alloc(4);
  header.writeUInt16LE(type, 0);
  header.writeUInt16LE(value.length, 2);
  return Buffer.concat([header, value]);
}

// Token-2022's real on-chain layout for a mint WITH extensions, per
// spl-token-2022-interface's extension/mod.rs (BASE_ACCOUNT_LENGTH and
// type_and_tlv_indices): the mint's own 82 bytes, then zero padding out to
// Account::LEN (165) — not Mint::LEN — then a 1-byte account-type tag, then
// the TLV entries. The padding exists so a mint's extension data can never
// be mistaken for a token account's: both start their type-and-TLV region
// at the same fixed offset (165) regardless of which one it is.
const EXTENSIBLE_ACCOUNT_LENGTH = 165; // Account::LEN

function token2022MintBuffer({
  decimals = 6,
  freezeAuthority = false,
  extensions = [] as Buffer[],
} = {}): Buffer {
  const base = baseMintBuffer({ decimals, freezeAuthority });
  if (extensions.length === 0) {
    // A Token-2022 mint with no extensions at all is the same shape as a
    // classic mint: nothing past the base 82 bytes.
    return base;
  }
  const padding = Buffer.alloc(EXTENSIBLE_ACCOUNT_LENGTH - base.length);
  const accountType = Buffer.from([1]); // AccountType::Mint
  return Buffer.concat([base, padding, accountType, ...extensions]);
}

function connectionReturning(value: unknown): Connection {
  return { getAccountInfo: vi.fn().mockResolvedValue(value) } as unknown as Connection;
}

describe("resolveTokenProgram", () => {
  it("resolves a classic SPL token, reading its real decimals", async () => {
    const connection = connectionReturning({ data: baseMintBuffer({ decimals: 6 }), owner: TOKEN_PROGRAM_ID });

    const result = await resolveTokenProgram(connection, MINT);

    expect(result.programId.equals(TOKEN_PROGRAM_ID)).toBe(true);
    expect(result.decimals).toBe(6);
  });

  it("resolves a Token-2022 token with no extensions", async () => {
    const connection = connectionReturning({
      data: token2022MintBuffer({ decimals: 9 }),
      owner: TOKEN_2022_PROGRAM_ID,
    });

    const result = await resolveTokenProgram(connection, MINT);

    expect(result.programId.equals(TOKEN_2022_PROGRAM_ID)).toBe(true);
    expect(result.decimals).toBe(9);
  });

  it("rejects a classic token address that does not exist", async () => {
    const connection = connectionReturning(null);
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(
      "Could not find that token. Check the token address."
    );
  });

  it("rejects an address owned by neither token program", async () => {
    const connection = connectionReturning({ data: baseMintBuffer(), owner: OTHER_PROGRAM });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow("This address is not a token.");
  });

  it("rejects data too short to be a token, regardless of owner", async () => {
    const connection = connectionReturning({ data: Buffer.alloc(10), owner: TOKEN_PROGRAM_ID });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow("This address is not a token.");
  });

  it("gives a clear error when the lookup itself fails, not a raw error", async () => {
    const connection = { getAccountInfo: vi.fn().mockRejectedValue(new Error("fetch failed")) } as unknown as Connection;
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow("Could not check this token. Try again.");
  });

  it("rejects a classic token with a freeze authority set", async () => {
    const connection = connectionReturning({
      data: baseMintBuffer({ freezeAuthority: true }),
      owner: TOKEN_PROGRAM_ID,
    });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(
      "This token can be frozen by its creator. It isn't supported here."
    );
  });

  it("rejects a Token-2022 token with a freeze authority set, even with no other extensions", async () => {
    const connection = connectionReturning({
      data: token2022MintBuffer({ freezeAuthority: true }),
      owner: TOKEN_2022_PROGRAM_ID,
    });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(
      "This token can be frozen by its creator. It isn't supported here."
    );
  });

  it("rejects a transfer-fee token with its own message", async () => {
    const connection = connectionReturning({
      data: token2022MintBuffer({ extensions: [tlvEntry(1, Buffer.alloc(0))] }),
      owner: TOKEN_2022_PROGRAM_ID,
    });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(TokenProgramError);
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(
      "This token takes a fee on every transfer. It isn't supported here."
    );
  });

  it("rejects a permanent-delegate token with its own message", async () => {
    const connection = connectionReturning({
      data: token2022MintBuffer({ extensions: [tlvEntry(12, Buffer.alloc(0))] }),
      owner: TOKEN_2022_PROGRAM_ID,
    });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(
      "This token lets someone else move tokens out of your account. It isn't supported here."
    );
  });

  it("rejects a transfer-hook token with its own message", async () => {
    const connection = connectionReturning({
      data: token2022MintBuffer({ extensions: [tlvEntry(14, Buffer.alloc(0))] }),
      owner: TOKEN_2022_PROGRAM_ID,
    });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(
      "This token runs extra code on every transfer. It isn't supported here."
    );
  });

  it("rejects a token with a mint close authority with its own message", async () => {
    const connection = connectionReturning({
      data: token2022MintBuffer({ extensions: [tlvEntry(3, Buffer.alloc(0))] }),
      owner: TOKEN_2022_PROGRAM_ID,
    });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(
      "This token can be closed by its creator. It isn't supported here."
    );
  });

  it("rejects a token whose new accounts default to frozen", async () => {
    const connection = connectionReturning({
      data: token2022MintBuffer({ extensions: [tlvEntry(6, Buffer.from([2]))] }),
      owner: TOKEN_2022_PROGRAM_ID,
    });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(
      "New token accounts for this token start out frozen. It isn't supported here."
    );
  });

  it("allows the default-account-state extension when new accounts are not frozen", async () => {
    const connection = connectionReturning({
      data: token2022MintBuffer({ decimals: 4, extensions: [tlvEntry(6, Buffer.from([1]))] }),
      owner: TOKEN_2022_PROGRAM_ID,
    });
    const result = await resolveTokenProgram(connection, MINT);
    expect(result.decimals).toBe(4);
  });

  it("rejects an unknown extension by default, never silently allowing it", async () => {
    const connection = connectionReturning({
      data: token2022MintBuffer({ extensions: [tlvEntry(9999, Buffer.alloc(4))] }),
      owner: TOKEN_2022_PROGRAM_ID,
    });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(
      "This token has a feature that isn't supported yet."
    );
  });

  it("checks every extension present, not just the first", async () => {
    const connection = connectionReturning({
      data: token2022MintBuffer({
        extensions: [tlvEntry(6, Buffer.from([1])), tlvEntry(1, Buffer.alloc(0))],
      }),
      owner: TOKEN_2022_PROGRAM_ID,
    });
    await expect(resolveTokenProgram(connection, MINT)).rejects.toThrow(
      "This token takes a fee on every transfer. It isn't supported here."
    );
  });
});

// Mirrors exactly how CreateOfferForm checks a new offer's two tokens: both
// resolved together via Promise.all, give side (mint A) first, want side
// (mint B) second. Regression coverage for a bug found on devnet testing:
// a transfer-fee Token-2022 token on the want side opened the wallet
// pop-up instead of being blocked, because the extension parser was
// silently finding nothing (see tokenProgram.ts's EXTENSIONS_START_OFFSET
// comment for the root cause).
describe("checking both tokens in an offer (give side and want side)", () => {
  // The exact addresses from the devnet bug report.
  const GIVE_MINT = new PublicKey("998xE5uRZN3dECUGJ6VcpWp8KpjmHCjU2MbngEqAmyTD");
  const WANT_MINT = new PublicKey("4hCSTsZWboKxb9LcYGDXfSmY7pxQmYHmCHmdTRqcXwYU");

  function connectionFor(mintData: Map<string, { data: Buffer; owner: PublicKey }>): Connection {
    return {
      getAccountInfo: vi.fn((address: PublicKey) => Promise.resolve(mintData.get(address.toBase58()) ?? null)),
    } as unknown as Connection;
  }

  function resolveBothSides(connection: Connection, mintA: PublicKey, mintB: PublicKey) {
    return Promise.all([resolveTokenProgram(connection, mintA), resolveTokenProgram(connection, mintB)]);
  }

  it("blocks when the token on the give side (mint A) has a transfer fee", async () => {
    const connection = connectionFor(
      new Map([
        [
          GIVE_MINT.toBase58(),
          { data: token2022MintBuffer({ extensions: [tlvEntry(1, Buffer.alloc(0))] }), owner: TOKEN_2022_PROGRAM_ID },
        ],
        [WANT_MINT.toBase58(), { data: baseMintBuffer(), owner: TOKEN_PROGRAM_ID }],
      ])
    );

    await expect(resolveBothSides(connection, GIVE_MINT, WANT_MINT)).rejects.toThrow(
      "This token takes a fee on every transfer. It isn't supported here."
    );
  });

  it("blocks when the token on the want side (mint B) has a transfer fee — the exact shape of the reported bug", async () => {
    const connection = connectionFor(
      new Map([
        [GIVE_MINT.toBase58(), { data: baseMintBuffer(), owner: TOKEN_PROGRAM_ID }],
        [
          WANT_MINT.toBase58(),
          { data: token2022MintBuffer({ extensions: [tlvEntry(1, Buffer.alloc(0))] }), owner: TOKEN_2022_PROGRAM_ID },
        ],
      ])
    );

    await expect(resolveBothSides(connection, GIVE_MINT, WANT_MINT)).rejects.toThrow(
      "This token takes a fee on every transfer. It isn't supported here."
    );
  });

  it.each([
    ["permanent delegate", tlvEntry(12, Buffer.alloc(0)), "This token lets someone else move tokens out of your account. It isn't supported here."],
    ["transfer hook", tlvEntry(14, Buffer.alloc(0)), "This token runs extra code on every transfer. It isn't supported here."],
    ["mint close authority", tlvEntry(3, Buffer.alloc(0)), "This token can be closed by its creator. It isn't supported here."],
    ["default account state frozen", tlvEntry(6, Buffer.from([2])), "New token accounts for this token start out frozen. It isn't supported here."],
  ])("blocks a %s extension on the want side", async (_name, extension, message) => {
    const connection = connectionFor(
      new Map([
        [GIVE_MINT.toBase58(), { data: baseMintBuffer(), owner: TOKEN_PROGRAM_ID }],
        [WANT_MINT.toBase58(), { data: token2022MintBuffer({ extensions: [extension] }), owner: TOKEN_2022_PROGRAM_ID }],
      ])
    );

    await expect(resolveBothSides(connection, GIVE_MINT, WANT_MINT)).rejects.toThrow(message);
  });

  it.each([
    ["permanent delegate", tlvEntry(12, Buffer.alloc(0)), "This token lets someone else move tokens out of your account. It isn't supported here."],
    ["transfer hook", tlvEntry(14, Buffer.alloc(0)), "This token runs extra code on every transfer. It isn't supported here."],
    ["mint close authority", tlvEntry(3, Buffer.alloc(0)), "This token can be closed by its creator. It isn't supported here."],
    ["default account state frozen", tlvEntry(6, Buffer.from([2])), "New token accounts for this token start out frozen. It isn't supported here."],
  ])("blocks a %s extension on the give side", async (_name, extension, message) => {
    const connection = connectionFor(
      new Map([
        [GIVE_MINT.toBase58(), { data: token2022MintBuffer({ extensions: [extension] }), owner: TOKEN_2022_PROGRAM_ID }],
        [WANT_MINT.toBase58(), { data: baseMintBuffer(), owner: TOKEN_PROGRAM_ID }],
      ])
    );

    await expect(resolveBothSides(connection, GIVE_MINT, WANT_MINT)).rejects.toThrow(message);
  });

  it("allows two tokens that both pass, regardless of side", async () => {
    const connection = connectionFor(
      new Map([
        [GIVE_MINT.toBase58(), { data: baseMintBuffer({ decimals: 6 }), owner: TOKEN_PROGRAM_ID }],
        [WANT_MINT.toBase58(), { data: baseMintBuffer({ decimals: 9 }), owner: TOKEN_2022_PROGRAM_ID }],
      ])
    );

    const [tokenA, tokenB] = await resolveBothSides(connection, GIVE_MINT, WANT_MINT);
    expect(tokenA.decimals).toBe(6);
    expect(tokenB.decimals).toBe(9);
  });
});
