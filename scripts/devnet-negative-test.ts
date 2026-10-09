// Devnet negative test (assignment step 4): exercises the live deployed
// program directly over RPC, bypassing the frontend entirely. Uses the CLI
// wallet at ~/.config/solana/id.json as both payer and maker. Sends real
// (devnet) transactions — this does not touch any program or frontend
// source file.
//
// 1. Creates a classic SPL token with a freeze authority and a plain classic
//    SPL token, then calls make_offer offering the freeze-authority token.
//    Expects the program to reject it with FreezeAuthorityNotSupported
//    (error 6009) — one of the hardening checks added in
//    "Hardening: reject unsafe token extensions and add logs".
// 2. Calls make_offer with two plain tokens (expected to succeed) and then
//    cancel_offer on it (expected to succeed), to show the same script
//    passes a good case.
//
// Run with: npx ts-node scripts/devnet-negative-test.ts

import * as anchor from "@coral-xyz/anchor";
import { BN } from "@coral-xyz/anchor";
import {
  Connection,
  Keypair,
  PublicKey,
  SystemProgram,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAccount,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import * as os from "os";
import * as path from "path";
import idl from "../target/idl/escrow.json";
import type { Escrow } from "../target/types/escrow";

const DEVNET_URL = "https://api.devnet.solana.com";
const OFFER_SEED = Buffer.from("offer");
const DECIMALS = 6;
const AMOUNT_A = 1_000_000; // 1.0 token at 6 decimals
const AMOUNT_B = 500_000;

const lines: string[] = [];
function log(line: string = ""): void {
  console.log(line);
  lines.push(line);
}

function offerPda(programId: PublicKey, maker: PublicKey, offerId: BN): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [OFFER_SEED, maker.toBuffer(), offerId.toArrayLike(Buffer, "le", 8)],
    programId
  );
  return pda;
}

function vaultFor(mintA: PublicKey, offer: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(mintA, offer, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
}

async function logTxLogs(connection: Connection, sig: string): Promise<void> {
  const tx = await connection.getTransaction(sig, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });
  const programLogs = tx?.meta?.logMessages ?? [];
  log(`  signature: ${sig}`);
  log("  program logs:");
  for (const l of programLogs) {
    log(`    ${l}`);
  }
}

function describeError(err: unknown): { name: string; message: string; logs: string[] } {
  const anyErr = err as any;
  const code = anyErr?.error?.errorCode?.code;
  const msg = anyErr?.error?.errorMessage ?? anyErr?.message ?? String(err);
  const logs: string[] = anyErr?.logs ?? anyErr?.error?.logs ?? [];
  return { name: code ?? "(no AnchorError code parsed)", message: msg, logs };
}

