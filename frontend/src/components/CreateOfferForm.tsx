"use client";

import { useEffect, useReducer, useRef, useState, type FormEvent } from "react";
import Link from "next/link";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { NetworkWarning } from "@/components/NetworkWarning";
import { TransactionStatusSteps } from "@/components/TransactionStatusSteps";
import { useEscrowProgram } from "@/hooks/useEscrowProgram";
import { useNetworkStatus } from "@/hooks/useNetworkStatus";
import {
  assertDistinctMints,
  assertSufficientBalance,
  buildCreateOfferTransaction,
  fetchMintDecimals,
  fetchTokenBalance,
  pickOfferId,
  toCreateOfferFormMessage,
} from "@/lib/escrow/createOffer";
import { shortenAddress } from "@/lib/format/address";
import { toBaseUnits } from "@/lib/solana/amounts";
import { explorerAddressUrl, explorerTransactionUrl } from "@/lib/solana/explorer";
import { type SendState } from "@/lib/tx/useSendTransaction";
import { type TransactionStatus } from "@/lib/tx/sendTransaction";
import { useSendTransaction } from "@/lib/tx/useSendTransaction";
import { EMPTY_CREATE_OFFER_FORM, reduceCreateOfferBanner } from "@/lib/ui/createOfferBanner";

const ALERT_CLASS = "rounded-control border px-4 py-3 text-sm";

