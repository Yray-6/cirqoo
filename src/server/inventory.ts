import "server-only";

import { randomUUID } from "node:crypto";
import { HttpError } from "@/server/http";
import { getSql, type Tx } from "@/server/db";
import { koboToNaira, newTicketCode } from "@/server/money";
import { asDate, iso } from "@/server/time";

const holdMs = 10 * 60 * 1000;

type TierRow = {
  id: string;
  name: string;
  price_kobo: number;
  capacity: number;
};

export type HoldLine = { tierId: string; quantity: number };

export type HoldContact = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
};

export type HoldResult = {
  orderId: string;
  heldUntil: string | null;
  discount: number;
  total: number;
  confirmed: boolean;
  replay: boolean;
};

type DiscountRow = {
  id: string;
  event_id: string;
  cut: string;
  percent: number;
  amount_kobo: number;
  usage_limit: number;
  used: number;
};

const unusableCode = "That code cannot be used.";

const holdsByIp = new Map<string, number[]>();

export function assertHoldRate(ip: string) {
  const now = Date.now();
  const recent = (holdsByIp.get(ip) ?? []).filter((time) => now - time < holdMs);
  if (recent.length >= 8) {
    throw new HttpError(429, "Too many reservations. Wait a few minutes.");
  }
  recent.push(now);
  holdsByIp.set(ip, recent);
}

async function publishedEvent(tx: Tx) {
  const published = await tx<{ id: string }[]>`
    SELECT id FROM events WHERE status = 'published' ORDER BY starts_at ASC LIMIT 1
  `;
  const event = published[0];
  if (!event) throw new HttpError(404, "There is no event on sale.");
  return event;
}

function validLines(lines: HoldLine[]) {
  if (lines.length < 1) throw new HttpError(400, "Choose a ticket to continue.");
  for (const line of lines) {
    if (!line.tierId || !Number.isInteger(line.quantity) || line.quantity < 1 || line.quantity > 1000) {
      throw new HttpError(400, "Choose a ticket that is still on sale.");
    }
  }
}

function applyCut(subtotal: number, discount: DiscountRow) {
  let cut = 0;
  if (discount.cut === "percentage") cut = Math.round((subtotal * discount.percent) / 100);
  else if (discount.cut === "fixed") cut = discount.amount_kobo;
  else throw new HttpError(400, unusableCode);
  if (!Number.isSafeInteger(cut) || cut < 0) throw new HttpError(400, unusableCode);
  return Math.min(subtotal, cut);
}

async function readDiscount(tx: Tx, eventId: string, raw: string, lock: boolean) {
  const code = raw.trim().toUpperCase();
  if (!code) return null;
  if (!/^[A-Z0-9-]{4,16}$/.test(code)) throw new HttpError(400, unusableCode);
  const rows = lock
    ? await tx<DiscountRow[]>`
        SELECT id, event_id, cut, percent, amount_kobo, usage_limit, used
        FROM discounts
        WHERE code = ${code}
        FOR UPDATE
      `
    : await tx<DiscountRow[]>`
        SELECT id, event_id, cut, percent, amount_kobo, usage_limit, used
        FROM discounts
        WHERE code = ${code}
      `;
  const discount = rows[0];
  if (!discount || discount.event_id !== eventId) throw new HttpError(400, unusableCode);
  if (discount.used >= discount.usage_limit) throw new HttpError(409, "No uses left.");
  return discount;
}

function publicAmounts(subtotalKobo: number, totalKobo: number) {
  const subtotal = koboToNaira(subtotalKobo);
  const total = totalKobo === 0 ? 0 : Math.max(1, koboToNaira(totalKobo));
  return { subtotal, discount: Math.max(0, subtotal - total), total };
}

function priced(subtotal: number, discountKobo: number) {
  if (!Number.isSafeInteger(subtotal) || subtotal < 0 || subtotal > 2_000_000_000) {
    throw new HttpError(400, "Choose fewer tickets.");
  }
  return { subtotal, discountKobo, total: subtotal - discountKobo };
}

function holdView(
  row: {
    id: string;
    status: string;
    held_until: Date | string | null;
    discount_kobo: number;
    total_kobo: number;
  },
  replay: boolean,
): HoldResult | null {
  const amounts = publicAmounts(row.total_kobo + row.discount_kobo, row.total_kobo);
  if (row.status === "confirmed") {
    return {
      orderId: row.id,
      heldUntil: null,
      discount: amounts.discount,
      total: amounts.total,
      confirmed: true,
      replay,
    };
  }
  const existingHold = asDate(row.held_until);
  if (row.status === "held" && existingHold && existingHold.getTime() > Date.now()) {
    return {
      orderId: row.id,
      heldUntil: existingHold.toISOString(),
      discount: amounts.discount,
      total: amounts.total,
      confirmed: false,
      replay,
    };
  }
  return null;
}

