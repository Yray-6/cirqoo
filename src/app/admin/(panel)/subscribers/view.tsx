"use client";

import { useState } from "react";
import { useAdminStore } from "@/components/admin/admin-store";
import { PageHeading } from "@/components/admin/ui";
import { formatDay } from "@/lib/admin-mock";

export default function SubscribersPage() {
  const { buyers, leads, events } = useAdminStore();
  const [tab, setTab] = useState<"users" | "leads">("users");

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Subscribers" />
      <div className="flex gap-2" role="tablist" aria-label="Subscriber lists">
        {(
          [
            ["users", "User list"],
            ["leads", "Leads"],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`rounded-full px-4 py-2 text-sm font-bold ${
              tab === value ? "bg-ink text-white" : "border border-line bg-white text-ink"
            }`}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "users" ? (
        <ul className="flex flex-col gap-2">
          {buyers.length === 0 ? (
            <li className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">No buyers yet.</li>
          ) : null}
          {buyers.map((buyer) => {
            const event = events.find((item) => item.id === buyer.eventId);
            return (
              <li
                key={buyer.id}
                className="rounded-2xl border border-line bg-white p-4"
              >
                <p className="font-black text-ink">{buyer.name}</p>
                <p className="text-sm text-muted">{buyer.email}</p>
                <p className="text-sm text-muted">{buyer.phone}</p>
                <p className="mt-2 text-sm text-ink">
                  {event?.title ?? "Event"} · {buyer.ticketCount}{" "}
                  {buyer.ticketCount === 1 ? "ticket" : "tickets"}
                </p>
              </li>
            );
          })}
        </ul>
      ) : (
        <ul className="flex flex-col gap-2">
          {leads.length === 0 ? (
            <li className="rounded-2xl border border-line bg-white p-5 text-sm text-muted">No leads yet.</li>
          ) : null}
          {leads.map((lead) => (
            <li key={lead.id} className="rounded-2xl border border-line bg-white p-4">
              <p className="font-black text-ink">{lead.email}</p>
              <p className="mt-1 text-sm text-muted">
                {lead.source === "newsletter" ? "Newsletter" : "Checkout"} ·{" "}
                {formatDay(lead.createdAt)}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
