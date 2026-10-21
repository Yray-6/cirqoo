import { asDate, iso } from "@/server/time";
import { getSql } from "@/server/db";
import { HttpError, asString, clientIp, isRecord, readJson, validEmail } from "@/server/http";
import { assertHoldRate, holdTickets, releaseHold, type HoldLine } from "@/server/inventory";
import { holdCookie } from "@/server/session-token";
import { apiGet, apiPost } from "@/server/route";

function holdCookieHeader(orderId: string, maxAge: number) {
  const secure = (process.env.APP_ORIGIN ?? "").startsWith("https://");
  return `${holdCookie}=${orderId}; HttpOnly; Path=/; Max-Age=${maxAge}; SameSite=Lax${secure ? "; Secure" : ""}`;
}

export const GET = apiGet(async (request) => {
  const cookie = request.headers.get("cookie") ?? "";
  const match = cookie.match(new RegExp(`${holdCookie}=([^;]+)`));
  const orderId = match?.[1];
  if (!orderId) return Response.json({ active: false });
  const sql = getSql();
  const rows = await sql<
    {
      id: string;
      status: string;
      held_until: Date | null;
      first_name: string;
      last_name: string;
      email: string;
      phone: string;
      event_title: string;
    }[]
  >`
    SELECT orders.id, orders.status, orders.held_until, orders.first_name, orders.last_name,
      orders.email, orders.phone, events.title AS event_title
    FROM orders
    JOIN events ON events.id = orders.event_id
    WHERE orders.id = ${orderId}
  `;
  const order = rows[0];
  const heldUntil = asDate(order?.held_until);
  if (!order || order.status !== "held" || !heldUntil || heldUntil.getTime() <= Date.now()) {
    if (order?.status === "held") await releaseHold(order.id);
    return Response.json({ active: false });
  }
  const lines = await sql<{ tier_id: string; name: string; quantity: number; price_kobo: number }[]>`
    SELECT tickets.tier_id, tiers.name, COUNT(*)::int AS quantity, tiers.price_kobo
    FROM tickets
    JOIN tiers ON tiers.id = tickets.tier_id
    WHERE tickets.order_id = ${orderId} AND tickets.status = 'held'
    GROUP BY tickets.tier_id, tiers.name, tiers.price_kobo
  `;
  return Response.json({
    active: true,
    heldUntil: iso(order.held_until),
    eventTitle: order.event_title,
    contact: {
      firstName: order.first_name,
      lastName: order.last_name,
      email: order.email,
      phone: order.phone,
    },
    lines: lines.map((line) => ({
      tierId: line.tier_id,
      name: line.name,
      quantity: line.quantity,
      price: Math.round(line.price_kobo / 100),
    })),
  });
});

export const POST = apiPost(async (request) => {
  assertHoldRate(clientIp(request));
  const body = await readJson(request);
  if (!isRecord(body) || !isRecord(body.contact) || !Array.isArray(body.lines)) {
    throw new HttpError(400, "Choose tickets and add your contact details.");
  }
  const contact = {
    firstName: asString(body.contact.firstName),
    lastName: asString(body.contact.lastName),
    email: asString(body.contact.email).toLowerCase(),
    phone: asString(body.contact.phone).replace(/\s/g, ""),
  };
  if (!contact.firstName || !contact.lastName || !validEmail(contact.email) || !/^\d{10,11}$/.test(contact.phone)) {
    throw new HttpError(400, "Check the name, email, and phone number.");
  }
  const lines: HoldLine[] = body.lines.map((line) => {
    if (!isRecord(line)) return { tierId: "", quantity: 0 };
    return { tierId: asString(line.tierId), quantity: Number(line.quantity) };
  });
  const result = await holdTickets({
    idempotencyKey: asString(body.idempotencyKey),
    lines,
    contact,
    code: asString(body.code),
    eventUpdates: body.eventUpdates === true,
    nearbyEvents: body.nearbyEvents === true,
  });
  const response = Response.json(result);
  response.headers.append("set-cookie", holdCookieHeader(result.orderId, 600));
  return response;
});

export async function DELETE(request: Request) {
  try {
    const { assertOrigin } = await import("@/server/http");
    assertOrigin(request);
    const cookie = request.headers.get("cookie") ?? "";
    const match = cookie.match(new RegExp(`${holdCookie}=([^;]+)`));
    if (match?.[1]) await releaseHold(match[1]);
    const response = Response.json({ ok: true });
    response.headers.append("set-cookie", holdCookieHeader("", 0));
    return response;
  } catch (error) {
    const { asJson } = await import("@/server/http");
    return asJson(error);
  }
}
