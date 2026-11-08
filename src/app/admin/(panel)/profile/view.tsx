"use client";

import { FormEvent, useState } from "react";
import { useAdminStore } from "@/components/admin/admin-store";
import { useSuccess } from "@/components/admin/success-modal";
import { Field, PageHeading, fieldClass, primaryButtonClass } from "@/components/admin/ui";

export default function ProfilePage() {
  const { profile, updateProfile, changePassword } = useAdminStore();
  const showSuccess = useSuccess();
  const [name, setName] = useState(profile.name);
  const [profileMessage, setProfileMessage] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [nextPassword, setNextPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordMessage, setPasswordMessage] = useState("");

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!name.trim()) return;
    const message = await updateProfile(name);
    if (message) {
      setProfileMessage(message);
      return;
    }
    setProfileMessage("");
    await showSuccess("Profile saved", "Your display name is updated.");
  }

  async function onPassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (nextPassword !== confirmPassword) {
      setPasswordMessage("New passwords must match.");
      return;
    }
    const message = await changePassword(currentPassword, nextPassword);
    if (message) {
      setPasswordMessage(message);
      return;
    }
    setPasswordMessage("");
    setCurrentPassword("");
    setNextPassword("");
    setConfirmPassword("");
    await showSuccess("Password updated", "Your new password is saved.");
  }

  return (
    <div className="mx-auto flex max-w-xl flex-col gap-5">
      <PageHeading title="Profile" />
      {profile.mustChangePassword ? (
        <p className="rounded-2xl border border-brand bg-[rgba(252,100,53,0.08)] p-4 text-sm font-bold text-ink">
          Change the temporary password before using the rest of the admin.
        </p>
      ) : null}
      <form onSubmit={(event) => void onSubmit(event)} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
        <Field label="Display name">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
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
        {profileMessage ? (
          <p role="alert" className="text-sm font-bold text-brand">
            {profileMessage}
          </p>
        ) : null}
      </form>
      <form onSubmit={(event) => void onPassword(event)} className="flex flex-col gap-4 rounded-2xl border border-line bg-white p-5">
        <h2 className="text-lg font-black text-ink">Password</h2>
        <Field label="Current password">
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(event) => setCurrentPassword(event.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="New password">
          <input
            type="password"
            autoComplete="new-password"
            value={nextPassword}
            onChange={(event) => setNextPassword(event.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="Confirm new password">
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        <button type="submit" className={`${primaryButtonClass} self-start`}>
          Change password
        </button>
        {passwordMessage ? (
          <p role="alert" className="text-sm font-bold text-brand">
            {passwordMessage}
          </p>
        ) : null}
      </form>
    </div>
  );
}