async function main() {
  const walletPath = path.join(os.homedir(), ".config", "solana", "id.json");
  const secret = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const payer = Keypair.fromSecretKey(Uint8Array.from(secret));

  const connection = new Connection(DEVNET_URL, "confirmed");
  const wallet = new anchor.Wallet(payer);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  anchor.setProvider(provider);
  const program = new anchor.Program(idl as Escrow, provider);

  log("# Devnet negative test");
  log();
  log(`Program: ${program.programId.toBase58()}`);
  log(`Wallet (payer/maker): ${payer.publicKey.toBase58()}`);
  log(`Cluster: ${DEVNET_URL}`);
  log(`Timestamp: ${new Date().toISOString()}`);
  log();

  // --- Test 1: negative case — a classic token with a freeze authority ---
  log("## Test 1: make_offer with a freeze-authority classic token (expect rejection)");
  log();

  const mintBad = await createMint(connection, payer, payer.publicKey, payer.publicKey, DECIMALS);
  const mintGoodB = await createMint(connection, payer, payer.publicKey, null, DECIMALS);
  log(`Created mint with freeze authority (mint A): ${mintBad.toBase58()}`);
  log(`Created plain mint, no freeze authority (mint B): ${mintGoodB.toBase58()}`);

  const makerAtaBad = await getOrCreateAssociatedTokenAccount(connection, payer, mintBad, payer.publicKey);
  await mintTo(connection, payer, mintBad, makerAtaBad.address, payer, AMOUNT_A);
  log(`Funded maker's ATA for the freeze-authority mint with ${AMOUNT_A} base units`);
  log();

  const offerIdBad = new BN(Date.now());
  const offerBad = offerPda(program.programId, payer.publicKey, offerIdBad);
  const vaultBad = vaultFor(mintBad, offerBad);

  try {
    const sig = await program.methods
      .makeOffer(offerIdBad, new BN(AMOUNT_A), new BN(AMOUNT_B))
      .accountsPartial({
        maker: payer.publicKey,
        tokenMintA: mintBad,
        tokenMintB: mintGoodB,
        makerTokenAccountA: makerAtaBad.address,
        offer: offerBad,
        vault: vaultBad,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();
    log(`UNEXPECTED: make_offer succeeded, signature ${sig}`);
    await logTxLogs(connection, sig);
    log();
    log("**RESULT: FAIL — the program accepted a freeze-authority mint.**");
  } catch (err) {
    const { name, message, logs } = describeError(err);
    log(`Rejected as expected.`);
    log(`  error name: ${name}`);
    log(`  error message: ${message}`);
    if (logs.length > 0) {
      log("  program logs:");
      for (const l of logs) {
        log(`    ${l}`);
      }
    }
    log();
    const pass = name === "FreezeAuthorityNotSupported";
    log(
      pass
        ? "**RESULT: PASS — rejected with FreezeAuthorityNotSupported (6009), as expected.**"
        : `**RESULT: FAIL — rejected, but with ${name}, not FreezeAuthorityNotSupported.**`
    );
  }
  log();

  // --- Test 2: positive case — two plain classic tokens ---
  log("## Test 2: make_offer then cancel_offer with two plain classic tokens (expect success)");
  log();

  const mintGoodA = await createMint(connection, payer, payer.publicKey, null, DECIMALS);
  log(`Created plain mint, no freeze authority (mint A): ${mintGoodA.toBase58()}`);
  log(`Reusing plain mint from test 1 (mint B): ${mintGoodB.toBase58()}`);

  const makerAtaGoodA = await getOrCreateAssociatedTokenAccount(connection, payer, mintGoodA, payer.publicKey);
  await mintTo(connection, payer, mintGoodA, makerAtaGoodA.address, payer, AMOUNT_A);
  log(`Funded maker's ATA for the plain mint with ${AMOUNT_A} base units`);
  log();

  const offerIdGood = new BN(Date.now() + 1);
  const offerGood = offerPda(program.programId, payer.publicKey, offerIdGood);
  const vaultGood = vaultFor(mintGoodA, offerGood);

  try {
    const sig = await program.methods
      .makeOffer(offerIdGood, new BN(AMOUNT_A), new BN(AMOUNT_B))
      .accountsPartial({
        maker: payer.publicKey,
        tokenMintA: mintGoodA,
        tokenMintB: mintGoodB,
        makerTokenAccountA: makerAtaGoodA.address,
        offer: offerGood,
        vault: vaultGood,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();
    log("make_offer succeeded.");
    await logTxLogs(connection, sig);
    const vaultAccount = await getAccount(connection, vaultGood, "confirmed", TOKEN_PROGRAM_ID);
    log(`  vault balance after make_offer: ${vaultAccount.amount.toString()} (expected ${AMOUNT_A})`);
    log();
    log("**RESULT: PASS — make_offer accepted a plain token and locked funds in the vault.**");
  } catch (err) {
    const { name, message, logs } = describeError(err);
    log(`UNEXPECTED: make_offer failed.`);
    log(`  error name: ${name}`);
    log(`  error message: ${message}`);
    for (const l of logs) log(`    ${l}`);
    log();
    log("**RESULT: FAIL — make_offer rejected a plain token with no unsafe extensions.**");
    log();
    writeReport();
    process.exit(1);
  }
  log();

  try {
    const sig = await program.methods
      .cancelOffer()
      .accountsPartial({
        maker: payer.publicKey,
        tokenMintA: mintGoodA,
        offer: offerGood,
        makerTokenAccountA: makerAtaGoodA.address,
        vault: vaultGood,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([payer])
      .rpc();
    log("cancel_offer succeeded.");
    await logTxLogs(connection, sig);
    const offerAccountInfo = await connection.getAccountInfo(offerGood, "confirmed");
    const makerAtaAfter = await getAccount(connection, makerAtaGoodA.address, "confirmed", TOKEN_PROGRAM_ID);
    log(`  offer account after cancel: ${offerAccountInfo === null ? "closed (null)" : "STILL EXISTS"}`);
    log(`  maker token balance after cancel: ${makerAtaAfter.amount.toString()} (expected ${AMOUNT_A}, refunded)`);
    log();
    const pass = offerAccountInfo === null && makerAtaAfter.amount === BigInt(AMOUNT_A);
    log(
      pass
        ? "**RESULT: PASS — cancel_offer closed the offer and refunded the maker in full.**"
        : "**RESULT: FAIL — cancel_offer ran, but the offer or balance state is wrong.**"
    );
  } catch (err) {
    const { name, message, logs } = describeError(err);
    log(`UNEXPECTED: cancel_offer failed.`);
    log(`  error name: ${name}`);
    log(`  error message: ${message}`);
    for (const l of logs) log(`    ${l}`);
    log();
    log("**RESULT: FAIL — cancel_offer failed on a normal, uncontested offer.**");
  }

  writeReport();
}

function writeReport(): void {
  const outPath = path.join(__dirname, "..", "DEVNET_NEGATIVE_TEST.md");
  fs.writeFileSync(outPath, lines.join("\n") + "\n");
  console.log(`\nWrote ${outPath}`);
}

main().catch((err) => {
  console.error("Script failed:", err);
  writeReport();
  process.exit(1);
});
