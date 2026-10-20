"use client";

import { FormEvent, useState } from "react";
import { useAdminStore } from "@/components/admin/admin-store";
import {
  Field,
  PageHeading,
  fieldClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/admin/ui";
import { describeCut, type DiscountCut } from "@/lib/admin-mock";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

function suggestCode() {
  let code = "";
  for (let index = 0; index < 6; index += 1) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

export default function DiscountsPage() {
  const { events, discounts, addDiscount, redeemDiscount } = useAdminStore();
  const [code, setCode] = useState("");
  const [eventId, setEventId] = useState(events[0]?.id ?? "");
  const [cut, setCut] = useState<DiscountCut>("percentage");
  const [percent, setPercent] = useState("10");
  const [amount, setAmount] = useState("2000");
  const [usageLimit, setUsageLimit] = useState("20");
  const [error, setError] = useState("");

  function onSubmit(formEvent: FormEvent<HTMLFormElement>) {
    formEvent.preventDefault();
    const message = addDiscount({
      code,
      eventId,
      cut,
      percent: Number(percent),
      amount: Number(amount),
      usageLimit: Number(usageLimit),
    });
    if (message) {
      setError(message);
      return;
    }
    setError("");
    setCode("");
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeading title="Discounts" />
      <form
        onSubmit={onSubmit}
        className="grid gap-4 rounded-2xl border border-line bg-white p-5 md:grid-cols-2"
      >
        <Field label="Code">
          <span className="flex gap-2">
            <input
              value={code}
              onChange={(change) => setCode(change.target.value.toUpperCase())}
              className={fieldClass}
              placeholder="EARLY10"
              required
            />
            <button
              type="button"
              className={secondaryButtonClass}
              onClick={() => setCode(suggestCode())}
            >
              Generate
            </button>
          </span>
        </Field>
        <Field label="Event">
          <select
            value={eventId}
            onChange={(change) => setEventId(change.target.value)}
            className={fieldClass}
          >
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.title}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="md:col-span-2">
          <legend className="text-sm font-bold text-ink">Cut</legend>
          <div className="mt-2 flex flex-wrap gap-4 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="cut"
                checked={cut === "percentage"}
                onChange={() => setCut("percentage")}
              />
              Percentage cut
            </label>
            <label className="flex items-center gap-2">
              <input
                type="radio"
                name="cut"
                checked={cut === "fixed"}
                onChange={() => setCut("fixed")}
              />
              Fixed amount
            </label>
          </div>
        </fieldset>
        {cut === "percentage" ? (
          <Field label="Percentage">
            <input
              inputMode="numeric"
              value={percent}
              onChange={(change) => setPercent(change.target.value)}
              className={fieldClass}
              required
            />
          </Field>
        ) : (
          <Field label="Amount (₦)">
            <input
              inputMode="numeric"
              value={amount}
              onChange={(change) => setAmount(change.target.value)}
              className={fieldClass}
              required
            />
          </Field>
        )}
        <Field label="Usage count">
          <input
            inputMode="numeric"
            value={usageLimit}
            onChange={(change) => setUsageLimit(change.target.value)}
            className={fieldClass}
            required
          />
        </Field>
        {error ? (
          <p role="alert" className="text-sm font-bold text-brand md:col-span-2">
            {error}
          </p>
        ) : (
          <p className="text-sm text-muted md:col-span-2">
            The code stays valid until the usage count is spent.
          </p>
        )}
        <button type="submit" className={`${primaryButtonClass} md:col-span-2 md:justify-self-start`}>
          Create code
        </button>
      </form>
      <ul className="flex flex-col gap-2">
        {discounts.map((discount) => {
          const event = events.find((item) => item.id === discount.eventId);
          const spent = discount.used >= discount.usageLimit;
          return (
            <li
              key={discount.id}
              className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-white px-4 py-3"
            >
              <div>
                <p className="font-black tracking-wide text-ink">{discount.code}</p>
                <p className="text-sm text-muted">
                  {describeCut(discount)} · {event?.title ?? "Event"}
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="font-bold text-ink">
                  {discount.used} / {discount.usageLimit} uses
                </p>
                {spent ? (
                  <p className="text-muted">Used up</p>
                ) : (
                  <button
                    type="button"
                    className="mt-1 font-bold text-brand"
                    onClick={() => redeemDiscount(discount.id)}
                  >
                    Record a use
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
