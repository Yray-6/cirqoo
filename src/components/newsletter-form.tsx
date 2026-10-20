"use client";

import { FormEvent, useState } from "react";

export function NewsletterForm() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);

  function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const value = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) {
      setError("Enter a valid email address.");
      setDone(false);
      return;
    }
    setError("");
    setDone(true);
  }

  if (done) {
    return (
      <p className="text-base leading-6 text-ink" role="status">
        Thanks, you’re on the list.
      </p>
    );
  }

  return (
    <form
      onSubmit={onSubmit}
      noValidate
      className="flex flex-col gap-2.5 sm:flex-row sm:items-stretch"
    >
      <div className="flex flex-col gap-1">
        <label htmlFor="newsletter-email" className="sr-only">
          Your Email
        </label>
        <input
          id="newsletter-email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Your Email"
          value={email}
          onChange={(event) => {
            setEmail(event.target.value);
            if (error) setError("");
          }}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? "newsletter-error" : undefined}
          className="w-full rounded-lg border border-black/50 px-4 py-[17px] text-base text-ink outline-none placeholder:text-muted focus:border-brand sm:w-[306px]"
        />
        {error ? (
          <p id="newsletter-error" className="text-sm text-brand" role="alert">
            {error}
          </p>
        ) : null}
      </div>
      <button
        type="submit"
        className="rounded-lg bg-brand px-6 py-[19px] text-base leading-5 text-white hover:bg-[#e4572c]"
      >
        Subscribe
      </button>
    </form>
  );
}
