import "server-only";

import { randomBytes } from "node:crypto";

const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function newTicketCode() {
  const bytes = randomBytes(12);
  let code = "CRQ-";
  for (const byte of bytes) code += alphabet[byte % alphabet.length];
  return code;
}

export function nairaToKobo(naira: number) {
  return naira * 100;
}

export function koboToNaira(kobo: number) {
  return Math.round(kobo / 100);
}
