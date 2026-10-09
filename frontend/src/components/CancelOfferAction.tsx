"use client";

import { useEffect, useRef, useState } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { DisabledOfferAction, formatOfferAmount } from "@/components/OfferCard";
import { TransactionStatusSteps } from "@/components/TransactionStatusSteps";
import { Button } from "@/components/ui/Button";
import { useEscrowProgram } from "@/hooks/useEscrowProgram";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  assertIsMaker,
  buildCancelOfferTransaction,
  fetchFreshOffer,
  toCancelOfferFormMessage,
} from "@/lib/escrow/cancelOffer";
import { fetchMintDecimals } from "@/lib/escrow/createOffer";
import type { Offer } from "@/lib/escrow/fetchOffers";
import { shortenAddress } from "@/lib/format/address";
import { createInFlightGuard } from "@/lib/tx/inFlightGuard";
import { type SendState } from "@/lib/tx/useSendTransaction";
import { type TransactionStatus } from "@/lib/tx/sendTransaction";
import { useSendTransaction } from "@/lib/tx/useSendTransaction";

export type CancelOfferResult = { type: "success"; signature: string } | { type: "error"; message: string };

// The outcome of a cancel attempt (success or failure) is reported upward
// through onResult rather than rendered here, so it survives this card
// being removed by the next offers-list refresh — the same lesson from the
// Take Offer and Create Offer banner fixes.
export function CancelOfferAction({
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
  onResult: (result: CancelOfferResult | null) => void;
}) {
  const { publicKey } = useWallet();
  const { connection } = useConnection();
  const programState = useEscrowProgram();
  const networkStatus = useNetworkStatus();
  const { state, send, reset } = useSendTransaction();

  const [panelOpen, setPanelOpen] = useState(false);
  const prevStatusRef = useRef<SendState["status"]>("idle");
  // A synchronous guard against a double-click on Confirm, on top of
  // useSendTransaction's own guard — this one also stops the pre-send checks
  // below (re-fetching the offer, checking who the maker is) from running
  // twice.
  const guardRef = useRef(createInFlightGuard());

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

  const tokenAvailable = decimals.has(offer.tokenA.toBase58());

  if (!publicKey || programState.status !== "ready") {
    return <DisabledOfferAction label="Connect wallet to cancel this offer" />;
  }
  if (networkStatus !== "devnet") {
    return <DisabledOfferAction label="Cancel offer" note="Switch to Solana Devnet to continue." />;
  }
  if (!tokenAvailable) {
    return (
      <DisabledOfferAction
        label="Cancel offer"
        note="We could not check this token, so this offer can't be canceled right now."
      />
    );
  }

  const isBusy = state.status !== "idle" && state.status !== "success" && state.status !== "error";

  function openPanel() {
    setPanelOpen(true);
  }

  function closePanel() {
    setPanelOpen(false);
    reset();
  }

  async function handleConfirm() {
    await guardRef.current(async () => {
      if (programState.status !== "ready" || !publicKey) {
        return;
      }
      onResult(null);
      try {
        const freshOffer = await fetchFreshOffer(programState.program, offer.offerAddress);
        assertIsMaker(freshOffer, publicKey);

        // Classic tokens only; fetchMintDecimals rejects Token-2022 with a
        // plain message and never falls back to 0 decimals.
        await fetchMintDecimals(connection, freshOffer.tokenA);

        await send(programState.program, async () => {
          const result = await buildCancelOfferTransaction({
            program: programState.program,
            maker: publicKey,
            offer: freshOffer,
          });
          return result.transaction;
        });
      } catch (error) {
        onResult({ type: "error", message: toCancelOfferFormMessage(error) });
        setPanelOpen(false);
      }
    });
  }

  if (!panelOpen) {
    return (
      <Button onClick={openPanel} className="w-full">
        Cancel offer
      </Button>
    );
  }

  const getBackAmount = formatOfferAmount(offer.amountA, offer.tokenA, decimals, unavailableMints);

  return (
    <div className="flex flex-col gap-3 rounded-control border border-border bg-raised p-4 text-sm">
      <p className="text-ink">
        You get back {getBackAmount} of {shortenAddress(offer.tokenA.toBase58())}. Your offer will be
        removed.
      </p>

      {isBusy && (
        <div className="border-t border-border pt-3">
          <TransactionStatusSteps current={state.status as TransactionStatus} />
        </div>
      )}

      <div className="flex gap-2">
        <Button onClick={handleConfirm} disabled={isBusy} className="flex-1">
          {isBusy ? "Canceling…" : "Confirm"}
        </Button>
        <Button variant="secondary" onClick={closePanel} disabled={isBusy} className="flex-1">
          Cancel
        </Button>
      </div>
    </div>
  );
}
