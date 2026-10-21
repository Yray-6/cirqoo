import "server-only";

import { getSql } from "@/server/db";
import { HttpError } from "@/server/http";
import { asDate } from "@/server/time";

export type MailOrder = {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  phone: string;
  status: string;
  subtotal_kobo: number;
  discount_kobo: number;
  total_kobo: number;
  paid_kobo: number | null;
  paid_at: Date | null;
  payment_channel: string | null;
  payment_reference: string | null;
  payment_error: string | null;
  title: string;
  venue: string;
  starts_at: Date;
  ends_at: Date;
};

export type MailLine = { tier_name: string; quantity: number; price_kobo: number };

export type MailRecipient = { tier_id: string; position: number; name: string; email: string };

export type MailTicket = {
  code: string;
  number: number;
  tier_id: string;
  tier_name: string;
  recipient: { name: string; email: string } | null;
};

/** Each tier's tickets, in number order, are matched to that tier's recipients in position order. */
export async function loadTickets(orderId: string): Promise<MailTicket[]> {
  const sql = getSql();
  const tickets = await sql<{ code: string; number: number; tier_id: string; tier_name: string }[]>`
    SELECT tickets.code, tickets.number, tickets.tier_id, tiers.name AS tier_name
    FROM tickets
    JOIN tiers ON tiers.id = tickets.tier_id
    WHERE tickets.order_id = ${orderId} AND tickets.status IN ('sold', 'scanned')
    ORDER BY tiers.sort_order, tickets.number
  `;
  const recipients = await sql<MailRecipient[]>`
    SELECT tier_id, position, name, email FROM order_recipients
    WHERE order_id = ${orderId}
    ORDER BY tier_id, position
  `;
  const queue = new Map<string, MailRecipient[]>();
  for (const recipient of recipients) {
    const list = queue.get(recipient.tier_id) ?? [];
    list.push(recipient);
    queue.set(recipient.tier_id, list);
  }
  return tickets.map((ticket) => {
    const next = queue.get(ticket.tier_id)?.shift();
    return { ...ticket, recipient: next ? { name: next.name, email: next.email } : null };
  });
}

export async function loadMailOrder(orderId: string) {
  const sql = getSql();
  const orders = await sql<MailOrder[]>`
    SELECT orders.id, orders.email, orders.first_name, orders.last_name, orders.phone, orders.status,
      orders.subtotal_kobo, orders.discount_kobo, orders.total_kobo,
      orders.paid_kobo, orders.paid_at, orders.payment_channel, orders.payment_reference, orders.payment_error,
      events.title, events.venue, events.starts_at, events.ends_at
    FROM orders
    JOIN events ON events.id = orders.event_id
    WHERE orders.id = ${orderId}
  `;
  const order = orders[0];
  if (!order) throw new HttpError(404, "Order not found.");
  const startsAt = asDate(order.starts_at);
  const endsAt = asDate(order.ends_at);
  if (!startsAt || !endsAt) throw new HttpError(500, "This event has no valid start or end time.");
  order.starts_at = startsAt;
  order.ends_at = endsAt;
  order.paid_at = asDate(order.paid_at);
  const lines = await sql<MailLine[]>`
    SELECT tiers.name AS tier_name, COUNT(*)::int AS quantity, tiers.price_kobo
    FROM tickets
    JOIN tiers ON tiers.id = tickets.tier_id
    WHERE tickets.order_id = ${orderId}
    GROUP BY tiers.id, tiers.name, tiers.price_kobo, tiers.sort_order
    ORDER BY tiers.sort_order
  `;
  return { order, lines };
}
