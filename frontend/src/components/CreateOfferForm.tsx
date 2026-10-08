"use client";

import { useState, type FormEvent } from "react";
import { useConnection, useWallet } from "@solana/wallet-adapter-react";
import { PublicKey } from "@solana/web3.js";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { NetworkWarning } from "@/components/NetworkWarning";
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
import { type TransactionStatus } from "@/lib/tx/sendTransaction";
import { useSendTransaction } from "@/lib/tx/useSendTransaction";

const ALERT_CLASS = "rounded-control border px-4 py-3 text-sm";

const STEP_ORDER: TransactionStatus[] = ["awaiting-approval", "sending", "confirming"];
const STEP_LABELS: Record<TransactionStatus, string> = {
  "awaiting-approval": "Waiting for your approval",
  sending: "Sending",
  confirming: "Confirming",
};

function StatusSteps({ current }: { current: TransactionStatus }) {
  const currentIndex = STEP_ORDER.indexOf(current);

  return (
    <ol className="flex flex-col gap-3">
      {STEP_ORDER.map((key, index) => {
        const done = index < currentIndex;
        const active = index === currentIndex;
        return (
          <li key={key} className="flex items-center gap-2 text-sm">
            <span
              aria-hidden="true"
              className={`size-2 flex-none rounded-full ${done || active ? "bg-success" : "bg-border"}`}
            />
            <span className={active ? "font-medium text-ink" : done ? "text-ink" : "text-muted"}>
              {STEP_LABELS[key]}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

export function CreateOfferForm() {
  const { connection } = useConnection();
  const { publicKey } = useWallet();
  const programState = useEscrowProgram();
  const networkStatus = useNetworkStatus();
  const { state, send, reset } = useSendTransaction();

  const [giveMint, setGiveMint] = useState("");
  const [giveAmount, setGiveAmount] = useState("");
  const [wantMint, setWantMint] = useState("");
  const [wantAmount, setWantAmount] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [offerAddr, setOfferAddr] = useState<PublicKey | null>(null);

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

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFormError(null);
    setOfferAddr(null);
    reset();

    if (programState.status !== "ready" || !publicKey) {
      return;
    }
    if (networkBlocked) {
      setFormError("Switch to Solana Devnet to continue.");
      return;
    }

    let mintA: PublicKey;
    let mintB: PublicKey;
    try {
      mintA = new PublicKey(giveMint.trim());
      mintB = new PublicKey(wantMint.trim());
    } catch {
      setFormError("Enter valid token addresses.");
      return;
    }

    try {
      assertDistinctMints(mintA, mintB);

      const [decimalsA, decimalsB] = await Promise.all([
        fetchMintDecimals(connection, mintA),
        fetchMintDecimals(connection, mintB),
      ]);

      const amountA = toBaseUnits(giveAmount, decimalsA);
      const amountB = toBaseUnits(wantAmount, decimalsB);

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
        setOfferAddr(result.offerAddress);
        return result.transaction;
      });
    } catch (error) {
      setFormError(toCreateOfferFormMessage(error));
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <NetworkWarning />
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <form onSubmit={handleSubmit} className="flex flex-col gap-5">
            <Input
              label="Token you're giving"
              placeholder="Token address"
              value={giveMint}
              onChange={(event) => setGiveMint(event.target.value)}
              disabled={isBusy}
              required
            />
            <Input
              label="Amount you're giving"
              placeholder="0.00"
              inputMode="decimal"
              value={giveAmount}
              onChange={(event) => setGiveAmount(event.target.value)}
              disabled={isBusy}
              required
            />
            <Input
              label="Token you want"
              placeholder="Token address"
              value={wantMint}
              onChange={(event) => setWantMint(event.target.value)}
              disabled={isBusy}
              required
            />
            <Input
              label="Amount you want"
              placeholder="0.00"
              inputMode="decimal"
              value={wantAmount}
              onChange={(event) => setWantAmount(event.target.value)}
              disabled={isBusy}
              required
            />

            {formError && (
              <p role="alert" className={`${ALERT_CLASS} border-error/40 text-error`}>
                {formError}
              </p>
            )}

            <Button type="submit" disabled={submitDisabled}>
              {isBusy ? "Creating offer…" : "Create offer"}
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
                  {giveAmount || "—"} of {giveMint ? shortenAddress(giveMint) : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between gap-4">
                <dt className="text-muted">You want</dt>
                <dd className="text-right text-ink">
                  {wantAmount || "—"} of {wantMint ? shortenAddress(wantMint) : "—"}
                </dd>
              </div>
            </dl>
          </div>

          {isBusy && (
            <div className="border-t border-border pt-4">
              <StatusSteps current={state.status as TransactionStatus} />
            </div>
          )}

          {state.status === "success" && (
            <div className={`${ALERT_CLASS} flex flex-col gap-2 border-success/40 text-ink`}>
              <p>Your offer is live.</p>
              {offerAddr && (
                <p>
                  Offer address:{" "}
                  <a
                    className="text-accent underline underline-offset-2"
                    href={explorerAddressUrl(offerAddr.toBase58())}
                    target="_blank"
                    rel="noreferrer"
                  >
                    {shortenAddress(offerAddr.toBase58())}
                  </a>
                </p>
              )}
              <p>
                <a
                  className="text-accent underline underline-offset-2"
                  href={explorerTransactionUrl(state.signature)}
                  target="_blank"
                  rel="noreferrer"
                >
                  View transaction on Solana Explorer
                </a>
              </p>
            </div>
          )}

          {state.status === "error" && (
            <p role="alert" className={`${ALERT_CLASS} border-error/40 text-error`}>
              {state.message}
            </p>
          )}
        </Card>
      </div>
    </div>
  );
}
