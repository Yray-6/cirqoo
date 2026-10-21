import "server-only";

import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { getSql } from "@/server/db";
import { appOrigin, paystackSecretKey } from "@/server/env";
import { HttpError, isRecord } from "@/server/http";
import {
  deliverPaidOrder,
  extendHold,
  finalizePaidOrder,
  reportPaymentProblem,
  type HoldLine,
  type PaymentRecord,
} from "@/server/inventory";
import { asDate } from "@/server/time";

const apiBase = "https://api.paystack.co";
const payWindowMinutes = 15;

function secret() {
  const key = paystackSecretKey();
  if (!key) throw new HttpError(503, "Payments are not configured.");
  return key;
}

async function paystack<T>(path: string, init?: { method?: string; body?: unknown }) {
  const key = secret();
  let response: Response;
  try {
    response = await fetch(`${apiBase}${path}`, {
      method: init?.method ?? "GET",
      headers: {
        authorization: `Bearer ${key}`,
        "content-type": "application/json",
      },
      body: init?.body === undefined ? undefined : JSON.stringify(init.body),
      cache: "no-store",
    });
  } catch {
    throw new HttpError(502, "Paystack could not be reached.");
  }
  const payload = (await response.json().catch(() => null)) as unknown;
  if (!isRecord(payload) || payload.status !== true || !isRecord(payload.data)) {
    const message = isRecord(payload) && typeof payload.message === "string" ? payload.message : "";
    console.error(`paystack ${path} failed: ${response.status} ${message}`);
    throw new HttpError(502, "Paystack rejected the request.");
  }
  return payload.data as T;
}

export async function initializePayment(orderId: string) {
  secret();
  const sql = getSql();
  const rows = await sql<
    { id: string; status: string; held_until: Date | null; email: string; total_kobo: number }[]
  >`SELECT id, status, held_until, email, total_kobo FROM orders WHERE id = ${orderId}`;
  const order = rows[0];
  if (!order) throw new HttpError(404, "Order not found.");
  if (order.status === "confirmed") throw new HttpError(409, "This order is already paid.");
  const heldUntil = asDate(order.held_until);
  if (order.status !== "held" || !heldUntil || heldUntil.getTime() <= Date.now()) {
    throw new HttpError(409, "This reservation expired. Start again.");
  }
  if (order.total_kobo <= 0) throw new HttpError(409, "There is nothing to pay for this order.");

  const lines = await sql<{ tier_id: string; quantity: number }[]>`
    SELECT tier_id, COUNT(*)::int AS quantity
    FROM tickets
    WHERE order_id = ${orderId} AND status = 'held'
    GROUP BY tier_id
  `;
  if (lines.length === 0) throw new HttpError(409, "This reservation expired. Start again.");

  const reference = `CRQ-${randomUUID().replaceAll("-", "")}`;
  await extendHold(orderId, payWindowMinutes);
  const data = await paystack<{ authorization_url: string; reference: string }>("/transaction/initialize", {
    method: "POST",
    body: {
      email: order.email,
      amount: order.total_kobo,
      currency: "NGN",
      reference,
      callback_url: `${appOrigin()}/checkout/callback`,
      metadata: {
        orderId,
        lines: lines.map((line) => ({ tierId: line.tier_id, quantity: line.quantity })),
        cancel_action: `${appOrigin()}/checkout`,
      },
    },
  });
  if (!data.authorization_url) throw new HttpError(502, "Paystack rejected the request.");
  await sql`UPDATE orders SET payment_reference = ${reference} WHERE id = ${orderId}`;
  return { url: data.authorization_url, reference };
}

export type VerifiedTransaction = {
  reference: string;
  status: string;
  amountKobo: number;
  currency: string;
  channel: string;
  paidAt: Date;
  orderId: string;
  lines: HoldLine[];
};

function readMetadata(raw: unknown): { orderId: string; lines: HoldLine[] } {
  let value = raw;
  if (typeof value === "string") {
    try {
      value = JSON.parse(value) as unknown;
    } catch {
      value = null;
    }
  }
  if (!isRecord(value)) return { orderId: "", lines: [] };
  const orderId = typeof value.orderId === "string" ? value.orderId : "";
  const lines: HoldLine[] = Array.isArray(value.lines)
    ? value.lines.flatMap((line) => {
        if (!isRecord(line) || typeof line.tierId !== "string") return [];
        const quantity = Number(line.quantity);
        if (!Number.isInteger(quantity) || quantity < 1) return [];
        return [{ tierId: line.tierId, quantity }];
      })
    : [];
  return { orderId, lines };
}

