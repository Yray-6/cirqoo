import { appOrigin } from "@/server/env";

export function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function nairaText(kobo: number) {
  return `₦${Math.round(kobo / 100).toLocaleString("en-NG")}`;
}

const font = "font-family:'Anek Bangla',Arial,Helvetica,sans-serif";

export function mailAsset(file: string) {
  return `${appOrigin()}/mail/${file}`;
}

const dateFormat = new Intl.DateTimeFormat("en-US", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
  timeZone: "UTC",
});

const timeFormat = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  minute: "2-digit",
  timeZone: "UTC",
});

export function eventSchedule(starts: Date, ends: Date) {
  return {
    date: dateFormat.format(starts),
    time: `${timeFormat.format(starts)} - ${timeFormat.format(ends)} UTC`,
  };
}

/** Whole UTC days from today until the event starts. */
export function daysUntil(starts: Date, now = new Date()) {
  const startDay = Date.UTC(starts.getUTCFullYear(), starts.getUTCMonth(), starts.getUTCDate());
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.round((startDay - today) / 86_400_000);
}

export function countdown(starts: Date, now = new Date()) {
  const days = daysUntil(starts, now);
  if (days <= 0) return "is today.";
  if (days === 1) return "is tomorrow.";
  return `is in ${days} days.`;
}

export function textLine(
  html: string,
  options?: { size?: number; weight?: number; color?: string; margin?: string; align?: "left" | "center"; lineHeight?: number },
) {
  const size = options?.size ?? 14;
  const weight = options?.weight ?? 400;
  const color = options?.color ?? "#000000";
  const margin = options?.margin ?? "0 0 12px";
  const lineHeight = options?.lineHeight ?? 24;
  const align = options?.align === "center" ? "text-align:center;" : "";
  return `<p class="mail-text" style="${font};font-size:${size}px;line-height:${lineHeight}px;font-weight:${weight};color:${color};margin:${margin};${align}">${html}</p>`;
}

export function eventTitle(title: string) {
  return `<p style="${font};font-size:14px;line-height:24px;font-weight:600;color:#FDAB86;margin:0 0 4px">${escapeHtml(title.toUpperCase())}</p>`;
}

function detailRow(file: string, width: number, height: number, label: string, value: string) {
  return `<tr>
      <td width="${width}" valign="middle" style="width:${width}px;padding:5px 14px 5px 0;line-height:0;font-size:0;">
        <img src="${mailAsset(file)}" width="${width}" height="${height}" alt="${label}" style="display:block;border:0;width:${width}px;height:${height}px;">
      </td>
      <td class="mail-detail" valign="middle" style="${font};font-size:10px;line-height:24px;font-weight:400;color:#1F242F;">${escapeHtml(value)}</td>
    </tr>`;
}

