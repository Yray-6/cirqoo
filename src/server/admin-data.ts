import "server-only";

import { desc, eq } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { getDb, getSql } from "@/server/db";
import { HttpError } from "@/server/http";
import { koboToNaira } from "@/server/money";
import { announcements, discounts } from "@/server/schema";
import type { CurrentUser } from "@/server/auth";

import { iso as timestamp } from "@/server/time";

function iso(value: Date | string | null) {
  return timestamp(value);
}

export async function loadAdminState(user: CurrentUser) {
  const profile = {
    name: user.name,
    email: user.email,
    role: user.role,
    mustChangePassword: user.mustChangePassword,
  };
  if (user.role !== "admin" || user.mustChangePassword) {
    return {
      profile,
      events: [],
      discounts: [],
      announcements: [],
      buyers: [],
      leads: [],
      inflowDays: [],
      orders: [],
      staff: [],
    };
  }

  const sql = getSql();
  const eventRows = await sql<
    {
      id: string;
      title: string;
      description: string;
      venue: string;
      starts_at: Date;
      ends_at: Date;
      status: "draft" | "published";
      sold: number;
    }[]
  >`
    SELECT events.id, events.title, events.description, events.venue, events.starts_at, events.ends_at, events.status,
      COUNT(tickets.id) FILTER (WHERE tickets.status IN ('sold', 'scanned'))::int AS sold
    FROM events
    LEFT JOIN tickets ON tickets.event_id = events.id
    GROUP BY events.id
    ORDER BY events.starts_at DESC
  `;
  const tierRows = await sql<
    {
      id: string;
      event_id: string;
      name: string;
      description: string;
      price_kobo: number;
      capacity: number;
    }[]
  >`
    SELECT id, event_id, name, description, price_kobo, capacity
    FROM tiers
    ORDER BY sort_order
  `;
  const events = eventRows.map((event) => ({
    id: event.id,
    title: event.title,
    description: event.description,
    venue: event.venue,
    startsAt: iso(event.starts_at) ?? "",
    endsAt: iso(event.ends_at) ?? "",
    status: event.status,
    sold: Number(event.sold),
    tiers: tierRows
      .filter((tier) => tier.event_id === event.id)
      .map((tier) => ({
        id: tier.id,
        name: tier.name,
        description: tier.description,
        price: koboToNaira(tier.price_kobo),
        capacity: tier.capacity,
      })),
  }));

  const discountRows = await getDb().select().from(discounts).orderBy(desc(discounts.code));
  const announcementRows = await getDb().select().from(announcements).orderBy(desc(announcements.createdAt));
  const leadRows = await sql<{ id: string; email: string; source: "newsletter" | "checkout"; created_at: Date }[]>`
    SELECT id, email, source, created_at FROM leads ORDER BY created_at DESC
  `;
  const buyerRows = await sql<
    { id: string; name: string; email: string; phone: string; event_id: string; ticket_count: number }[]
  >`
    SELECT min(orders.id::text) AS id,
      trim(both ' ' FROM concat(orders.first_name, ' ', orders.last_name)) AS name,
      orders.email, orders.phone, orders.event_id,
      COUNT(tickets.id)::int AS ticket_count
    FROM orders
    JOIN tickets ON tickets.order_id = orders.id AND tickets.status IN ('sold', 'scanned')
    WHERE orders.status = 'confirmed'
    GROUP BY orders.first_name, orders.last_name, orders.email, orders.phone, orders.event_id
    ORDER BY MIN(orders.created_at) DESC
  `;
  const orderRows = await sql<
    {
      id: string;
      event_id: string;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      status: "held" | "confirmed" | "expired";
      total_kobo: number;
      held_until: Date | null;
      email_error: string | null;
      payment_reference: string | null;
      payment_error: string | null;
      paid_kobo: number | null;
      ticket_count: number;
    }[]
  >`
    SELECT orders.id, orders.event_id, orders.first_name, orders.last_name, orders.email, orders.phone,
      orders.status, orders.total_kobo, orders.held_until, orders.email_error,
      orders.payment_reference, orders.payment_error, orders.paid_kobo,
      COUNT(tickets.id)::int AS ticket_count
    FROM orders
    LEFT JOIN tickets ON tickets.order_id = orders.id
    GROUP BY orders.id
    ORDER BY orders.created_at DESC
    LIMIT 50
  `;
  const staffRows = await sql<
    {
      id: string;
      name: string;
      email: string;
      role: "admin" | "staff";
      disabled: boolean;
      must_change_password: boolean;
    }[]
  >`
    SELECT id, name, email, role, disabled, must_change_password
    FROM users
    ORDER BY created_at ASC
  `;

  const today = new Date();
  const inflowDays = Array.from({ length: 30 }, (_, index) => {
    const day = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate()));
    day.setUTCDate(day.getUTCDate() - (29 - index));
    return { date: day.toISOString().slice(0, 10), amount: 0 };
  });
  const inflowRows = await sql<{ date: string; amount: number }[]>`
    SELECT to_char(confirmed_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS date,
      COALESCE(SUM(total_kobo), 0)::bigint AS amount
    FROM orders
    WHERE status = 'confirmed' AND confirmed_at >= ${new Date(`${inflowDays[0]?.date ?? "1970-01-01"}T00:00:00.000Z`).toISOString()}
    GROUP BY 1
  `;
  for (const row of inflowRows) {
    const day = inflowDays.find((item) => item.date === row.date);
    if (day) day.amount = koboToNaira(Number(row.amount));
  }

  return {
    profile,
    events,
    discounts: discountRows.map((discount) => ({
      id: discount.id,
      code: discount.code,
      eventId: discount.eventId,
      cut: discount.cut as "percentage" | "fixed",
      percent: discount.percent,
      amount: koboToNaira(discount.amountKobo),
      usageLimit: discount.usageLimit,
      used: discount.used,
    })),
    announcements: announcementRows.map((item) => ({
      id: item.id,
      title: item.title,
      body: item.body,
      createdAt: iso(item.createdAt) ?? "",
    })),
    buyers: buyerRows.map((buyer) => ({
      id: buyer.id,
      name: buyer.name,
      email: buyer.email,
      phone: buyer.phone,
      eventId: buyer.event_id,
      ticketCount: buyer.ticket_count,
    })),
    leads: leadRows.map((lead) => ({
      id: lead.id,
      email: lead.email,
      source: lead.source,
      createdAt: iso(lead.created_at) ?? "",
    })),
    inflowDays,
    orders: orderRows.map((order) => ({
      id: order.id,
      eventId: order.event_id,
      buyerName: `${order.first_name} ${order.last_name}`.trim(),
      email: order.email,
      phone: order.phone,
      status: order.status,
      total: koboToNaira(order.total_kobo),
      heldUntil: iso(order.held_until),
      emailError: order.email_error,
      paymentReference: order.payment_reference,
      paymentError: order.payment_error,
      paid: (order.paid_kobo ?? 0) > 0,
      ticketCount: order.ticket_count,
    })),
    staff: staffRows.map((member) => ({
      id: member.id,
      name: member.name,
      email: member.email,
      role: member.role,
      disabled: member.disabled,
      mustChangePassword: member.must_change_password,
    })),
  };
}

