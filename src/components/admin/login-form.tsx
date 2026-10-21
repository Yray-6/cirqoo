"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { fieldClass, primaryButtonClass } from "@/components/admin/ui";
import { api } from "@/lib/api";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setError("");
    try {
      const result = await api<{ role: "admin" | "staff"; mustChangePassword: boolean }>(
        "/api/admin/login",
        { method: "POST", body: JSON.stringify({ email, password }) },
      );
      if (result.mustChangePassword) router.push("/admin/profile");
      else if (result.role === "staff") router.push("/admin/scan");
      else router.push("/admin");
      router.refresh();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : "Sign-in failed.");
      setPending(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center px-5 py-16">
      <form
        onSubmit={onSubmit}
        className="w-full max-w-[420px] rounded-2xl border border-line bg-white p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06)]"
      >
        <Wordmark />
        <h1 className="mt-6 text-2xl font-black text-ink">Admin login</h1>
        <p className="mt-2 text-sm text-muted">
          Sign in to manage events, tickets, and the door.
        </p>
        <label className="mt-6 flex flex-col gap-1.5 text-sm font-bold text-ink">
          Email
          <input
            type="email"
            autoComplete="username"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={fieldClass}
          />
        </label>
        <label className="mt-4 flex flex-col gap-1.5 text-sm font-bold text-ink">
          Password
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={fieldClass}
          />
        </label>
        {error ? (
          <p role="alert" className="mt-4 text-sm font-bold text-brand">
            {error}
          </p>
        ) : null}
        <button type="submit" disabled={pending} className={`${primaryButtonClass} mt-6 w-full`}>
          {pending ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
