import "server-only";

import QRCode from "qrcode";
import { HttpError } from "@/server/http";
import { loadMailOrder, loadTickets, type MailLine, type MailOrder, type MailTicket } from "@/server/mail/order";
import { sendMail } from "@/server/mail/send";
import {
  escapeHtml,
  eventDetails,
  eventSchedule,
  eventTitle,
  layout,
  purchaseTable,
  textLine,
} from "@/server/mail/template";

type Batch = { email: string; name: string; tickets: MailTicket[]; purchaser: boolean };

/** One email per distinct address; tickets with no named recipient go to the purchaser. */
export function batchTickets(order: MailOrder, tickets: MailTicket[]) {
  const buyerEmail = order.email.toLowerCase();
  const batches = new Map<string, Batch>();
  for (const ticket of tickets) {
    const email = ticket.recipient?.email.toLowerCase() || buyerEmail;
    const purchaser = email === buyerEmail;
    const batch = batches.get(email) ?? {
      email,
      name: purchaser ? order.first_name : (ticket.recipient?.name ?? ""),
      tickets: [],
      purchaser,
    };
    batch.tickets.push(ticket);
    batches.set(email, batch);
  }
  return [...batches.values()];
}

function purchaseLines(lines: MailLine[]) {
  return lines.map((line) => ({
    name: line.tier_name,
    quantity: line.quantity,
    amountKobo: line.price_kobo * line.quantity,
  }));
}

async function sendBatch(order: MailOrder, lines: MailLine[], batch: Batch) {
  const attachments = await Promise.all(
    batch.tickets.map(async (ticket, index) => {
      const content = await QRCode.toBuffer(ticket.code, { type: "png", width: 320, margin: 1 });
      return {
        filename: `${ticket.code}.png`,
        content,
        contentType: "image/png",
        contentId: `ticket-${index}`,
      };
    }),
  );
  const blocks = batch.tickets
    .map(
      (ticket, index) => `
        <img src="cid:ticket-${index}" alt="Ticket QR code" width="157" height="157" style="display:block;margin:0 auto;border:0">
        <p class="mail-text" style="font-family:'Anek Bangla',Arial,Helvetica,sans-serif;font-size:10px;line-height:15px;font-weight:600;color:#000000;text-align:center;margin:16px 0 28px">${escapeHtml(ticket.tier_name)}</p>`,
    )
    .join("");
  const buyer = `${order.first_name} ${order.last_name}`.trim();
  const count = batch.tickets.length;
  const schedule = eventSchedule(order.starts_at, order.ends_at);
  const extras =
    order.discount_kobo > 0
      ? [
          { label: "Discount", amountKobo: -order.discount_kobo },
          { label: "Total", amountKobo: order.total_kobo, strong: true },
        ]
      : [];
  const intro = batch.purchaser
    ? textLine("Your RSVP is confirmed.", { weight: 500 })
    : textLine(
        `${escapeHtml(buyer)} got you ${count === 1 ? "a ticket" : `${count} tickets`}.`,
        { weight: 500 },
      );

  await sendMail({
    to: batch.email,
    replyTo: batch.purchaser ? undefined : order.email,
    subject: "RSVP: After Hours",
    html: layout({
      preheader: batch.purchaser
        ? `Your RSVP is confirmed for ${order.title}`
        : `${buyer} sent you ${count === 1 ? "a ticket" : `${count} tickets`} to ${order.title}`,
      body: `
        ${textLine(`Hi ${escapeHtml(batch.name || "there")},`)}
        ${intro}
        ${eventTitle(order.title)}
        ${eventDetails({ ...schedule, venue: order.venue })}
        ${batch.purchaser ? purchaseTable(purchaseLines(lines), extras) : ""}
        ${textLine("Present this QR at the Entrance as it holds your RSVP information", {
          size: 10,
          lineHeight: 15,
          margin: "28px 0 20px",
          align: "center",
        })}
        ${blocks}
      `,
    }),
    attachments,
  });
}

export async function sendTicketEmail(orderId: string) {
  const { order, lines } = await loadMailOrder(orderId);
  if (order.status !== "confirmed") throw new HttpError(409, "Only a confirmed order can be emailed.");
  const tickets = await loadTickets(orderId);
  if (tickets.length === 0) throw new HttpError(409, "This order has no tickets to send.");

  const results = await Promise.allSettled(
    batchTickets(order, tickets).map((batch) => sendBatch(order, lines, batch)),
  );
  const failed = results.filter((result) => result.status === "rejected");
  for (const result of failed) {
    console.error("ticket email batch failed", result.reason);
  }
  if (failed.length > 0) {
    throw new HttpError(502, `${failed.length} of ${results.length} ticket emails could not be sent.`);
  }
}