export function eventDetails(input: { date: string; time: string; venue: string }) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:12px 0 8px">
    ${detailRow("icon-calendar.png", 14, 14, "Date", input.date)}
    ${detailRow("icon-clock.png", 14, 14, "Time", input.time)}
    ${detailRow("icon-pin.png", 14, 14, "Venue", input.venue)}
  </table>`;
}

export type PurchaseLine = { name: string; quantity: number; amountKobo: number };

export function purchaseTable(lines: PurchaseLine[], extras: { label: string; amountKobo: number; strong?: boolean }[] = []) {
  const items = lines
    .map(
      (line) => `<tr>
        <td style="padding:16px 0 4px">
          <p class="purchase-strong" style="${font};font-size:10px;line-height:24px;font-weight:600;color:#000000;margin:0">${escapeHtml(line.name)}</p>
          <p class="purchase-muted" style="${font};font-size:10px;line-height:24px;font-weight:400;color:#B1B1B1;margin:0">Quantity: ${line.quantity}</p>
        </td>
        <td class="purchase-strong" align="right" valign="middle" style="${font};font-size:10px;line-height:24px;font-weight:600;color:#000000;padding:16px 0 4px">${nairaText(line.amountKobo)}</td>
      </tr>`,
    )
    .join("");
  const extraRows = extras
    .map((extra) => {
      const weight = extra.strong ? 600 : 400;
      const amount = `${extra.amountKobo < 0 ? "-" : ""}${nairaText(Math.abs(extra.amountKobo))}`;
      return `<tr>
        <td class="purchase-strong" style="${font};font-size:10px;line-height:24px;font-weight:${weight};color:#000000;padding:8px 0">${escapeHtml(extra.label)}</td>
        <td class="purchase-strong" align="right" style="${font};font-size:10px;line-height:24px;font-weight:${weight};color:#000000;padding:8px 0">${amount}</td>
      </tr>`;
    })
    .join("");
  return `<p class="mail-text" style="${font};font-size:12px;line-height:24px;font-weight:500;color:#000000;margin:20px 0 8px">Your Purchase Includes</p>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;width:100%">
      <tr>
        <td class="purchase-head" bgcolor="#FDAB86" style="background:#FDAB86;border-radius:6px 6px 0 0;padding:10px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td style="${font};font-size:10px;line-height:24px;font-weight:600;color:#ffffff">ITEM</td>
              <td align="right" style="${font};font-size:10px;line-height:24px;font-weight:600;color:#ffffff">PRICE</td>
            </tr>
          </table>
        </td>
      </tr>
      <tr>
        <td class="purchase-row" bgcolor="#F9F9F9" style="background:#F9F9F9;border-radius:0 0 8px 8px;padding:4px 10px 16px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">${items}${extraRows}</table>
        </td>
      </tr>
    </table>`;
}

function social(file: string, width: number, height: number, label: string, href: string) {
  return `<a href="${escapeHtml(href)}" style="text-decoration:none;color:#ffffff">
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td valign="middle" style="padding-right:6px;line-height:0;font-size:0">
          <img src="${mailAsset(file)}" width="${width}" height="${height}" alt="" style="display:block;border:0;width:${width}px;height:${height}px">
        </td>
        <td valign="middle" style="${font};font-size:10px;line-height:16px;font-weight:600;letter-spacing:1px;color:#ffffff">${escapeHtml(label)}</td>
      </tr></table>
    </a>`;
}

function footer() {
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" bgcolor="#FA87A8" style="background-color:#FA87A8;background-image:linear-gradient(90deg,#FA87A8 0%,#FDAB86 100%)">
      <tr>
        <td style="padding:18px 28px">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
            <tr>
              <td valign="middle">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td valign="middle" style="line-height:0;font-size:0">
                    <img src="${mailAsset("mark-footer.png")}" width="33" height="27" alt="" style="display:block;border:0;width:33px;height:27px">
                  </td>
                  <td valign="middle" style="${font};font-size:14px;line-height:24px;font-weight:400;color:#ffffff;padding-left:5px">CIRQOO</td>
                </tr></table>
              </td>
              <td align="right" valign="middle">
                <table role="presentation" cellpadding="0" cellspacing="0"><tr>
                  <td style="padding-left:18px">${social("icon-instagram.png", 15, 15, "@cirqooonTT", "https://instagram.com/cirqooonTT")}</td>
                  <td style="padding-left:18px">${social("icon-tiktok.png", 15, 16, "@cirqooonTT", "https://www.tiktok.com/@cirqooonTT")}</td>
                  <td style="padding-left:18px">${social("icon-mail.png", 15, 15, "info@cirqoo.com", "mailto:info@cirqoo.com")}</td>
                </tr></table>
              </td>
            </tr>
          </table>
        </td>
      </tr>
    </table>`;
}

export function button(label: string, href: string) {
  return `<p style="margin:24px 0 0">
      <a href="${escapeHtml(href)}" style="${font};display:inline-block;background:#FDAB86;color:#ffffff;text-decoration:none;font-size:14px;font-weight:600;line-height:24px;padding:10px 18px;border-radius:8px">${escapeHtml(label)}</a>
    </p>`;
}

export function layout(input: { preheader: string; body: string; dark?: string }) {
  const dark = input.dark ?? "#000000";
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width,initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="supported-color-schemes" content="light dark">
    <link href="https://fonts.googleapis.com/css2?family=Anek+Bangla:wght@400;500;600&display=swap" rel="stylesheet">
    <style>
      :root { color-scheme: light dark; supported-color-schemes: light dark; }
      body { margin: 0; padding: 0; background: #ffffff; }
      @media only screen and (max-width: 640px) {
        .container { width: 100% !important; }
        .mail-pad { padding-left: 20px !important; padding-right: 20px !important; }
      }
      @media (prefers-color-scheme: dark) {
        body, .mail-canvas { background: ${dark} !important; }
        .mail-text, .mail-detail, .purchase-strong { color: #ffffff !important; }
        .header-light { display: none !important; }
        .header-dark { display: block !important; }
        .purchase-head { background: #202020 !important; }
        .purchase-row { background: #2a2a2a !important; }
      }
    </style>
  </head>
  <body class="mail-canvas" style="margin:0;padding:0;background:#ffffff">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${escapeHtml(input.preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" class="mail-canvas" bgcolor="#ffffff" style="background:#ffffff">
      <tr>
        <td align="center">
          <table role="presentation" class="container mail-canvas" width="612" cellpadding="0" cellspacing="0" bgcolor="#ffffff" style="width:612px;max-width:100%;background:#ffffff">
            <tr>
              <td class="mail-canvas" style="padding:0;line-height:0;font-size:0;background:#ffffff">
                <img class="header-light" src="${mailAsset("header-light.png")}" width="612" height="156" alt="Cirqoo After Hours" style="display:block;width:100%;max-width:612px;height:auto;border:0">
                <img class="header-dark" src="${mailAsset("header-dark.png")}" width="612" height="156" alt="" style="display:none;width:100%;max-width:612px;height:auto;border:0">
              </td>
            </tr>
            <tr>
              <td class="mail-pad" style="padding:8px 39px 40px">
                ${input.body}
              </td>
            </tr>
            <tr>
              <td>${footer()}</td>
            </tr>
          </table>
        </td>
      </tr>
    </table>
  </body>
</html>`;
}
