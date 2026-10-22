"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { naira } from "@/lib/tickets";

type CatalogTier = {
  id: string;
  name: string;
  description: string;
  price: number;
  remaining: number;
};

type Catalog = {
  id: string;
  title: string;
  soldOut: boolean;
  tiers: CatalogTier[];
};

type Step = "tickets" | "contact" | "payment" | "done";

type Quote = {
  code: string;
  cartKey: string;
  discount: number;
  total: number;
};

type HoldResult = {
  discount: number;
  total: number;
  confirmed: boolean;
};

type Recipient = { name: string; email: string };

type Contact = {
  firstName: string;
  lastName: string;
  email: string;
  confirmEmail: string;
  phone: string;
  separateEmails: boolean;
  recipients: Record<string, Recipient>;
};

/** One slot per ticket, keyed by tier and index, so entries survive quantity changes. */
type RecipientSlot = { key: string; tierId: string; tierName: string; index: number; count: number };

type RecipientErrors = Record<string, Partial<Recipient>>;

const emptyContact: Contact = {
  firstName: "",
  lastName: "",
  email: "",
  confirmEmail: "",
  phone: "",
  separateEmails: false,
  recipients: {},
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
  "flex h-[52px] w-full items-center justify-center rounded-lg text-base font-semibold text-white enabled:bg-[#3F3F3F] enabled:hover:bg-[#2c2c2c] disabled:bg-[#CECECE] min-[1100px]:h-auto min-[1100px]:py-4 min-[1100px]:leading-5 min-[1100px]:font-normal min-[1100px]:enabled:bg-brand min-[1100px]:enabled:hover:bg-[#e4572c] min-[1100px]:disabled:bg-[#ECECED] min-[1100px]:disabled:text-[#61646C] min-[1100px]:disabled:opacity-75";

const stepTitle =
  "text-xl font-bold leading-8 text-ink min-[1100px]:text-2xl min-[1100px]:font-black";

export function CheckoutFlow() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("tickets");
  const [catalog, setCatalog] = useState<Catalog | null>(null);
  const [catalogError, setCatalogError] = useState("");
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [contact, setContact] = useState<Contact>(emptyContact);
  const [showErrors, setShowErrors] = useState(false);
  const [holdError, setHoldError] = useState("");
  const [payError, setPayError] = useState("");
  const [redirecting, setRedirecting] = useState(false);
  const [pending, setPending] = useState(false);
  const [code, setCode] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [codeError, setCodeError] = useState("");
  const [codePending, setCodePending] = useState(false);
  const [orderComplete, setOrderComplete] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [eventUpdates, setEventUpdates] = useState(false);
  const [nearbyEvents, setNearbyEvents] = useState(false);
  const [secondsLeft, setSecondsLeft] = useState(10 * 60);
  const [timerOn, setTimerOn] = useState(false);
  const idempotencyKey = useRef("");

  useEffect(() => {
    const existing = sessionStorage.getItem("cirqoo-hold-key");
    const key = existing ?? crypto.randomUUID();
    if (!existing) sessionStorage.setItem("cirqoo-hold-key", key);
    idempotencyKey.current = key;
    let cancel = false;
    api<{ event: Catalog | null }>("/api/public/catalog")
      .then((payload) => {
        if (cancel) return;
        setCatalog(payload.event);
        setQuantities((current) => {
          const next = { ...current };
          for (const tier of payload.event?.tiers ?? []) {
            if (next[tier.id] === undefined) next[tier.id] = 0;
          }
          return next;
        });
      })
      .catch((error: unknown) => {
        if (!cancel) setCatalogError(error instanceof Error ? error.message : "Tickets did not load.");
      });
    return () => {
      cancel = true;
    };
  }, []);

  useEffect(() => {
    if (!timerOn) return;
    const id = window.setInterval(() => {
      setSecondsLeft((current) => (current > 0 ? current - 1 : 0));
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerOn]);

  const tiers = catalog?.tiers ?? [];
  const lines = tiers.flatMap((ticket) => {
    const quantity = quantities[ticket.id] ?? 0;
    if (quantity < 1) return [];
    return [{ ...ticket, quantity, total: ticket.price * quantity }];
  });
  const ticketTotal = lines.reduce((sum, line) => sum + line.total, 0);
  const ticketCount = lines.reduce((sum, line) => sum + line.quantity, 0);
  const cartKey = lines.map((line) => `${line.id}:${line.quantity}`).join("|");
  const applied = quote && quote.cartKey === cartKey ? quote : null;
  const total = applied ? applied.total : ticketTotal;
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
  const recipientSlots: RecipientSlot[] = lines.flatMap((line) =>
    Array.from({ length: line.quantity }, (_, index) => ({
      key: `${line.id}:${index}`,
      tierId: line.id,
      tierName: line.name,
      index,
      count: line.quantity,
    })),
  );
  const recipientErrors: RecipientErrors = {};
  if (contact.separateEmails) {
    for (const slot of recipientSlots) {
      const entry = contact.recipients[slot.key] ?? { name: "", email: "" };
      const slotErrors: Partial<Recipient> = {};
      if (!entry.name.trim()) slotErrors.name = "Enter the recipient's name.";
      if (!validEmail(entry.email.trim())) slotErrors.email = "Enter a valid email address.";
      if (Object.keys(slotErrors).length > 0) recipientErrors[slot.key] = slotErrors;
    }
  }
  const contactReady = Object.keys(contactErrors).length === 0 && Object.keys(recipientErrors).length === 0;

  function rotateKey() {
    const key = crypto.randomUUID();
    sessionStorage.setItem("cirqoo-hold-key", key);
    idempotencyKey.current = key;
  }

  async function requestQuote(raw: string) {
    const typed = raw.trim().toUpperCase();
    const result = await api<{ discount: number; total: number }>("/api/checkout/discount", {
      method: "POST",
      body: JSON.stringify({
        code: typed,
        lines: lines.map((line) => ({ tierId: line.id, quantity: line.quantity })),
      }),
    });
    const next = { code: typed, cartKey, discount: result.discount, total: result.total };
    setQuote(next);
    return next;
  }

  async function goToContact() {
    if (ticketCount < 1 || catalog?.soldOut || codePending) return;
    const typed = code.trim().toUpperCase();
    if (typed && applied?.code !== typed) {
      setCodePending(true);
      setCodeError("");
      try {
        await requestQuote(typed);
      } catch (error) {
        setQuote(null);
        setCodeError(error instanceof Error ? error.message : "That code cannot be used.");
        return;
      } finally {
        setCodePending(false);
      }
    } else if (!typed) {
      setQuote(null);
      setCodeError("");
    }
    setTimerOn(true);
    setSecondsLeft(10 * 60);
    setStep("contact");
  }

  async function applyCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (ticketCount < 1 || codePending) return;
    setCodePending(true);
    setCodeError("");
    try {
      await requestQuote(code);
    } catch (error) {
      setQuote(null);
      setCodeError(error instanceof Error ? error.message : "That code cannot be used.");
    } finally {
      setCodePending(false);
    }
  }

  async function submitContact(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowErrors(true);
    if (!contactReady || expired || pending || !idempotencyKey.current) return;
    setPending(true);
    setHoldError("");
    try {
      const result = await api<HoldResult>("/api/checkout/hold", {
        method: "POST",
        body: JSON.stringify({
          idempotencyKey: idempotencyKey.current,
          lines: lines.map((line) => ({ tierId: line.id, quantity: line.quantity })),
          code: applied?.code ?? "",
          contact: {
            firstName: contact.firstName.trim(),
            lastName: contact.lastName.trim(),
            email: contact.email.trim(),
            phone: contact.phone,
          },
          recipients: contact.separateEmails
            ? recipientSlots.map((slot) => ({
                tierId: slot.tierId,
                name: contact.recipients[slot.key]?.name.trim() ?? "",
                email: contact.recipients[slot.key]?.email.trim() ?? "",
              }))
            : [],
        }),
      });
      if (result.total === 0 && result.confirmed) {
        setTimerOn(false);
        setOrderComplete(true);
        setStep("done");
      } else if (result.confirmed || result.total === 0) {
        setHoldError("Those tickets could not be reserved.");
      } else {
        setQuote({
          code: applied?.code ?? "",
          cartKey,
          discount: result.discount,
          total: result.total,
        });
        setOrderComplete(false);
        setSecondsLeft(10 * 60);
        setTimerOn(true);
        setStep("payment");
      }
    } catch (holdFailure) {
      const text = holdFailure instanceof Error ? holdFailure.message : "Those tickets could not be reserved.";
      setHoldError(text);
      if (text.includes("expired") || text.includes("Start again")) rotateKey();
    } finally {
      setPending(false);
    }
  }

  async function finishCheckout() {
    if (!acceptTerms || expired || pending) return;
    setPending(true);
    setPayError("");
    if (eventUpdates || nearbyEvents) {
      try {
        await api("/api/leads", {
          method: "POST",
          body: JSON.stringify({ email: contact.email.trim(), source: "checkout" }),
        });
      } catch {
        // The reservation still stands if the mailing list does not save.
      }
    }
    try {
      const { url } = await api<{ url: string }>("/api/checkout/pay", { method: "POST" });
      setRedirecting(true);
      window.location.assign(url);
    } catch (payFailure) {
      const text = payFailure instanceof Error ? payFailure.message : "Payment could not be started.";
      setPayError(text);
      if (text.includes("expired") || text.includes("Start again")) rotateKey();
      setPending(false);
    }
  }

  async function goBack() {
    if (step === "payment") {
      setPending(true);
      try {
        await api("/api/checkout/hold", { method: "DELETE" });
      } catch {
        // The hold expires on its own if the release does not land.
      } finally {
        setPending(false);
      }
      rotateKey();
      setTimerOn(false);
      setSecondsLeft(10 * 60);
      setStep("contact");
      return;
    }
    if (step === "contact") setStep("tickets");
    else router.push("/");
  }

  const activeIndex = orderComplete ? 1 : step === "done" ? 2 : stepOrder.indexOf(step);

  return (
    <div className="min-h-full bg-white text-ink">
      <header className="flex items-center justify-between px-5 pt-6 min-[1100px]:px-[72px] min-[1100px]:pt-12 min-[1100px]:pb-10">
        <p className="text-base leading-8 text-ink min-[1100px]:text-xl">Checkout</p>
        <Link href="/" aria-label="Close checkout" className="opacity-70">
          <Image
            src="/close.svg"
            alt=""
            width={32}
            height={32}
            className="size-3.5 min-[1100px]:size-8"
          />
        </Link>
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
                    className={`flex shrink-0 items-center gap-1.5 text-sm font-normal whitespace-nowrap text-[#61646C] min-[1100px]:gap-2 min-[1100px]:text-base min-[1100px]:font-black min-[1100px]:tracking-[0.02em] ${reached ? "" : "opacity-50"}`}
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

          {catalogError ? (
            <p role="alert" className="text-sm font-bold text-brand">
              {catalogError}
            </p>
          ) : null}
          {step === "tickets" ? (
            <TicketStep
              tiers={tiers}
              loading={catalog === null && !catalogError}
              quantities={quantities}
              onChange={(id, quantity) =>
                setQuantities((current) => ({ ...current, [id]: quantity }))
              }
              onBack={() => void goBack()}
            />
          ) : null}

          {step === "contact" ? (
            <ContactStep
              contact={contact}
              errors={showErrors ? contactErrors : {}}
              recipientSlots={recipientSlots}
              recipientErrors={showErrors ? recipientErrors : {}}
              onRecipient={(key, patch) =>
                setContact((current) => ({
                  ...current,
                  recipients: {
                    ...current.recipients,
                    [key]: { ...(current.recipients[key] ?? { name: "", email: "" }), ...patch },
                  },
                }))
              }
              formError={holdError}
              secondsLeft={secondsLeft}
              expired={expired}
              onChange={(patch) => setContact((current) => ({ ...current, ...patch }))}
              onSubmit={(event) => void submitContact(event)}
              onBack={() => void goBack()}
            />
          ) : null}

          {step === "payment" ? (
            <PaymentStep
              secondsLeft={secondsLeft}
              expired={expired}
              formError={payError}
              acceptTerms={acceptTerms}
              eventUpdates={eventUpdates}
              nearbyEvents={nearbyEvents}
              onAcceptTerms={setAcceptTerms}
              onEventUpdates={setEventUpdates}
              onNearbyEvents={setNearbyEvents}
              onBack={() => void goBack()}
            />
          ) : null}

          {step === "done" ? (
            <div className="flex flex-col gap-6">
              <h1 className={stepTitle}>You&apos;re in</h1>
              <p className="max-w-xl text-sm leading-6 text-[#61646C] min-[1100px]:text-base">
                Your tickets are confirmed. We emailed them to {contact.email.trim()}.
              </p>
              <Link
                href="/"
                className="flex h-[52px] w-full items-center justify-center rounded-lg bg-[#3F3F3F] text-base font-semibold text-white hover:bg-[#2c2c2c] min-[1100px]:h-auto min-[1100px]:w-fit min-[1100px]:bg-brand min-[1100px]:px-6 min-[1100px]:py-4 min-[1100px]:font-normal min-[1100px]:hover:bg-[#e4572c]"
              >
                Back to the event
              </Link>
            </div>
          ) : null}
        </section>

        <Summary
          eventTitle={catalog?.title ?? "Cirqoo After Hours - Karaoke & Games"}
          lines={lines}
          discount={applied?.discount ?? 0}
          total={total}
          showCode={step === "tickets"}
          code={code}
          codeError={codeError}
          codePending={codePending}
          appliedCode={applied?.code ?? ""}
          codeStale={quote !== null && quote.cartKey !== cartKey}
          onCode={setCode}
          onApplyCode={(event) => void applyCode(event)}
          action={
            step === "tickets" && ticketCount > 0
              ? {
                  label: codePending ? "Checking…" : "Continue",
                  enabled: !codePending,
                  onClick: () => void goToContact(),
                }
              : step === "contact"
                ? {
                    label: "Continue",
                    enabled: contactReady && !expired && !pending,
                    form: "contact-form",
                  }
                : step === "payment"
                  ? {
                      label: redirecting ? "Opening Paystack…" : pending ? "Please wait…" : "Pay now",
                      enabled: acceptTerms && !expired && !pending,
                      onClick: () => void finishCheckout(),
                    }
                  : undefined
          }
        />
      </main>
    </div>
  );
}

function TicketFace({ name, price }: { name: string; price: number }) {
  return (
    <div className="relative aspect-[567/232] w-full overflow-hidden rounded-[10px] bg-white shadow-[0_12px_28px_rgba(31,36,47,0.16)] min-[1100px]:w-1/2">
      <Image
        src="/ticket-card/face.png"
        alt=""
        fill
        sizes="(min-width: 1100px) 360px, 100vw"
        className="object-cover object-left"
      />
      <div className="absolute inset-y-0 right-0 flex w-[37.7%] flex-col items-center justify-center bg-white px-2 text-center">
        <p className="text-sm leading-tight font-extrabold text-black">
          {name}
        </p>
        <p className="mt-1 text-sm leading-tight font-bold text-black">
          {naira(price)}
        </p>
      </div>
      <span
        aria-hidden="true"
        className="absolute top-1/2 right-0 aspect-square w-[6.35%] translate-x-1/2 -translate-y-1/2 rounded-full bg-[#444444]"
      />
    </div>
  );
}

function TicketListSkeleton() {
  return (
    <div aria-busy="true" className="flex flex-col">
      <span className="sr-only">Loading tickets</span>
      {[0, 1].map((index) => (
        <div
          key={index}
          className={`flex items-start justify-between gap-3 pb-7 min-[1100px]:gap-6 min-[1100px]:pb-8 ${
            index > 0 ? "border-t border-[#E4E5E7] pt-7 min-[1100px]:pt-8" : ""
          }`}
        >
          <div className="flex min-w-0 flex-1 flex-col gap-2">
            <div className="h-6 w-40 animate-pulse rounded bg-black/10 motion-reduce:animate-none min-[1100px]:h-[30px] min-[1100px]:w-52" />
            <div className="h-6 w-24 animate-pulse rounded bg-black/10 motion-reduce:animate-none min-[1100px]:mt-2 min-[1100px]:h-[30px] min-[1100px]:w-28" />
            <div className="mt-1 h-[22px] w-full max-w-md animate-pulse rounded bg-black/10 motion-reduce:animate-none" />
          </div>
          <div className="h-[46px] w-[92px] shrink-0 animate-pulse rounded-lg bg-black/10 motion-reduce:animate-none min-[1100px]:h-11 min-[1100px]:w-16" />
        </div>
      ))}
    </div>
  );
}

function TicketStep({
  tiers,
  loading,
  quantities,
  onChange,
  onBack,
}: {
  tiers: CatalogTier[];
  loading: boolean;
  quantities: Record<string, number>;
  onChange: (id: string, quantity: number) => void;
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
      <div className="flex flex-col min-[1100px]:pt-2.5">
        {loading ? (
          <TicketListSkeleton />
        ) : tiers.length === 0 ? (
          <p className="text-sm text-muted">Tickets are not on sale right now.</p>
        ) : null}
        {tiers.map((ticket, index) => {
          const selected = (quantities[ticket.id] ?? 0) > 0;
          return (
            <article
              key={ticket.id}
              className={`flex flex-col pb-7 min-[1100px]:pb-8 ${
                index > 0 ? "border-t border-[#E4E5E7] pt-7 min-[1100px]:pt-8" : ""
              }`}
            >
            <div
              aria-hidden={!selected}
              className={`grid transition-[grid-template-rows,opacity] duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                selected ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0"
              }`}
            >
              <div className="overflow-hidden">
                <div
                  className={`origin-top px-1 pt-1 pb-5 transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] motion-reduce:transition-none ${
                    selected ? "translate-y-0 scale-100" : "-translate-y-4 scale-[0.98]"
                  }`}
                >
                  <TicketFace name={ticket.name} price={ticket.price} />
                </div>
              </div>
            </div>
            <div className="flex items-start justify-between gap-3 min-[1100px]:gap-6">
              <div className="min-w-0">
                <h2 className="text-base font-bold leading-6 text-ink min-[1100px]:text-lg min-[1100px]:font-black min-[1100px]:leading-[30px] min-[1100px]:tracking-[0.02em]">
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
                    value={quantities[ticket.id] ?? 0}
                    onChange={(event) =>
                      onChange(ticket.id, Number(event.target.value))
                    }
                    className="h-[46px] w-full appearance-none rounded-lg border border-[#ECECED] bg-white pr-8 pl-4 text-[16px] font-extrabold text-black min-[1100px]:h-auto min-[1100px]:w-auto min-[1100px]:py-2.5 min-[1100px]:pr-10 min-[1100px]:pl-3"
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
                  <p className="text-right text-sm text-[#61646C] min-[1100px]:text-sm min-[1100px]:leading-[18px]">
                    1 ticket left
                  </p>
                ) : null}
              </div>
            </div>
            <p className="mt-3 text-sm leading-[22px] text-[#61646C] min-[1100px]:hidden">
              {ticket.description}
            </p>
            </article>
          );
        })}
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
    <p className="rounded-lg bg-[#FFEFEA] p-4 text-sm leading-6 text-[#61646C] min-[1100px]:text-base">
      {expired ? (
        "This reservation has expired. Go back and choose your tickets again."
      ) : (
        <>
          We are reserving this ticket for you. Complete your checkout within{" "}
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
      <label htmlFor={id} className="text-sm leading-[21px] text-[#111827] min-[1100px]:text-sm">
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
        className="h-12 rounded-lg border border-[#CECFD2] px-4 text-[16px] text-black outline-none placeholder:text-muted focus:border-brand min-[1100px]:px-5 min-[1100px]:text-base"
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
  recipientSlots,
  recipientErrors,
  onRecipient,
  formError,
  secondsLeft,
  expired,
  onChange,
  onSubmit,
  onBack,
}: {
  contact: Contact;
  errors: Partial<Record<keyof Contact, string>>;
  recipientSlots: RecipientSlot[];
  recipientErrors: RecipientErrors;
  onRecipient: (key: string, patch: Partial<Recipient>) => void;
  formError: string;
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
      {formError ? (
        <p role="alert" className="text-sm font-bold text-brand">
          {formError}
        </p>
      ) : null}
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
            <label htmlFor="phone" className="text-sm leading-[21px] text-[#111827] min-[1100px]:text-sm">
              <span className="text-brand">*</span> Phone number
            </label>
            <div className="flex gap-2">
              <span className="flex h-12 w-[100px] shrink-0 items-center justify-between rounded-lg border border-[#CECFD2] px-3.5 text-[16px] text-black min-[1100px]:w-auto min-[1100px]:justify-start min-[1100px]:gap-3 min-[1100px]:text-[#111827]">
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
                className="h-12 min-w-0 flex-1 rounded-lg border border-[#CECFD2] px-4 text-[16px] text-black outline-none placeholder:text-muted focus:border-brand min-[1100px]:px-5 min-[1100px]:text-base"
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
          <h2 className="text-base font-bold leading-6 text-ink min-[1100px]:text-lg min-[1100px]:font-black min-[1100px]:leading-[30px] min-[1100px]:text-black">
            Send ticket to different email addresses?
          </h2>
          <div className="flex items-start gap-3 rounded-lg border border-line p-4 text-sm leading-6 text-[#61646C] min-[1100px]:relative min-[1100px]:block min-[1100px]:py-3 min-[1100px]:pl-12 min-[1100px]:text-base">
            <Image
              src="/info.svg"
              alt=""
              width={20}
              height={20}
              className="mt-0.5 size-4 shrink-0 min-[1100px]:absolute min-[1100px]:top-3.5 min-[1100px]:left-5 min-[1100px]:size-5"
            />
            {contact.separateEmails
              ? "Each ticket goes straight to the person named below. You will still get the receipt and order summary."
              : "All tickets will be sent to the email address you entered above."}
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
          {contact.separateEmails ? (
            <div className="flex flex-col gap-6">
              {recipientSlots.map((slot) => {
                const entry = contact.recipients[slot.key] ?? { name: "", email: "" };
                const slotErrors = recipientErrors[slot.key] ?? {};
                return (
                  <fieldset key={slot.key} className="flex flex-col gap-4 rounded-lg border border-line p-4">
                    <legend className="px-1 text-sm font-bold text-ink min-[1100px]:text-base">
                      {slot.tierName}
                      {slot.count > 1 ? ` · Ticket ${slot.index + 1} of ${slot.count}` : ""}
                    </legend>
                    <div className="flex flex-col gap-4 min-[1100px]:flex-row">
                      <div className="flex-1">
                        <Field
                          id={`recipient-name-${slot.key}`}
                          label="Recipient name"
                          autoComplete="off"
                          value={entry.name}
                          error={slotErrors.name}
                          onChange={(name) => onRecipient(slot.key, { name })}
                        />
                      </div>
                      <div className="flex-1">
                        <Field
                          id={`recipient-email-${slot.key}`}
                          label="Recipient email"
                          type="email"
                          autoComplete="off"
                          value={entry.email}
                          error={slotErrors.email}
                          onChange={(email) => onRecipient(slot.key, { email })}
                        />
                      </div>
                    </div>
                  </fieldset>
                );
              })}
            </div>
          ) : null}
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
    <label className="flex items-center gap-2 text-sm font-medium text-black min-[1100px]:text-base min-[1100px]:leading-6 min-[1100px]:text-[#111827]">
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
    <label className="flex items-start gap-4 text-sm leading-[22px] text-[#111827] min-[1100px]:text-base">
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
  formError,
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
  formError: string;
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
      {formError ? (
        <p role="alert" className="text-sm font-bold text-brand">
          {formError}
        </p>
      ) : null}
      <div className="border-b border-line pb-8 min-[1100px]:pb-14">
        <div className="flex gap-4">
          <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-brand">
            <Image src="/radio-check.svg" alt="" width={16} height={16} />
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            <div className="flex flex-col items-start gap-3 min-[1100px]:flex-row min-[1100px]:items-center min-[1100px]:justify-between">
              <p className="text-base leading-6 text-ink min-[1100px]:text-[#111827]">
                Pay with Card or Bank
              </p>
              <Image
                src="/paystack-56586a.png"
                alt="Paystack"
                width={114}
                height={20}
                className="h-5 w-[114px] shrink-0 object-contain"
              />
            </div>
            <p className="text-sm leading-[22px] text-[#61646C] min-[1100px]:text-base min-[1100px]:leading-[21px]">
              Pay with Mastercard, Visa, or Verve or with bank transfer.
            </p>
            <p className="rounded-lg bg-[#FAFAFA] p-4 text-sm leading-[22px] text-[#61646C] min-[1100px]:text-sm min-[1100px]:leading-[21px]">
              You will be taken to Paystack&apos;s secure page to pay, then brought
              back here. Your tickets are emailed as soon as the payment clears.
            </p>
          </div>
        </div>
      </div>
      <p className="rounded-lg bg-line p-4 text-sm leading-6 text-[#61646C] min-[1100px]:text-base min-[1100px]:leading-[22px]">
        You must accept the Cirqoo Terms and Conditions, Refund Policy and Privacy
        Policy before completing this purchase.
      </p>
      <div className="flex flex-col gap-3.5 min-[1100px]:gap-6 min-[1100px]:pb-6">
        <CheckRow checked={acceptTerms} onChange={onAcceptTerms}>
          I accept the{" "}
          <a href="https://www.instagram.com/cirqoo?vrfl=YmoxMjFhajhucG1h" className="text-brand">
            Cirqoo Terms and Conditions
          </a>
          {/* ,{" "}
          <a href="https://tix.africa" className="text-brand">
            Refund Policy
          </a>{" "}
          and{" "}
          <a href="https://tix.africa" className="text-brand">
            Privacy Policy
          </a> */}
          .
        </CheckRow>
        <CheckRow checked={eventUpdates} onChange={onEventUpdates}>
          Keep me updated on future events from{" "}
          <span className="text-brand">CIRQOO</span>.
        </CheckRow>
        <CheckRow checked={nearbyEvents} onChange={onNearbyEvents}>
          Send me emails about the best events happening nearby or online.
        </CheckRow>
      </div>
    </div>
  );
}

function Summary({
  eventTitle,
  lines,
  discount,
  total,
  showCode,
  code,
  codeError,
  codePending,
  appliedCode,
  codeStale,
  onCode,
  onApplyCode,
  action,
}: {
  eventTitle: string;
  lines: Array<{ id: string; name: string; quantity: number; total: number }>;
  discount: number;
  total: number;
  showCode: boolean;
  code: string;
  codeError: string;
  codePending: boolean;
  appliedCode: string;
  codeStale: boolean;
  onCode: (value: string) => void;
  onApplyCode: (event: FormEvent<HTMLFormElement>) => void;
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
      <h2 className="text-xl font-bold leading-8 text-ink min-[1100px]:text-2xl min-[1100px]:font-black">
        Summary
      </h2>
      <div className="flex flex-col gap-6 rounded-2xl border border-line p-5 min-[1100px]:block min-[1100px]:p-6">
        <p className="text-center text-lg font-bold leading-7 text-ink min-[1100px]:text-xl min-[1100px]:font-black min-[1100px]:text-black">
          {eventTitle}
        </p>
        {lines.length === 0 ? (
          <p className="text-center text-sm leading-6 text-[#85888E] min-[1100px]:mt-10 min-[1100px]:text-base min-[1100px]:leading-[30px]">
            Please, choose a ticket type to continue
          </p>
        ) : (
          <div className="flex flex-col gap-6 min-[1100px]:mt-8 min-[1100px]:gap-0">
            {lines.map((line) => (
              <div key={line.id} className="flex items-start justify-between gap-3 pb-4 min-[1100px]:gap-6 min-[1100px]:pb-5">
                <p className="text-sm leading-6 text-[#85888E] min-[1100px]:text-base min-[1100px]:leading-[30px]">
                  {line.quantity} × {line.name}
                </p>
                <p className="text-sm leading-6 text-[#85888E] min-[1100px]:text-base min-[1100px]:leading-[30px]">
                  {naira(line.total)}
                </p>
              </div>
            ))}
            {showCode ? (
              <form onSubmit={onApplyCode} className="flex flex-col gap-2 border-t border-line py-4">
                <label htmlFor="discount-code" className="text-sm leading-[21px] text-[#111827] min-[1100px]:text-sm">
                  Discount code
                </label>
                <div className="flex gap-2">
                  <input
                    id="discount-code"
                    name="discount-code"
                    value={code}
                    autoComplete="off"
                    onChange={(event) => onCode(event.target.value.toUpperCase())}
                    className="h-12 min-w-0 flex-1 rounded-lg border border-[#CECFD2] px-4 text-[16px] text-black outline-none placeholder:text-muted focus:border-brand min-[1100px]:text-base"
                    placeholder="Code"
                  />
                  <button
                    type="submit"
                    disabled={!code.trim() || codePending}
                    className="h-12 shrink-0 rounded-lg bg-[#3F3F3F] px-4 text-base font-semibold text-white enabled:hover:bg-[#2c2c2c] disabled:bg-[#CECECE] min-[1100px]:bg-brand min-[1100px]:enabled:hover:bg-[#e4572c]"
                  >
                    {codePending ? "Checking" : "Apply"}
                  </button>
                </div>
                {codeError ? (
                  <p role="alert" className="text-sm text-brand">
                    {codeError}
                  </p>
                ) : null}
                {appliedCode ? (
                  <p className="text-sm leading-5 text-[#61646C] min-[1100px]:text-sm">{appliedCode} applied.</p>
                ) : null}
                {codeStale ? (
                  <p className="text-sm leading-5 text-[#61646C] min-[1100px]:text-sm">
                    Apply the code again for these tickets.
                  </p>
                ) : null}
              </form>
            ) : appliedCode ? (
              <p className="border-t border-line pt-4 text-sm leading-5 text-[#61646C] min-[1100px]:text-sm">
                {appliedCode} applied.
              </p>
            ) : null}
            {discount > 0 ? (
              <div className="flex items-center justify-between border-t border-line py-4 min-[1100px]:pt-5">
                <p className="text-sm leading-6 text-[#85888E] min-[1100px]:text-base min-[1100px]:leading-[30px]">
                  Discount
                </p>
                <p className="text-sm leading-[30px] text-[#85888E] min-[1100px]:text-base">
                  -{naira(discount)}
                </p>
              </div>
            ) : null}
            <div className="flex items-center justify-between border-t border-line min-[1100px]:py-5">
              <p className="text-base font-black leading-6 text-ink min-[1100px]:leading-[30px]">
                Total
              </p>
              <p className="text-base font-black leading-[30px] text-ink">
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