export async function verifyTransaction(reference: string): Promise<VerifiedTransaction> {
  if (!/^[A-Za-z0-9\-.=]{1,100}$/.test(reference)) throw new HttpError(400, "That payment reference is not valid.");
  const data = await paystack<{
    reference?: string;
    status?: string;
    amount?: number;
    currency?: string;
    channel?: string;
    paid_at?: string | null;
    metadata?: unknown;
  }>(`/transaction/verify/${encodeURIComponent(reference)}`);
  const meta = readMetadata(data.metadata);
  return {
    reference: data.reference ?? reference,
    status: typeof data.status === "string" ? data.status : "unknown",
    amountKobo: Number.isSafeInteger(data.amount) ? Number(data.amount) : 0,
    currency: data.currency ?? "",
    channel: data.channel ?? "",
    paidAt: asDate(data.paid_at) ?? new Date(),
    orderId: meta.orderId,
    lines: meta.lines,
  };
}

export function verifyWebhookSignature(rawBody: string, header: string | null) {
  if (!header) return false;
  const expected = createHmac("sha512", secret()).update(rawBody).digest("hex");
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(header, "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}

export type SettleResult =
  | { status: "paid"; orderId: string; email: string; already: boolean; problem: string | null }
  | { status: "pending"; orderId: string | null }
  | { status: "failed"; orderId: string | null; reason: string };

const pendingStatuses = new Set(["pending", "ongoing", "processing", "queued", "send_otp", "send_pin", "open"]);

export async function settlePayment(reference: string): Promise<SettleResult> {
  const sql = getSql();
  const tx = await verifyTransaction(reference);

  let orderId = /^[0-9a-f-]{36}$/i.test(tx.orderId) ? tx.orderId : "";
  if (!orderId) {
    const byReference = await sql<{ id: string }[]>`
      SELECT id FROM orders WHERE payment_reference = ${tx.reference}
    `;
    orderId = byReference[0]?.id ?? "";
  }
  if (!orderId) throw new HttpError(404, "No order matches that payment.");

  const rows = await sql<{ status: string; email: string; total_kobo: number; payment_error: string | null }[]>`
    SELECT status, email, total_kobo, payment_error FROM orders WHERE id = ${orderId}
  `;
  const order = rows[0];
  if (!order) throw new HttpError(404, "Order not found.");
  if (order.status === "confirmed") {
    return { status: "paid", orderId, email: order.email, already: true, problem: null };
  }
  if (order.payment_error) {
    return { status: "paid", orderId, email: order.email, already: true, problem: order.payment_error };
  }

  if (tx.status !== "success") {
    if (pendingStatuses.has(tx.status)) return { status: "pending", orderId };
    return { status: "failed", orderId, reason: tx.status === "abandoned" ? "The payment was not completed." : "The payment did not go through." };
  }
  if (tx.currency !== "NGN" || tx.amountKobo < order.total_kobo) {
    const problem = `Paystack reported ${tx.currency} ${tx.amountKobo} for an order of NGN ${order.total_kobo} kobo. Check reference ${tx.reference}.`;
    await sql`
      UPDATE orders SET payment_error = ${problem}, payment_reference = ${tx.reference}
      WHERE id = ${orderId} AND payment_error IS NULL
    `;
    await reportPaymentProblem(orderId);
    return { status: "failed", orderId, reason: "The amount paid does not match this order. We have been notified." };
  }

  const payment: PaymentRecord = {
    reference: tx.reference,
    amountKobo: tx.amountKobo,
    channel: tx.channel,
    paidAt: tx.paidAt,
  };
  const outcome = await finalizePaidOrder(orderId, payment, tx.lines);
  if (outcome.problem) {
    await reportPaymentProblem(orderId);
    return { status: "paid", orderId, email: order.email, already: false, problem: outcome.problem };
  }
  if (!outcome.already) await deliverPaidOrder(orderId);
  return { status: "paid", orderId, email: order.email, already: outcome.already, problem: null };
}