export async function quoteCheckout(input: { code: string; lines: HoldLine[] }) {
  validLines(input.lines);
  const sql = getSql();
  return sql.begin(async (tx) => {
    const event = await publishedEvent(tx);
    const tiers = await tx<{ id: string; price_kobo: number }[]>`
      SELECT id, price_kobo FROM tiers WHERE event_id = ${event.id}
    `;
    const prices = new Map(tiers.map((tier) => [tier.id, tier.price_kobo]));
    let subtotal = 0;
    for (const line of input.lines) {
      const price = prices.get(line.tierId);
      if (price === undefined) throw new HttpError(400, "Choose a ticket that is still on sale.");
      subtotal += price * line.quantity;
    }
    const discount = await readDiscount(tx, event.id, input.code, false);
    if (!discount) throw new HttpError(400, unusableCode);
    const amounts = priced(subtotal, applyCut(subtotal, discount));
    return publicAmounts(amounts.subtotal, amounts.total);
  });
}

export async function releaseExpired(tx: Tx) {
  await tx`
    WITH expired AS (
      UPDATE orders
      SET status = 'expired'
      WHERE status = 'held' AND held_until <= now()
      RETURNING id
    )
    UPDATE tickets
    SET status = 'available', held_until = NULL, order_id = NULL
    WHERE status = 'held' AND order_id IN (SELECT id FROM expired)
  `;
}

export async function holdTickets(input: {
  idempotencyKey: string;
  lines: HoldLine[];
  contact: HoldContact;
  code?: string;
  eventUpdates: boolean;
  nearbyEvents: boolean;
}) {
  const key = input.idempotencyKey.trim();
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new HttpError(400, "Start checkout again.");
  validLines(input.lines);
  const sql = getSql();
  let outcome: HoldResult;
  try {
    outcome = await sql.begin(async (tx) => {
      await releaseExpired(tx);
      const existing = await tx<
        {
          id: string;
          status: string;
          held_until: Date | string | null;
          discount_kobo: number;
          total_kobo: number;
        }[]
      >`SELECT id, status, held_until, discount_kobo, total_kobo FROM orders WHERE idempotency_key = ${key}`;
      const prior = existing[0] ? holdView(existing[0], true) : null;
      if (prior) return prior;
      if (existing[0]) throw new HttpError(409, "This checkout expired. Start again.");

      const event = await publishedEvent(tx);
      const tierRows = await tx<TierRow[]>`
        SELECT id, name, price_kobo, capacity FROM tiers WHERE event_id = ${event.id} ORDER BY sort_order
      `;
      const tiers = new Map(tierRows.map((tier) => [tier.id, tier]));
      let ticketCount = 0;
      let subtotal = 0;
      const picked: string[] = [];

      for (const line of input.lines) {
        const tier = tiers.get(line.tierId);
        if (!tier) throw new HttpError(400, "Choose a ticket that is still on sale.");
        const rows = await tx<{ id: string }[]>`
          SELECT id FROM tickets
          WHERE tier_id = ${tier.id} AND status = 'available'
          ORDER BY number
          FOR UPDATE SKIP LOCKED
          LIMIT ${line.quantity}
        `;
        if (rows.length < line.quantity) {
          throw new HttpError(409, `Only ${rows.length} ${tier.name} tickets are left.`);
        }
        picked.push(...rows.map((row) => row.id));
        ticketCount += line.quantity;
        subtotal += tier.price_kobo * line.quantity;
      }

      if (ticketCount < 1) throw new HttpError(400, "Choose a ticket to continue.");
      const discount = input.code ? await readDiscount(tx, event.id, input.code, true) : null;
      const amounts = priced(subtotal, discount ? applyCut(subtotal, discount) : 0);
      const shown = publicAmounts(amounts.subtotal, amounts.total);
      const heldUntil = new Date(Date.now() + holdMs);
      const orderId = randomUUID();
      await tx`
        INSERT INTO orders (
          id, event_id, first_name, last_name, email, phone, status,
          subtotal_kobo, fees_kobo, total_kobo, discount_id, discount_kobo,
          idempotency_key, held_until
        ) VALUES (
          ${orderId}, ${event.id}, ${input.contact.firstName}, ${input.contact.lastName},
          ${input.contact.email}, ${input.contact.phone}, ${"held"},
          ${amounts.subtotal}, ${0}, ${amounts.total}, ${discount?.id ?? null}, ${amounts.discountKobo},
          ${key}, ${heldUntil.toISOString()}
        )
      `;
      await tx`
        UPDATE tickets
        SET status = 'held', held_until = ${heldUntil.toISOString()}, order_id = ${orderId}
        WHERE id IN ${tx(picked)}
      `;
      if (input.eventUpdates || input.nearbyEvents) {
        await tx`
          INSERT INTO leads (id, email, source)
          VALUES (${randomUUID()}, ${input.contact.email}, ${"checkout"})
          ON CONFLICT (email) DO NOTHING
        `;
      }
      if (amounts.total > 0) {
        return {
          orderId,
          heldUntil: heldUntil.toISOString(),
          discount: shown.discount,
          total: shown.total,
          confirmed: false,
          replay: false,
        };
      }
      if (discount) {
        const redeemed = await tx<{ id: string }[]>`
          UPDATE discounts SET used = used + 1
          WHERE id = ${discount.id} AND used < usage_limit
          RETURNING id
        `;
        if (!redeemed[0]) throw new HttpError(409, "No uses left.");
      }
      const soldAt = new Date();
      await tx`
        UPDATE orders
        SET status = 'confirmed', confirmed_at = ${soldAt.toISOString()}, held_until = NULL
        WHERE id = ${orderId}
      `;
      await tx`
        UPDATE tickets SET status = 'sold', held_until = NULL
        WHERE order_id = ${orderId} AND status = 'held'
      `;
      return {
        orderId,
        heldUntil: null,
        discount: shown.discount,
        total: shown.total,
        confirmed: true,
        replay: false,
      };
    });
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (code !== "23505") throw error;
    const rows = await sql<
      {
        id: string;
        status: string;
        held_until: Date | string | null;
        discount_kobo: number;
        total_kobo: number;
      }[]
    >`SELECT id, status, held_until, discount_kobo, total_kobo FROM orders WHERE idempotency_key = ${key}`;
    const prior = rows[0] ? holdView(rows[0], true) : null;
    if (!prior) throw new HttpError(409, "This checkout expired. Start again.");
    return prior;
  }
  if (outcome.confirmed && !outcome.replay) await deliverTickets(outcome.orderId);
  return outcome;
}

