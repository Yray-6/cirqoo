export const sessionCookie = "cirqoo_session";
export const holdCookie = "cirqoo_hold";
const sessionMs = 12 * 60 * 60 * 1000;

export type SessionRole = "admin" | "staff";

export type SessionClaims = {
  sub: string;
  role: SessionRole;
  exp: number;
  mcp: boolean;
};

const keys = new Map<string, Promise<CryptoKey>>();

function secret() {
  const value = process.env.SESSION_SECRET ?? "";
  if (value.length < 32) return null;
  return value;
}

function encode(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decode(value: string) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/");
  const pad = padded.length % 4 === 0 ? "" : "=".repeat(4 - (padded.length % 4));
  const binary = atob(padded + pad);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index);
  return bytes;
}

async function hmacKey(value: string) {
  const cached = keys.get(value);
  if (cached) return cached;
  const created = crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(value),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  keys.set(value, created);
  return created;
}

export function claimsFor(user: { id: string; role: SessionRole; mustChangePassword: boolean }): SessionClaims {
  return {
    sub: user.id,
    role: user.role,
    exp: Date.now() + sessionMs,
    mcp: user.mustChangePassword,
  };
}

export async function signSession(claims: SessionClaims) {
  const keyMaterial = secret();
  if (!keyMaterial) throw new Error("SESSION_SECRET is missing.");
  const payload = encode(new TextEncoder().encode(JSON.stringify(claims)));
  const signature = await crypto.subtle.sign("HMAC", await hmacKey(keyMaterial), new TextEncoder().encode(payload));
  return `${payload}.${encode(new Uint8Array(signature))}`;
}

export async function verifySession(token: string | undefined | null): Promise<SessionClaims | null> {
  const keyMaterial = secret();
  if (!keyMaterial || !token) return null;
  const [payload, signature] = token.split(".");
  if (!payload || !signature) return null;
  const valid = await crypto.subtle.verify(
    "HMAC",
    await hmacKey(keyMaterial),
    decode(signature),
    new TextEncoder().encode(payload),
  );
  if (!valid) return null;
  try {
    const claims = JSON.parse(new TextDecoder().decode(decode(payload))) as SessionClaims;
    if (!claims.sub || (claims.role !== "admin" && claims.role !== "staff") || claims.exp < Date.now()) {
      return null;
    }
    return claims;
  } catch {
    return null;
  }
}

export function sessionCookieOptions() {
  const secure = (process.env.APP_ORIGIN ?? "").startsWith("https://");
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure,
    path: "/",
    maxAge: sessionMs / 1000,
  };
}