const ticketFilters = ["provisioned", "unsold", "sold", "redeemed", "scanned"] as const;
export type TicketListFilter = (typeof ticketFilters)[number];

export function ticketListFilter(value: string | null): TicketListFilter {
  return ticketFilters.find((filter) => filter === value) ?? "unsold";
}

export async function ticketPage(eventId: string, page: number, status: TicketListFilter = "unsold") {
  const pageSize = 50;
  const safePage = Number.isInteger(page) && page > 0 ? page : 1;
  const offset = (safePage - 1) * pageSize;
  const dbStatus = status === "unsold" ? "available" : status === "provisioned" || status === "redeemed" ? null : status;
  const sql = getSql();
  const where =
    status === "redeemed"
      ? sql`AND tickets.status IN ('sold', 'scanned') AND orders.status = 'confirmed' AND orders.discount_id IS NOT NULL`
      : status === "sold"
        ? sql`AND tickets.status = 'sold' AND orders.discount_id IS NULL`
        : dbStatus
          ? sql`AND tickets.status = ${dbStatus}`
          : sql`AND TRUE`;
  const events = await sql<{ id: string }[]>`SELECT id FROM events WHERE id = ${eventId}`;
  if (!events[0]) throw new HttpError(404, "Event not found.");
  const [{ count }] = await sql<{ count: string }[]>`
    SELECT COUNT(*)::text AS count
    FROM tickets
    LEFT JOIN orders ON orders.id = tickets.order_id
    WHERE tickets.event_id = ${eventId}
    ${where}
  `;
  const rows = await sql<
    {
      number: number;
      code: string;
      tier_id: string;
      tier_name: string;
      status: "available" | "held" | "sold" | "scanned";
      buyer_name: string | null;
      scanned_at: Date | null;
      discount_code: string | null;
    }[]
  >`
    SELECT tickets.number, tickets.code, tickets.tier_id, tiers.name AS tier_name, tickets.status,
      NULLIF(trim(both ' ' FROM concat(orders.first_name, ' ', orders.last_name)), '') AS buyer_name,
      tickets.scanned_at,
      discounts.code AS discount_code
    FROM tickets
    JOIN tiers ON tiers.id = tickets.tier_id
    LEFT JOIN orders ON orders.id = tickets.order_id
    LEFT JOIN discounts ON discounts.id = orders.discount_id
    WHERE tickets.event_id = ${eventId}
    ${where}
    ORDER BY tickets.number
    LIMIT ${pageSize} OFFSET ${offset}
  `;
  const counts = await sql<{ tier_id: string; status: string; count: number }[]>`
    SELECT tier_id, status, COUNT(*)::int AS count
    FROM tickets
    WHERE event_id = ${eventId}
    GROUP BY tier_id, status
  `;
  const tierRows = await sql<{ id: string; name: string }[]>`
    SELECT id, name FROM tiers WHERE event_id = ${eventId} ORDER BY sort_order
  `;
  return {
    eventId,
    status,
    page: safePage,
    pageSize,
    total: Number(count),
    tickets: rows.map((ticket) => ({
      number: ticket.number,
      code: ticket.code,
      eventId,
      tierId: ticket.tier_id,
      tierName: ticket.tier_name,
      status: ticket.status === "available" ? "unsold" : ticket.status,
      buyerName: ticket.buyer_name ?? undefined,
      scannedAt: iso(ticket.scanned_at) ?? undefined,
      discountCode: ticket.discount_code ?? undefined,
    })),
    counts: tierRows.map((tier) => {
      const owned = counts.filter((item) => item.tier_id === tier.id);
      const value = (status: string) => owned.find((item) => item.status === status)?.count ?? 0;
      return {
        tierId: tier.id,
        name: tier.name,
        provisioned: owned.reduce((sum, item) => sum + item.count, 0),
        unsold: value("available"),
        held: value("held"),
        sold: value("sold"),
        scanned: value("scanned"),
      };
    }),
  };
}

