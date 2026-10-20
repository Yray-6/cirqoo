"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Wordmark } from "@/components/wordmark";
import { fieldClass, primaryButtonClass } from "@/components/admin/ui";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email.trim() || !password) return;
    router.push("/admin");
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
        <button type="submit" className={`${primaryButtonClass} mt-6 w-full`}>
          Sign in
        </button>
      </form>
    </main>
  );
}
