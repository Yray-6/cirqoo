"use client";

import Image from "next/image";
import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  naira,
  serviceFeeEach,
  tickets,
  type TicketId,
} from "@/lib/tickets";

type Step = "tickets" | "contact" | "payment" | "done";

type Contact = {
  firstName: string;
  lastName: string;
  email: string;
  confirmEmail: string;
  phone: string;
  separateEmails: boolean;
};

const emptyContact: Contact = {
  firstName: "",
  lastName: "",
  email: "",
  confirmEmail: "",
  phone: "",
  separateEmails: false,
};

const stepOrder: Step[] = ["tickets", "contact", "payment"];
const stepLabels = ["Tickets", "Contact", "Payment"];

function clock(totalSeconds: number) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

const actionButton =
  "flex h-[52px] w-full items-center justify-center rounded-lg text-xs font-semibold text-white enabled:bg-[#3F3F3F] enabled:hover:bg-[#2c2c2c] disabled:bg-[#CECECE] min-[1100px]:h-auto min-[1100px]:py-4 min-[1100px]:text-base min-[1100px]:leading-5 min-[1100px]:font-normal min-[1100px]:enabled:bg-brand min-[1100px]:enabled:hover:bg-[#e4572c] min-[1100px]:disabled:bg-[#ECECED] min-[1100px]:disabled:text-[#61646C] min-[1100px]:disabled:opacity-75";

const stepTitle =
  "text-xs font-bold leading-8 text-ink min-[1100px]:text-2xl min-[1100px]:font-black";

