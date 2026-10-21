import "server-only";

import QRCode from "qrcode";
import { Resend } from "resend";
import { getSql } from "@/server/db";
import { iso } from "@/server/time";
import { HttpError } from "@/server/http";
import { formatWhen } from "@/lib/admin-mock";

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export async function sendTicketEmail(orderId: string) {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new HttpError(503, "Ticket email is not configured.");

  const sql = getSql();
  const orders = await sql<
    {
      email: string;
      first_name: string;
      title: string;
      venue: string;
      starts_at: Date;
    }[]
  >`
    SELECT orders.email, orders.first_name, events.title, events.venue, events.starts_at
    FROM orders
    JOIN events ON events.id = orders.event_id
    WHERE orders.id = ${orderId} AND orders.status = 'confirmed'
  `;
  const order = orders[0];
  if (!order) throw new HttpError(404, "Order not found.");
  const ticketRows = await sql<{ code: string; tier_name: string; number: number }[]>`
    SELECT tickets.code, tickets.number, tiers.name AS tier_name
    FROM tickets
    JOIN tiers ON tiers.id = tickets.tier_id
    WHERE tickets.order_id = ${orderId} AND tickets.status IN ('sold', 'scanned')
    ORDER BY tickets.number
  `;
  if (ticketRows.length === 0) throw new HttpError(409, "This order has no tickets to send.");

  const attachments = await Promise.all(
    ticketRows.map(async (ticket, index) => {
      const content = await QRCode.toBuffer(ticket.code, { type: "png", width: 280, margin: 1 });
      return {
        filename: `${ticket.code}.png`,
        content,
        contentType: "image/png",
        contentId: `ticket-${index}`,
      };
    }),
  );
  const blocks = ticketRows
    .map(
      (ticket, index) => `
        <p style="font-family:sans-serif;font-size:16px;font-weight:700">${escapeHtml(ticket.tier_name)}</p>
        <img src="cid:ticket-${index}" alt="Ticket QR code" width="280" height="280" />
        <p style="font-family:sans-serif;font-size:14px">Code ${escapeHtml(ticket.code)}</p>
      `,
    )
    .join("");
  const resend = new Resend(apiKey);
  const sent = await resend.emails.send({
    from,
    to: order.email,
    subject: `Your tickets for ${order.title}`,
    html: `
      <p style="font-family:sans-serif;font-size:16px">Hello ${escapeHtml(order.first_name)},</p>
      <p style="font-family:sans-serif;font-size:16px">
        ${escapeHtml(order.title)}<br />
        ${escapeHtml(formatWhen(iso(order.starts_at) ?? ""))} UTC<br />
        ${escapeHtml(order.venue)}
      </p>
      <p style="font-family:sans-serif;font-size:16px">Show one QR code at the door. The code is not a link.</p>
      ${blocks}
    `,
    attachments,
  });
  if (sent.error) throw new HttpError(502, "The ticket email could not be sent.");
}
