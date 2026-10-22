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
  return process.env.RESEND_ADMIN_EMAIL?.trim().toLowerCase() ?? "ajiriokpeva@gmail.com";
}

export type Mail = {
  to: string | string[];
  subject: string;
  html: string;
  text?: string;
  attachments?: Attachment[];
  replyTo?: string;
};

function attachmentBytes(attachments: Attachment[] | undefined) {
  return (attachments ?? []).reduce((total, attachment) => {
    const content = attachment.content;
    if (typeof content === "string") return total + Buffer.byteLength(content);
    if (content instanceof Uint8Array) return total + content.byteLength;
    return total;
  }, 0);
}

function attempt(mail: Mail, from = "") {
  return {
    to: mail.to,
    subject: mail.subject,
    from,
    replyTo: mail.replyTo ?? null,
    attachmentCount: mail.attachments?.length ?? 0,
    attachmentBytes: attachmentBytes(mail.attachments),
    htmlLength: mail.html.length,
    hasApiKey: Boolean(process.env.RESEND_API_KEY?.trim()),
    hasFrom: Boolean(process.env.EMAIL_FROM?.trim()),
  };
}

function thrown(error: unknown) {
  if (!(error instanceof Error)) return { name: "unknown", message: String(error), stack: "", cause: null };
  const cause = error.cause;
  return {
    name: error.name,
    message: error.message,
    stack: error.stack ?? "",
    cause:
      cause instanceof Error
        ? { name: cause.name, message: cause.message, stack: cause.stack ?? "" }
        : (cause ?? null),
  };
}

export async function sendMail(mail: Mail) {
  const pending = attempt(mail);
  let apiKey = "";
  let from = "";
  try {
    ({ apiKey, from } = config());
  } catch (error) {
    console.error(`email send threw ${JSON.stringify({ ...pending, ...thrown(error) })}`);
    throw error;
  }
  const detail = { ...pending, from };
  console.error(`email send ${JSON.stringify(detail)}`);
  try {
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
      console.error(
        `email failed ${JSON.stringify({
          ...detail,
          name: sent.error.name,
          message: sent.error.message,
          statusCode: sent.error.statusCode,
        })}`,
      );
      throw new HttpError(502, "The email could not be sent.");
    }
    const id = sent.data?.id ?? "";
    console.error(`email sent ${JSON.stringify({ ...detail, id })}`);
    return id;
  } catch (error) {
    if (error instanceof HttpError) throw error;
    console.error(`email send threw ${JSON.stringify({ ...detail, ...thrown(error) })}`);
    throw error;
  }
}

export function fireAndForget(work: Promise<unknown>, label: string) {
  void work.catch((error: unknown) => {
    const detail = error instanceof Error ? error.message : "unknown error";
    console.error(`${label} failed: ${detail}`);
  });
}
