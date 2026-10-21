"use client";

import Link from "next/link";
import { useAdminStore } from "@/components/admin/admin-store";
import { PageHeading, primaryButtonClass } from "@/components/admin/ui";
import { eventCapacity, eventSold, formatDay } from "@/lib/admin-mock";

export default function EventsPage() {
  const { events } = useAdminStore();

  return (
    <div className="flex flex-col gap-6">
      <PageHeading
        title="Events"
        action={
          <Link href="/admin/events/new" className={primaryButtonClass}>
            Create New Event
          </Link>
        }
      />
      <ul className="flex flex-col gap-3">
        {events.map((event) => (
          <li key={event.id}>
            <Link
              href={`/admin/events/${event.id}`}
              className="block rounded-2xl border border-line bg-white p-5 hover:border-brand"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="text-lg font-black text-ink">{event.title}</h2>
                  <p className="mt-1 text-sm text-muted">
                    {formatDay(event.startsAt)} · {event.venue}
                  </p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-bold ${
                    event.status === "published"
                      ? "bg-[rgba(252,100,53,0.12)] text-brand"
                      : "bg-line text-muted"
                  }`}
                >
                  {event.status === "published" ? "Published" : "Draft"}
                </span>
              </div>
              <p className="mt-3 text-sm font-bold text-ink">
                {eventSold(event)} / {eventCapacity(event)} sold
              </p>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
