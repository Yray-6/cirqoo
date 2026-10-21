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

export type HoldRecipient = { tierId: string; name: string; email: string };

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

function selectionKey(lines: HoldLine[]) {
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(line.tierId, (counts.get(line.tierId) ?? 0) + line.quantity);
  return [...counts.entries()]
    .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
    .map(([tierId, quantity]) => `${tierId}:${quantity}`)
    .join("|");
}

/** Recipients are optional, but when given there must be exactly one per ticket in each tier. */
function validRecipients(lines: HoldLine[], recipients: HoldRecipient[]) {
  if (recipients.length === 0) return;
  const wanted = new Map<string, number>();
  for (const line of lines) wanted.set(line.tierId, (wanted.get(line.tierId) ?? 0) + line.quantity);
  const given = new Map<string, number>();
  for (const recipient of recipients) {
    if (!recipient.name || recipient.name.length > 80 || !recipient.email || recipient.email.length > 200) {
      throw new HttpError(400, "Add a name and email address for every ticket.");
    }
    given.set(recipient.tierId, (given.get(recipient.tierId) ?? 0) + 1);
  }
  for (const [tierId, count] of wanted) {
    if (given.get(tierId) !== count) throw new HttpError(400, "Add a name and email address for every ticket.");
  }
  if (given.size !== wanted.size) throw new HttpError(400, "Add a name and email address for every ticket.");
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
  recipients: HoldRecipient[];
  eventUpdates: boolean;
  nearbyEvents: boolean;
}) {
  const key = input.idempotencyKey.trim();
  if (!/^[0-9a-f-]{36}$/i.test(key)) throw new HttpError(400, "Start checkout again.");
  validLines(input.lines);
  validRecipients(input.lines, input.recipients);
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
          discount_id: string | null;
          discount_kobo: number;
          total_kobo: number;
        }[]
      >`SELECT id, status, held_until, discount_id, discount_kobo, total_kobo FROM orders WHERE idempotency_key = ${key} FOR UPDATE`;
      const row = existing[0];
      if (row?.status === "confirmed") {
        const prior = holdView(row, true);
        if (prior) return prior;
      }
      if (row && !holdView(row, true)) throw new HttpError(409, "This checkout expired. Start again.");

      const event = await publishedEvent(tx);
      const tierRows = await tx<TierRow[]>`
        SELECT id, name, price_kobo, capacity FROM tiers WHERE event_id = ${event.id} ORDER BY sort_order
      `;
      const tiers = new Map(tierRows.map((tier) => [tier.id, tier]));
      const discount = input.code ? await readDiscount(tx, event.id, input.code, true) : null;

      async function takeTickets() {
        const picked: string[] = [];
        let ticketCount = 0;
        let subtotal = 0;
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
          picked.push(...rows.map((ticket) => ticket.id));
          ticketCount += line.quantity;
          subtotal += tier.price_kobo * line.quantity;
        }
        if (ticketCount < 1) throw new HttpError(400, "Choose a ticket to continue.");
        return { picked, subtotal };
      }

      async function writeRecipients(orderId: string) {
        await tx`DELETE FROM order_recipients WHERE order_id = ${orderId}`;
        const positions = new Map<string, number>();
        for (const recipient of input.recipients) {
          const position = positions.get(recipient.tierId) ?? 0;
          positions.set(recipient.tierId, position + 1);
          await tx`
            INSERT INTO order_recipients (id, order_id, tier_id, position, name, email)
            VALUES (${randomUUID()}, ${orderId}, ${recipient.tierId}, ${position}, ${recipient.name}, ${recipient.email})
          `;
        }
      }

      const heldUntil = new Date(Date.now() + holdMs);
      const orderId = row?.id ?? randomUUID();
      let subtotal = 0;
      let picked: string[] | null = null;

      if (row) {
        const heldLines = await tx<{ tier_id: string; quantity: number }[]>`
          SELECT tier_id, COUNT(*)::int AS quantity
          FROM tickets
          WHERE order_id = ${row.id} AND status = 'held'
          GROUP BY tier_id
        `;
        const sameTickets =
          selectionKey(heldLines.map((line) => ({ tierId: line.tier_id, quantity: line.quantity }))) ===
          selectionKey(input.lines);
        const sameDiscount = (row.discount_id ?? null) === (discount?.id ?? null);
        if (sameTickets && sameDiscount) {
          const prior = holdView(row, true);
          if (prior) return prior;
          throw new HttpError(409, "This checkout expired. Start again.");
        }
        if (!sameTickets) {
          await tx`
            UPDATE tickets
            SET status = 'available', held_until = NULL, order_id = NULL
            WHERE order_id = ${row.id} AND status = 'held'
          `;
          const taken = await takeTickets();
          subtotal = taken.subtotal;
          picked = taken.picked;
        } else {
          for (const line of input.lines) {
            const tier = tiers.get(line.tierId);
            if (!tier) throw new HttpError(400, "Choose a ticket that is still on sale.");
            subtotal += tier.price_kobo * line.quantity;
          }
        }
      } else {
        const taken = await takeTickets();
        subtotal = taken.subtotal;
        picked = taken.picked;
      }

      const amounts = priced(subtotal, discount ? applyCut(subtotal, discount) : 0);
      const shown = publicAmounts(amounts.subtotal, amounts.total);
      if (row) {
        await tx`
          UPDATE orders
          SET first_name = ${input.contact.firstName}, last_name = ${input.contact.lastName},
            email = ${input.contact.email}, phone = ${input.contact.phone}, status = ${"held"},
            subtotal_kobo = ${amounts.subtotal}, fees_kobo = ${0}, total_kobo = ${amounts.total},
            discount_id = ${discount?.id ?? null}, discount_kobo = ${amounts.discountKobo},
            held_until = ${heldUntil.toISOString()}
          WHERE id = ${row.id}
        `;
      } else {
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
      }
      if (picked) {
        await tx`
          UPDATE tickets
          SET status = 'held', held_until = ${heldUntil.toISOString()}, order_id = ${orderId}
          WHERE id IN ${tx(picked)}
        `;
      } else {
        await tx`
          UPDATE tickets SET held_until = ${heldUntil.toISOString()}
          WHERE order_id = ${orderId} AND status = 'held'
        `;
      }
      await writeRecipients(orderId);
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
  if (outcome.confirmed && !outcome.replay) await deliverOrder(outcome.orderId);
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

