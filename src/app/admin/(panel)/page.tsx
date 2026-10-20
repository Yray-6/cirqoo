"use client";

import Link from "next/link";
import { MonthCalendar } from "@/components/admin/month-calendar";
import { primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui";
import { useAdminStore } from "@/components/admin/admin-store";
import {
  eventCapacity,
  eventSold,
  formatWhen,
  naira,
  sampleToday,
} from "@/lib/admin-mock";

export default function DashboardPage() {
  const { events, tickets, inflowDays } = useAdminStore();
  const upcoming = events
    .filter((event) => event.status === "published" && event.startsAt >= sampleToday)
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt))[0];
  const inflow = inflowDays.reduce((sum, day) => sum + day.amount, 0);
  const peak = Math.max(...inflowDays.map((day) => day.amount), 1);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-black text-ink">Dashboard</h1>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/scan" className={primaryButtonClass}>
            Scan Ticket
          </Link>
          <Link href="/admin/events/new" className={secondaryButtonClass}>
            Create New Event
          </Link>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-muted">Total events</p>
          <p className="mt-2 text-4xl font-black text-ink">{events.length}</p>
        </section>
        <section className="rounded-2xl border border-line bg-white p-5 lg:col-span-2">
          <p className="text-sm text-muted">Upcoming program</p>
          {upcoming ? (
            <>
              <h2 className="mt-2 text-xl font-black text-ink">{upcoming.title}</h2>
              <p className="mt-2 text-sm text-ink">{formatWhen(upcoming.startsAt)} UTC</p>
              <p className="text-sm text-muted">{upcoming.venue}</p>
              <p className="mt-3 text-sm font-bold text-ink">
                {eventSold(upcoming.id, tickets)} / {eventCapacity(upcoming)} tickets sold
              </p>
            </>
          ) : (
            <p className="mt-2 text-sm text-muted">No upcoming program.</p>
          )}
        </section>
      </div>

      <div className="grid gap-4 xl:grid-cols-2">
        <MonthCalendar events={events} />
        <section className="rounded-2xl border border-line bg-white p-5">
          <p className="text-sm text-muted">Last 30 days cash inflow</p>
          <p className="mt-2 text-4xl font-black text-ink">{naira(inflow)}</p>
          <p className="mt-1 text-xs text-muted">21 Sep – 20 Oct 2026</p>
          <div className="mt-6 flex h-28 items-end gap-1" aria-hidden="true">
            {inflowDays.map((day) => (
              <div
                key={day.date}
                title={`${day.date}: ${naira(day.amount)}`}
                className="flex-1 rounded-sm bg-brand"
                style={{ height: `${Math.max((day.amount / peak) * 100, day.amount ? 8 : 0)}%` }}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
