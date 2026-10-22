"use client";

import Link from "next/link";
import { FormEvent, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  fromUtcInput,
  toUtcInput,
  type AdminTier,
  type EventDraft,
  type EventStatus,
} from "@/lib/admin-mock";
import { useAdminStore } from "@/components/admin/admin-store";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { useNavPending } from "@/components/admin/nav-pending";
import { useSuccess } from "@/components/admin/success-modal";
import {
  Field,
  PageHeading,
  fieldClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/ui";

type TierRow = {
  key: string;
  id?: string;
  name: string;
  description: string;
  price: string;
  capacity: string;
};

function rowsFromTiers(tiers: AdminTier[]): TierRow[] {
  return tiers.map((tier) => ({
    key: tier.id,
    id: tier.id,
    name: tier.name,
    description: tier.description,
    price: String(tier.price),
    capacity: String(tier.capacity),
  }));
}

function emptyRow(): TierRow {
  return {
    key: "new-tier",
    name: "",
    description: "",
    price: "",
    capacity: "",
  };
}

export function EventForm({ eventId }: { eventId?: string }) {
  const router = useRouter();
  const store = useAdminStore();
  const showSuccess = useSuccess();
  const { expect } = useNavPending();
  const existing = eventId ? store.events.find((event) => event.id === eventId) : undefined;
  const [title, setTitle] = useState(existing?.title ?? "");
  const [description, setDescription] = useState(existing?.description ?? "");
  const [venue, setVenue] = useState(existing?.venue ?? "");
  const [startsAt, setStartsAt] = useState(
    existing ? toUtcInput(existing.startsAt) : "2026-11-06T18:00",
  );
  const [endsAt, setEndsAt] = useState(
    existing ? toUtcInput(existing.endsAt) : "2026-11-06T23:00",
  );
  const [status, setStatus] = useState<EventStatus>(existing?.status ?? "draft");
  const [tiers, setTiers] = useState<TierRow[]>(
    existing ? rowsFromTiers(existing.tiers) : [emptyRow()],
  );
  const [error, setError] = useState("");
  const [modalError, setModalError] = useState("");
  const [draft, setDraft] = useState<EventDraft | null>(null);
  const [confirmKind, setConfirmKind] = useState<"save" | "delete" | null>(null);
  const [confirmTick, setConfirmTick] = useState(0);
  const [pending, setPending] = useState(false);
  const pendingRef = useRef(false);

  if (eventId && !existing) {
    return (
      <div>
        <PageHeading title="Event not found" />
        <Link href="/admin/events" className={`${secondaryButtonClass} mt-6`}>
          Back to events
        </Link>
      </div>
    );
  }

  function updateTier(key: string, patch: Partial<TierRow>) {
    setTiers((current) =>
      current.map((tier) => (tier.key === key ? { ...tier, ...patch } : tier)),
    );
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pendingRef.current) return;
    if (!title.trim() || !venue.trim()) {
      setError("Add a title and a venue.");
      return;
    }
    if (endsAt <= startsAt) {
      setError("The end time has to be after the start.");
      return;
    }
    if (tiers.length < 1) {
      setError("Add at least one ticket tier.");
      return;
    }

    const parsed: EventDraft["tiers"] = [];
    for (const tier of tiers) {
      const price = Number(tier.price);
      const capacity = Number(tier.capacity);
      if (!tier.name.trim()) {
        setError("Every tier needs a name.");
        return;
      }
      if (!Number.isInteger(price) || price < 0) {
        setError("Ticket prices are whole naira amounts.");
        return;
      }
      if (!Number.isInteger(capacity) || capacity < 1) {
        setError("Each tier needs at least one ticket.");
        return;
      }
      parsed.push({
        id: tier.id,
        name: tier.name,
        description: tier.description,
        price,
        capacity,
      });
    }

    setError("");
    setModalError("");
    setConfirmKind("save");
    setConfirmTick((current) => current + 1);
    setDraft({
      title,
      description,
      venue,
      startsAt: fromUtcInput(startsAt),
      endsAt: fromUtcInput(endsAt),
      status,
      tiers: parsed,
    });
  }

  function closeConfirm() {
    if (pendingRef.current) return;
    setDraft(null);
    setConfirmKind(null);
    setModalError("");
  }

  function askDelete() {
    if (pendingRef.current) return;
    setError("");
    setModalError("");
    setConfirmKind("delete");
    setConfirmTick((current) => current + 1);
  }

  async function confirmSave() {
    if (!draft || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setModalError("");
    const message = eventId
      ? await store.updateEvent(eventId, draft)
      : await store.createEvent(draft);
    if (message) {
      setModalError(message);
      pendingRef.current = false;
      setPending(false);
      return;
    }
    setDraft(null);
    setConfirmKind(null);
    await showSuccess(
      eventId ? "Event updated" : "Event created",
      eventId ? "Your changes are saved." : "The event is on your events list.",
    );
    expect("/admin/events");
    router.push("/admin/events");
  }

  async function confirmDelete() {
    if (!eventId || pendingRef.current) return;
    pendingRef.current = true;
    setPending(true);
    setModalError("");
    const message = await store.deleteEvent(eventId);
    if (message) {
      setModalError(message);
      pendingRef.current = false;
      setPending(false);
      return;
    }
    setDraft(null);
    setConfirmKind(null);
    await showSuccess("Event deleted", "The event has been removed.");
    expect("/admin/events");
    router.push("/admin/events");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <PageHeading title={eventId ? "Edit event" : "Create event"} />
      <div className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-2">
        <div className="md:col-span-2">
          <Field label="Title">
            <input
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              className={fieldClass}
              required
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Description">
            <textarea
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              rows={4}
              className={fieldClass}
            />
          </Field>
        </div>
        <div className="md:col-span-2">
          <Field label="Venue">
            <input
              value={venue}
              onChange={(event) => setVenue(event.target.value)}
              className={fieldClass}
              required
            />
          </Field>
        </div>
        <Field label="Starts (UTC)">
          <input
            type="datetime-local"
            value={startsAt}
            onChange={(event) => setStartsAt(event.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="Ends (UTC)">
          <input
            type="datetime-local"
            value={endsAt}
            onChange={(event) => setEndsAt(event.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="Status">
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as EventStatus)}
            className={fieldClass}
          >
            <option value="draft">Draft</option>
            <option value="published">Published</option>
          </select>
        </Field>
      </div>

      <section className="rounded-2xl border border-line bg-white p-5">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-black text-ink">Tickets</h2>
          <button
            type="button"
            className={secondaryButtonClass}
            onClick={() =>
              setTiers((current) => [
                ...current,
                { ...emptyRow(), key: crypto.randomUUID() },
              ])
            }
          >
            Add tier
          </button>
        </div>
        <p className="mt-1 text-sm text-muted">
          The number you set is the most that can be sold for that tier.
        </p>
        <ul className="mt-4 flex flex-col gap-4">
          {tiers.map((tier, index) => (
            <li key={tier.key} className="rounded-xl border border-line p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-bold text-ink">Tier {index + 1}</p>
                {tiers.length > 1 ? (
                  <button
                    type="button"
                    className="text-sm font-bold text-brand"
                    onClick={() =>
                      setTiers((current) => current.filter((item) => item.key !== tier.key))
                    }
                  >
                    Remove
                  </button>
                ) : null}
              </div>
              <div className="grid gap-3 md:grid-cols-3">
                <Field label="Name">
                  <input
                    value={tier.name}
                    onChange={(event) => updateTier(tier.key, { name: event.target.value })}
                    className={fieldClass}
                    required
                  />
                </Field>
                <Field label="Price (₦)">
                  <input
                    inputMode="numeric"
                    value={tier.price}
                    onChange={(event) => updateTier(tier.key, { price: event.target.value })}
                    className={fieldClass}
                    required
                  />
                </Field>
                <Field label="Number of tickets">
                  <input
                    inputMode="numeric"
                    value={tier.capacity}
                    onChange={(event) => updateTier(tier.key, { capacity: event.target.value })}
                    className={fieldClass}
                    required
                  />
                </Field>
                <div className="md:col-span-3">
                  <Field label="Description">
                    <input
                      value={tier.description}
                      onChange={(event) =>
                        updateTier(tier.key, { description: event.target.value })
                      }
                      className={fieldClass}
                    />
                  </Field>
                </div>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {error ? (
        <p role="alert" className="text-sm font-bold text-brand">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-3">
        <button type="submit" className={primaryButtonClass}>
          Save event
        </button>
        <Link href="/admin/events" className={secondaryButtonClass}>
          Cancel
        </Link>
        {eventId ? (
          <button type="button" className={`${secondaryButtonClass} text-brand`} onClick={askDelete}>
            Delete event
          </button>
        ) : null}
      </div>
      </form>
      <ConfirmModal
        key={confirmTick}
        open={confirmKind !== null}
        title={
          confirmKind === "delete"
            ? "Delete this event?"
            : eventId
              ? "Save this event?"
              : "Create this event?"
        }
        confirmLabel={confirmKind === "delete" ? "Delete" : "Yes"}
        pendingLabel={
          confirmKind === "delete" ? "Deleting…" : eventId ? "Saving…" : "Creating…"
        }
        pending={pending}
        onConfirm={() => void (confirmKind === "delete" ? confirmDelete() : confirmSave())}
        onClose={closeConfirm}
      >
        <p>
          {confirmKind === "delete"
            ? "Do you want to delete this event? Its tickets and discount codes will be removed."
            : eventId
              ? "Do you want to save this event?"
              : "Do you want to create this event?"}
        </p>
        {modalError ? (
          <p role="alert" className="mt-2 font-bold text-brand">
            {modalError}
          </p>
        ) : null}
      </ConfirmModal>
    </div>
  );
}