export type PaymentRecord = {
  reference: string;
  amountKobo: number;
  channel: string;
  paidAt: Date;
};

async function finalizeOrder(
  tx: Tx,
  orderId: string,
  discountId: string | null,
  payment: PaymentRecord | null,
) {
  if (discountId) {
    const redeemed = await tx<{ id: string }[]>`
      UPDATE discounts SET used = used + 1
      WHERE id = ${discountId} AND used < usage_limit
      RETURNING id
    `;
    // A paid order is never rejected over a discount; the money has already moved.
    if (!redeemed[0] && !payment) throw new HttpError(409, "No uses left.");
  }
  const soldAt = new Date();
  if (payment) {
    await tx`
      UPDATE orders
      SET status = 'confirmed', confirmed_at = ${soldAt.toISOString()}, held_until = NULL,
        payment_reference = ${payment.reference}, paid_at = ${payment.paidAt.toISOString()},
        paid_kobo = ${payment.amountKobo}, payment_channel = ${payment.channel}, payment_error = NULL
      WHERE id = ${orderId}
    `;
  } else {
    await tx`
      UPDATE orders SET status = 'confirmed', confirmed_at = ${soldAt.toISOString()}, held_until = NULL
      WHERE id = ${orderId}
    `;
  }
  await tx`
    UPDATE tickets SET status = 'sold', held_until = NULL
    WHERE order_id = ${orderId} AND status = 'held'
  `;
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
    await finalizeOrder(tx, orderId, order.discount_id, null);
    return { already: false as const };
  });
  if (!outcome.already) await deliverOrder(orderId);
  return outcome;
}