export function CheckoutFlow() {
  const [step, setStep] = useState<Step>("tickets");
  const [quantities, setQuantities] = useState<Record<TicketId, number>>({
    "early-bird": 0,
    solo: 0,
  });
  const [contact, setContact] = useState<Contact>(emptyContact);
  const [showErrors, setShowErrors] = useState(false);
  const [feeNote, setFeeNote] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [eventUpdates, setEventUpdates] = useState(false);
  const [nearbyEvents, setNearbyEvents] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(10 * 60);
  const [timerOn, setTimerOn] = useState(false);

  useEffect(() => {
    if (!timerOn) return;
    const id = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerOn]);

  const lines = tickets.flatMap((ticket) => {
    const quantity = quantities[ticket.id];
    if (quantity < 1) return [];
    return [{ ...ticket, quantity, total: ticket.price * quantity }];
  });
  const ticketTotal = lines.reduce((sum, line) => sum + line.total, 0);
  const ticketCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const fees = ticketCount * serviceFeeEach;
  const total = ticketTotal + fees;
  const expired = timerOn && secondsLeft === 0;

  const contactErrors = useMemo(() => {
    const errors: Partial<Record<keyof Contact, string>> = {};
    if (!contact.firstName.trim()) errors.firstName = "Enter your first name.";
    if (!contact.lastName.trim()) errors.lastName = "Enter your last name.";
    if (!validEmail(contact.email)) errors.email = "Enter a valid email address.";
    if (contact.confirmEmail !== contact.email || !contact.confirmEmail) {
      errors.confirmEmail = "Email addresses must match.";
    }
    if (!/^\d{10,11}$/.test(contact.phone.replace(/\s/g, ""))) {
      errors.phone = "Enter a valid phone number.";
    }
    return errors;
  }, [contact]);
  const contactReady = Object.keys(contactErrors).length === 0;

  function goToContact() {
    if (ticketCount < 1) return;
    setTimerOn(true);
    setStep("contact");
  }

  function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);
    if (!contactReady || expired) return;
    setStep("payment");
  }

  function finishCheckout() {
    if (!acceptTerms || expired) return;
    setStep("done");
  }

  function goBack() {
    if (step === "contact") setStep("tickets");
    else if (step === "payment") setStep("contact");
    else window.location.href = "/";
  }

  const activeIndex =
    step === "done" ? 2 : stepOrder.indexOf(step);

  return (
    <div className="min-h-full bg-white text-ink">
      <header className="flex items-center justify-between px-5 pt-6 min-[1100px]:px-[72px] min-[1100px]:pt-12 min-[1100px]:pb-10">
        <p className="text-xs leading-8 text-ink min-[1100px]:text-xl">Checkout</p>
        <a href="/" aria-label="Close checkout" className="opacity-70">
          <Image
            src="/close.svg"
            alt=""
            width={32}
            height={32}
            className="size-3.5 min-[1100px]:size-8"
          />
        </a>
      </header>

      <main className="mt-8 flex flex-col gap-8 px-5 pb-12 min-[1100px]:mt-0 min-[1100px]:flex-row min-[1100px]:items-start min-[1100px]:justify-between min-[1100px]:gap-12 min-[1100px]:px-[72px] min-[1100px]:pb-24">
        <section className="flex w-full min-w-0 flex-col gap-8 min-[1100px]:max-w-[922px]">
          <ol className="flex items-center gap-2">
            {stepLabels.map((label, index) => {
              const reached = index <= activeIndex;
              return (
                <li
                  key={label}
                  className={`flex items-center gap-2 ${index > 0 ? "min-w-0 flex-1" : ""}`}
                >
                  {index > 0 ? (
                    <span className="mx-1 h-px min-w-4 flex-1 bg-[#E5E7EB]" />
                  ) : null}
                  <span
                    className={`flex shrink-0 items-center gap-1.5 text-[10px] font-normal whitespace-nowrap text-[#61646C] min-[1100px]:gap-2 min-[1100px]:text-base min-[1100px]:font-black min-[1100px]:tracking-[0.02em] ${reached ? "" : "opacity-50"}`}
                  >
                    {reached ? (
                      <Image
                        src="/step-check.svg"
                        alt=""
                        width={16}
                        height={16}
                        className="size-[15px] min-[1100px]:size-4"
                      />
                    ) : (
                      <span className="size-[13px] rounded-full border border-[#61646C] min-[1100px]:size-3.5" />
                    )}
                    {label}
                  </span>
                </li>
              );
            })}
          </ol>

          {step === "tickets" ? (
            <TicketStep
              quantities={quantities}
              onChange={(id, quantity) =>
                setQuantities((current) => ({ ...current, [id]: quantity }))
              }
              onBack={goBack}
            />
          ) : null}

          {step === "contact" ? (
            <ContactStep
              contact={contact}
              errors={showErrors ? contactErrors : {}}
              secondsLeft={secondsLeft}
              expired={expired}
              onChange={(patch) => setContact((current) => ({ ...current, ...patch }))}
              onSubmit={submitContact}
              onBack={goBack}
            />
          ) : null}

          {step === "payment" ? (
            <PaymentStep
              secondsLeft={secondsLeft}
              expired={expired}
              acceptTerms={acceptTerms}
              eventUpdates={eventUpdates}
              nearbyEvents={nearbyEvents}
              onAcceptTerms={setAcceptTerms}
              onEventUpdates={setEventUpdates}
              onNearbyEvents={setNearbyEvents}
              onBack={goBack}
            />
          ) : null}

          {step === "done" ? (
            <div className="flex flex-col gap-6">
              <h1 className={stepTitle}>You're all set</h1>
              <p className="max-w-xl text-[10px] leading-6 text-[#61646C] min-[1100px]:text-base">
                This preview does not charge a card. A confirmation for{" "}
                {contact.email} would be emailed once a payment provider is
                connected.
              </p>
              <a
                href="/"
                className="flex h-[52px] w-full items-center justify-center rounded-lg bg-[#3F3F3F] text-xs font-semibold text-white hover:bg-[#2c2c2c] min-[1100px]:h-auto min-[1100px]:w-fit min-[1100px]:bg-brand min-[1100px]:px-6 min-[1100px]:py-4 min-[1100px]:text-base min-[1100px]:font-normal min-[1100px]:hover:bg-[#e4572c]"
              >
                Back to the event
              </a>
            </div>
          ) : null}
        </section>

        <Summary
          lines={lines}
          fees={fees}
          total={total}
          feeNote={feeNote}
          onToggleFee={() => setFeeNote((open) => !open)}
          action={
            step === "tickets" && ticketCount > 0
              ? { label: "Continue", enabled: true, onClick: goToContact }
              : step === "contact"
                ? {
                    label: "Continue",
                    enabled: contactReady && !expired,
                    form: "contact-form",
                  }
                : step === "payment"
                  ? {
                      label: "Checkout",
                      mobileLabel: "Continue",
                      enabled: acceptTerms && !expired,
                      onClick: finishCheckout,
                    }
                  : undefined
          }
        />
      </main>
    </div>
  );
}

