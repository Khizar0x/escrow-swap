import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createAssociatedTokenAccountIdempotentInstruction,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getAccount,
  getAssociatedTokenAddressSync,
  getMintLen,
  mintTo,
} from "@solana/spl-token";
import { assert } from "chai";
import { Escrow } from "../target/types/escrow";
import { newFundedKeypair, offerPda } from "./utils";

// Regression tests for make_offer hardening, run against a local validator.
// Each test asserts the desired behaviour, so exploit cases fail on the
// unmodified program. Token-2022 is used throughout so the transfer-fee
// extension is in play.

describe("make_offer hardening", () => {
  // Confirmed commitment so reads after .rpc() see the transaction's effects.
  // The default provider commitment ("processed") lets reads race the tx.
  const baseProvider = anchor.AnchorProvider.env();
  const provider = new anchor.AnchorProvider(baseProvider.connection, baseProvider.wallet, {
    commitment: "confirmed",
  });
  anchor.setProvider(provider);
  const program = anchor.workspace.Escrow as Program<Escrow>;
  const connection = provider.connection;

  async function createToken2022Mint(
    payer: Keypair,
    feeBps: number | null
  ): Promise<PublicKey> {
    const mint = Keypair.generate();
    const extensions = feeBps === null ? [] : [ExtensionType.TransferFeeConfig];
    const space = getMintLen(extensions);
    const lamports = await connection.getMinimumBalanceForRentExemption(space);
    const ixs = [
      SystemProgram.createAccount({
        fromPubkey: payer.publicKey,
        newAccountPubkey: mint.publicKey,
        space,
        lamports,
        programId: TOKEN_2022_PROGRAM_ID,
      }),
    ];
    if (feeBps !== null) {
      ixs.push(
        createInitializeTransferFeeConfigInstruction(
          mint.publicKey,
          payer.publicKey,
          payer.publicKey,
          feeBps,
          BigInt(1_000_000_000_000),
          TOKEN_2022_PROGRAM_ID
        )
      );
    }
    ixs.push(
      createInitializeMintInstruction(
        mint.publicKey,
        6,
        payer.publicKey,
        null,
        TOKEN_2022_PROGRAM_ID
      )
    );
    await sendAndConfirmTransaction(connection, new Transaction().add(...ixs), [
      payer,
      mint,
    ]);
    return mint.publicKey;
  }

  async function fundAta(
    payer: Keypair,
    owner: Keypair,
    mint: PublicKey,
    amount: number
  ): Promise<PublicKey> {
    const ata = getAssociatedTokenAddressSync(
      mint,
      owner.publicKey,
      false,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const ix = createAssociatedTokenAccountIdempotentInstruction(
      payer.publicKey,
      ata,
      owner.publicKey,
      mint,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
    await sendAndConfirmTransaction(connection, new Transaction().add(ix), [payer]);
    if (amount > 0) {
      await mintTo(
        connection,
        payer,
        mint,
        ata,
        payer,
        amount,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
    }
    return ata;
  }

  function ataFor(mint: PublicKey, owner: PublicKey): PublicKey {
    return getAssociatedTokenAddressSync(
      mint,
      owner,
      true,
      TOKEN_2022_PROGRAM_ID,
      ASSOCIATED_TOKEN_PROGRAM_ID
    );
  }

  // The local RPC can serve stale state briefly after .rpc() returns, so state
  // checks poll until the expected value appears or the attempts run out.
  async function eventually<T>(read: () => Promise<T>, ok: (v: T) => boolean): Promise<T> {
    let last: T | undefined;
    for (let attempt = 0; attempt < 40; attempt++) {
      try {
        last = await read();
        if (ok(last)) return last;
      } catch (err: any) {
        if (err?.name !== "TokenAccountNotFoundError") throw err;
      }
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return last as T;
  }

  function token2022Account(address: PublicKey) {
    return () => getAccount(connection, address, "confirmed", TOKEN_2022_PROGRAM_ID);
  }

  function makeOfferCall(
    maker: Keypair,
    mintA: PublicKey,
    mintB: PublicKey,
    offerId: BN,
    amountA: BN,
    amountB: BN
  ) {
    const offer = offerPda(program.programId, maker.publicKey, offerId);
    const vault = ataFor(mintA, offer);
    const makerTokenAccountA = ataFor(mintA, maker.publicKey);
    return {
      offer,
      vault,
      makerTokenAccountA,
      call: () =>
        program.methods
          .makeOffer(offerId, amountA, amountB)
          .accountsPartial({
            maker: maker.publicKey,
            tokenMintA: mintA,
            tokenMintB: mintB,
            makerTokenAccountA,
            offer,
            vault,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
          })
          .signers([maker])
          .rpc(),
    };
  }

  // Asserts the call fails with the named custom error.
  async function expectProgramError(p: Promise<unknown>, codeName: string) {
    try {
      await p;
    } catch (err: any) {
      const actual = err?.error?.errorCode?.code;
      assert.equal(
        actual,
        codeName,
        `expected ${codeName}, got: ${err?.message ?? err}`
      );
      return;
    }
    assert.fail(`expected ${codeName}, but the transaction succeeded`);
  }

  async function setupMaker() {
    const payer = await newFundedKeypair(connection, 20);
    const maker = await newFundedKeypair(connection, 10);
    return { payer, maker };
  }

  it("9. make_offer rejects amount_a = 0", async () => {
    const { payer, maker } = await setupMaker();
    const mintA = await createToken2022Mint(payer, null);
    const mintB = await createToken2022Mint(payer, null);
    await fundAta(payer, maker, mintA, 1_000);

    const { offer, call } = makeOfferCall(
      maker,
      mintA,
      mintB,
      new BN(9),
      new BN(0),
      new BN(50)
    );
    await expectProgramError(call(), "ZeroAmount");
    assert.isNull(await connection.getAccountInfo(offer), "no offer should exist");
  });

  it("10. make_offer rejects amount_b = 0", async () => {
    const { payer, maker } = await setupMaker();
    const mintA = await createToken2022Mint(payer, null);
    const mintB = await createToken2022Mint(payer, null);
    await fundAta(payer, maker, mintA, 1_000);

    const { offer, call } = makeOfferCall(
      maker,
      mintA,
      mintB,
      new BN(10),
      new BN(100),
      new BN(0)
    );
    await expectProgramError(call(), "ZeroAmount");
    assert.isNull(await connection.getAccountInfo(offer), "no offer should exist");
  });

  it("11. make_offer rejects the same mint for A and B", async () => {
    const { payer, maker } = await setupMaker();
    const mint = await createToken2022Mint(payer, null);
    await fundAta(payer, maker, mint, 1_000);

    const { offer, call } = makeOfferCall(
      maker,
      mint,
      mint,
      new BN(11),
      new BN(100),
      new BN(50)
    );
    await expectProgramError(call(), "SameMint");
    assert.isNull(await connection.getAccountInfo(offer), "no offer should exist");
  });

  it("12. make_offer rejects a transfer-fee mint A", async () => {
    const { payer, maker } = await setupMaker();
    const mintA = await createToken2022Mint(payer, 100); // 1% fee
    const mintB = await createToken2022Mint(payer, null);
    await fundAta(payer, maker, mintA, 1_000);

    const { vault, call } = makeOfferCall(
      maker,
      mintA,
      mintB,
      new BN(12),
      new BN(1_000),
      new BN(500)
    );

    let makeError: any = null;
    try {
      await call();
    } catch (err: any) {
      makeError = err;
    }
    if (makeError) {
      assert.equal(makeError?.error?.errorCode?.code, "TransferFeeNotSupported");
      return;
    }
    const acct = await eventually(token2022Account(vault), (a) => a.amount !== 0n);
    assert.fail(
      `transfer-fee mint A was accepted; amount_a = 1000 but vault holds ${acct.amount}`
    );
  });

  it("13. make_offer rejects a transfer-fee mint B", async () => {
    const { payer, maker } = await setupMaker();
    const mintA = await createToken2022Mint(payer, null);
    const mintB = await createToken2022Mint(payer, 100); // 1% fee
    await fundAta(payer, maker, mintA, 1_000);

    const { offer, call } = makeOfferCall(
      maker,
      mintA,
      mintB,
      new BN(13),
      new BN(100),
      new BN(500)
    );
    await expectProgramError(call(), "TransferFeeNotSupported");
    assert.isNull(await connection.getAccountInfo(offer), "no offer should exist");
  });

  it("14. make_offer rejects a zero-bps transfer-fee extension", async () => {
    // A zero fee can be raised later by the fee authority, so the extension
    // itself is rejected, not just a non-zero rate.
    const { payer, maker } = await setupMaker();
    const mintA = await createToken2022Mint(payer, 0);
    const mintB = await createToken2022Mint(payer, null);
    await fundAta(payer, maker, mintA, 1_000);

    const { call } = makeOfferCall(
      maker,
      mintA,
      mintB,
      new BN(14),
      new BN(100),
      new BN(50)
    );
    await expectProgramError(call(), "TransferFeeNotSupported");
  });

  it("15. regression: plain Token-2022 mints still make, take and cancel", async () => {
    const { payer, maker } = await setupMaker();
    const taker = await newFundedKeypair(connection, 10);
    const mintA = await createToken2022Mint(payer, null);
    const mintB = await createToken2022Mint(payer, null);
    await fundAta(payer, maker, mintA, 1_000);
    await fundAta(payer, taker, mintB, 1_000);

    // Make and take.
    const first = makeOfferCall(maker, mintA, mintB, new BN(15), new BN(100), new BN(50));
    await first.call();
    const vaultAfterMake = await eventually(token2022Account(first.vault), (a) => a.amount === 100n);
    assert.equal(vaultAfterMake.amount, 100n);

    const takerTokenAccountA = await fundAta(payer, taker, mintA, 0);
    const takerTokenAccountB = ataFor(mintB, taker.publicKey);
    const makerTokenAccountB = ataFor(mintB, maker.publicKey);
    await program.methods
      .takeOffer()
      .accountsPartial({
        taker: taker.publicKey,
        maker: maker.publicKey,
        tokenMintA: mintA,
        tokenMintB: mintB,
        offer: first.offer,
        vault: first.vault,
        takerTokenAccountA,
        takerTokenAccountB,
        makerTokenAccountB,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([taker])
      .rpc();
    const firstClosed = await eventually(
      () => connection.getAccountInfo(first.offer),
      (info) => info === null
    );
    assert.isNull(firstClosed, "offer closed after take");
    const takerA = await eventually(token2022Account(takerTokenAccountA), (a) => a.amount === 100n);
    assert.equal(takerA.amount, 100n);
    const makerB = await eventually(token2022Account(makerTokenAccountB), (a) => a.amount === 50n);
    assert.equal(makerB.amount, 50n);

    // Make and cancel.
    const second = makeOfferCall(maker, mintA, mintB, new BN(16), new BN(200), new BN(10));
    await second.call();
    await program.methods
      .cancelOffer()
      .accountsPartial({
        maker: maker.publicKey,
        tokenMintA: mintA,
        offer: second.offer,
        makerTokenAccountA: second.makerTokenAccountA,
        vault: second.vault,
        associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
        tokenProgram: TOKEN_2022_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .signers([maker])
      .rpc();
    const secondClosed = await eventually(
      () => connection.getAccountInfo(second.offer),
      (info) => info === null
    );
    assert.isNull(secondClosed, "offer closed after cancel");
  });
});
