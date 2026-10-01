"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { ESCROW_PROGRAM_ID } from "@/lib/anchor/constants";

interface ToastItem {
  id: number;
  kind: "success" | "error";
  title: string;
  message: string;
  signature?: string;
}

const ToastContext = createContext<{
  pushToast: (toast: Omit<ToastItem, "id">) => void;
} | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const pushToast = useCallback((toast: Omit<ToastItem, "id">) => {
    const id = Date.now() + Math.random();
    setToasts((current) => [...current, { ...toast, id }]);
    setTimeout(() => {
      setToasts((current) => current.filter((t) => t.id !== id));
    }, 8000);
  }, []);

  const dismiss = (id: number) =>
    setToasts((current) => current.filter((t) => t.id !== id));

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div className="fixed bottom-[24px] right-[24px] flex flex-col gap-[12px] z-50 w-[384px] max-w-[calc(100vw-32px)]">
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className="backdrop-blur-[12px] bg-[rgba(39,42,49,0.95)] flex gap-[14px] items-start px-[16px] py-[14px] rounded-[16px] shadow-[0px_25px_50px_-12px_rgba(0,0,0,0.25)]"
          >
            <div
              className={`flex items-center justify-center rounded-full shrink-0 size-[32px] ${
                toast.kind === "success"
                  ? "bg-[rgba(0,236,145,0.2)]"
                  : "bg-[rgba(255,107,107,0.2)]"
              }`}
            >
              {toast.kind === "success" ? (
                <CheckCircle2 size={15} className="text-[#00ec91]" />
              ) : (
                <XCircle size={15} className="text-[#ff6b6b]" />
              )}
            </div>
            <div className="flex-1">
              <p className="font-semibold text-[#e1e2eb] text-[14px]">
                {toast.title}
              </p>
              <p className="text-[#cec2d8] text-[12px] mt-[2px]">
                {toast.message}{" "}
                {toast.signature && (
                  <a
                    href={`https://explorer.solana.com/tx/${toast.signature}?cluster=devnet`}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[#75d1ff] font-mono text-[11px]"
                  >
                    Solana Explorer ↗
                  </a>
                )}
              </p>
            </div>
            <button
              onClick={() => dismiss(toast.id)}
              className="text-[#978da1] shrink-0"
            >
              <X size={14} />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}

export function explorerProgramLink() {
  return `https://explorer.solana.com/address/${ESCROW_PROGRAM_ID}?cluster=devnet`;
}
