const fs = require("fs");
const os = require("os");
const path = require("path");
const anchor = require("@coral-xyz/anchor");
const { Connection, Keypair, PublicKey } = require("@solana/web3.js");
const {
  TOKEN_PROGRAM_ID,
  ASSOCIATED_TOKEN_PROGRAM_ID,
  getAssociatedTokenAddressSync,
} = require("@solana/spl-token");

const idl = require("../src/lib/anchor/escrow.json");

const RPC = "https://api.devnet.solana.com";
const MAKER = new PublicKey("GrddqTEnvVi7hjRV6qxWLnT8zbJLnv1KLe72U2xrLnFv");
const MINT_A = new PublicKey("9vHbSrftF8fExXms8tS8i84F7SFo88AeRqHxJqvLRsDd");
const MINT_B = new PublicKey("FxR3wGtRw4rTTTjAmmD6AihXeZA8MBcCv2gtk6FnX8hd");

async function main() {
  const secretPath = path.join(os.homedir(), ".config/solana/id.json");
  const secret = JSON.parse(fs.readFileSync(secretPath, "utf8"));
  const taker = Keypair.fromSecretKey(Uint8Array.from(secret));

  const connection = new Connection(RPC, "confirmed");
  const wallet = new anchor.Wallet(taker);
  const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
  const program = new anchor.Program(idl, provider);

  console.log("Taker (CLI wallet):", taker.publicKey.toBase58());

  const offers = await program.account.offer.all();
  const target = offers.find(
    (o) =>
      o.account.maker.equals(MAKER) &&
      o.account.tokenMintA.equals(MINT_A) &&
      o.account.tokenMintB.equals(MINT_B)
  );

  if (!target) {
    console.error("No matching open offer found. Open offers:", offers.map(o => ({
      pubkey: o.publicKey.toBase58(),
      maker: o.account.maker.toBase58(),
      offerId: o.account.offerId.toString(),
    })));
    process.exit(1);
  }

  console.log("Found offer:", target.publicKey.toBase58(), "offerId:", target.account.offerId.toString());
  console.log("  amountA:", target.account.amountA.toString(), "amountB:", target.account.amountB.toString());

  const vault = getAssociatedTokenAddressSync(MINT_A, target.publicKey, true, TOKEN_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID);
  const takerTokenAccountA = getAssociatedTokenAddressSync(MINT_A, taker.publicKey);
  const takerTokenAccountB = getAssociatedTokenAddressSync(MINT_B, taker.publicKey);
  const makerTokenAccountB = getAssociatedTokenAddressSync(MINT_B, MAKER);

  const sig = await program.methods
    .takeOffer()
    .accountsPartial({
      taker: taker.publicKey,
      maker: MAKER,
      tokenMintA: MINT_A,
      tokenMintB: MINT_B,
      offer: target.publicKey,
      vault,
      takerTokenAccountA,
      takerTokenAccountB,
      makerTokenAccountB,
      associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: anchor.web3.SystemProgram.programId,
    })
    .rpc();

  console.log("take_offer signature:", sig);
  console.log(`Explorer: https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
