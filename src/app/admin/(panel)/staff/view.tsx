"use client";

import { FormEvent, useState } from "react";
import { useAdminStore } from "@/components/admin/admin-store";
import { useSuccess } from "@/components/admin/success-modal";
import { Field, PageHeading, fieldClass, primaryButtonClass, secondaryButtonClass } from "@/components/admin/ui";
import type { UserRole } from "@/lib/admin-mock";

export default function StaffPage() {
  const store = useAdminStore();
  const showSuccess = useSuccess();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<UserRole>("staff");
  const [notice, setNotice] = useState("");
  const [resetFor, setResetFor] = useState<string | null>(null);
  const [resetPassword, setResetPassword] = useState("");

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const message = await store.createStaff({ name, email, password, role });
    if (message) {
      setNotice(message);
      return;
    }
    setNotice("");
    setName("");
    setEmail("");
    setPassword("");
    await showSuccess("Account created", "They must change the temporary password on first login.");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Staff" />
      <form onSubmit={(event) => void onCreate(event)} className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-2">
        <Field label="Name">
          <input value={name} onChange={(event) => setName(event.target.value)} className={fieldClass} required />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(event) => setEmail(event.target.value)} className={fieldClass} required />
        </Field>
        <Field label="Temporary password">
          <input
            type="text"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        <Field label="Role">
          <select value={role} onChange={(event) => setRole(event.target.value as UserRole)} className={fieldClass}>
            <option value="staff">Staff</option>
            <option value="admin">Admin</option>
          </select>
        </Field>
        <button type="submit" className={`${primaryButtonClass} md:col-span-2 md:justify-self-start`}>
          Create account
        </button>
        {notice ? (
          <p role="alert" className="text-sm font-bold text-brand md:col-span-2">
            {notice}
          </p>
        ) : null}
      </form>
      <ul className="flex flex-col gap-2">
        {store.staff.map((member) => (
          <li key={member.id} className="rounded-2xl border border-line bg-white p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-black text-ink">{member.name}</p>
                <p className="text-sm text-muted">{member.email}</p>
                <p className="mt-1 text-sm text-ink">
                  {member.role === "admin" ? "Admin" : "Staff"}
                  {member.disabled ? " · Disabled" : ""}
                  {member.mustChangePassword ? " · Must change password" : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button type="button" className={secondaryButtonClass} onClick={() => setResetFor(member.id)}>
                  Reset password
                </button>
                <button
                  type="button"
                  className={secondaryButtonClass}
                  disabled={member.disabled}
                  onClick={() =>
                    void store.disableStaff(member.id).then((message) => {
                      if (message) {
                        setNotice(message);
                        return;
                      }
                      setNotice("");
                      void showSuccess("Account disabled", `${member.name} can no longer sign in.`);
                    })
                  }
                >
                  Disable
                </button>
              </div>
            </div>
            {resetFor === member.id ? (
              <form
                className="mt-4 flex flex-wrap items-end gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  void store.resetStaff(member.id, resetPassword).then((message) => {
                    if (message) {
                      setNotice(message);
                      return;
                    }
                    setNotice("");
                    setResetFor(null);
                    setResetPassword("");
                    void showSuccess("Password reset", `${member.name} must change this temporary password on next login.`);
                  });
                }}
              >
                <Field label="New temporary password">
                  <input
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    className={fieldClass}
                    required
                  />
                </Field>
                <button type="submit" className={primaryButtonClass}>
                  Save
                </button>
              </form>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}
