import type { Connection } from "@solana/web3.js";
import type { PublicKey } from "@solana/web3.js";
import { TOKEN_2022_PROGRAM_ID, TOKEN_PROGRAM_ID } from "@/lib/solana/ata";

export class TokenProgramError extends Error {}

// Byte layout shared by a classic SPL token and the base of a Token-2022
// token (Token-2022 only ever adds data after these same 82 bytes).
const MINT_BASE_LEN = 82;
const MINT_DECIMALS_OFFSET = 44;
const FREEZE_AUTHORITY_OPTION_OFFSET = 46;
// One byte "account type" tag sits right after the base layout; the
// extension list (if any) starts immediately after that tag.
const EXTENSIONS_START_OFFSET = MINT_BASE_LEN + 1;

// Token-2022 extension type numbers this app recognizes by name. Anything
// else present on the token is still blocked — see assertExtensionsAllowed
// — just without a message specific to that extension.
const EXTENSION_TRANSFER_FEE_CONFIG = 1;
const EXTENSION_MINT_CLOSE_AUTHORITY = 3;
const EXTENSION_DEFAULT_ACCOUNT_STATE = 6;
const EXTENSION_PERMANENT_DELEGATE = 12;
const EXTENSION_TRANSFER_HOOK = 14;

// The default-account-state extension stores a single byte: the state new
// accounts are created in. 2 means frozen (0 = uninitialized, 1 = normal).
const ACCOUNT_STATE_FROZEN = 2;

export interface TokenProgramInfo {
  programId: PublicKey;
  decimals: number;
}

interface MintExtension {
  type: number;
  data: Buffer;
}

// Reads every Token-2022 extension entry stored after the base token
// layout. A classic token, or a Token-2022 token with no extensions at all,
// has no data past the base 82 bytes and returns an empty list here.
function readMintExtensions(data: Buffer): MintExtension[] {
  if (data.length <= MINT_BASE_LEN) {
    return [];
  }

  const extensions: MintExtension[] = [];
  let offset = EXTENSIONS_START_OFFSET;

  while (offset + 4 <= data.length) {
    const type = data.readUInt16LE(offset);
    const length = data.readUInt16LE(offset + 2);
    if (type === 0) {
      // Padding / uninitialized marker: nothing real follows.
      break;
    }
    const valueStart = offset + 4;
    const valueEnd = valueStart + length;
    if (valueEnd > data.length) {
      break;
    }
    extensions.push({ type, data: data.subarray(valueStart, valueEnd) });
    offset = valueEnd;
  }

  return extensions;
}

function hasFreezeAuthority(data: Buffer): boolean {
  return data.readUInt32LE(FREEZE_AUTHORITY_OPTION_OFFSET) !== 0;
}

// Throws a specific, plain-language message for the first extension this
// app doesn't support. A token with no extensions at all passes through
// untouched. Any extension not named here still blocks the token — the
// default branch — so an extension this app has never heard of is never
// silently allowed.
function assertExtensionsAllowed(extensions: MintExtension[]): void {
  for (const extension of extensions) {
    switch (extension.type) {
      case EXTENSION_TRANSFER_FEE_CONFIG:
        throw new TokenProgramError("This token takes a fee on every transfer. It isn't supported here.");
      case EXTENSION_PERMANENT_DELEGATE:
        throw new TokenProgramError(
          "This token lets someone else move tokens out of your account. It isn't supported here."
        );
      case EXTENSION_TRANSFER_HOOK:
        throw new TokenProgramError("This token runs extra code on every transfer. It isn't supported here.");
      case EXTENSION_MINT_CLOSE_AUTHORITY:
        throw new TokenProgramError("This token can be closed by its creator. It isn't supported here.");
      case EXTENSION_DEFAULT_ACCOUNT_STATE:
        if (extension.data.length > 0 && extension.data[0] === ACCOUNT_STATE_FROZEN) {
          throw new TokenProgramError(
            "New token accounts for this token start out frozen. It isn't supported here."
          );
        }
        break;
      default:
        throw new TokenProgramError("This token has a feature that isn't supported yet.");
    }
  }
}

// Fetches a token's owning program (classic or Token-2022) and its decimal
// count, after confirming this app can actually support it: the address
// must be owned by one of the two known token programs, must not have a
// freeze authority set (its creator could freeze any account for it,
// including one this app would otherwise rely on staying usable), and —
// for Token-2022 — must carry none of the extensions this app doesn't
// support. A lookup that fails for any reason never falls back to
// guessing a token program or a decimal count.
export async function resolveTokenProgram(connection: Connection, mint: PublicKey): Promise<TokenProgramInfo> {
  let info;
  try {
    info = await connection.getAccountInfo(mint);
  } catch {
    throw new TokenProgramError("Could not check this token. Try again.");
  }

  if (!info) {
    throw new TokenProgramError("Could not find that token. Check the token address.");
  }
  if (info.data.length < MINT_BASE_LEN) {
    throw new TokenProgramError("This address is not a token.");
  }

  let programId: PublicKey;
  if (info.owner.equals(TOKEN_PROGRAM_ID)) {
    programId = TOKEN_PROGRAM_ID;
  } else if (info.owner.equals(TOKEN_2022_PROGRAM_ID)) {
    programId = TOKEN_2022_PROGRAM_ID;
  } else {
    throw new TokenProgramError("This address is not a token.");
  }

  if (hasFreezeAuthority(info.data)) {
    throw new TokenProgramError("This token can be frozen by its creator. It isn't supported here.");
  }

  if (programId.equals(TOKEN_2022_PROGRAM_ID)) {
    assertExtensionsAllowed(readMintExtensions(info.data));
  }

  return { programId, decimals: info.data.readUInt8(MINT_DECIMALS_OFFSET) };
}
