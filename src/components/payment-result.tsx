"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";

type SettleResult =
  | { status: "paid"; orderId: string; email: string; already: boolean; problem: string | null }
  | { status: "pending"; orderId: string | null }
  | { status: "failed"; orderId: string | null; reason: string };

type View =
  | { kind: "checking" }
  | { kind: "paid"; email: string }
  | { kind: "problem"; message: string }
  | { kind: "pending" }
  | { kind: "failed"; message: string };

const title = "text-xl font-bold leading-8 text-ink min-[1100px]:text-2xl min-[1100px]:font-black";
const copy = "max-w-xl text-sm leading-6 text-[#61646C] min-[1100px]:text-base";
const primary =
  "flex h-[52px] w-full items-center justify-center rounded-lg bg-[#3F3F3F] text-base font-semibold text-white hover:bg-[#2c2c2c] disabled:bg-[#CECECE] min-[1100px]:h-auto min-[1100px]:w-fit min-[1100px]:bg-brand min-[1100px]:px-6 min-[1100px]:py-4 min-[1100px]:font-normal min-[1100px]:hover:bg-[#e4572c]";
const secondary =
  "flex h-[52px] w-full items-center justify-center rounded-lg border border-[#CECFD2] text-base font-semibold text-ink hover:bg-[#FAFAFA] min-[1100px]:h-auto min-[1100px]:w-fit min-[1100px]:px-6 min-[1100px]:py-4 min-[1100px]:font-normal";

async function verify(reference: string): Promise<View> {
  try {
    const result = await api<SettleResult>("/api/checkout/verify", {
      method: "POST",
      body: JSON.stringify({ reference }),
    });
    if (result.status === "paid") {
      sessionStorage.removeItem("cirqoo-hold-key");
      return result.problem ? { kind: "problem", message: result.problem } : { kind: "paid", email: result.email };
    }
    if (result.status === "pending") return { kind: "pending" };
    return { kind: "failed", message: result.reason };
  } catch (error) {
    return { kind: "failed", message: error instanceof Error ? error.message : "The payment could not be checked." };
  }
}

export function PaymentResultShell({
  title: heading,
  body,
  children,
}: {
  title: string;
  body: string;
  children?: ReactNode;
}) {
  return (
    <div className="min-h-full bg-white text-ink">
      <header className="flex items-center justify-between px-5 pt-6 min-[1100px]:px-[72px] min-[1100px]:pt-12 min-[1100px]:pb-10">
        <p className="text-base leading-8 text-ink min-[1100px]:text-xl">Checkout</p>
        <Link href="/" aria-label="Back to the event" className="opacity-70">
          <Image src="/close.svg" alt="" width={32} height={32} className="size-3.5 min-[1100px]:size-8" />
        </Link>
      </header>
      <main className="mt-8 flex flex-col gap-6 px-5 pb-12 min-[1100px]:mt-0 min-[1100px]:max-w-[922px] min-[1100px]:px-[72px] min-[1100px]:pb-24">
        <h1 className={title}>{heading}</h1>
        <p className={copy} aria-live="polite">
          {body}
        </p>
        {children}
      </main>
    </div>
  );
}

export function PaymentResult() {
  const params = useSearchParams();
  const reference = params.get("reference") ?? params.get("trxref") ?? "";
  const [view, setView] = useState<View>(() =>
    reference ? { kind: "checking" } : { kind: "failed", message: "We could not find a payment to check." },
  );
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!reference) return;
    let cancel = false;
    void verify(reference).then((next) => {
      if (!cancel) setView(next);
    });
    return () => {
      cancel = true;
    };
  }, [reference]);

  const check = useCallback(async () => {
    setBusy(true);
    const next = await verify(reference);
    setView(next);
    setBusy(false);
  }, [reference]);

  if (view.kind === "checking") {
    return <PaymentResultShell title="Confirming your payment" body="One moment while we check with Paystack." />;
  }
  if (view.kind === "paid") {
    return (
      <PaymentResultShell title="You're in" body={`Payment received. Your tickets and receipt are on their way to ${view.email}.`}>
        <Link href="/" className={primary}>
          Back to the event
        </Link>
      </PaymentResultShell>
    );
  }
  if (view.kind === "problem") {
    return (
      <PaymentResultShell
        title="Payment received"
        body="Your payment went through, but we hit a snag issuing the tickets. Our team has been notified and will sort it out or refund you. Nothing more to do on your side."
      >
        <Link href="/" className={primary}>
          Back to the event
        </Link>
      </PaymentResultShell>
    );
  }
  if (view.kind === "pending") {
    return (
      <PaymentResultShell
        title="Payment still processing"
        body="Paystack has not confirmed the payment yet. Bank transfers can take a minute. Check again, or wait for the email."
      >
        <div className="flex flex-col gap-3 min-[1100px]:flex-row">
          <button type="button" onClick={() => void check()} disabled={busy} className={primary}>
            {busy ? "Checking…" : "Check again"}
          </button>
          <Link href="/" className={secondary}>
            Back to the event
          </Link>
        </div>
      </PaymentResultShell>
    );
  }
  return (
    <PaymentResultShell title="Payment not completed" body={`${view.message} You have not been charged for these tickets.`}>
      <div className="flex flex-col gap-3 min-[1100px]:flex-row">
        <Link href="/checkout" className={primary}>
          Try again
        </Link>
        <Link href="/" className={secondary}>
          Back to the event
        </Link>
      </div>
    </PaymentResultShell>
  );
}
