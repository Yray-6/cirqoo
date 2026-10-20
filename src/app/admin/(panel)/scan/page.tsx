"use client";

import { FormEvent, useState } from "react";
import { useAdminStore, type ScanResult } from "@/components/admin/admin-store";
import { PageHeading, fieldClass, primaryButtonClass } from "@/components/admin/ui";
import { formatWhen, ticketLabel } from "@/lib/admin-mock";

export default function ScanPage() {
  const store = useAdminStore();
  const [code, setCode] = useState("");
  const [result, setResult] = useState<ScanResult | null>(null);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setResult(store.scan(code));
    setCode("");
  }

  const ticket = result && result.type !== "unknown" ? result.ticket : null;
  const event = ticket ? store.events.find((item) => item.id === ticket.eventId) : null;

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-6">
      <PageHeading title="Scan Tickets" />
      <div className="relative mx-auto aspect-square w-full max-w-[280px] overflow-hidden rounded-3xl bg-ink">
        <div className="absolute inset-8 rounded-2xl border-2 border-white/80" />
        <p className="absolute inset-x-0 bottom-5 text-center text-xs text-white/80">
          Camera preview
        </p>
      </div>
      <form onSubmit={onSubmit} className="flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 text-sm font-bold text-ink">
          Ticket code
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="CRQ-OPEN02"
            autoCapitalize="characters"
            className={fieldClass}
            required
          />
        </label>
        <button type="submit" className={primaryButtonClass}>
          Check ticket
        </button>
        <p className="text-sm text-muted">
          Try CRQ-OPEN02 for a sold ticket, or CRQ-USED01 for one that is already used.
        </p>
      </form>
      {result ? (
        <section
          role="status"
          className={`rounded-2xl border p-5 ${
            result.type === "used"
              ? "border-brand bg-[rgba(252,100,53,0.08)]"
              : result.type === "already"
                ? "border-black/15 bg-white"
                : "border-brand bg-white"
          }`}
        >
          {result.type === "unknown" ? (
            <p className="font-bold text-ink">No ticket with that code.</p>
          ) : null}
          {result.type === "unsold" ? (
            <p className="font-bold text-ink">This ticket has not been sold.</p>
          ) : null}
          {result.type === "used" && ticket ? (
            <>
              <p className="text-sm font-bold text-brand">Ticket used</p>
              <p className="mt-2 text-lg font-black text-ink">{ticket.buyerName}</p>
              <p className="text-sm text-ink">
                {ticketLabel(ticket.number)} · {ticket.tierName}
                {event ? ` · ${event.title}` : ""}
              </p>
            </>
          ) : null}
          {result.type === "already" && ticket ? (
            <>
              <p className="text-sm font-bold text-ink">Already used</p>
              <p className="mt-2 text-lg font-black text-ink">{ticket.buyerName}</p>
              <p className="text-sm text-muted">
                {ticketLabel(ticket.number)} · scanned{" "}
                {ticket.scannedAt ? formatWhen(ticket.scannedAt) : "earlier"} UTC
              </p>
            </>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
