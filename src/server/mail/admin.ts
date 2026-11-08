import "server-only";

import { appOrigin } from "@/server/env";
import { loadMailOrder, type MailLine } from "@/server/mail/order";
import { adminEmail, sendMail } from "@/server/mail/send";
import {
  button,
  escapeHtml,
  eventDetails,
  eventSchedule,
  eventTitle,
  layout,
  nairaText,
  purchaseTable,
  textLine,
} from "@/server/mail/template";

function purchaseLines(lines: MailLine[]) {
  return lines.map((line) => ({
    name: line.tier_name,
    quantity: line.quantity,
    amountKobo: line.price_kobo * line.quantity,
  }));
}

export async function sendAdminOrderNotice(orderId: string) {
  const to = adminEmail();
  if (!to) {
    console.error(`admin notice email skipped ${JSON.stringify({ orderId, reason: "ADMIN_EMAIL is not set" })}`);
    return;
  }
  const { order, lines } = await loadMailOrder(orderId);
  const buyer = `${order.first_name} ${order.last_name}`.trim();
  const problem = order.payment_error;
  const paid = order.paid_kobo && order.paid_kobo > 0;
  const schedule = eventSchedule(order.starts_at, order.ends_at);
  const extras =
    order.discount_kobo > 0
      ? [
          { label: "Discount", amountKobo: -order.discount_kobo },
          { label: "Total", amountKobo: order.total_kobo, strong: true },
        ]
      : [];
  const channel = order.payment_channel ? order.payment_channel.replaceAll("_", " ") : "";

  await sendMail({
    to,
    replyTo: order.email,
    subject: problem
      ? `Action needed: ${buyer} paid for ${order.title}`
      : `${paid ? "Paid order" : "New order"}: ${buyer} · ${order.title}`,
    html: layout({
      preheader: problem ?? `${buyer} ordered ${nairaText(order.total_kobo)}`,
      body: `
        ${problem ? textLine(escapeHtml(problem), { weight: 600, color: "#FDAB86" }) : ""}
        ${textLine(problem ? "Payment needs attention." : paid ? "Paid order." : "New order.", { weight: 500 })}
        ${textLine(`${escapeHtml(buyer)}<br>${escapeHtml(order.email)}<br>${escapeHtml(order.phone)}`, { size: 12 })}
        ${eventTitle(order.title)}
        ${eventDetails({ ...schedule, venue: order.venue })}
        ${purchaseTable(purchaseLines(lines), extras)}
        ${order.payment_reference ? textLine(`Reference ${escapeHtml(order.payment_reference)}`, { size: 12, color: "#1F242F", margin: "16px 0 0" }) : ""}
        ${paid ? textLine(`Paid ${escapeHtml(nairaText(order.paid_kobo ?? 0))}${channel ? ` by ${escapeHtml(channel)}` : ""}`, { size: 12, color: "#1F242F", margin: "4px 0 0" }) : ""}
        ${button("Open orders", `${appOrigin()}/admin/tickets`)}
      `,
    }),
  });
}
