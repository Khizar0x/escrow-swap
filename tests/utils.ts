import * as anchor from "@coral-xyz/anchor";
import { BN, Program } from "@coral-xyz/anchor";
import {
  Keypair,
  PublicKey,
  SystemProgram,
  LAMPORTS_PER_SOL,
} from "@solana/web3.js";
import {
  ASSOCIATED_TOKEN_PROGRAM_ID,
  TOKEN_PROGRAM_ID,
  createMint,
  getAssociatedTokenAddressSync,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import { Escrow } from "../target/types/escrow";

const OFFER_SEED = Buffer.from("offer");

export function offerPda(
  programId: PublicKey,
  maker: PublicKey,
  offerId: BN
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [OFFER_SEED, maker.toBuffer(), offerId.toArrayLike(Buffer, "le", 8)],
    programId
  );
  return pda;
}

export function vaultAddress(mintA: PublicKey, offer: PublicKey): PublicKey {
  return getAssociatedTokenAddressSync(
    mintA,
    offer,
    true,
    TOKEN_PROGRAM_ID,
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
}

export async function newFundedKeypair(
  connection: anchor.web3.Connection,
  sol = 10
): Promise<Keypair> {
  const kp = Keypair.generate();
  const sig = await connection.requestAirdrop(kp.publicKey, sol * LAMPORTS_PER_SOL);
  await connection.confirmTransaction(sig, "confirmed");
  return kp;
}

export interface Actors {
  maker: Keypair;
  taker: Keypair;
  mintA: PublicKey;
  mintB: PublicKey;
  decimals: number;
  makerTokenAccountA: PublicKey;
}

export async function setupActors(
  provider: anchor.AnchorProvider,
  opts: { makerAmountA?: number; takerAmountB?: number } = {}
): Promise<Actors> {
  const connection = provider.connection;
  const decimals = 6;
  const makerAmountA = opts.makerAmountA ?? 1_000;
  const takerAmountB = opts.takerAmountB ?? 1_000;

  const maker = await newFundedKeypair(connection);
  const taker = await newFundedKeypair(connection);

  const mintA = await createMint(connection, maker, maker.publicKey, null, decimals);
  const mintB = await createMint(connection, taker, taker.publicKey, null, decimals);

  const makerAtaA = await getOrCreateAssociatedTokenAccount(
    connection,
    maker,
    mintA,
    maker.publicKey
  );
  if (makerAmountA > 0) {
    await mintTo(connection, maker, mintA, makerAtaA.address, maker, makerAmountA);
  }

  const takerAtaB = await getOrCreateAssociatedTokenAccount(
    connection,
    taker,
    mintB,
    taker.publicKey
  );
  if (takerAmountB > 0) {
    await mintTo(connection, taker, mintB, takerAtaB.address, taker, takerAmountB);
  }

  return {
    maker,
    taker,
    mintA,
    mintB,
    decimals,
    makerTokenAccountA: makerAtaA.address,
  };
}

export async function makeOffer(
  program: Program<Escrow>,
  maker: Keypair,
  mintA: PublicKey,
  mintB: PublicKey,
  offerId: BN,
  amountA: BN,
  amountB: BN
): Promise<{ offer: PublicKey; vault: PublicKey; makerTokenAccountA: PublicKey }> {
  const offer = offerPda(program.programId, maker.publicKey, offerId);
  const vault = vaultAddress(mintA, offer);
  const makerTokenAccountA = getAssociatedTokenAddressSync(mintA, maker.publicKey);

  await program.methods
    .makeOffer(offerId, amountA, amountB)
    .accounts({
      maker: maker.publicKey,
      tokenMintA: mintA,
      tokenMintB: mintB,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([maker])
    .rpc();

  return { offer, vault, makerTokenAccountA };
}

export function takeOfferIx(
  program: Program<Escrow>,
  taker: Keypair,
  maker: PublicKey,
  mintA: PublicKey,
  mintB: PublicKey,
  offer: PublicKey,
  vault: PublicKey
) {
  const takerTokenAccountA = getAssociatedTokenAddressSync(mintA, taker.publicKey);
  const takerTokenAccountB = getAssociatedTokenAddressSync(mintB, taker.publicKey);
  const makerTokenAccountB = getAssociatedTokenAddressSync(mintB, maker);

  return {
    takerTokenAccountA,
    takerTokenAccountB,
    makerTokenAccountB,
    call: () =>
      program.methods
        .takeOffer()
        .accountsPartial({
          taker: taker.publicKey,
          maker,
          tokenMintA: mintA,
          tokenMintB: mintB,
          offer,
          vault,
          takerTokenAccountA,
          takerTokenAccountB,
          makerTokenAccountB,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([taker])
        .rpc(),
  };
}

export function cancelOfferIx(
  program: Program<Escrow>,
  maker: Keypair,
  mintA: PublicKey,
  offer: PublicKey,
  vault: PublicKey,
  makerTokenAccountA: PublicKey
) {
  return {
    call: () =>
      program.methods
        .cancelOffer()
        .accountsPartial({
          maker: maker.publicKey,
          tokenMintA: mintA,
          offer,
          makerTokenAccountA,
          vault,
          associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
          tokenProgram: TOKEN_PROGRAM_ID,
          systemProgram: SystemProgram.programId,
        })
        .signers([maker])
        .rpc(),
  };
}