export function CreateOfferForm() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const programState = useEscrowProgram();
  const networkStatus = useNetworkStatus();
  const { state, send, reset } = useSendTransaction();

  const [fields, setFields] = useState(EMPTY_CREATE_OFFER_FORM);
  const [banner, dispatchBanner] = useReducer(reduceCreateOfferBanner, null);
  const pendingOfferAddressRef = useRef<PublicKey | null>(null);
  const prevStatusRef = useRef<SendState["status"]>("idle");

  // Reacts to the transaction's own terminal states (not wallet rejection,
  // which useSendTransaction already resets to idle quietly). The offer
  // address is read from a ref rather than component state, since it's
  // produced mid-build, inside the same submit that this effect reacts to
  // after the fact.
  useEffect(() => {
    const prev = prevStatusRef.current;
    prevStatusRef.current = state.status;

    if (state.status === "success" && prev !== "success") {
      const offerAddress = pendingOfferAddressRef.current;
      if (offerAddress) {
        dispatchBanner({
          type: "submit-result",
          result: { type: "success", offerAddress, signature: state.signature },
        });
        setFields(EMPTY_CREATE_OFFER_FORM);
      }
    } else if (state.status === "error" && prev !== "error") {
      dispatchBanner({ type: "submit-result", result: { type: "error", message: state.message } });
    }
  }, [state]);

  if (programState.status !== "ready" || !publicKey) {
    return (
      <div className={`${ALERT_CLASS} border-border bg-surface text-muted`}>
        Connect your wallet to create an offer.
      </div>
    );
  }

  const networkBlocked = networkStatus !== "devnet";
  const isBusy = state.status !== "idle" && state.status !== "success" && state.status !== "error";
  const submitDisabled = isBusy || networkBlocked;
  const showingSuccess = banner?.type === "success";

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    dispatchBanner({ type: "submit-started" });
    reset();

    if (programState.status !== "ready" || !publicKey) {
      return;
    }
    if (networkBlocked) {
      dispatchBanner({
        type: "submit-result",
        result: { type: "error", message: "Switch to Solana Devnet to continue." },
      });
      return;
    }

    let mintA: PublicKey;
    let mintB: PublicKey;
    try {
      mintA = new PublicKey(fields.giveMint.trim());
      mintB = new PublicKey(fields.wantMint.trim());
    } catch {
      dispatchBanner({ type: "submit-result", result: { type: "error", message: "Enter valid token addresses." } });
      return;
    }

    try {
      assertDistinctMints(mintA, mintB);

      const [decimalsA, decimalsB] = await Promise.all([
        fetchMintDecimals(connection, mintA),
        fetchMintDecimals(connection, mintB),
      ]);

      const amountA = toBaseUnits(fields.giveAmount, decimalsA);
      const amountB = toBaseUnits(fields.wantAmount, decimalsB);

      const balance = await fetchTokenBalance(connection, publicKey, mintA);
      assertSufficientBalance(amountA, balance);

      const offerId = await pickOfferId(connection, programState.program.programId, publicKey);

      await send(programState.program, async () => {
        const result = await buildCreateOfferTransaction({
          program: programState.program,
          maker: publicKey,
          mintA,
          mintB,
          amountA,
          amountB,
          offerId,
        });
        pendingOfferAddressRef.current = result.offerAddress;
        return result.transaction;
      });
    } catch (error) {
      dispatchBanner({ type: "submit-result", result: { type: "error", message: toCreateOfferFormMessage(error) } });
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <NetworkWarning />

      {banner && (
        <div
          className={`flex items-start justify-between gap-3 rounded-control border px-4 py-3 text-sm ${
            banner.type === "success" ? "border-success/40 text-ink" : "border-error/40 text-error"
          }`}
        >
          <div className="flex flex-col gap-2">
            {banner.type === "success" ? (
              <>
                <p>Offer created.</p>
                <p>
                  Offer address:{" "}
                  <a
                    className="text-accent underline underline-offset-2"
                    href={explorerAddressUrl(banner.offerAddress.toBase58())}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortenAddress(banner.offerAddress.toBase58())}
                  </a>
                </p>
                <p>
                  <a
                    className="text-accent underline underline-offset-2"
                    href={explorerTransactionUrl(banner.signature)}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View transaction on Solana Explorer
                  </a>
                </p>
                <p>
                  <Link href="/my-offers" className="text-accent underline underline-offset-2">
                    View in My Offers
                  </Link>
                </p>
              </>
            ) : (
              <p role="alert">{banner.message}</p>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={() => dispatchBanner({ type: "dismissed" })}>
            Dismiss
          </Button>
        </div>
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Token you're giving"
              placeholder="Token address"
              value={fields.giveMint}
              onChange={(event) => setFields((f) => ({ ...f, giveMint: event.target.value }))}
              disabled={isBusy}
              required
            />
            <Input
              label="Amount you're giving"
              placeholder="0.00"
              inputMode="decimal"
              value={fields.giveAmount}
              onChange={(event) => setFields((f) => ({ ...f, giveAmount: event.target.value }))}
              disabled={isBusy}
              required
            />
            <Input
              label="Token you want"
              placeholder="Token address"
              value={fields.wantMint}
              onChange={(event) => setFields((f) => ({ ...f, wantMint: event.target.value }))}
              disabled={isBusy}
              required
            />
            <Input
              label="Amount you want"
              placeholder="0.00"
              inputMode="decimal"
              value={fields.wantAmount}
              onChange={(event) => setFields((f) => ({ ...f, wantAmount: event.target.value }))}
              disabled={isBusy}
              required
            />

            <Button type="submit" disabled={submitDisabled}>
              {isBusy ? "Creating offer…" : showingSuccess ? "Create another offer" : "Create offer"}
            </Button>
          </form>
        </Card>

        <Card className="flex flex-col gap-5">
          <div>
            <h2 className="text-sm font-medium text-ink">Summary</h2>
            <dl className="mt-3 flex flex-col gap-2 text-sm">
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">You give</dt>
                <dd className="text-right text-ink">
                  {fields.giveAmount || "—"} of {fields.giveMint ? shortenAddress(fields.giveMint) : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">You want</dt>
                <dd className="text-right text-ink">
                  {fields.wantAmount || "—"} of {fields.wantMint ? shortenAddress(fields.wantMint) : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {isBusy && (
            <div className="border-t border-border pt-4">
              <TransactionStatusSteps current={state.status as TransactionStatus} />
            </div>
          )}
        </Card>
      </div>
    </div>
  );
}
