"use client";

import { FormEvent, useEffect, useId, useRef, useState } from "react";
import { TicketCamera } from "@/components/admin/ticket-camera";
import { PageHeading, fieldClass, primaryButtonClass } from "@/components/admin/ui";
import { api } from "@/lib/api";
import { formatWhen, ticketLabel } from "@/lib/admin-mock";

type ScanResult =
  | { type: "unknown" }
  | { type: "unsold" }
  | { type: "held" }
  | {
      type: "used" | "already";
      buyerName: string;
      number: number;
      tierName: string;
      eventTitle: string;
      scannedAt: string;
    };

type Notice = {
  tone: "success" | "used";
  title: string;
  message: string;
};

export default function ScanPage() {
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const [notice, setNotice] = useState<Notice | null>(null);
  const checkingRef = useRef(false);
  const noticeClose = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      noticeClose.current?.();
      noticeClose.current = null;
    };
  }, []);

  function closeNotice() {
    noticeClose.current?.();
    noticeClose.current = null;
    setNotice(null);
  }

  async function lookup(value: string) {
    const trimmed = value.trim();
    if (!trimmed || checkingRef.current) return;
    checkingRef.current = true;
    setChecking(true);
    setError("");
    setResult(null);
    try {
      const next = await api<ScanResult>("/api/admin/scan", {
        method: "POST",
        body: JSON.stringify({ code: trimmed }),
      });
      if (next.type === "used" || next.type === "already") {
        setChecking(false);
        const detail = `${next.buyerName} · ${ticketLabel(next.number)} · ${next.tierName} · ${next.eventTitle}`;
        await new Promise<void>((resolve) => {
          noticeClose.current = resolve;
          setNotice(
            next.type === "used"
              ? { tone: "success", title: "Ticket scan successful", message: detail }
              : {
                  tone: "used",
                  title: "Ticket already used",
                  message: `${detail} · scanned ${formatWhen(next.scannedAt)} UTC`,
                },
          );
        });
        noticeClose.current = null;
        return;
      }
      setResult(next);
    } catch (scanError) {
      setResult(null);
      setError(scanError instanceof Error ? scanError.message : "The scan did not go through.");
    } finally {
      checkingRef.current = false;
      setChecking(false);
    }
  }

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = code;
    if (!value.trim() || checkingRef.current) return;
    setCode("");
    void lookup(value);
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeading title="Scan Tickets" />
      <TicketCamera
        onCode={(value) => {
          setCode("");
          return lookup(value);
        }}
      />
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
          Ticket code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="CRQ-OPEN02"
            autoCapitalize="characters"
            className={fieldClass}
            disabled={checking}
            required
          />
        </label>
        <button type="submit" className={`${primaryButtonClass} disabled:opacity-70`} disabled={checking} aria-busy={checking}>
          {checking ? (
            <span className="inline-flex items-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/40 border-t-white" aria-hidden="true" />
              Checking…
            </span>
          ) : (
            "Check ticket"
          )}
        </button>
        <p className="text-sm text-muted" role="status">
          {checking ? "Checking ticket…" : "Point the camera at the ticket QR, or type the code."}
        </p>
      </form>
      {error ? (
        <p role="alert" className="text-sm font-bold text-brand">
          {error}
        </p>
      ) : null}
      {result?.type === "unknown" || result?.type === "unsold" || result?.type === "held" ? (
        <section role="status" className="rounded-2xl border border-brand bg-white p-5">
          {result.type === "unknown" ? <p className="font-bold text-ink">No ticket with that code.</p> : null}
          {result.type === "unsold" ? <p className="font-bold text-ink">This ticket has not been sold.</p> : null}
          {result.type === "held" ? (
            <p className="font-bold text-ink">This ticket is reserved and has not been paid.</p>
          ) : null}
        </section>
      ) : null}
      <ScanNotice open={notice !== null} notice={notice} onClose={closeNotice} />
    </div>
  );
}

function ScanNotice({
  open,
  notice,
  onClose,
}: {
  open: boolean;
  notice: Notice | null;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const messageId = useId();
  const shown = useRef<Notice | null>(notice);
  if (notice) shown.current = notice;
  const copy = notice ?? shown.current;
  const success = copy?.tone !== "used";

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      aria-describedby={messageId}
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      onClick={(event) => {
        const bounds = ref.current?.getBoundingClientRect();
        if (!bounds) return;
        const inside =
          event.clientX >= bounds.left &&
          event.clientX <= bounds.right &&
          event.clientY >= bounds.top &&
          event.clientY <= bounds.bottom;
        if (!inside) onClose();
      }}
      className="m-auto w-[min(100%-2rem,24rem)] rounded-2xl border border-line bg-white p-6 text-ink shadow-xl backdrop:bg-black/45"
    >
      <div className="flex flex-col items-center text-center">
        <div
          className={`flex h-12 w-12 items-center justify-center rounded-full ${
            success ? "bg-[rgba(252,100,53,0.12)] text-brand" : "bg-[rgba(180,35,24,0.1)] text-[#b42318]"
          }`}
        >
          {success ? (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M5 12.5 9.2 17 19 7" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
              <path d="M7 7l10 10M17 7 7 17" strokeLinecap="round" />
            </svg>
          )}
        </div>
        <h2 id={titleId} className="mt-4 text-lg font-black">
          {copy?.title ?? ""}
        </h2>
        <p id={messageId} className="mt-2 text-sm leading-6 text-muted">
          {copy?.message ?? ""}
        </p>
        <button type="button" className={`${primaryButtonClass} mt-5 min-w-28`} onClick={onClose}>
          Done
        </button>
      </div>
    </dialog>
  );
}
