import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import { PublicKey } from "@solana/web3.js";
import { getAccount, getAssociatedTokenAddressSync } from "@solana/spl-token";
import { assert } from "chai";
import { Escrow } from "../target/types/escrow";
import {
  cancelOfferIx,
  makeOffer,
  offerPda,
  setupActors,
  takeOfferIx,
  vaultAddress,
} from "./utils";

describe("escrow", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);
  const program = anchor.workspace.Escrow as Program<Escrow>;
  const connection = provider.connection;

  async function expectAccountClosed(pubkey: PublicKey) {
    const info = await connection.getAccountInfo(pubkey);
    assert.isNull(info, `expected account ${pubkey.toBase58()} to be closed`);
  }

  async function expectRpcFailure(p: Promise<unknown>) {
    let threw = false;
    try {
      await p;
    } catch (_err) {
      threw = true;
    }
    assert.isTrue(threw, "expected transaction to fail, but it succeeded");
  }

  it("1. make_offer success", async () => {
    const { maker, mintA, mintB } = await setupActors(provider, { makerAmountA: 1_000 });
    const offerId = new BN(1);
    const amountA = new BN(100);
    const amountB = new BN(50);

    const { offer, vault, makerTokenAccountA } = await makeOffer(
      program,
      maker,
      mintA,
      mintB,
      offerId,
      amountA,
      amountB
    );

    const offerAccount = await program.account.offer.fetch(offer);
    assert.equal(offerAccount.offerId.toString(), offerId.toString());
    assert.equal(offerAccount.maker.toBase58(), maker.publicKey.toBase58());
    assert.equal(offerAccount.tokenMintA.toBase58(), mintA.toBase58());
    assert.equal(offerAccount.tokenMintB.toBase58(), mintB.toBase58());
    assert.equal(offerAccount.amountA.toString(), amountA.toString());
    assert.equal(offerAccount.amountB.toString(), amountB.toString());

    const vaultAccount = await getAccount(connection, vault);
    assert.equal(vaultAccount.amount.toString(), amountA.toString());
    assert.equal(vaultAccount.owner.toBase58(), offer.toBase58());

    const makerAtaA = await getAccount(connection, makerTokenAccountA);
    assert.equal(makerAtaA.amount.toString(), "900");
  });

  it("2. take_offer success", async () => {
    const { maker, taker, mintA, mintB } = await setupActors(provider, {
      makerAmountA: 1_000,
      takerAmountB: 1_000,
    });
    const offerId = new BN(1);
    const amountA = new BN(100);
    const amountB = new BN(50);

    const { offer, vault } = await makeOffer(
      program,
      maker,
      mintA,
      mintB,
      offerId,
      amountA,
      amountB
    );

    const { takerTokenAccountA, takerTokenAccountB, makerTokenAccountB, call } = takeOfferIx(
      program,
      taker,
      maker.publicKey,
      mintA,
      mintB,
      offer,
      vault
    );
    await call();

    const takerAtaA = await getAccount(connection, takerTokenAccountA);
    assert.equal(takerAtaA.amount.toString(), amountA.toString());

    const makerAtaB = await getAccount(connection, makerTokenAccountB);
    assert.equal(makerAtaB.amount.toString(), amountB.toString());

    const takerAtaB = await getAccount(connection, takerTokenAccountB);
    assert.equal(takerAtaB.amount.toString(), "950");

    await expectAccountClosed(offer);
    await expectAccountClosed(vault);
  });

  it("3. cancel_offer success", async () => {
    const { maker, mintA, mintB } = await setupActors(provider, { makerAmountA: 1_000 });
    const offerId = new BN(1);
    const amountA = new BN(100);
    const amountB = new BN(50);

    const { offer, vault, makerTokenAccountA } = await makeOffer(
      program,
      maker,
      mintA,
      mintB,
      offerId,
      amountA,
      amountB
    );

    const { call } = cancelOfferIx(program, maker, mintA, offer, vault, makerTokenAccountA);
    await call();

    const makerAtaA = await getAccount(connection, makerTokenAccountA);
    assert.equal(makerAtaA.amount.toString(), "1000");

    await expectAccountClosed(offer);
    await expectAccountClosed(vault);
  });

  it("4. wrong user cancel failure", async () => {
    const { maker, taker, mintA, mintB } = await setupActors(provider, { makerAmountA: 1_000 });
    const offerId = new BN(1);
    const amountA = new BN(100);
    const amountB = new BN(50);

    const { offer, vault, makerTokenAccountA } = await makeOffer(
      program,
      maker,
      mintA,
      mintB,
      offerId,
      amountA,
      amountB
    );

    // `taker` signs as the "maker" slot on someone else's real offer.
    const attackerAtaA = getAssociatedTokenAddressSync(mintA, taker.publicKey);
    const { call } = cancelOfferIx(program, taker, mintA, offer, vault, attackerAtaA);
    await expectRpcFailure(call());

    const offerAccount = await program.account.offer.fetch(offer);
    assert.equal(offerAccount.amountA.toString(), amountA.toString());
    const vaultAccount = await getAccount(connection, vault);
    assert.equal(vaultAccount.amount.toString(), amountA.toString());
    const makerAtaA = await getAccount(connection, makerTokenAccountA);
    assert.equal(makerAtaA.amount.toString(), "900");
  });

  it("5. wrong mint failure", async () => {
    const { maker, mintA, mintB } = await setupActors(provider, { makerAmountA: 1_000 });
    const { mintA: wrongMint } = await setupActors(provider, { makerAmountA: 0, takerAmountB: 0 });
    const offerId = new BN(1);
    const amountA = new BN(100);
    const amountB = new BN(50);

    const { offer, vault, makerTokenAccountA } = await makeOffer(
      program,
      maker,
      mintA,
      mintB,
      offerId,
      amountA,
      amountB
    );

    const { call } = cancelOfferIx(program, maker, wrongMint, offer, vault, makerTokenAccountA);
    await expectRpcFailure(call());

    const offerAccount = await program.account.offer.fetch(offer);
    assert.equal(offerAccount.amountA.toString(), amountA.toString());
    const vaultAccount = await getAccount(connection, vault);
    assert.equal(vaultAccount.amount.toString(), amountA.toString());
  });

  it("6. wrong vault failure", async () => {
    const { maker, mintA, mintB } = await setupActors(provider, { makerAmountA: 1_000 });
    const offerId = new BN(1);
    const amountA = new BN(100);
    const amountB = new BN(50);

    const { offer, vault, makerTokenAccountA } = await makeOffer(
      program,
      maker,
      mintA,
      mintB,
      offerId,
      amountA,
      amountB
    );

    // makerTokenAccountA is a real, valid token account for mintA — just not the vault.
    const { call } = cancelOfferIx(program, maker, mintA, offer, makerTokenAccountA, makerTokenAccountA);
    await expectRpcFailure(call());

    const offerAccount = await program.account.offer.fetch(offer);
    assert.equal(offerAccount.amountA.toString(), amountA.toString());
    const vaultAccount = await getAccount(connection, vault);
    assert.equal(vaultAccount.amount.toString(), amountA.toString());
    const makerAtaA = await getAccount(connection, makerTokenAccountA);
    assert.equal(makerAtaA.amount.toString(), "900");
  });

  it("7. insufficient taker balance failure", async () => {
    const { maker, taker, mintA, mintB } = await setupActors(provider, {
      makerAmountA: 1_000,
      takerAmountB: 10,
    });
    const offerId = new BN(1);
    const amountA = new BN(100);
    const amountB = new BN(50);

    const { offer, vault } = await makeOffer(
      program,
      maker,
      mintA,
      mintB,
      offerId,
      amountA,
      amountB
    );

    const { takerTokenAccountB, call } = takeOfferIx(
      program,
      taker,
      maker.publicKey,
      mintA,
      mintB,
      offer,
      vault
    );
    await expectRpcFailure(call());

    const takerAtaB = await getAccount(connection, takerTokenAccountB);
    assert.equal(takerAtaB.amount.toString(), "10");

    const offerAccount = await program.account.offer.fetch(offer);
    assert.equal(offerAccount.amountA.toString(), amountA.toString());
    const vaultAccount = await getAccount(connection, vault);
    assert.equal(vaultAccount.amount.toString(), amountA.toString());

    const makerTokenAccountB = getAssociatedTokenAddressSync(mintB, maker.publicKey);
    const makerAtaBInfo = await connection.getAccountInfo(makerTokenAccountB);
    assert.isNull(makerAtaBInfo, "maker's token B account should never have been created");
  });

  it("8. completed offer reuse failure", async () => {
    const { maker, taker, mintA, mintB } = await setupActors(provider, {
      makerAmountA: 1_000,
      takerAmountB: 1_000,
    });
    const offerId = new BN(1);
    const amountA = new BN(100);
    const amountB = new BN(50);

    const { offer, vault } = await makeOffer(
      program,
      maker,
      mintA,
      mintB,
      offerId,
      amountA,
      amountB
    );

    const first = takeOfferIx(program, taker, maker.publicKey, mintA, mintB, offer, vault);
    await first.call();
    await expectAccountClosed(offer);

    const second = takeOfferIx(program, taker, maker.publicKey, mintA, mintB, offer, vault);
    await expectRpcFailure(second.call());

    const takerAtaA = await getAccount(connection, first.takerTokenAccountA);
    assert.equal(takerAtaA.amount.toString(), amountA.toString());
  });
});
