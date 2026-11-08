"use client";

import { useMemo, useState } from "react";
import { formatDay, utcDayKey, type AdminEvent } from "@/lib/admin-mock";

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function cellsFor(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1));
  const count = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: Array<number | null> = [];
  for (let index = 0; index < first.getUTCDay(); index += 1) cells.push(null);
  for (let day = 1; day <= count; day += 1) cells.push(day);
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export function MonthCalendar({ events }: { events: AdminEvent[] }) {
  const [cursor, setCursor] = useState({ year: 2026, month: 10 });
  const [selected, setSelected] = useState<string | null>(null);
  const cells = useMemo(
    () => cellsFor(cursor.year, cursor.month),
    [cursor.month, cursor.year],
  );
  const label = new Intl.DateTimeFormat("en-GB", {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(cursor.year, cursor.month, 1)));

  const marked = new Set(
    events
      .filter((event) => {
        const date = new Date(event.startsAt);
        return date.getUTCFullYear() === cursor.year && date.getUTCMonth() === cursor.month;
      })
      .map((event) => utcDayKey(event.startsAt)),
  );

  function shift(amount: number) {
    const next = new Date(Date.UTC(cursor.year, cursor.month + amount, 1));
    setCursor({ year: next.getUTCFullYear(), month: next.getUTCMonth() });
    setSelected(null);
  }

  const selectedEvents = events.filter((event) => utcDayKey(event.startsAt) === selected);

  return (
    <section className="rounded-2xl border border-line bg-white p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="text-base font-black text-ink">Calendar</h2>
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="rounded-lg border border-black/15 px-2 py-1 text-sm"
            onClick={() => shift(-1)}
            aria-label="Previous month"
          >
            ‹
          </button>
          <p className="min-w-32 text-center text-sm font-bold">{label}</p>
          <button
            type="button"
            className="rounded-lg border border-black/15 px-2 py-1 text-sm"
            onClick={() => shift(1)}
            aria-label="Next month"
          >
            ›
          </button>
        </div>
      </div>
      <div className="mt-4 grid grid-cols-7 gap-1 text-center text-xs text-muted">
        {weekdayLabels.map((day) => (
          <div key={day} className="py-1">
            {day}
          </div>
        ))}
        {cells.map((day, index) => {
          if (!day) return <div key={`empty-${index}`} />;
          const key = new Date(Date.UTC(cursor.year, cursor.month, day)).toISOString().slice(0, 10);
          const hasEvent = marked.has(key);
          const isSelected = selected === key;
          return (
            <button
              key={key}
              type="button"
              onClick={() => setSelected(key)}
              className={`flex h-10 flex-col items-center justify-center rounded-lg text-sm ${
                isSelected ? "bg-ink text-white" : "hover:bg-line"
              }`}
            >
              {day}
              {hasEvent ? (
                <span
                  className={`mt-0.5 size-1.5 rounded-full ${isSelected ? "bg-white" : "bg-brand"}`}
                />
              ) : (
                <span className="mt-0.5 size-1.5" />
              )}
            </button>
          );
        })}
      </div>
      <div className="mt-4 text-sm text-muted">
        {selectedEvents.length > 0 ? (
          <ul className="flex flex-col gap-1 text-ink">
            {selectedEvents.map((event) => (
              <li key={event.id}>
                {event.title} · {formatDay(event.startsAt)}
              </li>
            ))}
          </ul>
        ) : (
          <p>{selected ? "No events on this day." : "Days with an event show an orange dot."}</p>
        )}
      </div>
    </section>
  );
}
