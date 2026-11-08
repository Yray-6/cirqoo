"use client";

import { FormEvent, useState } from "react";
import { useAdminStore } from "@/components/admin/admin-store";
import { useSuccess } from "@/components/admin/success-modal";
import {
  Field,
  PageHeading,
  fieldClass,
  primaryButtonClass,
} from "@/components/admin/ui";
import { formatDay } from "@/lib/admin-mock";

export default function AnnouncementsPage() {
  const { announcements, addAnnouncement } = useAdminStore();
  const showSuccess = useSuccess();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [error, setError] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!title.trim() || !body.trim()) return;
    try {
      await addAnnouncement(title, body);
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "The announcement was not posted.");
      return;
    }
    setError("");
    setTitle("");
    setBody("");
    await showSuccess("Announcement posted", "The announcement is saved.");
  }

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6">
      <PageHeading title="Announcements" />
      <form onSubmit={onSubmit} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
        <Field label="Title">
          <input
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="Message">
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            className={fieldClass}
            required
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm font-bold text-brand">
            {error}
          </p>
        ) : null}
        <button type="submit" className={`${primaryButtonClass} self-start`}>
          Post announcement
        </button>
      </form>
      <ul className="flex flex-col gap-3">
        {announcements.map((announcement) => (
          <li key={announcement.id} className="rounded-2xl border border-line bg-white p-5">
            <h2 className="text-lg font-black text-ink">{announcement.title}</h2>
            <p className="mt-1 text-xs text-muted">{formatDay(announcement.createdAt)}</p>
            <p className="mt-3 text-sm leading-6 text-ink">{announcement.body}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
