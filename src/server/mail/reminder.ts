import "server-only";

import { getSql } from "@/server/db";
import { HttpError } from "@/server/http";
import { loadMailOrder, loadTickets } from "@/server/mail/order";
import { sendMail } from "@/server/mail/send";
import { batchTickets } from "@/server/mail/tickets";
import { countdown, escapeHtml, eventDetails, eventSchedule, layout, textLine } from "@/server/mail/template";

const font = "font-family:'Anek Bangla',Arial,Helvetica,sans-serif";

export function reminderHtml(input: {
  name: string;
  title: string;
  startsAt: Date;
  endsAt: Date;
  venue: string;
  note?: string;
}) {
  const schedule = eventSchedule(input.startsAt, input.endsAt);
  const when = countdown(input.startsAt);
  const note = input.note?.trim();
  return layout({
    preheader: `${input.title} ${when}`,
    dark: "#141414",
    body: `
      ${textLine(`Hi ${escapeHtml(input.name || "there")}!`, { size: 12 })}
      ${textLine("This is your reminder to prepare yourself.", { size: 12, weight: 500 })}
      ${textLine(
        `<span style="${font};font-weight:500">${escapeHtml(input.title.toUpperCase())}</span> ${escapeHtml(when)}`,
        { size: 12 },
      )}
      ${note ? textLine(escapeHtml(note), { size: 12, color: "#141414" }) : ""}
      ${eventDetails({ ...schedule, venue: input.venue })}
    `,
  });
}

/** One reminder per ticket holder for a published event. `note` is the short line under the countdown. */
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
          subject: `${order.title} is coming up`,
          html: reminderHtml({
            name: batch.name || "there",
            title: order.title,
            startsAt: order.starts_at,
            endsAt: order.ends_at,
            venue: order.venue,
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
