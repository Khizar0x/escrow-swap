"use client";

import { useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { DisabledOfferAction, formatOfferAmount } from "@/components/OfferCard";
import { TransactionStatusSteps } from "@/components/TransactionStatusSteps";
import { Button } from "@/components/ui/Button";
import { useEscrowProgram } from "@/hooks/useEscrowProgram";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import { fetchMintDecimals } from "@/lib/escrow/createOffer";
import type { Offer } from "@/lib/escrow/fetchOffers";
import {
  assertNotOwnOffer,
  assertSufficientTakerBalance,
  buildTakeOfferTransaction,
  fetchFreshOffer,
  needsTakerTokenAccountA,
  toTakeOfferFormMessage,
} from "@/lib/escrow/takeOffer";
import { shortenAddress } from "@/lib/format/address";
import { type SendState } from "@/lib/tx/useSendTransaction";
import { type TransactionStatus } from "@/lib/tx/sendTransaction";
import { useSendTransaction } from "@/lib/tx/useSendTransaction";

export type TakeOfferResult = { type: "success"; signature: string } | { type: "error"; message: string };

// The outcome of a take-offer attempt (success or failure) is reported
// upward through onResult rather than rendered here, so it survives this
// card being removed by the next offers-list refresh — e.g. once the swap
// succeeds and the offer disappears, or once someone else takes it first.
export function TakeOfferAction({
  offer,
  decimals,
  unavailableMints,
  onRefresh,
  onResult,
}: {
  offer: Offer;
  decimals: Map<string, number>;
  unavailableMints: Set<string>;
  onRefresh: () => void;
  onResult: (result: TakeOfferResult | null) => void;
}) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const programState = useEscrowProgram();
  const networkStatus = useNetworkStatus();
  const { state, send, reset } = useSendTransaction();

  const [panelOpen, setPanelOpen] = useState(false);
  const [willCreateAccount, setWillCreateAccount] = useState<boolean | null>(null);
  const prevStatusRef = useRef<SendState["status"]>("idle");

  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = state.status;

    if (state.status === "success" && prev !== "success") {
      onResult({ type: "success", signature: state.signature });
      onRefresh();
      setPanelOpen(false);
    } else if (state.status === "error" && prev !== "error") {
      onResult({ type: "error", message: state.message });
      setPanelOpen(false);
    }
  }, [state, onResult, onRefresh]);

  const tokensAvailable = decimals.has(offer.tokenA.toBase58()) && decimals.has(offer.tokenB.toBase58());

  if (!publicKey || programState.status !== "ready") {
    return <DisabledOfferAction label="Connect wallet to take this offer" />;
  }
  if (networkStatus !== "devnet") {
    return <DisabledOfferAction label="Take offer" note="Switch to Solana Devnet to continue." />;
  }
  if (!tokensAvailable) {
    return (
      <DisabledOfferAction
        label="Take offer"
        note="We could not check one of these tokens, so this offer can't be taken right now."
      />
    );
  }

  const isBusy = state.status !== "idle" && state.status !== "success" && state.status !== "error";

  async function openPanel() {
    setWillCreateAccount(null);
    setPanelOpen(true);
    try {
      const needsAccount = await needsTakerTokenAccountA(connection, publicKey!, offer.tokenA);
      setWillCreateAccount(needsAccount);
    } catch {
      setWillCreateAccount(false);
    }
  }

  function closePanel() {
    setPanelOpen(false);
    reset();
  }

  async function handleConfirm() {
    if (programState.status !== "ready" || !publicKey) {
      return;
    }
    onResult(null);
    try {
      const freshOffer = await fetchFreshOffer(programState.program, offer.offerAddress);
      assertNotOwnOffer(freshOffer, publicKey);

      // Both tokens must be classic tokens; fetchMintDecimals rejects
      // Token-2022 (and anything else that isn't a classic mint) with a
      // plain message. Only token B's decimals are needed past this point,
      // to show the balance check's amounts in plain decimals.
      const [, decimalsB] = await Promise.all([
        fetchMintDecimals(connection, freshOffer.tokenA),
        fetchMintDecimals(connection, freshOffer.tokenB),
      ]);

      await assertSufficientTakerBalance(connection, publicKey, freshOffer, decimalsB);

      const createsTakerTokenAccountA = await needsTakerTokenAccountA(connection, publicKey, freshOffer.tokenA);

      await send(programState.program, async () => {
        const result = await buildTakeOfferTransaction({
          program: programState.program,
          taker: publicKey,
          offer: freshOffer,
          createsTakerTokenAccountA,
        });
        return result.transaction;
      });
    } catch (error) {
      onResult({ type: "error", message: toTakeOfferFormMessage(error) });
      setPanelOpen(false);
    }
  }

  if (!panelOpen) {
    return (
      <Button onClick={openPanel} className="w-full">
        Take offer
      </Button>
    );
  }

  const giveAmount = formatOfferAmount(offer.amountB, offer.tokenB, decimals, unavailableMints);
  const getAmount = formatOfferAmount(offer.amountA, offer.tokenA, decimals, unavailableMints);

  return (
    <div className="flex flex-col gap-3 rounded-control border border-border bg-raised p-4 text-sm">
      <p className="text-ink">
        You give {giveAmount} of {shortenAddress(offer.tokenB.toBase58())}. You get {getAmount} of{" "}
        {shortenAddress(offer.tokenA.toBase58())}.
      </p>
      <p className="text-muted">Maker: {shortenAddress(offer.maker.toBase58())}</p>

      {willCreateAccount && (
        <p className="text-muted">
          This will also create a token account for you to receive this token. It costs a small amount of
          SOL.
        </p>
      )}

      {isBusy && (
        <div className="border-t border-border pt-3">
          <TransactionStatusSteps current={state.status as TransactionStatus} />
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleConfirm} disabled={isBusy} className="flex-1">
          {isBusy ? "Taking offer…" : "Confirm"}
        </Button>
        <Button variant="secondary" onClick={closePanel} disabled={isBusy} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}
