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
  const accountType = Buffer.from([1]); // AccountType::Mint
  return Buffer.concat([base, accountType, ...extensions]);
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
