"use client";

import { FormEvent, useMemo, useState } from "react";
import { useAdminStore } from "@/components/admin/admin-store";
import { Field, PageHeading, fieldClass, primaryButtonClass } from "@/components/admin/ui";
import { formatWhen, ticketLabel } from "@/lib/admin-mock";

export default function TicketsPage() {
  const { events, tickets, provisionTickets } = useAdminStore();
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [tab, setTab] = useState<"unused" | "used">("unused");
  const [tierId, setTierId] = useState("");
  const [extra, setExtra] = useState("10");
  const [notice, setNotice] = useState("");
  const event = events.find((item) => item.id === eventId);
  const rows = useMemo(
    () =>
      tickets
        .filter((ticket) => ticket.eventId === eventId)
        .sort((a, b) => a.number - b.number),
    [eventId, tickets],
  );

  const selectedTierId = event?.tiers.some((tier) => tier.id === tierId)
    ? tierId
    : (event?.tiers[0]?.id ?? "");
  const unused = rows.filter((ticket) => ticket.status !== "scanned");
  const used = rows.filter((ticket) => ticket.status === "scanned");
  const visible = tab === "unused" ? unused : used;
  const counts = (event?.tiers ?? []).map((tier) => {
    const owned = rows.filter((ticket) => ticket.tierId === tier.id);
    return {
      tier,
      provisioned: owned.length,
      unsold: owned.filter((ticket) => ticket.status === "unsold").length,
      sold: owned.filter((ticket) => ticket.status === "sold").length,
      scanned: owned.filter((ticket) => ticket.status === "scanned").length,
    };
  });

  function onProvision(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const message = provisionTickets(eventId, selectedTierId, Number(extra));
    setNotice(message ?? `Provisioned ${extra} more tickets.`);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Tickets" />
      <label className="flex max-w-md flex-col gap-1.5 text-sm font-bold text-ink">
        Event
        <select
          value={eventId}
          onChange={(event) => setEventId(event.target.value)}
          className={fieldClass}
        >
          {events.map((event) => (
            <option key={event.id} value={event.id}>
              {event.title}
            </option>
          ))}
        </select>
      </label>
      <section className="grid gap-3 md:grid-cols-2">
        {counts.map(({ tier, provisioned, unsold, sold, scanned }) => (
          <article key={tier.id} className="rounded-2xl border border-line bg-white p-4">
            <h2 className="font-black text-ink">{tier.name}</h2>
            <dl className="mt-3 grid grid-cols-4 gap-2 text-center">
              {(
                [
                  ["Provisioned", provisioned],
                  ["Unsold", unsold],
                  ["Sold", sold],
                  ["Scanned", scanned],
                ] as const
              ).map(([label, value]) => (
                <div key={label}>
                  <dt className="text-xs text-muted">{label}</dt>
                  <dd className="text-xl font-black text-ink">{value}</dd>
                </div>
              ))}
            </dl>
          </article>
        ))}
      </section>
      <form
        onSubmit={onProvision}
        className="grid items-end gap-3 rounded-2xl border border-line bg-white p-4 md:grid-cols-[1fr_8rem_auto]"
      >
        <Field label="Provision more">
          <select
            value={selectedTierId}
            onChange={(change) => setTierId(change.target.value)}
            className={fieldClass}
          >
            {(event?.tiers ?? []).map((tier) => (
              <option key={tier.id} value={tier.id}>
                {tier.name}
              </option>
            ))}
          </select>
        </Field>
        <Field label="How many">
          <input
            inputMode="numeric"
            value={extra}
            onChange={(change) => setExtra(change.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        <button type="submit" className={primaryButtonClass}>
          Add tickets
        </button>
        {notice ? (
          <p role="status" className="text-sm font-bold text-ink md:col-span-3">
            {notice}
          </p>
        ) : null}
      </form>
      <div className="flex gap-2" role="tablist" aria-label="Ticket status">
        {(
          [
            ["unused", `Unused (${unused.length})`],
            ["used", `Used (${used.length})`],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === value ? "bg-ink text-white" : "bg-white text-ink border border-line"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      <ul className="flex flex-col gap-2">
        {visible.length === 0 ? (
          <li className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">
            No {tab} tickets for this event.
          </li>
        ) : (
          visible.map((ticket) => {
            const usedTicket = ticket.status === "scanned";
            return (
              <li
                key={ticket.code}
                className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3"
              >
                <div>
                  <p className="text-xs font-bold text-muted">{ticketLabel(ticket.number)}</p>
                  <p
                    className={`font-black tracking-wide text-ink ${
                      usedTicket ? "select-none blur-[3px]" : ""
                    }`}
                  >
                    {ticket.code}
                  </p>
                  <p className="text-sm text-muted">{ticket.tierName}</p>
                </div>
                <div className="text-right text-sm">
                  {usedTicket ? (
                    <>
                      <p className="font-bold text-ink">Used</p>
                      <p className="text-muted">
                        {ticket.buyerName}
                        {ticket.scannedAt ? ` · ${formatWhen(ticket.scannedAt)}` : ""}
                      </p>
                    </>
                  ) : ticket.status === "unsold" ? (
                    <p className="font-bold text-muted">Unsold</p>
                  ) : (
                    <>
                      <p className="font-bold text-ink">{ticket.buyerName}</p>
                      <p className="text-muted">Not scanned</p>
                    </>
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>
    </div>
  );
}