function TicketStep({
  quantities,
  onChange,
  onBack,
}: {
  quantities: Record<TicketId, number>;
  onChange: (id: TicketId, quantity: number) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-8 min-[1100px]:gap-6 min-[1100px]:pb-10">
      <div className="flex items-center gap-3 min-[1100px]:gap-4">
        <button type="button" onClick={onBack} aria-label="Back to the event">
          <Image
            src="/back.svg"
            alt=""
            width={28}
            height={28}
            className="size-6 min-[1100px]:size-7"
          />
        </button>
        <h1 className={stepTitle}>Choose Tickets</h1>
      </div>
      <div className="flex flex-col gap-7 min-[1100px]:gap-8 min-[1100px]:pt-2.5">
        {tickets.map((ticket) => (
          <article key={ticket.id} className="border-b border-line pb-7 min-[1100px]:pb-8">
            <div className="flex items-start justify-between gap-3 min-[1100px]:gap-6">
              <div className="min-w-0">
                <h2 className="text-xs font-bold leading-6 text-ink min-[1100px]:text-lg min-[1100px]:font-black min-[1100px]:leading-[30px] min-[1100px]:tracking-[0.02em]">
                  {ticket.name}
                </h2>
                <p className="text-sm font-bold leading-6 text-brand min-[1100px]:mt-2 min-[1100px]:text-lg min-[1100px]:font-black min-[1100px]:leading-[30px] min-[1100px]:tracking-[0.02em]">
                  {naira(ticket.price)}
                </p>
                <p className="mt-2 hidden text-sm leading-[22px] text-[#61646C] min-[1100px]:block">
                  {ticket.description}
                </p>
              </div>
              <div className="flex w-[92px] shrink-0 flex-col gap-3 min-[1100px]:w-auto min-[1100px]:items-end min-[1100px]:gap-4">
                <label className="relative block w-full">
                  <span className="sr-only">Quantity for {ticket.name}</span>
                  <select
                    value={quantities[ticket.id]}
                    onChange={(event) =>
                      onChange(ticket.id, Number(event.target.value))
                    }
                    className="h-[46px] w-full appearance-none rounded-lg border border-[#ECECED] bg-white pr-8 pl-4 text-xs font-extrabold text-black min-[1100px]:h-auto min-[1100px]:w-auto min-[1100px]:py-2.5 min-[1100px]:pr-10 min-[1100px]:pl-3 min-[1100px]:text-sm"
                  >
                    {Array.from({ length: ticket.remaining + 1 }, (_, quantity) => (
                      <option key={quantity} value={quantity}>
                        {quantity}
                      </option>
                    ))}
                  </select>
                  <Image
                    src="/chevron.svg"
                    alt=""
                    width={11}
                    height={7}
                    className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2"
                  />
                </label>
                {ticket.remaining === 1 ? (
                  <p className="text-right text-[10px] text-[#61646C] min-[1100px]:text-sm min-[1100px]:leading-[18px]">
                    1 ticket left
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-[10px] leading-[22px] text-[#61646C] min-[1100px]:hidden">
              {ticket.description}
            </p>
          </article>
        ))}
      </div>
    </div>
  );
}

function ReservationNote({
  secondsLeft,
  expired,
}: {
  secondsLeft: number;
  expired: boolean;
}) {
  return (
    <p className="rounded-lg bg-[#FFEFEA] p-4 text-[10px] leading-6 text-[#61646C] min-[1100px]:text-base">
      {expired ? (
        "This reservation has expired. Go back and choose your tickets again."
      ) : (
        <>
          We're reserving this ticket for you. Complete your checkout within{" "}
          <span className="font-extrabold text-brand min-[1100px]:text-[15px] min-[1100px]:leading-5">
            {clock(secondsLeft)}
          </span>{" "}
          to make it yours.
        </>
      )}
    </p>
  );
}

function Field({
  id,
  label,
  value,
  onChange,
  error,
  type = "text",
  autoComplete,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  type?: string;
  autoComplete?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[10px] leading-[21px] text-[#111827] min-[1100px]:text-sm">
        <span className="text-brand">*</span> {label}
      </label>
      <input
        id={id}
        name={id}
        type={type}
        autoComplete={autoComplete}
        placeholder={label}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={error ? true : undefined}
        className="h-12 rounded-lg border border-[#CECFD2] px-4 text-[10px] text-black outline-none placeholder:text-muted focus:border-brand min-[1100px]:px-5 min-[1100px]:text-base"
      />
      {error ? (
        <p className="text-sm text-brand" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function ContactStep({
  contact,
  errors,
  secondsLeft,
  expired,
  onChange,
  onSubmit,
  onBack,
}: {
  contact: Contact;
  errors: Partial<Record<keyof Contact, string>>;
  secondsLeft: number;
  expired: boolean;
  onChange: (patch: Partial<Contact>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-8 min-[1100px]:gap-6">
      <div className="flex items-center gap-3 min-[1100px]:gap-4">
        <button type="button" onClick={onBack} aria-label="Back to tickets">
          <Image
            src="/back.svg"
            alt=""
            width={28}
            height={28}
            className="size-6 min-[1100px]:size-7"
          />
        </button>
        <h1 className={stepTitle}>Contact Information</h1>
      </div>
      <ReservationNote secondsLeft={secondsLeft} expired={expired} />
      <form id="contact-form" onSubmit={onSubmit} noValidate className="flex flex-col gap-8 min-[1100px]:gap-10">
        <div className="flex flex-col gap-6">
          <Field
            id="firstName"
            label="First name"
            autoComplete="given-name"
            value={contact.firstName}
            error={errors.firstName}
            onChange={(firstName) => onChange({ firstName })}
          />
          <Field
            id="lastName"
            label="Last name"
            autoComplete="family-name"
            value={contact.lastName}
            error={errors.lastName}
            onChange={(lastName) => onChange({ lastName })}
          />
          <Field
            id="email"
            label="Email address"
            type="email"
            autoComplete="email"
            value={contact.email}
            error={errors.email}
            onChange={(email) => onChange({ email })}
          />
          <Field
            id="confirmEmail"
            label="Confirm email address"
            type="email"
            autoComplete="email"
            value={contact.confirmEmail}
            error={errors.confirmEmail}
            onChange={(confirmEmail) => onChange({ confirmEmail })}
          />
          <div className="flex flex-col gap-2">
            <label htmlFor="phone" className="text-[10px] leading-[21px] text-[#111827] min-[1100px]:text-sm">
              <span className="text-brand">*</span> Phone number
            </label>
            <div className="flex gap-2">
              <span className="flex h-12 w-[100px] shrink-0 items-center justify-between rounded-lg border border-[#CECFD2] px-3.5 text-[10px] text-black min-[1100px]:w-auto min-[1100px]:justify-start min-[1100px]:gap-3 min-[1100px]:text-base min-[1100px]:text-[#111827]">
                +234
                <Image src="/chevron.svg" alt="" width={8} height={4} />
              </span>
              <input
                id="phone"
                name="phone"
                inputMode="numeric"
                autoComplete="tel-national"
                placeholder="Phone number"
                value={contact.phone}
                onChange={(event) => onChange({ phone: event.target.value })}
                aria-invalid={errors.phone ? true : undefined}
                className="h-12 min-w-0 flex-1 rounded-lg border border-[#CECFD2] px-4 text-[10px] text-black outline-none placeholder:text-muted focus:border-brand min-[1100px]:px-5 min-[1100px]:text-base"
              />
            </div>
            {errors.phone ? (
              <p className="text-sm text-brand" role="alert">
                {errors.phone}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex flex-col gap-5">
          <h2 className="text-xs font-bold leading-6 text-ink min-[1100px]:text-lg min-[1100px]:font-black min-[1100px]:leading-[30px] min-[1100px]:text-black">
            Send ticket to different email addresses?
          </h2>
          <div className="flex items-start gap-3 rounded-lg border border-line p-4 text-[10px] leading-6 text-[#61646C] min-[1100px]:relative min-[1100px]:block min-[1100px]:py-3 min-[1100px]:pl-12 min-[1100px]:text-base">
            <Image
              src="/info.svg"
              alt=""
              width={20}
              height={20}
              className="mt-0.5 size-4 shrink-0 min-[1100px]:absolute min-[1100px]:top-3.5 min-[1100px]:left-5 min-[1100px]:size-5"
            />
            Tickets will only be sent to the email address you provide here.
          </div>
          <div className="flex gap-5">
            <Radio
              name="separate-emails"
              label="Yes"
              checked={contact.separateEmails}
              onChange={() => onChange({ separateEmails: true })}
            />
            <Radio
              name="separate-emails"
              label="No"
              checked={!contact.separateEmails}
              onChange={() => onChange({ separateEmails: false })}
            />
          </div>
        </div>

      </form>
    </div>
  );
}

function Radio({
  name,
  label,
  checked,
  onChange,
}: {
  name: string;
  label: string;
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <label className="flex items-center gap-2 text-[10px] font-medium text-black min-[1100px]:text-base min-[1100px]:leading-6 min-[1100px]:text-[#111827]">
      <input
        type="radio"
        name={name}
        checked={checked}
        onChange={onChange}
        className="sr-only"
      />
      <span
        className={`flex size-5 items-center justify-center rounded-full border ${
          checked ? "border-transparent bg-brand" : "border-[#D1D5DB] bg-white"
        }`}
      >
        {checked ? (
          <Image src="/radio-check.svg" alt="" width={16} height={16} />
        ) : null}
      </span>
      {label}
    </label>
  );
}

function CheckRow({
  checked,
  onChange,
  children,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex items-start gap-4 text-[10px] leading-[22px] text-[#111827] min-[1100px]:text-base">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="sr-only"
      />
      <span
        className={`mt-0.5 flex size-5 shrink-0 items-center justify-center rounded border ${
          checked ? "border-brand bg-brand text-white" : "border-[#D1D5DB] bg-white"
        }`}
        aria-hidden="true"
      >
        {checked ? (
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M2 6.2 4.6 8.8 10 3.2"
              stroke="white"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        ) : null}
      </span>
      <span>{children}</span>
    </label>
  );
}

function PaymentStep({
  secondsLeft,
  expired,
  acceptTerms,
  eventUpdates,
  nearbyEvents,
  onAcceptTerms,
  onEventUpdates,
  onNearbyEvents,
  onBack,
}: {
  secondsLeft: number;
  expired: boolean;
  acceptTerms: boolean;
  eventUpdates: boolean;
  nearbyEvents: boolean;
  onAcceptTerms: (checked: boolean) => void;
  onEventUpdates: (checked: boolean) => void;
  onNearbyEvents: (checked: boolean) => void;
  onBack: () => void;
}) {
  return (
    <div className="flex flex-col gap-8 min-[1100px]:gap-6">
      <div className="flex items-center gap-3 min-[1100px]:gap-4">
        <button type="button" onClick={onBack} aria-label="Back to contact information">
          <Image
            src="/back.svg"
            alt=""
            width={28}
            height={28}
            className="size-6 min-[1100px]:size-7"
          />
        </button>
        <h1 className={stepTitle}>Payment Options</h1>
      </div>
      <ReservationNote secondsLeft={secondsLeft} expired={expired} />
      <div className="border-b border-line pb-8 min-[1100px]:pb-14">
        <div className="flex gap-4">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand">
            <Image src="/radio-check.svg" alt="" width={16} height={16} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col gap-3 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-between">
              <p className="text-xs leading-6 text-ink min-[1100px]:text-base min-[1100px]:text-[#111827]">
                Pay with Card or Bank
              </p>
              <Image
                src="/paystack-56586a.png"
                alt="Paystack"
                width={114}
                height={20}
                className="h-5 w-auto"
              />
            </div>
            <p className="text-xs leading-[22px] text-[#61646C] min-[1100px]:text-sm min-[1100px]:leading-[21px]">
              Pay with Mastercard, Visa, or Verve or with bank transfer.
            </p>
            <p className="rounded-lg bg-[#FAFAFA] p-4 text-[10px] leading-[22px] text-[#61646C] min-[1100px]:text-sm min-[1100px]:leading-[21px]">
              Once your payment is confirmed, your ticket will be emailed to you
              automatically within minutes.
            </p>
          </div>
        </div>
      </div>
      <p className="rounded-lg bg-line p-4 text-[10px] leading-6 text-[#61646C] min-[1100px]:text-base min-[1100px]:leading-[22px]">
        You must accept the Cirqoo Terms and Conditions, Refund Policy and Privacy
        Policy before completing this purchase.
      </p>
      <div className="flex flex-col gap-3.5 min-[1100px]:gap-6 min-[1100px]:pb-6">
        <CheckRow checked={acceptTerms} onChange={onAcceptTerms}>
          I accept the{" "}
          <a href="https://tix.africa" className="text-brand">
            Cirqoo Terms and Conditions
          </a>
          ,{" "}
          <a href="https://tix.africa" className="text-brand">
            Refund Policy
          </a>{" "}
          and{" "}
          <a href="https://tix.africa" className="text-brand">
            Privacy Policy
          </a>
          .
        </CheckRow>
        <CheckRow checked={eventUpdates} onChange={onEventUpdates}>
          Keep me updated on future events from{" "}
          <span className="text-brand">AWE LAGOS</span>.
        </CheckRow>
        <CheckRow checked={nearbyEvents} onChange={onNearbyEvents}>
          Send me emails about the best events happening nearby or online.
        </CheckRow>
      </div>
    </div>
  );
}

function Summary({
  lines,
  fees,
  total,
  feeNote,
  onToggleFee,
  action,
}: {
  lines: Array<{ id: string; name: string; quantity: number; total: number }>;
  fees: number;
  total: number;
  feeNote: boolean;
  onToggleFee: () => void;
  action?: {
    label: string;
    mobileLabel?: string;
    enabled: boolean;
    onClick?: () => void;
    form?: string;
  };
}) {
  return (
    <aside className="flex w-full flex-col gap-5 min-[1100px]:w-[538px] min-[1100px]:shrink-0 min-[1100px]:gap-6">
      <h2 className="text-xs font-bold leading-8 text-ink min-[1100px]:text-2xl min-[1100px]:font-black">
        Summary
      </h2>
      <div className="flex flex-col gap-6 rounded-2xl border border-line p-5 min-[1100px]:block min-[1100px]:p-6">
        <p className="text-center text-xs font-bold leading-7 text-ink min-[1100px]:text-xl min-[1100px]:font-black min-[1100px]:text-black">
          Cirqoo After Hours - Karaoke & Games
        </p>
        {lines.length === 0 ? (
          <p className="text-center text-[10px] leading-6 text-[#85888E] min-[1100px]:mt-10 min-[1100px]:text-base min-[1100px]:leading-[30px]">
            Please, choose a ticket type to continue
          </p>
        ) : (
          <div className="flex flex-col gap-6 min-[1100px]:mt-8 min-[1100px]:gap-0">
            {lines.map((line) => (
              <div key={line.id} className="flex items-start justify-between gap-3 pb-4 min-[1100px]:gap-6 min-[1100px]:pb-5">
                <p className="text-[10px] leading-6 text-[#85888E] min-[1100px]:text-base min-[1100px]:leading-[30px]">
                  {line.quantity} × {line.name}
                </p>
                <p className="text-[10px] leading-6 text-[#85888E] min-[1100px]:text-base min-[1100px]:leading-[30px]">
                  {naira(line.total)}
                </p>
              </div>
            ))}
            <div className="border-y border-line py-4 min-[1100px]:border-t min-[1100px]:border-b-0 min-[1100px]:pt-5 min-[1100px]:pb-0">
              <div className="flex items-center justify-between pb-4 min-[1100px]:pb-5">
                <p className="flex items-center gap-2 text-[10px] leading-6 text-[#85888E] min-[1100px]:text-base min-[1100px]:leading-[30px]">
                  Service fees
                  <button
                    type="button"
                    onClick={onToggleFee}
                    aria-expanded={feeNote}
                    aria-label="About service fees"
                  >
                    <Image src="/info.svg" alt="" width={16} height={16} />
                  </button>
                </p>
                <p className="text-[10px] leading-[30px] text-[#85888E] min-[1100px]:text-base">
                  {naira(fees)}
                </p>
              </div>
              {feeNote ? (
                <p className="pb-4 text-[10px] leading-5 text-[#61646C] min-[1100px]:text-sm">
                  A {naira(serviceFeeEach)} service fee is added for each ticket.
                </p>
              ) : null}
              <div className="flex items-center justify-between min-[1100px]:pb-5">
                <p className="text-[10px] leading-6 text-[#85888E] min-[1100px]:text-base min-[1100px]:leading-[30px]">
                  Subtotal
                </p>
                <p className="text-[10px] leading-[30px] text-[#85888E] min-[1100px]:text-base">
                  {naira(total)}
                </p>
              </div>
            </div>
            <p className="rounded-lg border border-line bg-[#FAFAFA] px-4 py-4 text-center text-[10px] leading-[21px] text-[#61646C] min-[1100px]:text-sm">
              Discount has been automatically calculated
            </p>
            <div className="flex items-center justify-between min-[1100px]:py-5">
              <p className="text-xs font-black leading-6 text-ink min-[1100px]:text-base min-[1100px]:leading-[30px]">
                Total
              </p>
              <p className="text-xs font-black leading-[30px] text-ink min-[1100px]:text-base">
                {naira(total)}
              </p>
            </div>
            {action ? (
              <button
                type={action.form ? "submit" : "button"}
                form={action.form}
                disabled={!action.enabled}
                onClick={action.onClick}
                className={actionButton}
              >
                {action.mobileLabel ? (
                  <>
                    <span className="min-[1100px]:hidden">{action.mobileLabel}</span>
                    <span className="hidden min-[1100px]:inline">{action.label}</span>
                  </>
                ) : (
                  action.label
                )}
              </button>
            ) : null}
          </div>
        )}
      </div>
    </aside>
  );
}