export async function releaseHold(orderId: string) {
  const sql = getSql();
  await sql.begin(async (tx) => {
    const rows = await tx<{ id: string }[]>`
      SELECT id FROM orders WHERE id = ${orderId} AND status = 'held' FOR UPDATE
    `;
    if (!rows[0]) return;
    await tx`UPDATE orders SET status = 'expired' WHERE id = ${orderId}`;
    await tx`
      UPDATE tickets
      SET status = 'available', held_until = NULL, order_id = NULL
      WHERE order_id = ${orderId} AND status = 'held'
    `;
  });
}

export async function confirmOrder(orderId: string) {
  const sql = getSql();
  const outcome = await sql.begin(async (tx) => {
    const rows = await tx<
      { id: string; status: string; held_until: Date | null; email: string; discount_id: string | null }[]
    >`SELECT id, status, held_until, email, discount_id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const order = rows[0];
    if (!order) throw new HttpError(404, "Order not found.");
    if (order.status === "confirmed") return { already: true as const };
    const heldUntil = asDate(order.held_until);
    if (order.status !== "held" || !heldUntil || heldUntil.getTime() <= Date.now()) {
      await tx`UPDATE orders SET status = 'expired' WHERE id = ${orderId} AND status = 'held'`;
      await tx`
        UPDATE tickets
        SET status = 'available', held_until = NULL, order_id = NULL
        WHERE order_id = ${orderId} AND status = 'held'
      `;
      throw new HttpError(409, "This reservation expired.");
    }
    if (order.discount_id) {
      const redeemed = await tx<{ id: string }[]>`
        UPDATE discounts SET used = used + 1
        WHERE id = ${order.discount_id} AND used < usage_limit
        RETURNING id
      `;
      if (!redeemed[0]) throw new HttpError(409, "No uses left.");
    }
    const soldAt = new Date();
    await tx`
      UPDATE orders SET status = 'confirmed', confirmed_at = ${soldAt.toISOString()}, held_until = NULL
      WHERE id = ${orderId}
    `;
    await tx`
      UPDATE tickets SET status = 'sold', held_until = NULL
      WHERE order_id = ${orderId} AND status = 'held'
    `;
    return { already: false as const };
  });
  if (!outcome.already) await deliverTickets(orderId);
  return outcome;
}

export async function resendOrder(orderId: string) {
  const sql = getSql();
  const rows = await sql<{ status: string }[]>`SELECT status FROM orders WHERE id = ${orderId}`;
  if (!rows[0]) throw new HttpError(404, "Order not found.");
  if (rows[0].status !== "confirmed") throw new HttpError(409, "Only a confirmed order can be emailed.");
  await deliverTickets(orderId);
}

async function deliverTickets(orderId: string) {
  const { sendTicketEmail } = await import("@/server/mail");
  const sql = getSql();
  try {
    await sendTicketEmail(orderId);
    await sql`UPDATE orders SET email_error = NULL WHERE id = ${orderId}`;
  } catch {
    console.error("ticket email failed");
    await sql`
      UPDATE orders SET email_error = ${"The ticket email could not be sent."} WHERE id = ${orderId}
    `;
  }
}

export type ScanResponse =
  | { type: "unknown" }
  | { type: "unsold" }
  | { type: "held" }
  | {
      type: "used" | "already";
      buyerName: string;
      number: number;
      tierName: string;
      eventTitle: string;
      scannedAt: string;
    };

export async function scanTicket(raw: string): Promise<ScanResponse> {
  const code = raw.trim().toUpperCase();
  if (!/^CRQ-[A-Z0-9]+$/.test(code)) return { type: "unknown" };
  const sql = getSql();
  return sql.begin(async (tx) => {
    await releaseExpired(tx);
    const updated = await tx<{ id: string }[]>`
      UPDATE tickets
      SET status = 'scanned', scanned_at = now()
      WHERE code = ${code} AND status = 'sold'
      RETURNING id
    `;
    const row = await loadScan(tx, code);
    if (!row) return { type: "unknown" };
    if (updated[0]) {
      return {
        type: "used",
        buyerName: row.buyer_name,
        number: row.number,
        tierName: row.tier_name,
        eventTitle: row.event_title,
        scannedAt: iso(row.scanned_at) ?? new Date().toISOString(),
      };
    }
    if (row.status === "available") return { type: "unsold" };
    if (row.status === "held") return { type: "held" };
    if (row.status === "scanned") {
      return {
        type: "already",
        buyerName: row.buyer_name,
        number: row.number,
        tierName: row.tier_name,
        eventTitle: row.event_title,
        scannedAt: iso(row.scanned_at) ?? new Date().toISOString(),
      };
    }
    return { type: "unsold" };
  });
}

async function loadScan(tx: Tx, code: string) {
  const rows = await tx<
    {
      status: string;
      number: number;
      tier_name: string;
      event_title: string;
      buyer_name: string | null;
      scanned_at: Date | null;
    }[]
  >`
    SELECT tickets.status, tickets.number, tickets.scanned_at,
      tiers.name AS tier_name, events.title AS event_title,
      NULLIF(trim(both ' ' FROM concat(orders.first_name, ' ', orders.last_name)), '') AS buyer_name
    FROM tickets
    JOIN tiers ON tiers.id = tickets.tier_id
    JOIN events ON events.id = tickets.event_id
    LEFT JOIN orders ON orders.id = tickets.order_id
    WHERE tickets.code = ${code}
  `;
  const row = rows[0];
  if (!row) return null;
  return { ...row, buyer_name: row.buyer_name ?? "Guest" };
}

export async function insertTickets(
  tx: Tx,
  eventId: string,
  tierId: string,
  count: number,
  startNumber: number,
) {
  for (let index = 0; index < count; index += 1) {
    let saved = false;
    for (let attempt = 0; attempt < 5 && !saved; attempt += 1) {
      try {
        await tx`
          INSERT INTO tickets (id, event_id, tier_id, number, code, status)
          VALUES (
            ${randomUUID()}, ${eventId}, ${tierId}, ${startNumber + index},
            ${newTicketCode()}, ${"available"}
          )
        `;
        saved = true;
      } catch (error) {
        const details = typeof error === "object" && error ? (error as { code?: string; constraint_name?: string; constraint?: string }) : {};
        const constraint = details.constraint_name ?? details.constraint ?? "";
        if (details.code !== "23505" || !constraint.includes("code") || attempt === 4) throw error;
      }
    }
  }
}