export async function addDiscount(input: {
  code: string;
  eventId: string;
  cut: "percentage" | "fixed";
  percent: number;
  amount: number;
  usageLimit: number;
}) {
  const code = input.code.trim().toUpperCase();
  if (!/^[A-Z0-9-]{4,16}$/.test(code)) throw new HttpError(400, "Use 4 to 16 letters or numbers.");
  if (!Number.isInteger(input.usageLimit) || input.usageLimit < 1 || input.usageLimit > 100_000) {
    throw new HttpError(400, "Set how many times the code can be used.");
  }
  if (input.cut === "percentage" && (!Number.isInteger(input.percent) || input.percent < 1 || input.percent > 100)) {
    throw new HttpError(400, "Percentage cut is a whole number from 1 to 100.");
  }
  if (input.cut === "fixed" && (!Number.isInteger(input.amount) || input.amount < 1)) {
    throw new HttpError(400, "Fixed amount is a whole naira value.");
  }
  const sql = getSql();
  const event = await sql<{ id: string }[]>`SELECT id FROM events WHERE id = ${input.eventId}`;
  if (!event[0]) throw new HttpError(400, "Pick an event.");
  try {
    await getDb().insert(discounts).values({
      id: randomUUID(),
      code,
      eventId: input.eventId,
      cut: input.cut,
      percent: input.cut === "percentage" ? input.percent : 0,
      amountKobo: input.cut === "fixed" ? input.amount * 100 : 0,
      usageLimit: input.usageLimit,
      used: 0,
    });
  } catch (error) {
    const pgCode = typeof error === "object" && error && "code" in error ? String(error.code) : "";
    if (pgCode === "23505") throw new HttpError(409, "That code already exists.");
    throw error;
  }
}

export async function redeemDiscount(id: string) {
  const sql = getSql();
  const rows = await sql<{ id: string }[]>`
    UPDATE discounts SET used = used + 1
    WHERE id = ${id} AND used < usage_limit
    RETURNING id
  `;
  if (!rows[0]) {
    const found = await getDb().select({ id: discounts.id }).from(discounts).where(eq(discounts.id, id)).limit(1);
    if (!found[0]) throw new HttpError(404, "Code not found.");
    throw new HttpError(409, "This code has no uses left.");
  }
}

export async function addAnnouncement(title: string, body: string) {
  const cleanTitle = title.trim();
  const cleanBody = body.trim();
  if (!cleanTitle || cleanTitle.length > 160 || !cleanBody || cleanBody.length > 4000) {
    throw new HttpError(400, "Add a title and a message.");
  }
  await getDb().insert(announcements).values({
    id: randomUUID(),
    title: cleanTitle,
    body: cleanBody,
  });
}