const releasedAfterPayment = "Paid, but the reserved tickets were released and none are left. Refund or re-issue needed.";

/**
 * Confirms an order that Paystack reports as paid. A lapsed hold timer is not a
 * reason to refuse the money: as long as the tickets are still attached they are
 * sold; if they were already released, the same quantities are re-allocated from
 * what is available, and only when that fails is the problem flagged for an admin.
 */
export async function finalizePaidOrder(orderId: string, payment: PaymentRecord, lines: HoldLine[]) {
  const sql = getSql();
  return sql.begin(async (tx) => {
    const rows = await tx<
      { id: string; status: string; event_id: string; discount_id: string | null }[]
    >`SELECT id, status, event_id, discount_id FROM orders WHERE id = ${orderId} FOR UPDATE`;
    const order = rows[0];
    if (!order) throw new HttpError(404, "Order not found.");
    if (order.status === "confirmed") return { already: true as const, problem: null };

    const held = await tx<{ id: string }[]>`
      SELECT id FROM tickets WHERE order_id = ${orderId} AND status = 'held' FOR UPDATE
    `;
    if (held.length === 0) {
      const picked: string[] = [];
      let short = lines.length === 0;
      for (const line of lines) {
        if (short) break;
        const available = await tx<{ id: string }[]>`
          SELECT id FROM tickets
          WHERE tier_id = ${line.tierId} AND event_id = ${order.event_id} AND status = 'available'
          ORDER BY number
          FOR UPDATE SKIP LOCKED
          LIMIT ${line.quantity}
        `;
        if (available.length < line.quantity) short = true;
        else picked.push(...available.map((row) => row.id));
      }
      if (short) {
        await tx`
          UPDATE orders
          SET status = 'expired', held_until = NULL,
            payment_reference = ${payment.reference}, paid_at = ${payment.paidAt.toISOString()},
            paid_kobo = ${payment.amountKobo}, payment_channel = ${payment.channel},
            payment_error = ${releasedAfterPayment}
          WHERE id = ${orderId}
        `;
        return { already: false as const, problem: releasedAfterPayment };
      }
      await tx`
        UPDATE tickets
        SET status = 'held', order_id = ${orderId}, held_until = now()
        WHERE id IN ${tx(picked)}
      `;
    }
    await finalizeOrder(tx, orderId, order.discount_id, payment);
    return { already: false as const, problem: null };
  });
}

/** Pushes the hold out so a buyer who is already on Paystack's page does not lose the seats mid-payment. */
export async function extendHold(orderId: string, minutes: number) {
  const sql = getSql();
  const until = new Date(Date.now() + minutes * 60 * 1000).toISOString();
  await sql.begin(async (tx) => {
    await tx`
      UPDATE orders SET held_until = ${until}
      WHERE id = ${orderId} AND status = 'held' AND held_until < ${until}
    `;
    await tx`
      UPDATE tickets SET held_until = ${until}
      WHERE order_id = ${orderId} AND status = 'held' AND held_until < ${until}
    `;
  });
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

/** Tickets plus the purchaser's order summary (sent when there is a payment or when tickets went to other people). */
async function deliverOrder(orderId: string) {
  const { sendReceiptEmail } = await import("@/server/mail");
  await deliverTickets(orderId);
  try {
    await sendReceiptEmail(orderId);
  } catch {
    console.error("receipt email failed");
  }
}

/** Tickets, receipt, and the admin notice for a paid order. Only the ticket email is tracked on the order. */
export async function deliverPaidOrder(orderId: string) {
  const { sendAdminOrderNotice } = await import("@/server/mail");
  await deliverOrder(orderId);
  try {
    await sendAdminOrderNotice(orderId);
  } catch {
    console.error("admin notice email failed");
  }
}

/** Tells the admin about a payment that could not be turned into tickets. */
export async function reportPaymentProblem(orderId: string) {
  const { sendAdminOrderNotice } = await import("@/server/mail");
  try {
    await sendAdminOrderNotice(orderId);
  } catch {
    console.error("admin notice email failed");
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
