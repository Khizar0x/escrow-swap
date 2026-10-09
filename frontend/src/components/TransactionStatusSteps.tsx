import { type TransactionStatus } from "@/lib/tx/sendTransaction";

const STEP_ORDER: TransactionStatus[] = ["awaiting-approval", "sending", "confirming"];
const STEP_LABELS: Record<TransactionStatus, string> = {
  "awaiting-approval": "Waiting for your approval",
  sending: "Sending",
  confirming: "Confirming",
};

// The three steps any sent transaction passes through, shared by every flow
// that uses useSendTransaction (Create Offer, Take Offer, ...).
export function TransactionStatusSteps({ current }: { current: TransactionStatus }) {
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
