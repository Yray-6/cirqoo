import "server-only";

import { loadMailOrder, loadTickets, type MailLine } from "@/server/mail/order";
import { sendMail } from "@/server/mail/send";
import { batchTickets } from "@/server/mail/tickets";
import {
  escapeHtml,
  eventDetails,
  eventSchedule,
  eventTitle,
  layout,
  nairaText,
  purchaseTable,
  textLine,
} from "@/server/mail/template";

const font = "font-family:'Anek Bangla',Arial,Helvetica,sans-serif";

function purchaseLines(lines: MailLine[]) {
  return lines.map((line) => ({
    name: line.tier_name,
    quantity: line.quantity,
    amountKobo: line.price_kobo * line.quantity,
  }));
}

function paidWhen(value: Date) {
  return new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(value);
}

/**
 * The purchaser's order summary. Sent when money changed hands, or when any
 * ticket went to someone else (so the purchaser still has a record of the order).
 */
export async function sendReceiptEmail(orderId: string) {
  const { order, lines } = await loadMailOrder(orderId);
  const paid = (order.paid_kobo ?? 0) > 0;
  const batches = batchTickets(order, await loadTickets(orderId));
  const others = batches.filter((batch) => !batch.purchaser);
  const own = batches.find((batch) => batch.purchaser);
  if (!paid && others.length === 0) {
    console.error(
      `receipt email skipped ${JSON.stringify({ orderId, reason: "no payment and no other recipients" })}`,
    );
    return;
  }

  const whereTickets =
    others.length === 0
      ? "Your tickets are in a separate email."
      : own
        ? "Your own tickets are in a separate email. The rest were sent directly to:"
        : "The tickets were sent directly to:";
  const recipientList =
    others.length === 0
      ? ""
      : `<ul class="mail-detail" style="${font};font-size:12px;line-height:22px;color:#1F242F;margin:0 0 16px;padding-left:18px">${others
          .map(
            (batch) =>
              `<li>${escapeHtml(batch.name || batch.email)} &lt;${escapeHtml(batch.email)}&gt; · ${batch.tickets.length} ticket${batch.tickets.length === 1 ? "" : "s"}</li>`,
          )
          .join("")}</ul>`;
  const channel = order.payment_channel ? order.payment_channel.replaceAll("_", " ") : "Paystack";
  const schedule = eventSchedule(order.starts_at, order.ends_at);
  const extras =
    order.discount_kobo > 0
      ? [
          { label: "Discount", amountKobo: -order.discount_kobo },
          { label: "Total", amountKobo: order.total_kobo, strong: true },
        ]
      : [];

  await sendMail({
    to: order.email,
    subject: "Receipts: After Hours by Cirqoo",
    html: layout({
      preheader: paid ? `Payment of ${nairaText(order.paid_kobo ?? 0)} received` : `Order confirmed for ${order.title}`,
      body: `
        ${textLine(`Hi ${escapeHtml(order.first_name)},`)}
        ${textLine(paid ? "Payment received." : "Your order is confirmed.", { weight: 500 })}
        ${textLine(whereTickets, { size: 12, color: "#1F242F" })}
        ${recipientList}
        ${eventTitle(order.title)}
        ${eventDetails({ ...schedule, venue: order.venue })}
        ${purchaseTable(purchaseLines(lines), extras)}
        ${order.payment_reference ? textLine(`Reference ${escapeHtml(order.payment_reference)}`, { size: 12, color: "#1F242F", margin: "16px 0 0" }) : ""}
        ${paid ? textLine(`Paid ${escapeHtml(nairaText(order.paid_kobo ?? 0))} by ${escapeHtml(channel)}${order.paid_at ? ` on ${escapeHtml(paidWhen(order.paid_at))}` : ""} UTC`, { size: 12, color: "#1F242F", margin: "4px 0 0" }) : ""}
      `,
    }),
  });
}
