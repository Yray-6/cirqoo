import "server-only";

import { Resend, type Attachment } from "resend";
import { HttpError } from "@/server/http";

const globalForMail = globalThis as { cirqooResend?: Resend };

function config() {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim();
  if (!apiKey || !from) throw new HttpError(503, "Email is not configured.");
  return { apiKey, from };
}

function client(apiKey: string) {
  if (!globalForMail.cirqooResend) globalForMail.cirqooResend = new Resend(apiKey);
  return globalForMail.cirqooResend;
}

export function adminEmail() {
  return process.env.ADMIN_EMAIL?.trim().toLowerCase() ?? "";
}

export type Mail = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
  replyTo?: string;
};

export async function sendMail(mail: Mail) {
  const { apiKey, from } = config();
  const sent = await client(apiKey).emails.send({
    from,
    to: mail.to,
    subject: mail.subject,
    html: mail.html,
    text: mail.text,
    attachments: mail.attachments,
    replyTo: mail.replyTo,
  });
  if (sent.error) {
    console.error(`email failed: ${sent.error.name}`);
    throw new HttpError(502, "The email could not be sent.");
  }
  return sent.data?.id ?? "";
}

export function fireAndForget(work: Promise<unknown>, label: string) {
  void work.catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error(`${label} failed: ${detail}`);
  });
}
