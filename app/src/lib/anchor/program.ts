"use client";

import { useMemo } from "react";
import * as anchor from "@coral-xyz/anchor";
import { useConnection, useAnchorWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import idl from "./escrow.json";
import type { Escrow } from "./escrow";

const OFFER_SEED = Buffer.from("offer");

const READ_ONLY_WALLET = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new Error("Connect a wallet to sign transactions");
  },
  signAllTransactions: async () => {
    throw new Error("Connect a wallet to sign transactions");
  },
};

export function offerPda(
  programId: PublicKey,
  maker: PublicKey,
  offerId: anchor.BN
): PublicKey {
  const [pda] = PublicKey.findProgramAddressSync(
    [OFFER_SEED, maker.toBuffer(), offerId.toArrayLike(Buffer, "le", 8)],
    programId
  );
  return pda;
}

export function useProgram() {
  const { connection } = useConnection();
  const wallet = useAnchorWallet();

  const provider = useMemo(() => {
    return new anchor.AnchorProvider(connection, wallet ?? READ_ONLY_WALLET, {
      commitment: "confirmed",
    });
  }, [connection, wallet]);

  const program = useMemo(() => {
    return new anchor.Program(
      idl as anchor.Idl,
      provider
    ) as unknown as anchor.Program<Escrow>;
  }, [provider]);

  return { program, provider, connection, wallet, isConnected: !!wallet };
}
