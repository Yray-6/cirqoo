import "server-only";

import { getSql } from "@/server/db";
import { HttpError } from "@/server/http";
import { loadMailOrder, loadTickets } from "@/server/mail/order";
import { sendMail } from "@/server/mail/send";
import { batchTickets } from "@/server/mail/tickets";
import {
  button,
  escapeHtml,
  eventDetails,
  eventSchedule,
  eventTitle,
  layout,
  textLine,
} from "@/server/mail/template";

function noteBlock(note: string) {
  const html = escapeHtml(note).replaceAll("\n", "<br>");
  return textLine(html, { size: 12, color: "#141414" });
}

function directionsLink(venue: string) {
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(venue)}`;
}

export function reminderHtml(input: {
  name: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  venue: string;
  ticketCount: number;
  note?: string;
}) {
  const schedule = eventSchedule(input.startsAt, input.endsAt);
  const note = input.note?.trim();
  const tickets =
    input.ticketCount === 1
      ? "You have 1 ticket on this email."
      : `You have ${input.ticketCount} tickets on this email.`;
  return layout({
    preheader: `${input.title} is today.`,
    body: `
      ${textLine(`Hi ${escapeHtml(input.name || "there")},`)}
      ${textLine("This is your reminder. The event is today.", { weight: 500 })}
      ${eventTitle(input.title)}
      ${eventDetails({ ...schedule, venue: input.venue })}
      ${note ? noteBlock(note) : ""}
      ${textLine("Bring the QR code from your ticket email and show it at the entrance.", { size: 12 })}
      ${textLine(tickets, { size: 12, margin: "0" })}
      ${button("Get directions", directionsLink(input.venue))}
    `,
  });
}

/** One reminder per ticket holder for a published event. `note` is an optional line from the admin. */
export async function sendEventReminders(eventId: string, note = "") {
  const sql = getSql();
  const events = await sql<{ id: string }[]>`
    SELECT id FROM events WHERE id = ${eventId} AND status = 'published'
  `;
  if (!events[0]) throw new HttpError(404, "Published event not found.");
  const orders = await sql<{ id: string }[]>`
    SELECT id FROM orders WHERE event_id = ${eventId} AND status = 'confirmed'
  `;

  const sends: Promise<unknown>[] = [];
  for (const row of orders) {
    const { order } = await loadMailOrder(row.id);
    const batches = batchTickets(order, await loadTickets(row.id));
    for (const batch of batches) {
      sends.push(
        sendMail({
          to: batch.email,
          replyTo: batch.purchaser ? undefined : order.email,
          subject: `Reminder: ${order.title} is today`,
          html: reminderHtml({
            name: batch.name || "there",
            title: order.title,
            startsAt: order.starts_at,
            endsAt: order.ends_at,
            venue: order.venue,
            ticketCount: batch.tickets.length,
            note,
          }),
        }),
      );
    }
  }
  const results = await Promise.allSettled(sends);
  const failed = results.filter((result) => result.status === "rejected");
  for (const result of failed) {
    console.error("reminder email failed", result.reason);
  }
  if (failed.length > 0) {
    throw new HttpError(502, `${failed.length} of ${results.length} reminder emails could not be sent.`);
  }
  return results.length;
}
