"use client";

import { FormEvent, useEffect, useState } from "react";
import { useAdminStore } from "@/components/admin/admin-store";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { SkeletonBlock } from "@/components/admin/page-skeleton";
import { useSuccess } from "@/components/admin/success-modal";
import { Field, PageHeading, fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui";
import { api } from "@/lib/api";
import { formatWhen, naira, ticketLabel, type AdminTicket } from "@/lib/admin-mock";

type TicketFilter = "sold" | "unsold" | "scanned" | "redeemed" | "provisioned";

type TicketPage = {
  eventId: string;
  status: TicketFilter;
  page: number;
  pageSize: number;
  total: number;
  tickets: AdminTicket[];
  counts: Array<{
    tierId: string;
    name: string;
    provisioned: number;
    unsold: number;
    held: number;
    sold: number;
    scanned: number;
  }>;
};

const ticketFilters: Array<{ value: TicketFilter; label: string }> = [
  { value: "sold", label: "Sold" },
  { value: "redeemed", label: "Redeemed" },
  { value: "unsold", label: "Unsold" },
  { value: "scanned", label: "Scanned" },
  { value: "provisioned", label: "Provisioned" },
];

type PendingAction =
  | { kind: "add"; count: number; tierName: string }
  | { kind: "one"; code: string; number: number }
  | { kind: "all"; count: number };

export default function TicketsPage() {
  const store = useAdminStore();
  const showSuccess = useSuccess();
  const [eventId, setEventId] = useState(store.events[0]?.id ?? "");
  const [status, setStatus] = useState<TicketFilter>("unsold");
  const [tierId, setTierId] = useState("");
  const [extra, setExtra] = useState("10");
  const [notice, setNotice] = useState("");
  const [page, setPage] = useState(1);
  const [data, setData] = useState<TicketPage | null>(null);
  const [pending, setPending] = useState<PendingAction | null>(null);
  const [pendingBusy, setPendingBusy] = useState(false);
  const [modalError, setModalError] = useState("");
  const event = store.events.find((item) => item.id === eventId);
  const selectedTierId = event?.tiers.some((tier) => tier.id === tierId)
    ? tierId
    : (event?.tiers[0]?.id ?? "");

  useEffect(() => {
    if (!eventId) return;
    let cancel = false;
    api<TicketPage>(
      `/api/admin/tickets?eventId=${encodeURIComponent(eventId)}&page=${page}&status=${status}`,
    )
      .then((next) => {
        if (!cancel) setData(next);
      })
      .catch((error: unknown) => {
        if (!cancel) setNotice(error instanceof Error ? error.message : "Tickets did not load.");
      });
    return () => {
      cancel = true;
    };
  }, [eventId, page, status, store.revision]);

  const listReady = data?.eventId === eventId && data.status === status && data.page === page;
  const rows = listReady && data ? data.tickets : [];
  const orders = store.orders.filter((order) => order.eventId === eventId);
  const pageCount = listReady && data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const unsoldTotal =
    data?.eventId === eventId ? data.counts.reduce((sum, count) => sum + count.unsold, 0) : 0;
  const selectedTier = event?.tiers.find((tier) => tier.id === selectedTierId);

  function ask(next: PendingAction) {
    setModalError("");
    setPending(next);
  }

  function closePending() {
    if (pendingBusy) return;
    setPending(null);
    setModalError("");
  }

  function onProvision(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const count = Number(extra);
    if (!selectedTier) {
      setNotice("Pick a ticket tier.");
      return;
    }
    if (!Number.isInteger(count) || count < 1 || count > 500) {
      setNotice("Add between 1 and 500 tickets.");
      return;
    }
    ask({ kind: "add", count, tierName: selectedTier.name });
  }

  async function confirmPending() {
    if (!pending || pendingBusy) return;
    setPendingBusy(true);
    setModalError("");
    try {
      if (pending.kind === "add") {
        const message = await store.provisionTickets(eventId, selectedTierId, pending.count);
        if (message) {
          setModalError(message);
          return;
        }
        setNotice("");
        setPending(null);
        void showSuccess(
          "Tickets added",
          `Added ${pending.count} ${pending.count === 1 ? "ticket" : "tickets"}.`,
        );
      } else {
        const result = await store.deleteTickets(
          eventId,
          pending.kind === "one" ? { code: pending.code } : { allUnsold: true },
        );
        if (result.error) {
          setModalError(result.error);
          return;
        }
        setPending(null);
        if (result.deleted === 0) {
          setNotice("There are no unsold tickets to delete.");
        } else {
          setNotice("");
          void showSuccess(
            result.deleted === 1 ? "Ticket deleted" : "Tickets deleted",
            `Deleted ${result.deleted} ${result.deleted === 1 ? "ticket" : "tickets"}.`,
          );
        }
      }
    } finally {
      setPendingBusy(false);
    }
  }

  const confirmCopy = pending
    ? pending.kind === "add"
      ? {
          title: "Add tickets?",
          body: `Add ${pending.count} ${pending.tierName} ${pending.count === 1 ? "ticket" : "tickets"} to ${event?.title ?? "this event"}?`,
          confirmLabel: "Add tickets",
        }
      : pending.kind === "one"
        ? {
            title: "Delete this ticket?",
            body: `Delete ${ticketLabel(pending.number)} (${pending.code})? This unsold ticket will be removed.`,
            confirmLabel: "Delete ticket",
          }
        : {
            title: "Delete all unsold tickets?",
            body: `Delete all ${pending.count} unsold ${pending.count === 1 ? "ticket" : "tickets"} for ${event?.title ?? "this event"}? Sold, held, and scanned tickets stay.`,
            confirmLabel: "Delete all",
          }
    : null;

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Tickets"
        action={
          <button
            type="button"
            className={secondaryButtonClass}
            disabled={unsoldTotal === 0}
            onClick={() => ask({ kind: "all", count: unsoldTotal })}
          >
            Delete all unsold
          </button>
        }
      />
      <label className="flex max-w-md flex-col gap-1.5 text-sm font-bold text-ink">
        Event
        <select
          value={eventId}
          onChange={(change) => {
            setEventId(change.target.value);
            setPage(1);
          }}
          className={fieldClass}
        >
          {store.events.map((item) => (
            <option key={item.id} value={item.id}>
              {item.title}
            </option>
          ))}
        </select>
      </label>
      {eventId && !data && !notice ? (
        <div className="flex flex-col gap-4" aria-busy="true">
          <span className="sr-only">Loading tickets</span>
          <SkeletonBlock className="h-24 rounded-2xl" />
          <SkeletonBlock className="h-10 w-80 rounded-full" />
          <SkeletonBlock className="h-16 rounded-2xl" />
          <SkeletonBlock className="h-16 rounded-2xl" />
          <SkeletonBlock className="h-16 rounded-2xl" />
        </div>
      ) : (
        <>
      <form
        onSubmit={(formEvent) => void onProvision(formEvent)}
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
          <p role="alert" className="text-sm font-bold text-brand md:col-span-3">
            {notice}
          </p>
        ) : null}
      </form>
      <section className="flex flex-col gap-2">
        <h2 className="text-lg font-black text-ink">Orders</h2>
        {orders.length === 0 ? (
          <p className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">No orders yet.</p>
        ) : (
          orders.map((order) => (
            <article
              key={order.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3"
            >
              <div>
                <p className="font-black text-ink">{order.buyerName}</p>
                <p className="text-sm text-muted">
                  {order.email} · {order.ticketCount} tickets · {naira(order.total)}
                </p>
                {order.paymentReference ? (
                  <p className="text-xs text-muted">Ref {order.paymentReference}</p>
                ) : null}
                {order.emailError ? <p className="text-sm font-bold text-brand">{order.emailError}</p> : null}
                {order.paymentError ? <p className="text-sm font-bold text-brand">{order.paymentError}</p> : null}
              </div>
              <div className="flex items-center gap-3 text-sm">
                <p className="font-bold text-ink">
                  {order.status === "held"
                    ? "Held"
                    : order.status === "confirmed"
                      ? order.paid
                        ? "Paid"
                        : "Confirmed"
                      : order.paid
                        ? "Paid · needs attention"
                        : "Expired"}
                </p>
                {order.status === "held" ? (
                  <button
                    type="button"
                    className="font-bold text-brand"
                    onClick={() =>
                      void store.confirmOrder(order.id).then((message) => {
                        if (message) {
                          setNotice(message);
                          return;
                        }
                        setNotice("");
                        void showSuccess("Order confirmed", "The ticket email is on its way.");
                      })
                    }
                  >
                    Confirm
                  </button>
                ) : null}
                {order.status === "confirmed" ? (
                  <button
                    type="button"
                    className="font-bold text-brand"
                    onClick={() =>
                      void store.resendOrder(order.id).then((message) => {
                        if (message) {
                          setNotice(message);
                          return;
                        }
                        setNotice("");
                        void showSuccess("Email sent", "The ticket email was sent again.");
                      })
                    }
                  >
                    Resend email
                  </button>
                ) : null}
              </div>
            </article>
          ))
        )}
      </section>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Ticket status">
        {ticketFilters.map((filter) => {
          const selected = status === filter.value;
          const count = selected && listReady && data ? data.total : null;
          return (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={selected}
              onClick={() => {
                setStatus(filter.value);
                setPage(1);
              }}
              className={`rounded-full px-4 py-2 text-sm font-bold ${
                selected ? "bg-ink text-white" : "border border-line bg-white text-ink"
              }`}
            >
              {filter.label}
              {count !== null ? ` (${count})` : ""}
            </button>
          );
        })}
      </div>
      {!listReady ? (
        <div className="flex flex-col gap-2" aria-busy="true">
          <span className="sr-only">Loading tickets</span>
          <SkeletonBlock className="h-16 rounded-2xl" />
          <SkeletonBlock className="h-16 rounded-2xl" />
          <SkeletonBlock className="h-16 rounded-2xl" />
        </div>
      ) : (
      <>
      <ul className="flex flex-col gap-2">
        {rows.length === 0 ? (
          <li className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">
            No {status} tickets.
          </li>
        ) : (
          rows.map((ticket) => {
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
                <div className="flex items-center gap-4">
                  <div className="text-right text-sm">
                    {usedTicket ? (
                      <>
                        <p className="font-bold text-ink">Scanned</p>
                        <p className="text-muted">
                          {ticket.buyerName}
                          {ticket.discountCode ? ` · ${ticket.discountCode}` : ""}
                          {ticket.scannedAt ? ` · ${formatWhen(ticket.scannedAt)}` : ""}
                        </p>
                      </>
                    ) : ticket.discountCode ? (
                      <>
                        <p className="font-bold text-ink">Redeemed</p>
                        <p className="text-muted">
                          {ticket.buyerName} · {ticket.discountCode}
                        </p>
                      </>
                    ) : ticket.status === "unsold" ? (
                      <p className="font-bold text-muted">Unsold</p>
                    ) : ticket.status === "held" ? (
                      <>
                        <p className="font-bold text-ink">{ticket.buyerName ?? "Reserved"}</p>
                        <p className="text-muted">Held</p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-ink">{ticket.buyerName}</p>
                        <p className="text-muted">Sold</p>
                      </>
                    )}
                  </div>
                  {ticket.status === "unsold" ? (
                    <button
                      type="button"
                      className="text-sm font-bold text-brand"
                      aria-label={`Delete ticket ${ticketLabel(ticket.number)}`}
                      onClick={() => ask({ kind: "one", code: ticket.code, number: ticket.number })}
                    >
                      Delete
                    </button>
                  ) : null}
                </div>
              </li>
            );
          })
        )}
      </ul>
      {pageCount > 1 ? (
        <div className="flex items-center gap-3">
          <button
            type="button"
            className={primaryButtonClass}
            disabled={page <= 1}
            onClick={() => setPage((current) => current - 1)}
          >
            Previous
          </button>
          <p className="text-sm text-muted">
            Page {page} of {pageCount}
          </p>
          <button
            type="button"
            className={primaryButtonClass}
            disabled={page >= pageCount}
            onClick={() => setPage((current) => current + 1)}
          >
            Next
          </button>
        </div>
      ) : null}
      </>
      )}
        </>
      )}
      <ConfirmModal
        open={pending !== null}
        title={confirmCopy?.title ?? "Confirm"}
        confirmLabel={confirmCopy?.confirmLabel ?? "Confirm"}
        pending={pendingBusy}
        onConfirm={() => void confirmPending()}
        onClose={closePending}
      >
        <p>{confirmCopy?.body}</p>
        {modalError ? (
          <p role="alert" className="mt-2 font-bold text-brand">
            {modalError}
          </p>
        ) : null}
      </ConfirmModal>
    </div>
  );
}
