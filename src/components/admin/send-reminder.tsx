"use client";

import { useState } from "react";
import { ConfirmModal } from "@/components/admin/confirm-modal";
import { useSuccess } from "@/components/admin/success-modal";
import { useAdminStore } from "@/components/admin/admin-store";
import { fieldClass, primaryButtonClass } from "@/components/admin/ui";

export function SendReminderButton({
  eventId,
  title,
  variant = "text",
}: {
  eventId: string;
  title: string;
  variant?: "text" | "button";
}) {
  const store = useAdminStore();
  const showSuccess = useSuccess();
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const [tick, setTick] = useState(0);

  function ask() {
    setError("");
    setTick((current) => current + 1);
    setOpen(true);
  }

  function close() {
    if (pending) return;
    setOpen(false);
    setError("");
  }

  async function send() {
    if (pending) return;
    if (note.trim().length > 400) {
      setError("Keep the note to 400 characters.");
      return;
    }
    setPending(true);
    setError("");
    const result = await store.sendEventReminder(eventId, note.trim());
    setPending(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setOpen(false);
    setNote("");
    if (result.sent === 0) {
      await showSuccess(
        "No reminders sent",
        "There are no confirmed ticket holders for this event.",
      );
      return;
    }
    await showSuccess(
      result.sent === 1 ? "Reminder sent" : "Reminders sent",
      result.sent === 1 ? "1 email is on its way." : `${result.sent} emails are on their way.`,
    );
  }

  return (
    <>
      <button
        type="button"
        className={
          variant === "button"
            ? primaryButtonClass
            : "text-sm font-bold text-brand"
        }
        onClick={ask}
      >
        Send reminder
      </button>
      <ConfirmModal
        key={tick}
        open={open}
        title="Send reminder emails?"
        confirmLabel="Send"
        pendingLabel="Sending…"
        pending={pending}
        onConfirm={() => void send()}
        onClose={close}
      >
        <p>
          This emails every confirmed ticket holder for {title} to remind them the event is today.
        </p>
        <label className="mt-3 flex flex-col gap-1.5 text-sm font-bold text-ink">
          Note
          <span className="block font-normal text-muted">Optional. One short line for this send.</span>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={3}
            maxLength={400}
            className={fieldClass}
            placeholder="Doors at 7. Dress code is black."
          />
        </label>
        {error ? (
          <p role="alert" className="mt-2 font-bold text-brand">
            {error}
          </p>
        ) : null}
      </ConfirmModal>
    </>
  );
}
