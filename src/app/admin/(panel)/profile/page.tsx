"use client";

import { FormEvent, useState } from "react";
import { useAdminStore } from "@/components/admin/admin-store";
import {
  Field,
  PageHeading,
  fieldClass,
  primaryButtonClass,
} from "@/components/admin/ui";

export default function ProfilePage() {
  const { profile, updateProfile } = useAdminStore();
  const [name, setName] = useState(profile.name);
  const [saved, setSaved] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    updateProfile(name);
    setSaved(true);
  }

  return (
    <form onSubmit={onSubmit} className="mx-auto flex max-w-xl flex-col gap-5">
      <PageHeading title="Profile" />
      <div className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
        <Field label="Display name">
          <input
            value={name}
            onChange={(event) => {
              setName(event.target.value);
              setSaved(false);
            }}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="Email">
          <input value={profile.email} readOnly className={`${fieldClass} bg-line`} />
        </Field>
        <button type="submit" className={`${primaryButtonClass} self-start`}>
          Save profile
        </button>
        {saved ? (
          <p role="status" className="text-sm font-bold text-ink">
            Saved.
          </p>
        ) : null}
      </div>
    </form>
  );
}
