import { describe, expect, it, vi } from "vitest";
import { Connection, Keypair, PublicKey } from "@solana/web3.js";
import { createEscrowProgram } from "@/lib/anchor/program";
import { GENERIC_ERROR_MESSAGE } from "@/lib/errors/map";
import { QuietRejection, sendAndConfirmTransaction } from "./sendTransaction";

function testProgram() {
  const connection = new Connection("http://127.0.0.1:1", "confirmed");
  const wallet = {
    publicKey: Keypair.generate().publicKey,
    signTransaction: async <T>(tx: T) => tx,
    signAllTransactions: async <T>(txs: T[]) => txs,
  };
  return createEscrowProgram(connection, wallet);
}

function fakeTransaction() {
  return { feePayer: undefined, recentBlockhash: undefined } as never;
}

describe("sendAndConfirmTransaction", () => {
  it("reports each step in order and resolves with the signature", async () => {
    const program = testProgram();
    const statuses: string[] = [];
    const signedTx = { serialize: () => Buffer.from("signed") };

    const connection = {
      getLatestBlockhash: vi
        .fn()
        .mockResolvedValue({ blockhash: "hash", lastValidBlockHeight: 1 }),
      sendRawTransaction: vi.fn().mockResolvedValue("SIG123"),
      confirmTransaction: vi.fn().mockResolvedValue({ value: { err: null } }),
    } as unknown as Connection;

    const wallet = {
      publicKey: new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"),
      signTransaction: vi.fn().mockResolvedValue(signedTx),
    };

    const signature = await sendAndConfirmTransaction({
      connection,
      wallet: wallet as never,
      program,
      buildTransaction: async () => fakeTransaction(),
      onStatus: (status) => statuses.push(status),
    });

    expect(signature).toBe("SIG123");
    expect(statuses).toEqual(["awaiting-approval", "sending", "confirming"]);
  });

  it("throws QuietRejection when the wallet declines to sign", async () => {
    const program = testProgram();
    const connection = {
      getLatestBlockhash: vi
        .fn()
        .mockResolvedValue({ blockhash: "hash", lastValidBlockHeight: 1 }),
    } as unknown as Connection;

    const wallet = {
      publicKey: new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"),
      signTransaction: vi.fn().mockRejectedValue(new Error("User rejected the request.")),
    };

    await expect(
      sendAndConfirmTransaction({
        connection,
        wallet: wallet as never,
        program,
        buildTransaction: async () => fakeTransaction(),
        onStatus: () => {},
      })
    ).rejects.toThrow(QuietRejection);
  });

  it("maps a confirmed-but-failed transaction to its plain program-error message", async () => {
    const program = testProgram();
    const signedTx = { serialize: () => Buffer.from("signed") };

    const connection = {
      getLatestBlockhash: vi
        .fn()
        .mockResolvedValue({ blockhash: "hash", lastValidBlockHeight: 1 }),
      sendRawTransaction: vi.fn().mockResolvedValue("SIG123"),
      confirmTransaction: vi
        .fn()
        .mockResolvedValue({ value: { err: { InstructionError: [0, { Custom: 6003 }] } } }),
      getTransaction: vi.fn().mockResolvedValue({
        meta: {
          logMessages: [
            "Program log: AnchorError occurred. Error Code: SameMint. Error Number: 6003. Error Message: Token A and token B must be different mints.",
          ],
        },
      }),
    } as unknown as Connection;

    const wallet = {
      publicKey: new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"),
      signTransaction: vi.fn().mockResolvedValue(signedTx),
    };

    await expect(
      sendAndConfirmTransaction({
        connection,
        wallet: wallet as never,
        program,
        buildTransaction: async () => fakeTransaction(),
        onStatus: () => {},
      })
    ).rejects.toThrow("Choose two different tokens.");
  });

  it("maps an unrecognized failure to the generic message, never a raw error string", async () => {
    const program = testProgram();
    const connection = {
      getLatestBlockhash: vi
        .fn()
        .mockResolvedValue({ blockhash: "hash", lastValidBlockHeight: 1 }),
      sendRawTransaction: vi.fn().mockRejectedValue(new Error("fetch failed")),
    } as unknown as Connection;

    const wallet = {
      publicKey: new PublicKey("7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU"),
      signTransaction: vi.fn().mockResolvedValue({ serialize: () => Buffer.from("x") }),
    };

    await expect(
      sendAndConfirmTransaction({
        connection,
        wallet: wallet as never,
        program,
        buildTransaction: async () => fakeTransaction(),
        onStatus: () => {},
      })
    ).rejects.toThrow(GENERIC_ERROR_MESSAGE);
  });
});
